/**
 * §9bis M5 — Moderation review queue API for sales-agent-mobile.
 *
 * Endpoints: GET /v1/moderation/reviews, GET /{advId}, POST /{advId}/approve,
 * POST /{advId}/reject, POST /{advId}/escalate (TOTP required for approve/reject).
 */

import * as SecureStore from 'expo-secure-store'
import { api } from './client'

const TOKEN_KEY = 'ble_sales_agent_token'

/**
 * Decode the `ble_tenant_id` claim from the stored JWT. The moderation endpoints
 * are tenant-scoped: the API gateway (and notification-service TenantValidator)
 * reject any request whose `X-Tenant-Id` header is missing (400) or mismatched
 * (403). Mirrors prospectsApi.resolveTenantId — without this header the queue
 * silently rendered empty ("0 in attesa").
 */
async function resolveTenantId(): Promise<string> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null)
  if (!token) throw new Error('Not authenticated')
  const base64 = token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')
  const payload = JSON.parse(atob(base64)) as Record<string, unknown>
  const tenantId = (payload.ble_tenant_id as string) ?? (payload.tenant_id as string)
  if (!tenantId || tenantId === 'ANY' || tenantId === '*') {
    throw new Error('No tenant is associated with this account')
  }
  return tenantId
}

export type AdvModerationStatus =
  | 'PENDING_HUMAN'
  | 'ESCALATED_TO_ADMIN'
  | 'APPROVED'
  | 'REJECTED'
  | 'AUTO_REJECTED'

export interface ReviewTask {
  advId: string
  tenantId: string
  merchantId: string
  title: string
  description: string
  imageUrl: string | null
  moderationStatus: AdvModerationStatus
  claudeRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | null
  claudeConfidence: number | null
  claudeReasons: string | null             // JSON-stringified list
  createdAt: string
  salesReviewExpiresAt: string | null
  tenantReviewExpiresAt: string | null
}

/**
 * TOTP header is injected via fetch options in approve/reject/takedown calls.
 * We use a local helper instead of extending the global client to keep the
 * TOTP code explicit and short-lived.
 */
async function withTotp<T>(
  method: 'POST',
  path: string,
  body: unknown,
  totpCode: string,
): Promise<T> {
  const gateway = process.env.EXPO_PUBLIC_GATEWAY_URL ?? 'http://localhost:8080'
  // Token resolved via SecureStore by the base api wrapper; here we need raw fetch
  // to insert X-TOTP-Code along with bearer. Duplicate minimally.
  // FU-51: SecureStore is now a static import (was a per-call dynamic import) —
  // consistent with client.ts/prospectsApi.ts and unit-testable under jest.
  const token = await SecureStore.getItemAsync('ble_sales_agent_token')
  const tenantId = await resolveTenantId()
  const res = await fetch(`${gateway}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Tenant-Id': tenantId,
      'X-TOTP-Code': totpCode,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`[${res.status}] ${txt || res.statusText}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const moderationApi = {
  list: async (page = 0, size = 20) =>
    api.get<ReviewTask[]>(`/api/v1/moderation/reviews?page=${page}&size=${size}`,
      { 'X-Tenant-Id': await resolveTenantId() }),

  get: async (advId: string) =>
    api.get<ReviewTask>(`/api/v1/moderation/reviews/${advId}`,
      { 'X-Tenant-Id': await resolveTenantId() }),

  approve: (advId: string, reason: string, totpCode: string) =>
    withTotp<{ status: string }>('POST',
      `/api/v1/moderation/reviews/${advId}/approve`, { reason }, totpCode),

  reject: (advId: string, reason: string, totpCode: string) =>
    withTotp<{ status: string }>('POST',
      `/api/v1/moderation/reviews/${advId}/reject`, { reason }, totpCode),

  escalate: async (advId: string, reason: string) =>
    api.post<{ status: string }>(
      `/api/v1/moderation/reviews/${advId}/escalate`, { reason },
      { 'X-Tenant-Id': await resolveTenantId() }),
}
