/**
 * FU-51: Unit tests for the sales-agent FCM push-token registration helper
 * (T-162). Exercises the permission gate, the native→Expo token fallback,
 * the BFF POST payload, and the fire-and-forget unregister path.
 */
jest.mock('react-native', () => ({ Platform: { OS: 'android', Version: 34 } }))
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  getDevicePushTokenAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}))
jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.2.3',
  nativeBuildVersion: '45',
}))

import * as Notifications from 'expo-notifications'
import { registerSalesAgentPushToken, unregisterPushToken } from './pushTokenRegistration'

const mockPerm = Notifications.getPermissionsAsync as jest.Mock
const mockNative = Notifications.getDevicePushTokenAsync as jest.Mock
const mockExpo = Notifications.getExpoPushTokenAsync as jest.Mock

const mockFetch = jest.fn()
;(globalThis as unknown as { fetch: jest.Mock }).fetch = mockFetch

function res(status: number, body = '') {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
  }
}

const opts = {
  authToken: 'tok', tenantId: 'tenant-1',
  territoryIds: ['terr-1', 'terr-2'], gateway: 'http://gw',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockFetch.mockResolvedValue(res(200))
})

describe('registerSalesAgentPushToken', () => {
  it('bails out with no-permission when notifications are not granted', async () => {
    mockPerm.mockResolvedValue({ status: 'denied' })
    const out = await registerSalesAgentPushToken(opts)
    expect(out).toEqual({ pushToken: null, registered: false, reason: 'no-permission' })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('uses the native device token and POSTs it to the BFF', async () => {
    mockPerm.mockResolvedValue({ status: 'granted' })
    mockNative.mockResolvedValue({ data: 'native-fcm-token' })
    const out = await registerSalesAgentPushToken(opts)

    expect(out).toEqual({ pushToken: 'native-fcm-token', registered: true })
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('http://gw/bff/v1/sales-agent/push-token')
    expect(init.method).toBe('POST')
    expect(init.headers['X-Tenant-Id']).toBe('tenant-1')
    expect(init.headers['Authorization']).toBe('Bearer tok')
    const body = JSON.parse(init.body)
    expect(body.pushToken).toBe('native-fcm-token')
    expect(body.platform).toBe('android')
    expect(body.territoryIds).toEqual(['terr-1', 'terr-2'])
    expect(body.appVersion).toBe('1.2.3+45')
  })

  it('falls back to the Expo token when the native token is unavailable', async () => {
    mockPerm.mockResolvedValue({ status: 'granted' })
    mockNative.mockResolvedValue(null)
    mockExpo.mockResolvedValue({ data: 'expo-token' })
    const out = await registerSalesAgentPushToken(opts)
    expect(out.pushToken).toBe('expo-token')
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).platform).toBe('expo')
  })

  it('reports token-fetch-failed when the Expo fallback throws', async () => {
    mockPerm.mockResolvedValue({ status: 'granted' })
    mockNative.mockResolvedValue(null)
    mockExpo.mockRejectedValue(new Error('FCM unreachable'))
    const out = await registerSalesAgentPushToken(opts)
    expect(out.registered).toBe(false)
    expect(out.reason).toContain('token-fetch-failed')
  })

  it('reports a bff-<status> reason when the BFF rejects the registration', async () => {
    mockPerm.mockResolvedValue({ status: 'granted' })
    mockNative.mockResolvedValue({ data: 'native-token' })
    mockFetch.mockResolvedValue(res(409, 'duplicate'))
    const out = await registerSalesAgentPushToken(opts)
    expect(out.registered).toBe(false)
    expect(out.reason).toContain('bff-409')
  })

  it('reports a network reason when the BFF call throws', async () => {
    mockPerm.mockResolvedValue({ status: 'granted' })
    mockNative.mockResolvedValue({ data: 'native-token' })
    mockFetch.mockRejectedValue(new Error('socket hang up'))
    const out = await registerSalesAgentPushToken(opts)
    expect(out.registered).toBe(false)
    expect(out.reason).toContain('network')
  })

  it('treats a permission-check throw as denied', async () => {
    mockPerm.mockRejectedValue(new Error('permission API crashed'))
    const out = await registerSalesAgentPushToken(opts)
    expect(out.reason).toBe('no-permission')
  })
})

describe('unregisterPushToken', () => {
  it('DELETEs the token at the BFF endpoint', async () => {
    await unregisterPushToken('the-token', { authToken: 'tok', tenantId: 't-1', gateway: 'http://gw' })
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('http://gw/bff/v1/sales-agent/push-token/the-token')
    expect(init.method).toBe('DELETE')
    expect(init.headers['X-Tenant-Id']).toBe('t-1')
  })

  it('swallows network errors so logout is never blocked', async () => {
    mockFetch.mockRejectedValue(new Error('offline'))
    await expect(
      unregisterPushToken('t', { authToken: 'a', tenantId: 'x' }),
    ).resolves.toBeUndefined()
  })
})
