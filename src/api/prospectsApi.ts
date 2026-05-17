/**
 * FU-26 — Prospect pipeline API for sales-agent-mobile.
 *
 * Wires the kanban (app/(app)/prospects/kanban.tsx) to the real backend domain
 * shipped in ble-core-registry#47 (V30__prospect_pipeline.sql). Until FU-26 the
 * kanban used hardcoded mock data.
 *
 * The `/v1/prospects` endpoints are tenant-scoped, so every call sends an
 * `X-Tenant-Id` header resolved from the agent's JWT (`ble_tenant_id` claim).
 * The base `api` wrapper still handles bearer auth + the 401→refresh→retry flow.
 */
import * as SecureStore from 'expo-secure-store'
import { api, ApiError } from './client'
import { TOKEN_KEY } from '../auth/AuthContext'

// ── Types ───────────────────────────────────────────────────────────────────

/**
 * Pipeline stage. Must stay aligned with
 * com.ble.registry.salesagent.ProspectStage on the backend — the resource
 * rejects any value outside this union with a 400.
 *
 * Happy path: LEAD → CONTACTED → DEMO → CONTRACT → CLOSED.
 * LOST is a terminal branch reachable from any non-terminal stage.
 */
export type ProspectStage =
  | 'LEAD'
  | 'CONTACTED'
  | 'DEMO'
  | 'CONTRACT'
  | 'CLOSED'
  | 'LOST'

/** A prospect as returned by GET /v1/prospects. */
export interface Prospect {
  id: string
  tenantId: string
  agentId: string
  organization: string
  address: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  stage: ProspectStage
  notes: string | null
  lastContactAt: string | null
  createdAt: string
  updatedAt: string
}

/** Paged envelope returned by the list endpoint. */
export interface ProspectPage {
  items: Prospect[]
  page: number
  size: number
  total: number
}

/** Body for creating a prospect. */
export interface CreateProspectRequest {
  organization: string
  address?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  notes?: string
}

// ── Tenant header resolution ────────────────────────────────────────────────

/**
 * Decode the `ble_tenant_id` claim from the stored JWT.
 *
 * The prospects domain is tenant-scoped; the API gateway cross-validates the
 * `X-Tenant-Id` header against this exact claim, so it is the only correct
 * source for the header value.
 */
async function resolveTenantId(): Promise<string> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null)
  if (!token) {
    throw new ApiError(401, 'Not authenticated')
  }
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(base64)) as Record<string, unknown>
    const tenantId = (payload.ble_tenant_id as string) ?? (payload.tenantId as string)
    if (!tenantId || tenantId === 'ANY') {
      throw new ApiError(400, 'No tenant is associated with this account')
    }
    return tenantId
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new ApiError(400, 'Could not resolve tenant from session')
  }
}

async function tenantHeaders(): Promise<Record<string, string>> {
  return { 'X-Tenant-Id': await resolveTenantId() }
}

// ── API ─────────────────────────────────────────────────────────────────────

export const prospectsApi = {
  /**
   * List the calling agent's prospects. Backend scopes a SALES_AGENT to their
   * own prospects automatically; `size` is capped at 200 server-side.
   */
  async list(page = 0, size = 200): Promise<ProspectPage> {
    const headers = await tenantHeaders()
    return api.get<ProspectPage>(
      `/api/v1/prospects?page=${page}&size=${size}`,
      headers,
    )
  },

  /** Create a new prospect (always starts at stage LEAD). */
  async create(req: CreateProspectRequest): Promise<Prospect> {
    const headers = await tenantHeaders()
    return api.post<Prospect>('/api/v1/prospects', req, headers)
  },

  /**
   * Move a prospect to a new pipeline stage.
   * Returns 409 if the transition is illegal per the backend state machine.
   */
  async moveStage(id: string, stage: ProspectStage): Promise<Prospect> {
    const headers = await tenantHeaders()
    return api.post<Prospect>(`/api/v1/prospects/${id}/stage`, { stage }, headers)
  },
}
