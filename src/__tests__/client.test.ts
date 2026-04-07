/**
 * Tests for API client — sales-agent-mobile.
 * Validates token handling, auth headers, error responses, and 204 support.
 */
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }))

jest.mock('expo-secure-store', () => ({
  getItemAsync:    jest.fn(),
  setItemAsync:    jest.fn(),
  deleteItemAsync: jest.fn(),
}))

import * as SecureStore from 'expo-secure-store'

const mockGetItem = SecureStore.getItemAsync as jest.Mock
const mockFetch   = jest.fn()
;(globalThis as any).fetch = mockFetch

// Dynamic import so mocks are registered first
let api: typeof import('../api/client')['api']
let ApiError: typeof import('../api/client')['ApiError']

beforeAll(async () => {
  const mod = await import('../api/client')
  api = mod.api
  ApiError = mod.ApiError
})

function mockRes(status: number, body: unknown) {
  return {
    ok:         status >= 200 && status < 300,
    status,
    json:       () => Promise.resolve(body),
    text:       () => Promise.resolve(JSON.stringify(body)),
    statusText: `HTTP ${status}`,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetItem.mockResolvedValue(null)
})

// -- Happy path ---------------------------------------------------------------

describe('api.get', () => {
  it('returns parsed JSON on 200', async () => {
    mockGetItem.mockResolvedValue('access-token')
    mockFetch.mockResolvedValueOnce(mockRes(200, { id: '42' }))

    const result = await api.get<{ id: string }>('/v1/test')
    expect(result).toEqual({ id: '42' })
  })

  it('sends Authorization header when token present', async () => {
    mockGetItem.mockResolvedValue('agent-token-123')
    mockFetch.mockResolvedValueOnce(mockRes(200, {}))

    await api.get('/v1/test')

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer agent-token-123')
  })

  it('omits Authorization header when no token', async () => {
    mockGetItem.mockResolvedValue(null)
    mockFetch.mockResolvedValueOnce(mockRes(200, {}))

    await api.get('/v1/test')

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((opts.headers as Record<string, string>)['Authorization']).toBeUndefined()
  })

  it('reads from ble_sales_agent_token key', async () => {
    mockFetch.mockResolvedValueOnce(mockRes(200, {}))
    await api.get('/v1/test')
    expect(mockGetItem).toHaveBeenCalledWith('ble_sales_agent_token')
  })

  it('returns undefined on 204', async () => {
    mockGetItem.mockResolvedValue(null)
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 204,
      json: () => { throw new Error('no body') },
      text: () => Promise.resolve(''),
      statusText: '',
    })

    const result = await api.get('/v1/test')
    expect(result).toBeUndefined()
  })
})

// -- Error handling -----------------------------------------------------------

describe('error handling', () => {
  it('throws ApiError with status on 4xx', async () => {
    mockGetItem.mockResolvedValue(null)
    mockFetch.mockResolvedValueOnce(mockRes(404, 'not found'))

    await expect(api.get('/v1/test')).rejects.toMatchObject({ status: 404 })
  })

  it('throws ApiError with status on 5xx', async () => {
    mockGetItem.mockResolvedValue(null)
    mockFetch.mockResolvedValueOnce(mockRes(500, 'server error'))

    await expect(api.get('/v1/test')).rejects.toMatchObject({ status: 500 })
  })

  it('ApiError is an instance of Error', () => {
    const err = new ApiError(400, 'bad request')
    expect(err).toBeInstanceOf(Error)
    expect(err.status).toBe(400)
    expect(err.message).toBe('bad request')
  })
})

// -- HTTP methods -------------------------------------------------------------

describe('api.post', () => {
  it('sends JSON body with POST method', async () => {
    mockGetItem.mockResolvedValue('tok')
    mockFetch.mockResolvedValueOnce(mockRes(201, { created: true }))

    const result = await api.post<{ created: boolean }>('/v1/items', { name: 'test' })
    expect(result).toEqual({ created: true })

    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(opts.method).toBe('POST')
    expect(opts.body).toBe(JSON.stringify({ name: 'test' }))
    expect((opts.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })
})

describe('api.put', () => {
  it('sends JSON body with PUT method', async () => {
    mockGetItem.mockResolvedValue('tok')
    mockFetch.mockResolvedValueOnce(mockRes(200, { updated: true }))

    await api.put('/v1/items/1', { name: 'updated' })

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(opts.method).toBe('PUT')
    expect(opts.body).toBe(JSON.stringify({ name: 'updated' }))
  })
})

describe('api.delete', () => {
  it('sends DELETE method without body', async () => {
    mockGetItem.mockResolvedValue('tok')
    mockFetch.mockResolvedValueOnce(mockRes(204, undefined))

    await api.delete('/v1/items/1')

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(opts.method).toBe('DELETE')
  })
})

// -- Gateway URL --------------------------------------------------------------

describe('gateway URL', () => {
  it('prefixes path with gateway base URL', async () => {
    mockGetItem.mockResolvedValue(null)
    mockFetch.mockResolvedValueOnce(mockRes(200, {}))

    await api.get('/v1/agents/me')

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/v1\/agents\/me$/)
  })
})
