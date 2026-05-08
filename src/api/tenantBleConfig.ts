/**
 * BCN-CFG-001 — read-only client for the tenant BLE detection threshold.
 *
 * Sales agents (SALES_AGENT role) display the soglia for context. Edits
 * happen in backoffice-tenant-web (TENANT_ADMIN role).
 *
 * Reference: BLE-project/ble-platform-docs#183
 */
import { api, ApiError } from './client'

export interface TenantBleConfig {
  id?: string
  tenantId: string
  /** Range (0.01, 50.00] — DB CHECK constraint. */
  beaconImmediateThresholdM: number
  updatedAt?: string
}

/**
 * Fetch the tenant BLE config. Returns `null` when the tenant has not yet
 * been configured (HTTP 404 → `TENANT_BLE_CONFIG_UNSET`).
 */
export async function fetchTenantBleConfig(): Promise<TenantBleConfig | null> {
  try {
    return await api.get<TenantBleConfig>('/api/v1/tenant-ble-config')
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null
    throw e
  }
}
