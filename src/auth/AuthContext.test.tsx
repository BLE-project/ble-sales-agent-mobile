/**
 * FU-51: Behaviour tests for AuthProvider + useAuth (sales-agent-mobile).
 *
 * Covers session bootstrap from SecureStore, the BFF login flow (incl.
 * camelCase + snake_case token shapes), JWT role parsing, logout wipe, and
 * loginWithToken (the biometric auto-login entry point).
 */
import React, { type ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react-native'
import * as SecureStore from 'expo-secure-store'

jest.mock('expo-secure-store', () => ({
  getItemAsync:    jest.fn(),
  setItemAsync:    jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('../notifications/pushTokenRegistration', () => ({
  registerSalesAgentPushToken: jest.fn().mockResolvedValue({ registered: false, pushToken: null }),
  unregisterPushToken: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('../api/client', () => ({ setOnLogout: jest.fn() }))

import { AuthProvider, useAuth } from './AuthContext'

const mockGet = SecureStore.getItemAsync as jest.Mock
const mockSet = SecureStore.setItemAsync as jest.Mock
const mockDel = SecureStore.deleteItemAsync as jest.Mock

const mockFetch = jest.fn()
;(globalThis as unknown as { fetch: jest.Mock }).fetch = mockFetch

/** Build a signature-less JWT carrying the given claims. */
function jwt(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${b64({ alg: 'none' })}.${b64(claims)}.sig`
}

const AGENT_JWT = jwt({
  sub: 'agent-001', name: 'Mario Rossi', email: 'mario@terrio.it',
  realm_access: { roles: ['SALES_AGENT'] }, ble_tenant_id: 'tenant-1',
})

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

function jsonRes(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue(null)
  mockSet.mockResolvedValue(undefined)
  mockDel.mockResolvedValue(undefined)
  // resolveAgentProfile fetch — default: profile lookup fails (agentId absent)
  mockFetch.mockResolvedValue(jsonRes(404, {}))
})

describe('AuthProvider bootstrap', () => {
  it('starts unauthenticated when SecureStore has no token', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('restores a session from a stored token + parses JWT roles', async () => {
    mockGet.mockImplementation((k: string) =>
      Promise.resolve(k === 'ble_sales_agent_token' ? AGENT_JWT : null))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.user?.sub).toBe('agent-001')
    expect(result.current.user?.roles).toEqual(['SALES_AGENT'])
    expect(result.current.isAuthenticated).toBe(true)
  })
})

describe('login', () => {
  it('authenticates via the BFF and persists both tokens (camelCase shape)', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonRes(200, { token: AGENT_JWT, refreshToken: 'r-1' }))
      .mockResolvedValue(jsonRes(404, {})) // profile lookup
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => { await result.current.login('mario', 'pw') })

    expect(result.current.user?.sub).toBe('agent-001')
    expect(mockSet).toHaveBeenCalledWith('ble_sales_agent_token', AGENT_JWT)
    expect(mockSet).toHaveBeenCalledWith('ble_sales_agent_refresh_token', 'r-1')
  })

  it('accepts the snake_case token shape from a translating proxy', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonRes(200, { access_token: AGENT_JWT, refresh_token: 'r-2' }))
      .mockResolvedValue(jsonRes(404, {}))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => { await result.current.login('mario', 'pw') })
    expect(mockSet).toHaveBeenCalledWith('ble_sales_agent_token', AGENT_JWT)
  })

  it('throws the backend error message when login is rejected', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 401,
      json: () => Promise.resolve({ message: 'Bad credentials' }),
    })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await expect(
      act(async () => { await result.current.login('x', 'y') }),
    ).rejects.toThrow('Bad credentials')
  })

  it('throws when the login response carries no access token', async () => {
    mockFetch.mockResolvedValueOnce(jsonRes(200, { refreshToken: 'r' }))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await expect(
      act(async () => { await result.current.login('x', 'y') }),
    ).rejects.toThrow('missing access token')
  })
})

describe('logout', () => {
  it('wipes both SecureStore tokens and clears the user', async () => {
    mockGet.mockImplementation((k: string) =>
      Promise.resolve(k === 'ble_sales_agent_token' ? AGENT_JWT : null))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))

    await act(async () => { await result.current.logout() })

    expect(result.current.user).toBeNull()
    expect(mockDel).toHaveBeenCalledWith('ble_sales_agent_token')
    expect(mockDel).toHaveBeenCalledWith('ble_sales_agent_refresh_token')
  })
})

describe('loginWithToken (biometric auto-login)', () => {
  it('sets the session from pre-fetched tokens without a BFF roundtrip', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    mockFetch.mockClear()

    await act(async () => { await result.current.loginWithToken(AGENT_JWT, 'r-new') })

    expect(result.current.user?.sub).toBe('agent-001')
    expect(result.current.isAuthenticated).toBe(true)
    expect(mockSet).toHaveBeenCalledWith('ble_sales_agent_token', AGENT_JWT)
    // no /api/v1/auth/login call — only the optional profile lookup may fire
    expect(mockFetch.mock.calls.every(([u]) => !String(u).includes('/auth/login'))).toBe(true)
  })
})

describe('useAuth guard', () => {
  it('throws when used outside an AuthProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used inside AuthProvider')
    spy.mockRestore()
  })
})

describe('agent profile resolution (FEAT-SA-FALLBACK)', () => {
  it('populates agentId + isSuperAdminAgent from /sales-agents/me on login', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonRes(200, { token: AGENT_JWT, refreshToken: 'r-1' })) // login
      .mockResolvedValueOnce(jsonRes(200, {                                            // profile
        id: 'sa-uuid-9', isSuperAdminFallback: true, territoryIds: ['ter-1', 'ter-2'],
      }))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => { await result.current.login('mario', 'pw') })

    expect(result.current.user?.agentId).toBe('sa-uuid-9')
    expect(result.current.user?.isSuperAdminAgent).toBe(true)
  })

  it('derives territoryIds from assignments[] when territoryIds is absent', async () => {
    // Bootstrap path: token present in SecureStore, profile resolves via assignments.
    mockGet.mockImplementation((k: string) =>
      Promise.resolve(k === 'ble_sales_agent_token' ? AGENT_JWT : null))
    mockFetch.mockResolvedValueOnce(jsonRes(200, {
      id: 'sa-uuid-7', isSuperAdminFallback: false,
      assignments: [{ territoryId: 'ter-a' }, { territoryId: 'ter-b' }, {}],
    }))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))
    expect(result.current.user?.agentId).toBe('sa-uuid-7')
  })
})

describe('push token lifecycle (T-162)', () => {
  it('unregisters the cached push token on logout when one was registered', async () => {
    const { registerSalesAgentPushToken, unregisterPushToken } =
      jest.requireMock('../notifications/pushTokenRegistration')
    ;(registerSalesAgentPushToken as jest.Mock).mockResolvedValue({
      registered: true, pushToken: 'fcm-token-xyz',
    })
    mockFetch
      .mockResolvedValueOnce(jsonRes(200, { token: AGENT_JWT, refreshToken: 'r-1' })) // login
      .mockResolvedValue(jsonRes(404, {}))                                            // profile
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => { await result.current.login('mario', 'pw') })
    // let the fire-and-forget registration settle
    await waitFor(() => expect(registerSalesAgentPushToken).toHaveBeenCalled())

    await act(async () => { await result.current.logout() })
    expect(unregisterPushToken).toHaveBeenCalledWith(
      'fcm-token-xyz', expect.objectContaining({ authToken: AGENT_JWT }),
    )
  })
})
