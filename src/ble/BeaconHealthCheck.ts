/**
 * §9 — Sales agent BLE first-config health check helper.
 *
 * Wraps react-native-ble-plx discovery to measure RSSI + battery level
 * for a known list of beacons. Returns per-beacon pass/fail with rationale.
 *
 * NOTE: Requires ble-plx dev-client (KI-S56-03 dependency). Until the plugin
 * is wired into the sales-agent APK this helper is exported but unused by the
 * UI screen — the screen mocks data via __DEV__ fixture when BleManager is
 * absent.
 */

export interface BeaconCheckTarget {
  code:        string   // e.g. "H-01"
  label:       string   // e.g. "Ingresso"
  uuid:        string
  major:       number
  minor:       number
}

export interface BeaconCheckResult {
  code:         string
  label:        string
  detected:     boolean
  rssi:         number | null
  batteryLevel: number | null
  pass:         boolean
  reason:       string
}

const MIN_RSSI_DBM  = -80
const MIN_BATTERY_PCT = 15

export async function scanBeacons(
  targets: BeaconCheckTarget[],
  timeoutMs = 15_000,
): Promise<BeaconCheckResult[]> {
  // Dynamic import — plug-in may be absent in stub builds.
  let BleManager: { new(): unknown } | null = null
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    BleManager = require('react-native-ble-plx').BleManager
  } catch {
    // ble-plx not available: return fixture for dev smoke
    if (__DEV__) {
      return targets.map((t) => ({
        code:         t.code,
        label:        t.label,
        detected:     true,
        rssi:         -55,
        batteryLevel: 87,
        pass:         true,
        reason:       '[dev fixture] ble-plx unavailable, mocking detection',
      }))
    }
    throw new Error('react-native-ble-plx non disponibile (KI-S56-03)')
  }

  // Real scan path — implementation is intentionally minimal here;
  // the full scan requires background services and is delegated to
  // the native SDK module once ble-plx is bundled.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const manager = new (BleManager as any)()
  const results: BeaconCheckResult[] = []

  for (const t of targets) {
    try {
      // Placeholder scan result builder (manager.startDeviceScan API is async-callback
      // based; converting to a per-target Promise.race is the typical pattern).
      results.push({
        code:         t.code,
        label:        t.label,
        detected:     false,
        rssi:         null,
        batteryLevel: null,
        pass:         false,
        reason:       'Not scanned (stub)',
      })
    } catch (e) {
      results.push({
        code: t.code, label: t.label, detected: false,
        rssi: null, batteryLevel: null, pass: false,
        reason: `Scan error: ${(e as Error).message}`,
      })
    }
  }
  await new Promise((r) => setTimeout(r, Math.min(timeoutMs, 1000)))
  return results
}

export function summarise(results: BeaconCheckResult[]) {
  const passed = results.filter((r) => r.pass).length
  return {
    total:  results.length,
    passed,
    failed: results.length - passed,
    allOk:  passed === results.length,
  }
}

export const BEACON_HEALTH_THRESHOLDS = {
  MIN_RSSI_DBM,
  MIN_BATTERY_PCT,
}
