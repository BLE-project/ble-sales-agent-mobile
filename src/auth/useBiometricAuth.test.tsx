/**
 * Tests for the BiometricAuthProvider + useBiometricAuth hook
 * (sales-agent-mobile port — Cluster B variant).
 *
 * Cluster B vs Cluster A differences exercised here:
 *  - Mock useAuth returns the sales-agent shape (`{user, accessToken,
 *    isAuthenticated, login, loginWithToken, logout, isLoading}`).
 *  - The biometric hook calls `auth.loginWithToken(...)` (not
 *    `auth.login(...)`) on successful refresh.
 */

import React, { type ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react-native'
import { IntlProvider } from 'react-intl'
import { BiometricAuthProvider, useBiometricAuth } from './useBiometricAuth'
import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'
import * as Crypto from 'expo-crypto'
import { _resetBiometricGate } from './biometric/biometricGate'

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('expo-secure-store', () => ({
  getItemAsync:    jest.fn(),
  setItemAsync:    jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}))
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
  getRandomBytesAsync: jest.fn(),
  digestStringAsync: jest.fn(),
}))

import { AppState as RNAppState } from 'react-native'
let appStateHandler: ((next: 'active' | 'background' | 'inactive') => void) | null = null

// useAuth (Cluster B / sales-agent shape) — exposes loginWithToken in addition
// to login. The biometric hook uses loginWithToken to apply pre-fetched
// tokens after a successful refresh roundtrip.
const mockLogin = jest.fn(async () => undefined)
const mockLoginWithToken = jest.fn(async () => undefined)
const mockLogout = jest.fn(async () => undefined)
let mockIsAuthenticated = true
jest.mock('./AuthContext', () => ({
  useAuth: () => ({
    user: {
      sub: 'test-user',
      name: 'Test',
      email: 'test@terrio.local',
      roles: ['SALES_AGENT'],
      agentId: 'sa-1',
      isSuperAdminAgent: false,
    },
    accessToken: 'access-token',
    isLoading: false,
    isAuthenticated: mockIsAuthenticated,
    login: mockLogin,
    loginWithToken: mockLoginWithToken,
    logout: mockLogout,
  }),
}))

const originalFetch = globalThis.fetch
beforeAll(() => {
  globalThis.fetch = jest.fn() as unknown as typeof fetch
})
afterAll(() => { globalThis.fetch = originalFetch })

// ── Helpers ──────────────────────────────────────────────────────────────────

// Tests run inside an IntlProvider so the hook's `useIntl()` calls (used for
// the LocalAuthentication prompt strings) resolve. `onError` is silenced to
// keep MissingTranslationError noise out of the test output.
const wrapper = ({ children }: { children: ReactNode }) => (
  <IntlProvider locale="en" onError={() => {}}>
    <BiometricAuthProvider>{children}</BiometricAuthProvider>
  </IntlProvider>
)

const STORAGE_KEY = 'ble_sales_agent_biometric_enrollment'
const REFRESH_KEY = 'ble_sales_agent_refresh_token'

const enrolledRecord = {
  schemaVersion: 1 as const,
  isEnrolled: true,
  optedOut: false,
  pinHash: 'cafebabe'.repeat(8),
  pinSalt: 'salt-hex',
  biometricEnabled: true,
  failCount: 0,
  lockoutState: { phase: 'OPEN' as const },
  lastPromptMs: null,
  lastSuccessMs: 0,
  enrolledAt: 1_700_000_000_000,
}

beforeEach(() => {
  jest.clearAllMocks()
  appStateHandler = null
  mockIsAuthenticated = true
  _resetBiometricGate()
  ;(SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined)
  ;(SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined)
  jest.spyOn(RNAppState, 'addEventListener').mockImplementation((_event, handler) => {
    appStateHandler = handler as typeof appStateHandler
    return { remove: jest.fn(() => { appStateHandler = null }) } as ReturnType<typeof RNAppState.addEventListener>
  })
})

afterEach(() => {
  jest.restoreAllMocks()
})

// ── Cold-start behavior ─────────────────────────────────────────────────────

describe('BiometricAuthProvider — cold start', () => {
  it('starts idle when not enrolled', async () => {
    ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null)
    const { result } = renderHook(() => useBiometricAuth(), { wrapper })
    await waitFor(() => expect(result.current.isEnrolled).toBe(false))
    expect(result.current.status).toBe('idle')
  })

  it('starts in prompting state when enrolled and session is authenticated', async () => {
    ;(SecureStore.getItemAsync as jest.Mock).mockImplementation(async (k: string) => {
      if (k === STORAGE_KEY) return JSON.stringify(enrolledRecord)
      return null
    })
    const { result } = renderHook(() => useBiometricAuth(), { wrapper })
    await waitFor(() => expect(result.current.isEnrolled).toBe(true))
    expect(result.current.status).toBe('prompting')
  })
})

// ── PIN flow (Cluster B: assert loginWithToken instead of login) ─────────────

describe('useBiometricAuth — submitPin (Cluster B)', () => {
  beforeEach(() => {
    ;(SecureStore.getItemAsync as jest.Mock).mockImplementation(async (k: string) => {
      if (k === STORAGE_KEY) return JSON.stringify(enrolledRecord)
      if (k === REFRESH_KEY) return 'refresh-token-blob'
      return null
    })
  })

  it('returns ok and calls loginWithToken on correct PIN', async () => {
    ;(Crypto.digestStringAsync as jest.Mock).mockResolvedValue(enrolledRecord.pinHash)
    ;(globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'new-access', refreshToken: 'new-refresh' }),
    })
    const { result } = renderHook(() => useBiometricAuth(), { wrapper })
    await waitFor(() => expect(result.current.isEnrolled).toBe(true))

    let res: string = ''
    await act(async () => { res = await result.current.submitPin('123456') })
    expect(res).toBe('ok')
    expect(mockLoginWithToken).toHaveBeenCalledWith('new-access', 'new-refresh')
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('returns wrong on first wrong PIN (failCount 1, no lockout)', async () => {
    ;(Crypto.digestStringAsync as jest.Mock).mockResolvedValue('different-hash')
    const { result } = renderHook(() => useBiometricAuth(), { wrapper })
    await waitFor(() => expect(result.current.isEnrolled).toBe(true))

    let res: string = ''
    await act(async () => { res = await result.current.submitPin('999999') })
    expect(res).toBe('wrong')
    expect(result.current.failCount).toBe(1)
    expect(result.current.isLocked).toBe(false)
  })

  it('escalates to locked after 3rd wrong PIN', async () => {
    const r = { ...enrolledRecord, failCount: 2 }
    ;(SecureStore.getItemAsync as jest.Mock).mockImplementation(async (k: string) => {
      if (k === STORAGE_KEY) return JSON.stringify(r)
      if (k === REFRESH_KEY) return 'refresh-token-blob'
      return null
    })
    ;(Crypto.digestStringAsync as jest.Mock).mockResolvedValue('different-hash')
    const { result } = renderHook(() => useBiometricAuth(), { wrapper })
    await waitFor(() => expect(result.current.failCount).toBe(2))

    let res: string = ''
    await act(async () => { res = await result.current.submitPin('999999') })
    expect(res).toBe('locked')
    expect(result.current.isLocked).toBe(true)
  })

  it('wipes credentials on 10th wrong PIN', async () => {
    const r = { ...enrolledRecord, failCount: 9 }
    ;(SecureStore.getItemAsync as jest.Mock).mockImplementation(async (k: string) => {
      if (k === STORAGE_KEY) return JSON.stringify(r)
      if (k === REFRESH_KEY) return 'refresh-token-blob'
      return null
    })
    ;(Crypto.digestStringAsync as jest.Mock).mockResolvedValue('different-hash')
    const { result } = renderHook(() => useBiometricAuth(), { wrapper })
    await waitFor(() => expect(result.current.failCount).toBe(9))

    let res: string = ''
    await act(async () => { res = await result.current.submitPin('999999') })
    expect(res).toBe('wiped')
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEY)
    expect(mockLogout).toHaveBeenCalled()
  })
})

// ── triggerBiometric (Cluster B) ─────────────────────────────────────────────

describe('useBiometricAuth — triggerBiometric (Cluster B)', () => {
  beforeEach(() => {
    ;(SecureStore.getItemAsync as jest.Mock).mockImplementation(async (k: string) => {
      if (k === STORAGE_KEY) return JSON.stringify(enrolledRecord)
      if (k === REFRESH_KEY) return 'refresh-token-blob'
      return null
    })
    ;(LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true)
    ;(LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true)
  })

  it('returns ok on biometric success and calls loginWithToken', async () => {
    ;(LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true })
    ;(globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'new-access', refreshToken: 'new-refresh' }),
    })
    const { result } = renderHook(() => useBiometricAuth(), { wrapper })
    await waitFor(() => expect(result.current.isEnrolled).toBe(true))

    let res: string = ''
    await act(async () => { res = await result.current.triggerBiometric() })
    expect(res).toBe('ok')
    expect(mockLoginWithToken).toHaveBeenCalledWith('new-access', 'new-refresh')
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('returns unavailable when no biometric hardware', async () => {
    ;(LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValueOnce(false)
    const { result } = renderHook(() => useBiometricAuth(), { wrapper })
    await waitFor(() => expect(result.current.isEnrolled).toBe(true))

    let res: string = ''
    await act(async () => { res = await result.current.triggerBiometric() })
    expect(res).toBe('unavailable')
    expect(result.current.status).toBe('pin-required')
  })

  it('falls back to PIN when refresh fails after biometric success', async () => {
    ;(LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true })
    ;(globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401 })
    const { result } = renderHook(() => useBiometricAuth(), { wrapper })
    await waitFor(() => expect(result.current.isEnrolled).toBe(true))

    let res: string = ''
    await act(async () => { res = await result.current.triggerBiometric() })
    expect(res).toBe('cancelled')
    expect(mockLogout).toHaveBeenCalled()
  })
})

// ── enroll / optOut ─────────────────────────────────────────────────────────

describe('useBiometricAuth — enroll', () => {
  it('hashes the PIN and persists the enrolled record', async () => {
    ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null)
    ;(LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true)
    ;(Crypto.getRandomBytesAsync as jest.Mock).mockResolvedValue(
      new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
    )
    ;(Crypto.digestStringAsync as jest.Mock).mockResolvedValue('a1b2c3d4'.repeat(8))

    const { result } = renderHook(() => useBiometricAuth(), { wrapper })
    await waitFor(() => expect(result.current.isEnrolled).toBe(false))

    await act(async () => { await result.current.enroll('123456') })
    expect(result.current.isEnrolled).toBe(true)
    expect(SecureStore.setItemAsync).toHaveBeenCalled()
    const written = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls[0][1])
    expect(written.isEnrolled).toBe(true)
    expect(written.optedOut).toBe(false)
  })
})

describe('useBiometricAuth — optOut', () => {
  it('persists optedOut + isEnrolled false', async () => {
    ;(SecureStore.getItemAsync as jest.Mock).mockImplementation(async (k: string) => {
      if (k === STORAGE_KEY) return JSON.stringify(enrolledRecord)
      return null
    })

    const { result } = renderHook(() => useBiometricAuth(), { wrapper })
    await waitFor(() => expect(result.current.isEnrolled).toBe(true))

    await act(async () => { await result.current.optOut() })
    expect(result.current.isEnrolled).toBe(false)
    expect(result.current.optedOut).toBe(true)
  })
})

describe('useBiometricAuth — outside provider', () => {
  it('throws if used without BiometricAuthProvider', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useBiometricAuth())).toThrow(
      /useBiometricAuth must be used inside <BiometricAuthProvider>/,
    )
    errorSpy.mockRestore()
  })
})
