/**
 * Biometric auth opt-in gate (host-app variant of the I3 consent pattern).
 *
 * Mirrors `src/ble/consent.ts` shape: module-level state, default-deny,
 * synchronous getter, host-app installs a real getter at bootstrap.
 *
 * ## Why this exists
 *
 * The biometric/PIN unlock flow needs to know — synchronously, on every
 * AppState transition — whether the user has opted in. Reading SecureStore
 * on every check would be too slow (async + native bridge round-trip).
 * Instead, the host app keeps an in-memory mirror of the persisted
 * `isEnrolled` flag and exposes it as a sync closure via
 * {@link setBiometricGetter}.
 *
 * ## Default-deny
 *
 * If no real getter is installed, `getBiometricEnrolled` returns `false`
 * and a one-shot warning is logged. This matches the `consent.ts`
 * default-deny stance from ADR-004 D1 / I3.
 *
 * ## Usage
 *
 * ```ts
 * // bootstrap (in useBiometricAuth.ts)
 * import { setBiometricGetter } from '@/auth/biometric'
 *
 * useEffect(() => {
 *   setBiometricGetter(() => state.isEnrolled)
 * }, [state.isEnrolled])
 * ```
 *
 * ## Related
 *
 * - I3 invariant (BLE consent) — same shape, different domain
 * - `src/ble/consent.ts` — the original pattern this mirrors
 * - ADR-004 D1 (provider-injection-with-default-deny)
 */

// Reference equality marker for the default-deny lambda. Kept at module
// scope so `_biometricGetter === defaultDeny` works after replacement.
const defaultDeny: () => boolean = () => false

let _biometricGetter: () => boolean = defaultDeny
let _warnedDefault = false

/**
 * Install the host-app's biometric-enrolled checker. Should be called once
 * at app bootstrap and re-installed whenever the enrolled state flips
 * (opt-in / opt-out / wipe).
 *
 * @param getter synchronous function returning current enrolled state
 */
export function setBiometricGetter(getter: () => boolean): void {
  _biometricGetter = getter
  // Reset the warn flag so a re-install of a real getter clears the
  // "default deny in effect" log line on the next check.
  _warnedDefault = false
}

/**
 * Returns `true` iff the host app has installed a real biometric getter
 * AND that getter currently reports enrolled. Called by the auth-unlock
 * gate before deciding whether to prompt.
 *
 * Logs a one-shot warning when the default-deny lambda is in effect, so a
 * forgetful integrator sees a clear breadcrumb in dev logs.
 */
export function getBiometricEnrolled(): boolean {
  // M3: flat try/catch is more readable than the IIFE pattern carried
  // over from consent.ts.
  let enrolled: boolean
  try { enrolled = _biometricGetter() }
  catch { enrolled = false }   // any error in the getter -> safest default

  if (!enrolled && _biometricGetter === defaultDeny && !_warnedDefault) {
    _warnedDefault = true
    // N4: dev-only breadcrumb. The project's no-console-in-prod rule
    // (rules/common/coding-style.md) means we must gate this behind
    // __DEV__ so it never ships in EAS production builds. Hermes
    // strips `__DEV__` blocks at minification time.
    if (__DEV__) {
      console.warn(
        '[auth/biometric] setBiometricGetter() never called — using default-deny. ' +
        'Biometric prompts will never appear until a real getter is installed at app bootstrap.',
      )
    }
  }
  return enrolled
}

/** Visible for testing: reset the warn flag + restore the default-deny getter. */
export function _resetBiometricGate(): void {
  _biometricGetter = defaultDeny
  _warnedDefault = false
}
