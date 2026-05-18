/**
 * FU-51: Unit tests for the auxiliary beacon API clients —
 * beaconHealthApi (BCN-CFG-002), beaconGpsApi (BCN-MAP-001), and
 * tenantBleConfig (BCN-CFG-001).
 *
 * Covers verb + path + body wiring plus the 404→null fallback that
 * fetchTenantBleConfig() relies on.
 */
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }))

jest.mock('expo-secure-store', () => ({
  getItemAsync:    jest.fn().mockResolvedValue('agent-token'),
  setItemAsync:    jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../auth/AuthContext', () => ({
  TOKEN_KEY:   'ble_sales_agent_token',
  REFRESH_KEY: 'ble_sales_agent_refresh_token',
}))

import { fetchMerchantBeacons, submitBeaconHealth } from '../api/beaconHealthApi'
import { captureBeaconGps } from '../api/beaconGpsApi'
import { fetchTenantBleConfig } from '../api/tenantBleConfig'

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
  mockFetch.mockResolvedValue(res(200, {}))
})

describe('beaconHealthApi.fetchMerchantBeacons', () => {
  it('GETs the merchant beacons sub-resource', async () => {
    mockFetch.mockResolvedValueOnce(res(200, [{ id: 'b-1', ibeaconUuid: 'u', major: 1, minor: 1 }]))
    const beacons = await fetchMerchantBeacons('merch-1')
    expect(beacons).toHaveLength(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/merchants/merch-1/beacons')
    expect(init.method).toBe('GET')
  })

  it('URL-encodes the merchantId path segment', async () => {
    await fetchMerchantBeacons('merch /weird?id')
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('merch%20%2Fweird%3Fid')
  })
})

describe('beaconHealthApi.submitBeaconHealth', () => {
  it('POSTs the scan snapshot to /api/v1/beacon-health', async () => {
    mockFetch.mockResolvedValueOnce(res(200, { healthSnapshotId: 'snap-1' }))
    const out = await submitBeaconHealth({
      merchantId: 'm-1',
      scanResults: [{ beaconId: 'b-1', detected: true, rssi: -55, pass: true }],
    })
    expect(out.healthSnapshotId).toBe('snap-1')
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/beacon-health')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body).merchantId).toBe('m-1')
  })
})

describe('beaconGpsApi.captureBeaconGps', () => {
  it('POSTs lat/lng to the beacon /gps sub-resource', async () => {
    mockFetch.mockResolvedValueOnce(res(200, {
      beaconId: 'b-1', latitude: 45.07, longitude: 7.68,
      gpsCapturedAt: '2026-05-18T10:00:00Z', gpsCapturedByActor: 'agent',
    }))
    const out = await captureBeaconGps('b-1', { latitude: 45.07, longitude: 7.68 })
    expect(out.beaconId).toBe('b-1')
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/beacons/b-1/gps')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ latitude: 45.07, longitude: 7.68 })
  })

  it('URL-encodes the beaconId path segment', async () => {
    await captureBeaconGps('b /1', { latitude: 0, longitude: 0 })
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('b%20%2F1/gps')
  })
})

describe('tenantBleConfig.fetchTenantBleConfig', () => {
  it('returns the config object on a 200', async () => {
    mockFetch.mockResolvedValueOnce(res(200, {
      tenantId: 't-1', beaconImmediateThresholdM: 2.5,
    }))
    const cfg = await fetchTenantBleConfig()
    expect(cfg).toEqual({ tenantId: 't-1', beaconImmediateThresholdM: 2.5 })
  })

  it('returns null when the tenant has no config (404)', async () => {
    mockFetch.mockResolvedValueOnce(res(404, 'TENANT_BLE_CONFIG_UNSET'))
    await expect(fetchTenantBleConfig()).resolves.toBeNull()
  })

  it('rethrows non-404 errors', async () => {
    mockFetch.mockResolvedValueOnce(res(500, 'server error'))
    await expect(fetchTenantBleConfig()).rejects.toMatchObject({ status: 500 })
  })
})
