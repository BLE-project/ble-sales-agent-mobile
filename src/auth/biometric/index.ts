/**
 * Biometric auth + PIN fallback — public API barrel.
 *
 * This module is the SHARED source-of-truth for biometric/PIN logic
 * across the 5 Terrio mobile apps. The other 4 apps (merchant, tenant,
 * territory, sales-agent) receive copies of these files via
 * `scripts/sync-biometric-shared.sh` (next milestone).
 *
 * The public surface is intentionally minimal. Internal helpers
 * (`constantTimeEquals`, `bytesToHex`, `migrateRaw`, the test-only
 * `_resetBiometricGate`) are NOT re-exported here — tests and internal
 * callers import them directly from the sibling source files, matching
 * the precedent in `src/ble/consent.ts` + `src/ble/scanner.test.ts`.
 *
 * ## Spec source
 *
 * The Q1-Q11 references in code comments map to the user-decided answers
 * captured during the feature-dev Phase 3 brainstorm (terrio-platform-docs/
 * feature-specs/biometric-auth.md, to be added — until then, see the PR
 * description on the feature-dev branch). Every Q* tag in this module's
 * source is documented inline with the rationale, not just the decision.
 *
 * ## Spec summary
 *
 * - Q1: 5 mobile apps in scope
 * - Q2: Biometric-as-primary (Touch ID unlocks refresh-token in keychain)
 * - Q3+Q11: Smart 3-min threshold (cold start always; warm only after 3 min)
 * - Q4+Q10: 6-digit PIN fallback, escalating lockout (1m/5m/30m), wipe at 10
 * - Q5: refresh-token storage (not username/password)
 * - Q6: Opt-out (proposed at first login)
 * - Q7: I3-consent pattern (sync getter, default-deny, module-level)
 * - Q8: Sequential to Expo SDK upgrade (already on SDK 54)
 * - Q9: Refresh-token from BFF for Cluster B (already in /v1/auth/login response)
 */

// Gate (sync getter, default-deny — I3 pattern)
export {
  setBiometricGetter,
  getBiometricEnrolled,
} from './biometricGate'

// Lockout state machine (pure TS, security-critical)
export {
  recordSuccess,
  recordFailedAttempt,
  isLocked,
  remainingSeconds,
  DEFAULT_LOCKOUT_CONFIG,
} from './lockoutMachine'
export type { LockoutState, LockoutConfig } from './lockoutMachine'

// Persistence (SecureStore + PIN hashing). `migrateRaw` is kept internal
// so callers depend on `readEnrollment`'s contract rather than reaching
// into migration internals.
export {
  readEnrollment,
  writeEnrollment,
  wipeEnrollment,
  hashPin,
  verifyPin,
  storageKeyFor,
  DEFAULT_ENROLLMENT,
} from './enrollmentStorage'
export type { EnrollmentRecord } from './enrollmentStorage'
