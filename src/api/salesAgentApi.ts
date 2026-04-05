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
