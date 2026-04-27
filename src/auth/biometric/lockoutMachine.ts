/**
 * PIN lockout state machine — pure TypeScript, no I/O, no React.
 *
 * Owns the security-critical logic for how the app responds to wrong PIN
 * attempts. Per Q10 (user-decided spec):
 *
 *   - 6-digit numeric PIN
 *   - Escalating lockout: 1 min → 5 min → 30 min
 *   - Wipe credentials after 10 consecutive wrong attempts
 *
 * The machine itself is stateless (pure functions). The caller owns
 * persistence: it passes in the current state, gets back the new state,
 * and is responsible for `writeEnrollment(...)`.
 *
 * ## Lockout escalation
 *
 * | failCount | Action                          |
 * |-----------|---------------------------------|
 * | 1–2       | Wrong, no lockout yet           |
 * | 3         | Lock 1 minute                   |
 * | 4–6       | Lock 1 minute (sustained)       |
 * | 7         | Lock 5 minutes                  |
 * | 8         | Lock 5 minutes                  |
 * | 9         | Lock 30 minutes                 |
 * | 10        | WIPE — terminal                 |
 *
 * The tier function is intentionally simple and the test suite
 * enumerates every transition (fail counts 1..10) so any bug in the
 * boundaries shows up immediately.
 *
 * ## Spec source
 *
 * User decision Q10: "PIN a 6 cifre numeriche, lockout escalating fino a
 * wipe credentials dopo 10 tentativi falsi. Stesso default di iOS Settings →
 * Touch ID & Passcode."
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Discriminated union representing the three terminal phases of the
 * lockout machine. The caller should never construct these directly —
 * use {@link recordSuccess} for OPEN and {@link recordFailedAttempt} for
 * the others.
 *
 * Note: the cumulative wrong-PIN count lives on `EnrollmentRecord.failCount`,
 * not on this union. The single source of truth keeps display + escalation
 * logic in lockstep (review M1).
 */
export type LockoutState =
  | { phase: 'OPEN' }
  | { phase: 'LOCKED'; unlocksAtMs: number }
  | { phase: 'WIPED' }

/**
 * Lockout configuration. Defaults per Q10. Exposed so tests + future
 * tenant-specific tuning can override without forking the machine.
 */
export interface LockoutConfig {
  /** failCount values that trigger a lockout. Must be sorted ascending. */
  readonly thresholds: readonly [number, number, number]
  /** Lockout duration in ms for each threshold tier (parallel to thresholds). */
  readonly durationsMs: readonly [number, number, number]
  /** failCount at which credentials are wiped. */
  readonly wipeAt: number
}

export const DEFAULT_LOCKOUT_CONFIG: LockoutConfig = {
  thresholds: [3, 7, 9],
  // 1 min, 5 min, 30 min
  durationsMs: [60_000, 5 * 60_000, 30 * 60_000],
  wipeAt: 10,
} as const

// ── Machine API ───────────────────────────────────────────────────────────────

/**
 * Record a successful PIN entry. Returns the OPEN state and resets the
 * fail counter. Caller should also clear `failCount` in the persisted
 * `EnrollmentRecord`.
 */
export function recordSuccess(): LockoutState {
  return { phase: 'OPEN' }
}

/**
 * Record a wrong PIN attempt. Decides whether to escalate to LOCKED or
 * WIPED based on the new failCount.
 *
 * @param newFailCount  the cumulative fail count INCLUDING this attempt.
 *                       Caller is responsible for incrementing.
 * @param nowMs         current time in epoch ms (injectable for tests).
 * @param config        lockout config (defaults to DEFAULT_LOCKOUT_CONFIG).
 */
export function recordFailedAttempt(
  newFailCount: number,
  nowMs: number,
  config: LockoutConfig = DEFAULT_LOCKOUT_CONFIG,
): LockoutState {
  // H2: NaN/negative guard. typeof NaN === 'number' silently slips
  // through downstream comparisons (NaN >= n is always false), which
  // would silently bypass every lockout tier. Treat invalid input as a
  // wipe — safer than OPEN since the alternative is a permanent
  // unlock-bypass via a single corrupted failCount field.
  if (!Number.isFinite(newFailCount) || newFailCount < 0) {
    return { phase: 'WIPED' }
  }

  if (newFailCount >= config.wipeAt) {
    return { phase: 'WIPED' }
  }

  const tier = lockoutTier(newFailCount, config.thresholds)
  if (tier === -1) {
    // Below first threshold — wrong attempt, but no lockout yet.
    // Caller still increments failCount in persistence.
    return { phase: 'OPEN' }
  }

  const durationMs = config.durationsMs[tier]
  return {
    phase: 'LOCKED',
    unlocksAtMs: nowMs + durationMs,
  }
}

/**
 * Returns `true` if the lockout is currently in effect.
 *
 * Note: a LOCKED state with `unlocksAtMs <= nowMs` is considered no longer
 * locked (the timer has expired). Caller should still preserve the
 * `failCount` so the next wrong attempt escalates correctly.
 */
export function isLocked(state: LockoutState, nowMs: number): boolean {
  return state.phase === 'LOCKED' && state.unlocksAtMs > nowMs
}

/**
 * Returns the seconds remaining on the current lockout, or 0 if not
 * locked or already expired.
 */
export function remainingSeconds(state: LockoutState, nowMs: number): number {
  if (state.phase !== 'LOCKED') return 0
  const remainingMs = state.unlocksAtMs - nowMs
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Returns the tier index (0, 1, 2) for the given failCount, or -1 if no
 * lockout applies yet. Tier index parallels `config.durationsMs`.
 *
 * Algorithm: find the highest threshold that `newFailCount` has crossed.
 *   thresholds = [3, 7, 9]
 *   failCount=1,2     → -1   (below all thresholds)
 *   failCount=3,4,5,6 → 0    (>= 3, < 7)
 *   failCount=7,8     → 1    (>= 7, < 9)
 *   failCount=9       → 2    (>= 9, < wipeAt=10)
 *   failCount=10      → handled by recordFailedAttempt before this call
 */
function lockoutTier(
  newFailCount: number,
  thresholds: readonly [number, number, number],
): number {
  if (newFailCount >= thresholds[2]) return 2
  if (newFailCount >= thresholds[1]) return 1
  if (newFailCount >= thresholds[0]) return 0
  return -1
}
