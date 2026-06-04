/**
 * BCN-MAP-001 Phase 2 — typed wrapper for the beacon GPS capture endpoint.
 *
 * Backend: POST /api/v1/beacons/{beaconId}/gps-capture (terrio-core-registry V29).
 * Roles: SALES_AGENT, MERCHANT_USER, TENANT_ADMIN.
 *
 * Reference: BLE-project/ble-platform-docs#185
 */
import { api } from './client'

export interface GpsCaptureRequest {
  latitude:  number
  longitude: number
}

export interface GpsCaptureResponse {
  beaconId:           string
  latitude:           number
  longitude:          number
  gpsCapturedAt:      string
  gpsCapturedByActor: string
}

export function captureBeaconGps(
  beaconId: string,
  payload: GpsCaptureRequest,
): Promise<GpsCaptureResponse> {
  return api.post<GpsCaptureResponse>(
    `/api/v1/beacons/${encodeURIComponent(beaconId)}/gps-capture`,
    payload,
  )
}
