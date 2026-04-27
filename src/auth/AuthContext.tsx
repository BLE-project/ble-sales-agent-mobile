import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import * as SecureStore from 'expo-secure-store'
import { registerSalesAgentPushToken, unregisterPushToken } from '../notifications/pushTokenRegistration'
// M1.3b: client.ts drives logout when the refresh token expires / fails.
import { setOnLogout } from '../api/client'

/**
 * SecureStore key for the OAuth access token. Exported so `src/api/client.ts`
 * can import it instead of duplicating the string literal.
 *
 * Promoted from an inline literal to a module-level export as part of
 * M1.3b (BFF migration + refresh-token consumption).
 */
export const TOKEN_KEY = 'ble_sales_agent_token'

/**
 * M1.3b: SecureStore key holding the OAuth refresh token. Mirrors the
 * Cluster A naming convention (`ble_<slug>_refresh_token`). Consumed by
 * `src/api/client.ts` for the 401 → refresh → retry interceptor and by
 * the future biometric auto-login hook (Cluster B integration).
 */
export const REFRESH_KEY = 'ble_sales_agent_refresh_token'

interface AuthUser {
  sub: string
  name?: string
  email?: string
  roles: string[]
  /** UUID of the SalesAgent row resolved from /v1/sales-agents/me — FEAT-SA-FALLBACK */
  agentId?: string
  /** True when this user is the SUPER_ADMIN acting as fallback sales agent */
  isSuperAdminAgent?: boolean
}

interface AuthContextType {
  user: AuthUser | null
  accessToken: string | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

const KC_URL    = process.env.EXPO_PUBLIC_KC_URL         ?? 'http://localhost:8180'
const KC_REALM  = process.env.EXPO_PUBLIC_KC_REALM       ?? 'ble'
// FIX-SA-AUTH-001: align with client.ts — use EXPO_PUBLIC_GATEWAY_URL (not EXPO_PUBLIC_GATEWAY)
// and correct default port 8080 (BFF) not 8090 (gamification service).
const GATEWAY   = process.env.EXPO_PUBLIC_GATEWAY_URL    ?? 'http://localhost:8080'
const CLIENT_ID = 'ble-sales-agent-mobile'

function parseJwt(token: string): Record<string, unknown> {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return {}
  }
}

/**
 * FEAT-SA-FALLBACK: after obtaining a token, resolve the SalesAgent profile
 * from the backend so we have the agent's UUID (needed for downstream API calls).
 * Returns undefined if the call fails — the app still works, agentId will be absent.
 */
async function resolveAgentProfile(token: string): Promise<{ id: string; isSuperAdminFallback: boolean; territoryIds: string[] } | undefined> {
  try {
    const res = await fetch(`${GATEWAY}/api/v1/sales-agents/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return undefined
    const data = await res.json()
    // T-162: territoryIds needed for beacon-health alert fan-out scope
    const territoryIds: string[] = Array.isArray(data.territoryIds)
      ? data.territoryIds
      : Array.isArray(data.assignments)
        ? data.assignments.map((a: { territoryId?: string }) => a.territoryId).filter(Boolean)
        : []
    return {
      id: data.id as string,
      isSuperAdminFallback: data.isSuperAdminFallback as boolean,
      territoryIds,
    }
  } catch {
    return undefined
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]               = useState<AuthUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading]     = useState(true)
  // T-162: cache push token for best-effort unregister on logout
  const registeredPushToken = useRef<string | null>(null)

  useEffect(() => {
    SecureStore.getItemAsync(TOKEN_KEY).then(async token => {
      if (token) {
        const payload = parseJwt(token)
        const roles = ((payload.realm_access as Record<string, string[]>)?.roles ?? [])
        const profile = await resolveAgentProfile(token)
        setUser({
          sub:               payload.sub as string,
          name:              payload.name as string,
          email:             payload.email as string,
          roles,
          agentId:           profile?.id,
          isSuperAdminAgent: profile?.isSuperAdminFallback,
        })
        setAccessToken(token)
      }
      setIsLoading(false)
    })
  }, [])

  async function login(username: string, password: string) {
    // M1.3b: migrated from Keycloak password-grant to BFF /api/v1/auth/login
    // (matches consumer / merchant / tenant / territory). Avoids the JWT
    // issuer mismatch that occurs when the device hits Keycloak directly
    // via localhost:8180 vs the BFF expecting issuer = "http://keycloak:8180/…".
    const res = await fetch(
      `${GATEWAY}/api/v1/auth/login`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password }),
      },
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(
        (err as { error?: string; message?: string }).message
          ?? (err as { error_description?: string }).error_description
          ?? 'Login failed',
      )
    }
    // BFF returns {token, refreshToken} (camelCase per AuthResource.java:142).
    // Defensive on shape: also accept snake_case for proxy translation.
    const data = await res.json() as {
      token?: string
      access_token?: string
      refreshToken?: string
      refresh_token?: string
    }
    const token = data.token ?? data.access_token
    if (!token) {
      throw new Error('Login response missing access token')
    }
    const refreshToken = data.refreshToken ?? data.refresh_token ?? null
    // BUG-003: persist in background to avoid iOS Keychain race condition.
    SecureStore.setItemAsync(TOKEN_KEY, token).catch(() => {})
    if (refreshToken) {
      SecureStore.setItemAsync(REFRESH_KEY, refreshToken).catch(() => {})
    }
    const payload = parseJwt(token)
    const roles = ((payload.realm_access as Record<string, string[]>)?.roles ?? [])

    // FEAT-SA-FALLBACK: resolve agent profile (includes SUPER_ADMIN sentinel row)
    const profile = await resolveAgentProfile(token)

    setUser({
      sub:               payload.sub as string,
      name:              payload.name as string,
      email:             payload.email as string,
      roles,
      agentId:           profile?.id,
      isSuperAdminAgent: profile?.isSuperAdminFallback,
    })
    setAccessToken(token)

    // T-162: register FCM push token with territory scope (fire-and-forget)
    const tenantId = (payload.ble_tenant_id as string) ?? (payload.tenantId as string) ?? ''
    registerSalesAgentPushToken({
      authToken:    token,
      tenantId,
      territoryIds: profile?.territoryIds ?? [],
    }).then((res) => {
      if (res.registered && res.pushToken) registeredPushToken.current = res.pushToken
    }).catch(() => { /* non-fatal */ })
  }

  const logout = useCallback(async () => {
    // T-162: best-effort unregister before clearing session
    if (registeredPushToken.current && accessToken) {
      const tenantId = accessToken ? (parseJwt(accessToken).ble_tenant_id as string ?? '') : ''
      unregisterPushToken(registeredPushToken.current, {
        authToken: accessToken,
        tenantId,
      }).catch(() => {})
      registeredPushToken.current = null
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY)
    // M1.3b: also wipe the refresh token so a fresh credential login is
    // required on next session. Best-effort.
    await SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {})
    setUser(null)
    setAccessToken(null)
  }, [accessToken])

  // M1.3b: register the logout callback so client.ts can drive a session
  // wipe when the refresh token expires / fails. Re-registers whenever
  // `logout`'s identity changes (i.e. whenever accessToken changes).
  useEffect(() => {
    setOnLogout(() => { void logout() })
  }, [logout])

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
