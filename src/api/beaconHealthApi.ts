/**
 * BCN-CFG-002 — typed wrappers for the beacon first-config flow APIs.
 *
 * Backend endpoints (terrio-core-registry):
 *   GET  /v1/merchants/{merchantId}/beacons    — list beacons assigned to a merchant
 *   POST /v1/beacon-health                     — persist scan snapshot + emit Kafka
 *
 * Reference: BLE-project/ble-platform-docs#186
 */
import { api } from './client'

export interface BeaconSummary {
  id:           string
  ibeaconUuid:  string
  major:        number
  minor:        number
  beaconType?:  string
  storeId?:     string
  storeName?:   string
}

export interface ScanResult {
  beaconId:     string
  detected:     boolean
  rssi?:        number
  batteryLevel?: number
  pass:         boolean
}

export interface BeaconHealthRequest {
  merchantId:   string
  scanResults:  ScanResult[]
}

export interface BeaconHealthResponse {
  healthSnapshotId: string
}

export function fetchMerchantBeacons(merchantId: string): Promise<BeaconSummary[]> {
  return api.get<BeaconSummary[]>(`/api/v1/merchants/${encodeURIComponent(merchantId)}/beacons`)
}

export function submitBeaconHealth(req: BeaconHealthRequest): Promise<BeaconHealthResponse> {
  return api.post<BeaconHealthResponse>('/api/v1/beacon-health', req)
}
