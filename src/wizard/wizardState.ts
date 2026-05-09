/**
 * BCN-CFG-002 — in-memory state shared across the 4 wizard screens.
 *
 * Kept deliberately tiny (module-level mutable singleton) to avoid a
 * Context/Provider for a 4-step linear flow. Each screen reads/writes
 * through the exported helpers; resetWizard() runs at the entry button
 * in app/(app)/beacon-config.tsx.
 *
 * Reference: BLE-project/ble-platform-docs#186
 */
import type { BeaconSummary, ScanResult } from '../api/beaconHealthApi'

export interface WizardState {
  merchantId:    string | null
  merchantName:  string | null
  beacons:       BeaconSummary[]
  scanResults:   ScanResult[]
  snapshotId:    string | null
}

const _state: WizardState = {
  merchantId:    null,
  merchantName:  null,
  beacons:       [],
  scanResults:   [],
  snapshotId:    null,
}

export function getWizardState(): WizardState {
  return _state
}

export function setMerchant(id: string, name: string): void {
  _state.merchantId   = id
  _state.merchantName = name
  _state.beacons      = []
  _state.scanResults  = []
  _state.snapshotId   = null
}

export function setBeacons(beacons: BeaconSummary[]): void {
  _state.beacons = beacons
}

export function setScanResults(results: ScanResult[]): void {
  _state.scanResults = results
}

export function upsertScanResult(r: ScanResult): void {
  const i = _state.scanResults.findIndex(s => s.beaconId === r.beaconId)
  if (i >= 0) _state.scanResults[i] = r
  else _state.scanResults.push(r)
}

export function setSnapshotId(id: string | null): void {
  _state.snapshotId = id
}

export function resetWizard(): void {
  _state.merchantId   = null
  _state.merchantName = null
  _state.beacons      = []
  _state.scanResults  = []
  _state.snapshotId   = null
}
