/**
 * Tests for API client — sales-agent-mobile.
 * Validates token handling, auth headers, error responses, and 204 support.
 *
 * M1.3b additions: 401 → refresh → retry path tests (REFRESH_KEY storage,
 * BFF /api/v1/auth/refresh response handling, SEC-FIX-008 backoff,
 * setOnLogout callback invocation on refresh failure).
 */
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }))

// M1.3b: setItemAsync now returns a resolved promise so production code
// which does `setItemAsync(...).catch(() => {})` doesn't trip on
// undefined.catch() at runtime.
jest.mock('expo-secure-store', () => ({
  getItemAsync:    jest.fn(),
  setItemAsync:    jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))

// M1.3b: client.ts imports TOKEN_KEY + REFRESH_KEY from AuthContext.tsx
// — mock the module so loading AuthContext doesn't pull React + the entire
// notifications / expo-asset chain into the test runtime.
jest.mock('../auth/AuthContext', () => ({
  TOKEN_KEY:   'ble_sales_agent_token',
  REFRESH_KEY: 'ble_sales_agent_refresh_token',
}))

import * as SecureStore from 'expo-secure-store'
import { api, ApiError, setOnLogout, _resetRefreshState } from '../api/client'

const mockGetItem = SecureStore.getItemAsync as jest.Mock
const mockSetItem = SecureStore.setItemAsync as jest.Mock
const mockFetch   = jest.fn()
;(globalThis as any).fetch = mockFetch

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

// ── M1.3b: 401 → refresh → retry path ───────────────────────────────────────

describe('api 401 → refresh → retry (M1.3b)', () => {
  const TOKEN_KEY   = 'ble_sales_agent_token'
  const REFRESH_KEY = 'ble_sales_agent_refresh_token'

  beforeEach(() => {
    jest.clearAllMocks()
    // Re-arm the resolved-undefined behaviour after .clearAllMocks() — production
    // calls .catch() on the return value, which fails on plain undefined.
    mockSetItem.mockResolvedValue(undefined)
    _resetRefreshState()
  })

  function mockSecureStore(items: Record<string, string | null>): void {
    mockGetItem.mockImplementation((key: string) => Promise.resolve(items[key] ?? null))
  }

  it('refreshes the token on 401 and retries the original request', async () => {
    mockSecureStore({ [TOKEN_KEY]: 'old-access', [REFRESH_KEY]: 'r-old' })
    mockFetch
      .mockResolvedValueOnce(mockRes(401, 'expired'))
      .mockResolvedValueOnce(mockRes(200, { token: 'fresh-access', refreshToken: 'fresh-refresh' }))
      .mockResolvedValueOnce(mockRes(200, { ok: true }))

    const result = await api.get<{ ok: boolean }>('/v1/agents/me')

    expect(result).toEqual({ ok: true })
    expect(mockFetch).toHaveBeenCalledTimes(3)
    // Call 2 was the refresh
    expect(String(mockFetch.mock.calls[1][0])).toContain('/api/v1/auth/refresh')
    // Call 3 was the retry, with the fresh token
    const retryHeaders = (mockFetch.mock.calls[2][1] as RequestInit).headers as Record<string, string>
    expect(retryHeaders['Authorization']).toBe('Bearer fresh-access')
    // SecureStore should have been updated with the new tokens
    expect(mockSetItem).toHaveBeenCalledWith(TOKEN_KEY,   'fresh-access')
    expect(mockSetItem).toHaveBeenCalledWith(REFRESH_KEY, 'fresh-refresh')
  })

  it('accepts snake_case refresh response shape (proxy-translated)', async () => {
    mockSecureStore({ [TOKEN_KEY]: 'old-access', [REFRESH_KEY]: 'r-old' })
    mockFetch
      .mockResolvedValueOnce(mockRes(401, ''))
      .mockResolvedValueOnce(mockRes(200, { access_token: 'snake-access', refresh_token: 'snake-refresh' }))
      .mockResolvedValueOnce(mockRes(200, {}))

    await api.get('/x')
    expect(mockSetItem).toHaveBeenCalledWith(TOKEN_KEY,   'snake-access')
    expect(mockSetItem).toHaveBeenCalledWith(REFRESH_KEY, 'snake-refresh')
  })

  it('falls back to ApiError(401) and invokes onLogout when no refresh token is stored', async () => {
    mockSecureStore({ [TOKEN_KEY]: 'old-access', [REFRESH_KEY]: null })
    const onLogout = jest.fn()
    setOnLogout(onLogout)
    mockFetch.mockResolvedValueOnce(mockRes(401, ''))

    await expect(api.get('/x')).rejects.toMatchObject({ name: 'ApiError', status: 401 })
    expect(onLogout).toHaveBeenCalled()
  })

  it('falls back to ApiError(401) and invokes onLogout when the refresh endpoint returns 401', async () => {
    mockSecureStore({ [TOKEN_KEY]: 'old-access', [REFRESH_KEY]: 'r-old' })
    const onLogout = jest.fn()
    setOnLogout(onLogout)
    mockFetch
      .mockResolvedValueOnce(mockRes(401, ''))
      .mockResolvedValueOnce(mockRes(401, ''))

    await expect(api.get('/x')).rejects.toMatchObject({ name: 'ApiError', status: 401 })
    expect(onLogout).toHaveBeenCalled()
  })

  it('SEC-FIX-008: enforces 5s backoff after a refresh failure', async () => {
    mockSecureStore({ [TOKEN_KEY]: 'old-access', [REFRESH_KEY]: 'r-old' })
    setOnLogout(jest.fn())

    // First 401 → refresh fails → records lastRefreshFailureMs
    mockFetch
      .mockResolvedValueOnce(mockRes(401, ''))
      .mockResolvedValueOnce(mockRes(401, ''))
    await expect(api.get('/x')).rejects.toBeInstanceOf(ApiError)

    // Second request immediately after — should fast-fail without hitting refresh
    mockFetch.mockResolvedValueOnce(mockRes(401, ''))
    const callsBefore = mockFetch.mock.calls.length
    await expect(api.get('/y')).rejects.toMatchObject({ name: 'ApiError', status: 401 })
    // Only 1 additional fetch (the original /y), no refresh attempt
    expect(mockFetch.mock.calls.length - callsBefore).toBe(1)
  })

  it('coalesces concurrent 401s into a single refresh roundtrip', async () => {
    mockSecureStore({ [TOKEN_KEY]: 'old-access', [REFRESH_KEY]: 'r-old' })

    mockFetch
      // 3 initial requests → 401
      .mockResolvedValueOnce(mockRes(401, ''))
      .mockResolvedValueOnce(mockRes(401, ''))
      .mockResolvedValueOnce(mockRes(401, ''))
      // 1 refresh
      .mockResolvedValueOnce(mockRes(200, { token: 'fresh', refreshToken: 'fresh-r' }))
      // 3 retries → 200
      .mockResolvedValueOnce(mockRes(200, { id: 'a' }))
      .mockResolvedValueOnce(mockRes(200, { id: 'b' }))
      .mockResolvedValueOnce(mockRes(200, { id: 'c' }))

    const [a, b, c] = await Promise.all([
      api.get<{ id: string }>('/a'),
      api.get<{ id: string }>('/b'),
      api.get<{ id: string }>('/c'),
    ])
    expect([a.id, b.id, c.id].sort()).toEqual(['a', 'b', 'c'])

    // Refresh must have been called exactly once
    const refreshCalls = mockFetch.mock.calls.filter(([url]) => String(url).includes('/api/v1/auth/refresh'))
    expect(refreshCalls).toHaveLength(1)
  })
})
