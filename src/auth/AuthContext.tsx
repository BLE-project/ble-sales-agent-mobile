import React, { createContext, useContext, useState, useEffect } from 'react'
import * as SecureStore from 'expo-secure-store'

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

const KC_URL    = process.env.EXPO_PUBLIC_KC_URL    ?? 'http://localhost:8180'
const KC_REALM  = process.env.EXPO_PUBLIC_KC_REALM  ?? 'ble'
const GATEWAY   = process.env.EXPO_PUBLIC_GATEWAY   ?? 'http://localhost:8090'
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
async function resolveAgentProfile(token: string): Promise<{ id: string; isSuperAdminFallback: boolean } | undefined> {
  try {
    const res = await fetch(`${GATEWAY}/api/v1/sales-agents/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return undefined
    const data = await res.json()
    return { id: data.id as string, isSuperAdminFallback: data.isSuperAdminFallback as boolean }
  } catch {
    return undefined
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]               = useState<AuthUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading]     = useState(true)

  useEffect(() => {
    SecureStore.getItemAsync('ble_sales_agent_token').then(async token => {
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
    const res = await fetch(
      `${KC_URL}/realms/${KC_REALM}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'password',
          client_id:  CLIENT_ID,
          username,
          password,
        }).toString(),
      }
    )
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error_description ?? 'Login failed')
    }
    const data = await res.json()
    const token = data.access_token as string
    await SecureStore.setItemAsync('ble_sales_agent_token', token)
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
  }

  async function logout() {
    await SecureStore.deleteItemAsync('ble_sales_agent_token')
    setUser(null)
    setAccessToken(null)
  }

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
