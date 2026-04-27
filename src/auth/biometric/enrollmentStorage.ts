/**
 * SecureStore-backed persistence for biometric/PIN enrollment.
 *
 * One JSON record per app, stored under
 * `ble_<app>_biometric_enrollment` (key derived from the supplied app
 * slug). The biometric state is stored SEPARATELY from the auth tokens
 * (`ble_<app>_token` / `ble_<app>_refresh_token`) so that a 10-fail
 * wipe of biometric state does NOT automatically destroy the active
 * Keycloak session — that decision is at the caller's discretion.
 *
 * ## Schema versioning
 *
 * The `schemaVersion` field is `1` for the initial release. Future
 * additions (extra fields, renames) bump to 2 and the {@link migrateRaw}
 * function handles backward-compatible upcasts on read.
 *
 * ## Wiping
 *
 * {@link wipeEnrollment} deletes the SecureStore key. The caller is
 * responsible for ALSO clearing tokens via the auth context's logout()
 * if the wipe is triggered by 10-fail PIN exhaustion.
 *
 * ## PIN hashing
 *
 * Hash + salt computation lives in {@link hashPin} / {@link verifyPin}.
 * Uses `expo-crypto` (already in the Expo SDK 54 bundle, no new
 * dependency). Salt is 16 bytes random hex; hash is SHA-256 of
 * `salt:pin` (PBKDF2 would be stronger but expo-crypto doesn't expose
 * it — given the rate-limited UI keypad and the wipe-after-10 policy,
 * SHA-256 is sufficient against offline brute-force given a stolen
 * SecureStore dump).
 */

import * as SecureStore from 'expo-secure-store'
import * as Crypto from 'expo-crypto'
import type { LockoutState } from './lockoutMachine'

// ── Types ─────────────────────────────────────────────────────────────────────

/** Persisted enrollment record. Single JSON value per app. */
export interface EnrollmentRecord {
  /** Schema version — bump on shape change, migrate in {@link migrateRaw}. */
  readonly schemaVersion: 1

  /** True iff user has completed the opt-in flow (set PIN + verified biometric). */
  readonly isEnrolled: boolean

  /** True iff user dismissed the first-login modal with "never ask again". */
  readonly optedOut: boolean

  /** SHA-256 hex of `salt:pin`. null until PIN is set. */
  readonly pinHash: string | null
  /** 16-byte random hex used for PIN hashing. null until PIN is set. */
  readonly pinSalt: string | null

  /** Biometric subsystem available + enrolled at the OS level. */
  readonly biometricEnabled: boolean

  /** Cumulative wrong-PIN counter. Reset on successful PIN entry. */
  readonly failCount: number

  /** Current lockout machine state. */
  readonly lockoutState: LockoutState

  /** Epoch ms of last biometric/PIN prompt shown (for telemetry). null = never. */
  readonly lastPromptMs: number | null

  /** Epoch ms of last successful unlock (for 3-min Smart re-prompt threshold). */
  readonly lastSuccessMs: number | null

  /** Epoch ms when user first enrolled. null = never enrolled. */
  readonly enrolledAt: number | null
}

/** Default record shape. Used on fresh install + as fallback for missing fields. */
export const DEFAULT_ENROLLMENT: EnrollmentRecord = {
  schemaVersion: 1,
  isEnrolled: false,
  optedOut: false,
  pinHash: null,
  pinSalt: null,
  biometricEnabled: false,
  failCount: 0,
  lockoutState: { phase: 'OPEN' },
  lastPromptMs: null,
  lastSuccessMs: null,
  enrolledAt: null,
}

// ── Storage keys ──────────────────────────────────────────────────────────────

/**
 * Build the SecureStore key for a given app slug. The slug should be
 * the same string used in the app's other SecureStore keys
 * (`ble_<slug>_token`, `ble_<slug>_refresh_token`).
 *
 * Examples: 'consumer', 'merchant', 'tenant', 'territory', 'sales_agent'.
 */
export function storageKeyFor(appSlug: string): string {
  return `ble_${appSlug}_biometric_enrollment`
}

// ── Read / write / wipe ───────────────────────────────────────────────────────

/**
 * Read the current enrollment record. Returns DEFAULT_ENROLLMENT if no
 * key exists or the value is corrupt. Migrations applied transparently.
 */
export async function readEnrollment(appSlug: string): Promise<EnrollmentRecord> {
  try {
    const raw = await SecureStore.getItemAsync(storageKeyFor(appSlug))
    if (!raw) return DEFAULT_ENROLLMENT
    return migrateRaw(JSON.parse(raw))
  } catch {
    // Corrupt JSON or SecureStore failure — safest default is to
    // reset, which forces a fresh enrollment flow on next launch.
    return DEFAULT_ENROLLMENT
  }
}

/**
 * Write the enrollment record. Caller is responsible for constructing a
 * full {@link EnrollmentRecord} (use spread on the previous value, do
 * not partial-write).
 *
 * @throws when SecureStore write fails (device storage full, keychain
 *   locked, or other native-bridge error). Callers that want to tolerate
 *   transient failures should wrap with try/catch — the symmetric
 *   {@link readEnrollment} swallows errors and falls back to defaults
 *   because read failures are recoverable; write failures are not, and
 *   surfacing them keeps the caller honest about persistence.
 */
export async function writeEnrollment(
  appSlug: string,
  record: EnrollmentRecord,
): Promise<void> {
  await SecureStore.setItemAsync(storageKeyFor(appSlug), JSON.stringify(record))
}

/**
 * Delete the enrollment key and return the cleared record. Use after a
 * 10-fail wipe or explicit "remove biometric login" in settings.
 *
 * H1: returns {@link DEFAULT_ENROLLMENT} so the caller can immediately
 * replace its in-memory copy with a zeroed record. The previous version
 * returned `void`, which left the live `EnrollmentRecord` (with the
 * pinHash + pinSalt fields populated) sitting in the JS heap until GC
 * — a 6-digit PIN hash recovered from a heap dump is brute-forceable in
 * milliseconds.
 */
export async function wipeEnrollment(appSlug: string): Promise<EnrollmentRecord> {
  await SecureStore.deleteItemAsync(storageKeyFor(appSlug))
  return DEFAULT_ENROLLMENT
}

// ── PIN hashing ───────────────────────────────────────────────────────────────

/**
 * Compute the canonical PIN hash + salt. Returns a fresh salt on every
 * call — used at PIN-set time. Salt is 16 random bytes hex-encoded.
 *
 * @throws if `expo-crypto` rejects (rare: cold-start race on some Android
 *   OEMs, or native-bridge crash). Callers should surface this as an
 *   explicit "PIN setup failed, please retry" UI rather than silently
 *   leaving a partial record on disk.
 */
export async function hashPin(pin: string): Promise<{ hash: string; salt: string }> {
  let saltBytes: Uint8Array
  try {
    saltBytes = await Crypto.getRandomBytesAsync(16)
  } catch (e) {
    // H6: surface explicitly. A silent fallback to a deterministic salt
    // would compromise every future PIN; refusing to proceed is safer.
    throw new Error(
      '[auth/biometric] Salt generation failed — PIN setup cannot proceed',
      { cause: e as Error },
    )
  }
  const salt = bytesToHex(saltBytes)
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${pin}`,
    { encoding: Crypto.CryptoEncoding.HEX },
  )
  return { hash, salt }
}

/**
 * Verify a candidate PIN against a stored hash+salt. Returns true on
 * match. Constant-time comparison prevents timing-side-channel leaks
 * (overkill given the wipe-after-10 policy, but cheap and idiomatic).
 */
export async function verifyPin(
  pin: string,
  storedHash: string,
  storedSalt: string,
): Promise<boolean> {
  const candidate = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${storedSalt}:${pin}`,
    { encoding: Crypto.CryptoEncoding.HEX },
  )
  return constantTimeEquals(candidate, storedHash)
}

// ── Migration ─────────────────────────────────────────────────────────────────

/**
 * Up-cast a raw parsed JSON value to the current EnrollmentRecord shape.
 * Handles missing fields by filling from DEFAULT_ENROLLMENT.
 *
 * Bumped schema versions add a new `case` here. The function is the SOLE
 * place that knows about all historical schemas.
 */
export function migrateRaw(raw: unknown): EnrollmentRecord {
  if (raw === null || typeof raw !== 'object') return DEFAULT_ENROLLMENT
  const r = raw as Partial<EnrollmentRecord>

  // C2: hard-fail on unknown/future schemaVersion. Returning
  // DEFAULT_ENROLLMENT (forcing fresh enrollment) is safer than silently
  // mapping fields by name — a future v2 might rename fields, and a
  // partial migration could erase an active wipe-state by missing the
  // renamed failCount field.
  if (r.schemaVersion !== 1) return DEFAULT_ENROLLMENT

  // H3: every numeric field uses Number.isFinite to reject NaN/Infinity.
  // typeof NaN === 'number' alone would let NaN slip through and break
  // every downstream comparison (NaN >= n is always false), defeating
  // the lockout escalation entirely.
  return {
    schemaVersion: 1,
    isEnrolled: typeof r.isEnrolled === 'boolean' ? r.isEnrolled : DEFAULT_ENROLLMENT.isEnrolled,
    optedOut: typeof r.optedOut === 'boolean' ? r.optedOut : DEFAULT_ENROLLMENT.optedOut,
    pinHash: typeof r.pinHash === 'string' ? r.pinHash : DEFAULT_ENROLLMENT.pinHash,
    pinSalt: typeof r.pinSalt === 'string' ? r.pinSalt : DEFAULT_ENROLLMENT.pinSalt,
    biometricEnabled: typeof r.biometricEnabled === 'boolean' ? r.biometricEnabled : DEFAULT_ENROLLMENT.biometricEnabled,
    failCount: typeof r.failCount === 'number' && Number.isFinite(r.failCount) ? r.failCount : DEFAULT_ENROLLMENT.failCount,
    lockoutState: isValidLockoutState(r.lockoutState) ? r.lockoutState : DEFAULT_ENROLLMENT.lockoutState,
    lastPromptMs: typeof r.lastPromptMs === 'number' && Number.isFinite(r.lastPromptMs) ? r.lastPromptMs : DEFAULT_ENROLLMENT.lastPromptMs,
    lastSuccessMs: typeof r.lastSuccessMs === 'number' && Number.isFinite(r.lastSuccessMs) ? r.lastSuccessMs : DEFAULT_ENROLLMENT.lastSuccessMs,
    enrolledAt: typeof r.enrolledAt === 'number' && Number.isFinite(r.enrolledAt) ? r.enrolledAt : DEFAULT_ENROLLMENT.enrolledAt,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidLockoutState(v: unknown): v is LockoutState {
  if (v === null || typeof v !== 'object') return false
  const s = v as Record<string, unknown>
  if (s.phase === 'OPEN' || s.phase === 'WIPED') return true
  // C1: LOCKED state needs a finite numeric unlocksAtMs to be usable.
  // Without this guard a corrupted SecureStore record like
  // { phase: 'LOCKED', unlocksAtMs: null } would pass the guard and then
  // `unlocksAtMs > nowMs` returns false, silently dropping an active
  // lockout — a real security bypass.
  if (s.phase === 'LOCKED') {
    return typeof s.unlocksAtMs === 'number' && Number.isFinite(s.unlocksAtMs)
  }
  return false
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Constant-time string equality.
 *
 * H4: avoids the early-return on length mismatch that would otherwise
 * leak length information through the function's return time. The
 * length-XOR captures any length difference as a bit set in `diff`, and
 * the loop runs over `max(a.length, b.length)` so the wall-clock cost
 * is constant w.r.t. which input is shorter.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length)
  let diff = a.length ^ b.length
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return diff === 0
}
