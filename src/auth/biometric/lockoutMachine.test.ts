/**
 * Tests for the PIN lockout state machine.
 *
 * Goal: 100% branch coverage. The machine is security-critical (controls
 * the wipe-after-10 boundary) and pure-functional, so it should be
 * exhaustively tested with no mocks.
 */

import {
  recordSuccess,
  recordFailedAttempt,
  isLocked,
  remainingSeconds,
  DEFAULT_LOCKOUT_CONFIG,
  type LockoutState,
} from './lockoutMachine'

const NOW = 1_700_000_000_000  // arbitrary fixed epoch ms

describe('lockoutMachine — recordSuccess', () => {
  it('returns OPEN', () => {
    expect(recordSuccess()).toEqual({ phase: 'OPEN' })
  })
})

describe('lockoutMachine — recordFailedAttempt — boundary enumeration', () => {
  // Per Q10 spec: thresholds [3,7,9], durations [60s, 300s, 1800s], wipeAt 10
  // Test every fail count from 1 to 11 to catch any boundary off-by-one.

  it('failCount=1 → OPEN (no lockout yet)', () => {
    expect(recordFailedAttempt(1, NOW)).toEqual({ phase: 'OPEN' })
  })

  it('failCount=2 → OPEN (still below first threshold)', () => {
    expect(recordFailedAttempt(2, NOW)).toEqual({ phase: 'OPEN' })
  })

  it('failCount=3 → LOCKED 1 min (first threshold)', () => {
    expect(recordFailedAttempt(3, NOW)).toEqual({
      phase: 'LOCKED',
      unlocksAtMs: NOW + 60_000,
    })
  })

  it('failCount=4 → LOCKED 1 min (sustained tier 0)', () => {
    expect(recordFailedAttempt(4, NOW)).toEqual({
      phase: 'LOCKED',
      unlocksAtMs: NOW + 60_000,
    })
  })

  it('failCount=5 → LOCKED 1 min (still tier 0, full assertion)', () => {
    // Reviewer-1 #6: previously this case only checked .phase, leaving
    // a regression in unlocksAtMs at this specific count undetected.
    expect(recordFailedAttempt(5, NOW)).toEqual({
      phase: 'LOCKED',
      unlocksAtMs: NOW + 60_000,
    })
  })

  it('failCount=6 → LOCKED 1 min (still tier 0)', () => {
    expect(recordFailedAttempt(6, NOW)).toEqual({
      phase: 'LOCKED',
      unlocksAtMs: NOW + 60_000,
    })
  })

  it('failCount=7 → LOCKED 5 min (tier 1)', () => {
    expect(recordFailedAttempt(7, NOW)).toEqual({
      phase: 'LOCKED',
      unlocksAtMs: NOW + 5 * 60_000,
    })
  })

  it('failCount=8 → LOCKED 5 min (tier 1 sustained)', () => {
    expect(recordFailedAttempt(8, NOW)).toEqual({
      phase: 'LOCKED',
      unlocksAtMs: NOW + 5 * 60_000,
    })
  })

  it('failCount=9 → LOCKED 30 min (tier 2)', () => {
    expect(recordFailedAttempt(9, NOW)).toEqual({
      phase: 'LOCKED',
      unlocksAtMs: NOW + 30 * 60_000,
    })
  })

  it('failCount=10 → WIPED (terminal, security wipe)', () => {
    expect(recordFailedAttempt(10, NOW)).toEqual({ phase: 'WIPED' })
  })

  it('failCount=11 → WIPED (still wiped, idempotent past threshold)', () => {
    expect(recordFailedAttempt(11, NOW)).toEqual({ phase: 'WIPED' })
  })

  it('failCount=0 (defensive) → OPEN', () => {
    // Caller bug: recordFailedAttempt called without incrementing.
    // Defensive: treat as no-op rather than crash.
    expect(recordFailedAttempt(0, NOW)).toEqual({ phase: 'OPEN' })
  })

  it('failCount=NaN → WIPED (H2 guard)', () => {
    // typeof NaN === 'number' silently slips through normal comparisons.
    // The H2 guard treats invalid input as a wipe to avoid
    // bypassing every lockout tier when failCount becomes NaN.
    expect(recordFailedAttempt(NaN, NOW)).toEqual({ phase: 'WIPED' })
  })

  it('failCount=-1 (negative) → WIPED (H2 guard)', () => {
    expect(recordFailedAttempt(-1, NOW)).toEqual({ phase: 'WIPED' })
  })

  it('failCount=Infinity → WIPED (H2 guard)', () => {
    expect(recordFailedAttempt(Infinity, NOW)).toEqual({ phase: 'WIPED' })
  })
})

describe('lockoutMachine — recordFailedAttempt — custom config', () => {
  const tightConfig = {
    thresholds: [2, 4, 5] as const,
    durationsMs: [10_000, 30_000, 90_000] as const,
    wipeAt: 6,
  }

  it('respects custom thresholds', () => {
    expect(recordFailedAttempt(1, NOW, tightConfig).phase).toBe('OPEN')
    expect(recordFailedAttempt(2, NOW, tightConfig).phase).toBe('LOCKED')
    expect(recordFailedAttempt(6, NOW, tightConfig).phase).toBe('WIPED')
  })

  it('uses custom durations for the right tier', () => {
    expect(recordFailedAttempt(2, NOW, tightConfig)).toEqual({
      phase: 'LOCKED', unlocksAtMs: NOW + 10_000,
    })
    expect(recordFailedAttempt(4, NOW, tightConfig)).toEqual({
      phase: 'LOCKED', unlocksAtMs: NOW + 30_000,
    })
    expect(recordFailedAttempt(5, NOW, tightConfig)).toEqual({
      phase: 'LOCKED', unlocksAtMs: NOW + 90_000,
    })
  })
})

describe('lockoutMachine — isLocked', () => {
  it('OPEN is not locked', () => {
    expect(isLocked({ phase: 'OPEN' }, NOW)).toBe(false)
  })

  it('WIPED is not locked (it is a terminal pre-wipe state, caller decides)', () => {
    expect(isLocked({ phase: 'WIPED' }, NOW)).toBe(false)
  })

  it('LOCKED with future unlocksAtMs IS locked', () => {
    const s: LockoutState = { phase: 'LOCKED', unlocksAtMs: NOW + 60_000 }
    expect(isLocked(s, NOW)).toBe(true)
  })

  it('LOCKED with past unlocksAtMs is NOT locked (timer expired)', () => {
    const s: LockoutState = { phase: 'LOCKED', unlocksAtMs: NOW - 1 }
    expect(isLocked(s, NOW)).toBe(false)
  })

  it('LOCKED at exactly unlocksAtMs is NOT locked (boundary: > not >=)', () => {
    const s: LockoutState = { phase: 'LOCKED', unlocksAtMs: NOW }
    expect(isLocked(s, NOW)).toBe(false)
  })
})

describe('lockoutMachine — remainingSeconds', () => {
  it('returns 0 for OPEN state', () => {
    expect(remainingSeconds({ phase: 'OPEN' }, NOW)).toBe(0)
  })

  it('returns 0 for WIPED state', () => {
    expect(remainingSeconds({ phase: 'WIPED' }, NOW)).toBe(0)
  })

  it('returns rounded-up seconds for active lockout', () => {
    const s: LockoutState = { phase: 'LOCKED', unlocksAtMs: NOW + 30_500 }
    // 30.5s remaining → rounded UP to 31 (better UX: never show 0 while locked)
    expect(remainingSeconds(s, NOW)).toBe(31)
  })

  it('returns 1 for sub-second remaining', () => {
    const s: LockoutState = { phase: 'LOCKED', unlocksAtMs: NOW + 100 }
    expect(remainingSeconds(s, NOW)).toBe(1)
  })

  it('returns 0 for expired lockout', () => {
    const s: LockoutState = { phase: 'LOCKED', unlocksAtMs: NOW - 1 }
    expect(remainingSeconds(s, NOW)).toBe(0)
  })
})

describe('lockoutMachine — DEFAULT_LOCKOUT_CONFIG', () => {
  it('matches Q10 spec (3,7,9 / 1m,5m,30m / wipe at 10)', () => {
    expect(DEFAULT_LOCKOUT_CONFIG.thresholds).toEqual([3, 7, 9])
    expect(DEFAULT_LOCKOUT_CONFIG.durationsMs).toEqual([60_000, 300_000, 1_800_000])
    expect(DEFAULT_LOCKOUT_CONFIG.wipeAt).toBe(10)
  })
})
