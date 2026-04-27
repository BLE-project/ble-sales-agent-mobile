/**
 * Biometric auto-login hook + provider — Cluster B integration (sales-agent port).
 *
 * Wires the shared `src/auth/biometric/` module into sales-agent-mobile's
 * existing auth flow. Per Pragmatic-Balance architecture (Phase 4):
 * the shared module owns the state-machine + persistence; this file
 * is the per-app glue.
 *
 * ## Cluster B vs Cluster A
 *
 * Sales-agent uses `AuthContext.tsx` (not `useAuth.tsx`). Its `useAuth()`
 * hook returns `{ user, accessToken, isAuthenticated, login,
 * loginWithToken, logout, isLoading }`. The biometric hook calls
 * `auth.loginWithToken(accessToken, refreshToken)` to apply pre-fetched
 * tokens — `login(username, password)` would re-issue a credential
 * roundtrip we don't need.
 *
 * BFF migration + refresh-token plumbing landed in M1.3b (PR #16).
 *
 * ## Spec
 *
 * - Q1: sales-agent port of the consumer-mobile pilot.
 * - Q2: Biometric-as-primary. Success → fetch /v1/auth/refresh → loginWithToken.
 * - Q3+Q11: cold start always prompts; warm start prompts only if
 *   background duration ≥ 3 min.
 * - Q4+Q10: PIN fallback uses the imported lockout state machine.
 * - Q5: refresh-token (read directly from SecureStore key
 *   `ble_sales_agent_refresh_token`).
 * - Q6: opt-out modal at first login (UI consumes `optOut()` action).
 * - Q7: I3 pattern reused via `setBiometricGetter`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  AppState,
  type AppStateStatus,
  type NativeEventSubscription,
} from 'react-native'
import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'
import {
  setBiometricGetter,
  readEnrollment,
  writeEnrollment,
  wipeEnrollment,
  hashPin,
  verifyPin,
  recordSuccess,
  recordFailedAttempt,
  isLocked as isLockoutActive,
  remainingSeconds,
  DEFAULT_ENROLLMENT,
  type EnrollmentRecord,
} from './biometric'
import { useAuth } from './AuthContext'

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Per-app slug — must match the SecureStore key prefix used elsewhere.
 * NB: underscore (not hyphen) so the resulting key is
 * `ble_sales_agent_biometric_enrollment`, matching the existing
 * `ble_sales_agent_token` / `ble_sales_agent_refresh_token` family.
 */
const APP_SLUG = 'sales_agent'

/** SecureStore key holding the OAuth refresh token. Mirrors `client.ts`. */
const REFRESH_KEY = 'ble_sales_agent_refresh_token'

/** Q11 Smart threshold. Warm transitions ≥ this trigger a re-prompt. */
const WARM_THRESHOLD_MS = 3 * 60 * 1000

const GATEWAY = process.env.EXPO_PUBLIC_GATEWAY_URL ?? 'http://localhost:8080'

// ── Public types ──────────────────────────────────────────────────────────────

export type BiometricStatus =
  | 'idle'
  | 'prompting'
  | 'pin-required'
  | 'locked'

export type BiometricResult =
  | 'ok'
  | 'fallback'
  | 'cancelled'
  | 'unavailable'
  | 'wrong'
  | 'locked'
  | 'wiped'

export interface BiometricAuthState {
  status: BiometricStatus
  isEnrolled: boolean
  isLocked: boolean
  remainingLockoutSeconds: number
  failCount: number
  optedOut: boolean

  triggerBiometric: () => Promise<BiometricResult>
  submitPin: (pin: string) => Promise<BiometricResult>
  enroll: (pin: string) => Promise<void>
  optOut: () => Promise<void>

  /** @internal Visible for testing; do not depend on this in UI code. */
  _record: EnrollmentRecord
}

// ── Context ───────────────────────────────────────────────────────────────────

const BiometricAuthContext = createContext<BiometricAuthState | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

export function BiometricAuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const [record, setRecord] = useState<EnrollmentRecord>(DEFAULT_ENROLLMENT)
  const [status, setStatus] = useState<BiometricStatus>('idle')
  const backgroundSinceRef = useRef<number | null>(null)
  const recordRef = useRef<EnrollmentRecord>(record)
  recordRef.current = record

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const r = await readEnrollment(APP_SLUG)
      if (cancelled) return
      setRecord(r)
      setBiometricGetter(() => r.isEnrolled)
      if (r.isEnrolled && auth.isAuthenticated) {
        setStatus(isLockoutActive(r.lockoutState, Date.now()) ? 'locked' : 'prompting')
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const sub: NativeEventSubscription = AppState.addEventListener(
      'change',
      (next: AppStateStatus) => {
        if (next === 'background' || next === 'inactive') {
          backgroundSinceRef.current = Date.now()
          return
        }
        if (next === 'active' && backgroundSinceRef.current !== null) {
          const elapsed = Date.now() - backgroundSinceRef.current
          backgroundSinceRef.current = null
          const r = recordRef.current
          if (r.isEnrolled && auth.isAuthenticated && elapsed >= WARM_THRESHOLD_MS) {
            setStatus(isLockoutActive(r.lockoutState, Date.now()) ? 'locked' : 'prompting')
          }
        }
      },
    )
    return () => sub.remove()
  }, [auth.isAuthenticated])

  const triggerBiometric = useCallback(async (): Promise<BiometricResult> => {
    const r = recordRef.current
    if (!r.isEnrolled) return 'unavailable'
    if (isLockoutActive(r.lockoutState, Date.now())) {
      setStatus('locked')
      return 'locked'
    }

    const has = await LocalAuthentication.hasHardwareAsync()
    if (!has) {
      setStatus('pin-required')
      return 'unavailable'
    }
    const enrolledAtOsLevel = await LocalAuthentication.isEnrolledAsync()
    if (!enrolledAtOsLevel) {
      setStatus('pin-required')
      return 'unavailable'
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Accedi a Terrio',
      cancelLabel: 'Usa PIN',
      disableDeviceFallback: true,
    })

    if (!result.success) {
      const reason = (result as { error?: string }).error
      if (reason === 'user_cancel' || reason === 'system_cancel') {
        setStatus('pin-required')
        return 'cancelled'
      }
      setStatus('pin-required')
      return 'fallback'
    }

    const ok = await refreshAndUnlock(auth)
    if (!ok) {
      await auth.logout()
      setStatus('idle')
      return 'cancelled'
    }
    const updated: EnrollmentRecord = { ...r, lastSuccessMs: Date.now() }
    setRecord(updated)
    await writeEnrollment(APP_SLUG, updated)
    setStatus('idle')
    return 'ok'
  }, [auth])

  const submitPin = useCallback(async (pin: string): Promise<BiometricResult> => {
    const r = recordRef.current
    if (isLockoutActive(r.lockoutState, Date.now())) {
      setStatus('locked')
      return 'locked'
    }
    if (!r.pinHash || !r.pinSalt) {
      return 'wrong'
    }

    const match = await verifyPin(pin, r.pinHash, r.pinSalt)

    if (match) {
      const cleared: EnrollmentRecord = {
        ...r,
        failCount: 0,
        lockoutState: recordSuccess(),
        lastSuccessMs: Date.now(),
      }
      setRecord(cleared)
      await writeEnrollment(APP_SLUG, cleared)
      const ok = await refreshAndUnlock(auth)
      if (!ok) {
        await auth.logout()
        setStatus('idle')
        return 'cancelled'
      }
      setStatus('idle')
      return 'ok'
    }

    const newFailCount = r.failCount + 1
    const newLockoutState = recordFailedAttempt(newFailCount, Date.now())

    if (newLockoutState.phase === 'WIPED') {
      const wiped = await wipeEnrollment(APP_SLUG)
      setRecord(wiped)
      setBiometricGetter(() => false)
      await auth.logout()
      setStatus('idle')
      return 'wiped'
    }

    const updated: EnrollmentRecord = {
      ...r,
      failCount: newFailCount,
      lockoutState: newLockoutState,
    }
    setRecord(updated)
    await writeEnrollment(APP_SLUG, updated)

    if (newLockoutState.phase === 'LOCKED') {
      setStatus('locked')
      return 'locked'
    }
    return 'wrong'
  }, [auth])

  const enroll = useCallback(async (pin: string): Promise<void> => {
    const { hash, salt } = await hashPin(pin)
    const biometricEnabled = await LocalAuthentication.hasHardwareAsync()
    const enrolledRecord: EnrollmentRecord = {
      ...DEFAULT_ENROLLMENT,
      isEnrolled: true,
      optedOut: false,
      pinHash: hash,
      pinSalt: salt,
      biometricEnabled,
      enrolledAt: Date.now(),
      lastSuccessMs: Date.now(),
    }
    setRecord(enrolledRecord)
    await writeEnrollment(APP_SLUG, enrolledRecord)
    setBiometricGetter(() => true)
  }, [])

  const optOut = useCallback(async (): Promise<void> => {
    const r = recordRef.current
    const opted: EnrollmentRecord = {
      ...r,
      isEnrolled: false,
      optedOut: true,
    }
    setRecord(opted)
    await writeEnrollment(APP_SLUG, opted)
    setBiometricGetter(() => false)
  }, [])

  const value = useMemo<BiometricAuthState>(() => {
    const now = Date.now()
    return {
      status,
      isEnrolled: record.isEnrolled,
      isLocked: isLockoutActive(record.lockoutState, now),
      remainingLockoutSeconds: remainingSeconds(record.lockoutState, now),
      failCount: record.failCount,
      optedOut: record.optedOut,
      triggerBiometric,
      submitPin,
      enroll,
      optOut,
      _record: record,
    }
  }, [status, record, triggerBiometric, submitPin, enroll, optOut])

  return (
    <BiometricAuthContext.Provider value={value}>
      {children}
    </BiometricAuthContext.Provider>
  )
}

export function useBiometricAuth(): BiometricAuthState {
  const ctx = useContext(BiometricAuthContext)
  if (!ctx) {
    throw new Error('useBiometricAuth must be used inside <BiometricAuthProvider>')
  }
  return ctx
}

// ── Internal: refresh + unlock helper ────────────────────────────────────────

/**
 * Trade fresh access + refresh tokens via the BFF refresh endpoint and
 * push them into the existing auth context. Returns false on any failure.
 *
 * Cluster B: calls `auth.loginWithToken(...)` (added in M1.3b + this PR's
 * AuthContext.tsx changes) — accepts pre-fetched tokens without
 * re-running the credential roundtrip.
 *
 * Defensive on response shape — accepts both camelCase (BFF) and
 * snake_case (proxy passthrough).
 */
async function refreshAndUnlock(auth: ReturnType<typeof useAuth>): Promise<boolean> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY)
  if (!refreshToken) return false

  try {
    const res = await fetch(`${GATEWAY}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return false
    const data = (await res.json()) as {
      access_token?: string
      refresh_token?: string
      token?: string
      refreshToken?: string
    }
    const accessToken = data.access_token ?? data.token
    const newRefresh = data.refresh_token ?? data.refreshToken ?? refreshToken
    if (!accessToken) return false

    await auth.loginWithToken(accessToken, newRefresh)
    return true
  } catch {
    return false
  }
}
