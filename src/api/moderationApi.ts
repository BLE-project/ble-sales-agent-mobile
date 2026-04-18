/**
 * §9bis M5 — Moderation review queue API for sales-agent-mobile.
 *
 * Endpoints: GET /v1/moderation/reviews, GET /{advId}, POST /{advId}/approve,
 * POST /{advId}/reject, POST /{advId}/escalate (TOTP required for approve/reject).
 */

import { api } from './client'

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
  // to insert X-TOTP-Code along with bearer. Duplicate minimally:
  const SecureStore = await import('expo-secure-store')
  const token = await SecureStore.getItemAsync('ble_sales_agent_token')
  const res = await fetch(`${gateway}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  list: (page = 0, size = 20) =>
    api.get<ReviewTask[]>(`/api/v1/moderation/reviews?page=${page}&size=${size}`),

  get: (advId: string) =>
    api.get<ReviewTask>(`/api/v1/moderation/reviews/${advId}`),

  approve: (advId: string, reason: string, totpCode: string) =>
    withTotp<{ status: string }>('POST',
      `/api/v1/moderation/reviews/${advId}/approve`, { reason }, totpCode),

  reject: (advId: string, reason: string, totpCode: string) =>
    withTotp<{ status: string }>('POST',
      `/api/v1/moderation/reviews/${advId}/reject`, { reason }, totpCode),

  escalate: (advId: string, reason: string) =>
    api.post<{ status: string }>(
      `/api/v1/moderation/reviews/${advId}/escalate`, { reason }),
}
