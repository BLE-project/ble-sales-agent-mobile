/**
 * Thin API client for sales agent mobile — wraps fetch with Bearer token.
 *
 * M1.3b: gained a transparent 401 → refresh → retry interceptor mirroring
 * the consumer / merchant / tenant / territory pattern. Refresh-token
 * coalescing + SEC-FIX-008 backoff prevent request storms after a failure.
 */
import * as SecureStore from 'expo-secure-store'
import { TOKEN_KEY, REFRESH_KEY } from '../auth/AuthContext'

const GATEWAY = process.env.EXPO_PUBLIC_GATEWAY_URL ?? 'http://localhost:8080'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY)
  } catch {
    return null
  }
}

// ── M1.3b: refresh-token coalescing + backoff ─────────────────────────────────

/** Register a logout callback invoked when the refresh token is expired/invalid. */
let _onLogout: (() => void) | null = null
export function setOnLogout(cb: () => void): void { _onLogout = cb }

// Single in-flight refresh promise to coalesce concurrent 401s.
let refreshPromise: Promise<string> | null = null

// SEC-FIX-008: 5s backoff after a failed refresh prevents request storms.
let lastRefreshFailureMs: number | null = null
const REFRESH_BACKOFF_MS = 5_000

/** @internal Reset module-level refresh state between tests. */
export function _resetRefreshState(): void {
  lastRefreshFailureMs = null
  refreshPromise = null
}

async function doRefresh(): Promise<string> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY).catch(() => null)
  if (!refreshToken) {
    _onLogout?.()
    throw new ApiError(401, 'No refresh token — please log in again')
  }
  // Sprint14 P3 fix (2026-05-06): BFF AuthResource expects camelCase
  // `refreshToken` field. Sending snake_case `refresh_token` returns 400
  // MISSING_REFRESH_TOKEN, which doRefresh treated as auth failure → fired
  // _onLogout → setUser(null) → /(app)/_layout Redirect /login. Surfaced as
  // sales-agent navigation+logout E2E fail (sales-agent uniquely triggers
  // doRefresh because /v1/registration-requests 401s for SALES_AGENT;
  // territory/consumer/merchant/tenant never enter the refresh path so the
  // bug stayed latent fleet-wide). All 5 mobile apps had the same bug.
  const res = await fetch(`${GATEWAY}/api/v1/auth/refresh`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ refreshToken }),
  })
  if (!res.ok) {
    _onLogout?.()
    throw new ApiError(401, 'Session expired — please log in again')
  }
  // Defensive on shape: BFF returns {token, refreshToken}; some proxy
  // chains translate to snake_case. Accept either.
  const data = await res.json() as {
    token?: string
    access_token?: string
    refreshToken?: string
    refresh_token?: string
  }
  const newAccess  = data.token ?? data.access_token
  const newRefresh = data.refreshToken ?? data.refresh_token ?? refreshToken
  if (!newAccess) {
    _onLogout?.()
    throw new ApiError(401, 'Refresh response missing access token')
  }
  await SecureStore.setItemAsync(TOKEN_KEY,   newAccess).catch(() => {})
  await SecureStore.setItemAsync(REFRESH_KEY, newRefresh).catch(() => {})
  lastRefreshFailureMs = null
  return newAccess
}

function buildHeaders(token: string | null, baseHeaders: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...baseHeaders,
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken()
  const headers = buildHeaders(token, (options.headers as Record<string, string> | undefined) ?? {})

  const res = await fetch(`${GATEWAY}${path}`, { ...options, headers })

  if (res.status === 401) {
    // SEC-FIX-008: fast-fail if we're inside the post-failure backoff window.
    if (lastRefreshFailureMs !== null
        && Date.now() - lastRefreshFailureMs < REFRESH_BACKOFF_MS) {
      throw new ApiError(401, 'Session expired — please log in again')
    }

    // Coalesce concurrent 401s behind a single refresh.
    if (!refreshPromise) {
      refreshPromise = doRefresh().finally(() => { refreshPromise = null })
    }
    let newToken: string
    try {
      newToken = await refreshPromise
    } catch {
      lastRefreshFailureMs = Date.now()
      throw new ApiError(401, 'Session expired — please log in again')
    }

    // Retry the original request with the fresh token.
    const retryHeaders = buildHeaders(newToken, (options.headers as Record<string, string> | undefined) ?? {})
    const retry = await fetch(`${GATEWAY}${path}`, { ...options, headers: retryHeaders })
    if (!retry.ok) {
      const body = await retry.text().catch(() => '')
      throw new ApiError(retry.status, body || retry.statusText)
    }
    if (retry.status === 204) return undefined as T
    return retry.json() as Promise<T>
  }

  if (!res.ok) {
    const body = await res.text()
    throw new ApiError(res.status, body || res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get:    <T>(path: string) => request<T>(path, { method: 'GET' }),
  post:   <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT',  body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
