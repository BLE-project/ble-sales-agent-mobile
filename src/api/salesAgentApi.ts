import { api } from './client'

export interface RegistrationRequest {
  id: string
  businessName: string
  ownerName: string
  email: string
  phone: string
  businessType: string
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED'
  notes: string | null
  createdAt: string
  territoryId?: string
}

export interface KitDelivery {
  id: string
  agentId: string
  registrationRequestId: string
  storeId: string | null
  status: 'PREPARING' | 'SHIPPED' | 'DELIVERED'
  items: string
  trackingNumber: string | null
  carrier: string | null
  notes: string | null
  deliveredAt: string | null
  createdAt: string
}

export interface SalesAgent {
  id: string
  keycloakUserId: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  fiscalType: 'VAT' | 'INDIVIDUAL'
  vatNumber: string | null
  taxCode: string | null
  royaltyPercent: number
  fixedFeeCents: number
  active: boolean
  createdAt: string
}

export interface AgentRoyalty {
  id: string
  agentId: string
  periodMonth: string
  totalMerchantVolumeCents: number
  royaltyCents: number
  fixedFeeCents: number
  totalPayoutCents: number
  royaltyPercentSnapshot: number
  status: 'DRAFT' | 'CONFIRMED' | 'PAID'
  paymentReference: string | null
  paidAt: string | null
  calculatedAt: string
}

export const registrationRequestsApi = {
  list: (status?: string) => {
    const qs = status ? `?status=${status}` : ''
    return api.get<RegistrationRequest[]>(`/api/v1/registration-requests${qs}`)
  },
  updateStatus: (id: string, status: string, notes?: string) =>
    api.put<RegistrationRequest>(`/api/v1/registration-requests/${id}/status`, { status, notes }),
}

export const kitDeliveryApi = {
  list: (agentId?: string) => {
    const qs = agentId ? `?agentId=${agentId}` : ''
    return api.get<KitDelivery[]>(`/api/v1/kit-deliveries${qs}`)
  },
  create: (req: Partial<KitDelivery>) =>
    api.post<KitDelivery>('/api/v1/kit-deliveries', req),
  updateStatus: (id: string, status: string, data?: Partial<KitDelivery>) =>
    api.put<KitDelivery>(`/api/v1/kit-deliveries/${id}/status`, { status, ...data }),
}

export const salesAgentProfileApi = {
  getById: (id: string) => api.get<SalesAgent>(`/api/v1/sales-agents/${id}`),
  getAssignments: (id: string) => api.get<unknown[]>(`/api/v1/sales-agents/${id}/assignments`),
}

export const royaltiesApi = {
  list: (agentId?: string) => {
    const qs = agentId ? `?agentId=${agentId}` : ''
    return api.get<AgentRoyalty[]>(`/api/v1/agent-royalties${qs}`)
  },
}

// ── FEAT-S45-001 + Fase 3.0b: Beacon Management ──────────────────────────────

// Must stay aligned with src/main/java/com/ble/core/beacon/BeaconType.java —
// backend @Enumerated(EnumType.STRING) rejects any value outside this union
// with a 400. Fase 3.1 fixup: removed the stale 'INFO' and 'ENTRANCE' values
// that were never in the Java enum and would have caused failed enrolments
// from the field.
export type BeaconType = 'TRACKING' | 'MERCHANT' | 'TOURIST_INFO'

export interface BeaconEnrollRequest {
  territoryId: string
  type: BeaconType
  ibeaconUuid: string
  major: number
  minor: number
  name?: string
  password?: string
  txPower?: number
  assignedToStoreId?: string
  assignedToZoneId?: string
}

export interface BeaconSummary {
  id: string
  tenantId: string
  territoryId: string
  name: string | null
  ibeaconUuid: string
  major: number
  minor: number
  type: BeaconType
  status: string
  enrolledBy: string | null
  enrolledAt: string | null
  txPower?: number | null
  assignedToStoreId?: string | null
  assignedToZoneId?: string | null
}

/**
 * Fase 3.0b: request body for PUT /v1/beacons/{id}.
 * Matches the BeaconRequest record on the backend, including the fields the
 * mobile app does not normally touch (txPower, assignments).
 */
export interface BeaconConfigUpdate {
  territoryId: string
  type: BeaconType
  ibeaconUuid: string
  major: number
  minor: number
  txPower?: number | null
  assignedToStoreId?: string | null
  assignedToZoneId?: string | null
}

export const beaconApi = {
  /** Enroll (create) a new beacon. Requires SALES_AGENT or SUPER_ADMIN. */
  enroll: (req: BeaconEnrollRequest) =>
    api.post<BeaconSummary>('/api/v1/beacons', req),

  /** List beacons for the current tenant context. */
  list: () =>
    api.get<BeaconSummary[]>('/api/v1/beacons'),

  /**
   * Fase 3.0b: Reconfigure a beacon — UUID/Major/Minor/Type/Territory.
   * PUT /api/v1/beacons/{id} with the full BeaconRequest body.
   * Backend emits CONFIG_UPDATED audit entry on success.
   * Returns 409 { error: { code: "BEACON_DUPLICATE_IDENTITY" } } if the new
   * identity triple collides with another beacon.
   */
  updateConfig: (beaconId: string, body: BeaconConfigUpdate) =>
    api.put<BeaconSummary>(`/api/v1/beacons/${beaconId}`, body),

  /** Set/change beacon password. Requires proximity (X-BLE-Proximity header). */
  setPassword: (beaconId: string, password: string) =>
    fetch(`${process.env.EXPO_PUBLIC_GATEWAY_URL ?? 'http://localhost:8080'}/api/v1/beacons/${beaconId}/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-BLE-Proximity': 'true',
      },
      body: JSON.stringify({ password }),
    }).then(r => { if (!r.ok) throw new Error('Set password failed'); return r.json() }),

  /** Reset beacon password. Requires proximity. */
  resetPassword: (beaconId: string, password: string) =>
    fetch(`${process.env.EXPO_PUBLIC_GATEWAY_URL ?? 'http://localhost:8080'}/api/v1/beacons/${beaconId}/password/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BLE-Proximity': 'true',
      },
      body: JSON.stringify({ password }),
    }).then(r => { if (!r.ok) throw new Error('Reset password failed'); return r.json() }),

  /** Update beacon name. */
  updateName: (beaconId: string, name: string) =>
    api.put<BeaconSummary>(`/api/v1/beacons/${beaconId}/name`, { name }),
}

// ── Fase 3.0b: Territory API (shared by beacon-config picker) ────────────────

export type TerritoryVisibility = 'public' | 'private' | 'closed'
export type TerritoryType = 'standard' | 'closed_circuit'

export interface Territory {
  id: string
  tenantId: string
  name: string
  visibility: TerritoryVisibility
  territoryType: TerritoryType
  defaultLocale?: string
  createdAt?: string
}

export const territoryApi = {
  /** List territories for the caller's tenant. */
  list: () => api.get<Territory[]>('/api/v1/territories'),
}

// ── Fase 3.0b: Beacon identity randomization (sales-agent copy) ──────────────
//
// Duplicated from admin-web so the mobile bundle doesn't need to import a
// workspace package. Keep the two copies in sync — admin-web is the source of
// truth for the algorithm.

/**
 * Generate a random UUID suitable for iBeacon broadcasts.
 * Uses crypto.randomUUID() when available, falls back to Math.random() for
 * older React Native Hermes runtimes (< 0.75).
 */
export function generateIBeaconUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().toUpperCase()
  }
  // Fallback: RFC4122 v4 via Math.random (cryptographically weak but fine for tests).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  }).toUpperCase()
}

/**
 * Produce a random iBeacon identity triple for test fixtures.
 * Major and minor are constrained to [1, 65535] per BLE spec.
 */
export function randomizeBeaconIdentity(): {
  ibeaconUuid: string
  major: number
  minor: number
} {
  return {
    ibeaconUuid: generateIBeaconUuid(),
    major: 1 + Math.floor(Math.random() * 65535),
    minor: 1 + Math.floor(Math.random() * 65535),
  }
}

// GAP-MER-001 fix: centralise merchant API calls in this module (consistent with other apis)
export interface MerchantSummary {
  id: string
  businessName: string
  tenantId: string
  status: string
  totalTransactions: number
  totalVolumeCents: number
}

export const merchantsApi = {
  /** List merchants managed by the currently authenticated sales agent. */
  listByAgent: () => api.get<MerchantSummary[]>('/api/v1/merchants?managedByAgent=true'),
}
