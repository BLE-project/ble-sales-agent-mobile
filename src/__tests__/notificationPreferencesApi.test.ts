/**
 * FU-51: Unit tests for notificationPreferencesApi — sales-agent mobile (§7.3).
 *
 * Covers:
 *  - list() GETs /api/v1/notifications/preferences
 *  - update() PUTs the prefs array, forcing mandatory:null per row
 *  - bearer token injection (and omission when absent)
 *  - non-ok responses surface as Error with the status code
 *  - 204 responses resolve to undefined
 */
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }))

const mockGetItem = jest.fn()
jest.mock('expo-secure-store', () => ({
  getItemAsync:    (...a: unknown[]) => mockGetItem(...a),
  setItemAsync:    jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))

import { notificationPreferencesApi } from '../api/notificationPreferencesApi'

const mockFetch = jest.fn()
;(globalThis as unknown as { fetch: jest.Mock }).fetch = mockFetch

function res(status: number, body: unknown) {
  return {
    ok:         status >= 200 && status < 300,
    status,
    json:       () => Promise.resolve(body),
    text:       () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
    statusText: `HTTP ${status}`,
  }
}

beforeEach(() => {
  mockFetch.mockReset()
  mockGetItem.mockReset()
  mockGetItem.mockResolvedValue('agent-token')
  mockFetch.mockResolvedValue(res(200, []))
})

describe('notificationPreferencesApi.list', () => {
  it('GETs the preferences endpoint with the bearer token', async () => {
    mockFetch.mockResolvedValueOnce(res(200, [{ appId: 'sales', channelId: 'kit-shipment', enabled: true, mandatory: null }]))
    const rows = await notificationPreferencesApi.list()
    expect(rows).toHaveLength(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/notifications/preferences')
    expect(init.method).toBe('GET')
    expect(init.headers['Authorization']).toBe('Bearer agent-token')
  })

  it('omits the Authorization header when no token is stored', async () => {
    mockGetItem.mockResolvedValueOnce(null)
    mockFetch.mockResolvedValueOnce(res(200, []))
    await notificationPreferencesApi.list()
    const [, init] = mockFetch.mock.calls[0]
    expect(init.headers.Authorization).toBeUndefined()
  })

  it('treats a SecureStore failure as "no token" rather than crashing', async () => {
    mockGetItem.mockRejectedValueOnce(new Error('keychain locked'))
    mockFetch.mockResolvedValueOnce(res(200, []))
    await expect(notificationPreferencesApi.list()).resolves.toEqual([])
    const [, init] = mockFetch.mock.calls[0]
    expect(init.headers.Authorization).toBeUndefined()
  })

  it('throws an Error carrying the status on a non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(res(500, 'boom'))
    await expect(notificationPreferencesApi.list()).rejects.toThrow('[500]')
  })
})

describe('notificationPreferencesApi.update', () => {
  it('PUTs the prefs array, forcing mandatory:null on every row', async () => {
    mockFetch.mockResolvedValueOnce(res(200, { updated: 2, clamped_always_on: 1 }))
    const out = await notificationPreferencesApi.update([
      { appId: 'sales', channelId: 'kit-shipment', enabled: true },
      { appId: 'sales', channelId: 'royalty-credit', enabled: false },
    ])
    expect(out).toEqual({ updated: 2, clamped_always_on: 1 })

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/notifications/preferences')
    expect(init.method).toBe('PUT')
    const sent = JSON.parse(init.body)
    expect(sent).toEqual([
      { appId: 'sales', channelId: 'kit-shipment', enabled: true, mandatory: null },
      { appId: 'sales', channelId: 'royalty-credit', enabled: false, mandatory: null },
    ])
  })

  it('resolves to undefined on a 204 response', async () => {
    mockFetch.mockResolvedValueOnce(res(204, ''))
    await expect(notificationPreferencesApi.update([])).resolves.toBeUndefined()
  })
})
