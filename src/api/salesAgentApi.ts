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

// ── FEAT-S45-001: Beacon Management ──────────────────────────────────────────

export interface BeaconEnrollRequest {
  territoryId: string
  type: 'TRACKING' | 'MERCHANT' | 'INFO' | 'ENTRANCE'
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
  name: string | null
  ibeaconUuid: string
  major: number
  minor: number
  type: string
  status: string
  enrolledBy: string | null
  enrolledAt: string | null
}

export const beaconApi = {
  /** Enroll (create) a new beacon. Requires SALES_AGENT or SUPER_ADMIN. */
  enroll: (req: BeaconEnrollRequest) =>
    api.post<BeaconSummary>('/api/v1/beacons', req),

  /** List beacons for the current tenant context. */
  list: () =>
    api.get<BeaconSummary[]>('/api/v1/beacons'),

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
