/**
 * FU-51: Unit tests for the BLE beacon health-check helper (§9).
 *
 * react-native-ble-plx is not bundled in stub builds, so scanBeacons()
 * falls back to a dev fixture. These tests exercise that fixture path,
 * the production-build error path, and the summarise() reducer.
 */
import {
  scanBeacons,
  summarise,
  BEACON_HEALTH_THRESHOLDS,
  type BeaconCheckTarget,
  type BeaconCheckResult,
} from './BeaconHealthCheck'

const targets: BeaconCheckTarget[] = [
  { code: 'H-01', label: 'Ingresso', uuid: 'u1', major: 1, minor: 1 },
  { code: 'H-02', label: 'Cassa',    uuid: 'u2', major: 1, minor: 2 },
]

const result = (pass: boolean): BeaconCheckResult => ({
  code: 'H', label: 'L', detected: pass,
  rssi: pass ? -50 : null, batteryLevel: pass ? 90 : null,
  pass, reason: '',
})

describe('scanBeacons — ble-plx absent', () => {
  it('returns a dev fixture for every target when __DEV__ is true', async () => {
    const g = globalThis as unknown as { __DEV__?: boolean }
    const prev = g.__DEV__
    g.__DEV__ = true
    try {
      const out = await scanBeacons(targets, 50)
      expect(out).toHaveLength(2)
      expect(out.every(r => r.detected && r.pass)).toBe(true)
      expect(out[0].code).toBe('H-01')
      expect(out[0].reason).toContain('dev fixture')
    } finally {
      g.__DEV__ = prev
    }
  })

  it('throws a KI-S56-03 error in a production build (__DEV__ false)', async () => {
    const g = globalThis as unknown as { __DEV__?: boolean }
    const prev = g.__DEV__
    g.__DEV__ = false
    try {
      await expect(scanBeacons(targets, 50)).rejects.toThrow('react-native-ble-plx')
    } finally {
      g.__DEV__ = prev
    }
  })
})

describe('summarise', () => {
  it('counts an all-pass batch', () => {
    expect(summarise([result(true), result(true)])).toEqual({
      total: 2, passed: 2, failed: 0, allOk: true,
    })
  })

  it('counts a mixed batch', () => {
    expect(summarise([result(true), result(false), result(false)])).toEqual({
      total: 3, passed: 1, failed: 2, allOk: false,
    })
  })

  it('treats an empty batch as vacuously all-ok', () => {
    expect(summarise([])).toEqual({ total: 0, passed: 0, failed: 0, allOk: true })
  })
})

describe('BEACON_HEALTH_THRESHOLDS', () => {
  it('exposes the documented RSSI + battery thresholds', () => {
    expect(BEACON_HEALTH_THRESHOLDS.MIN_RSSI_DBM).toBe(-80)
    expect(BEACON_HEALTH_THRESHOLDS.MIN_BATTERY_PCT).toBe(15)
  })
})
