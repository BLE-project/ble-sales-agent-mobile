/**
 * Tests for enrollmentStorage — the SecureStore + PIN-hashing layer.
 *
 * Goal: cover the security-critical paths surfaced in Phase 6 review:
 *   - migrateRaw (C2, H3): schema-version gating, NaN/Infinity rejection
 *   - isValidLockoutState via migrateRaw (C1): corrupted LOCKED state rejection
 *   - hashPin / verifyPin (H4, H5): round-trip + constant-time behavior
 *   - hashPin (H6): explicit error on Crypto.getRandomBytesAsync rejection
 *   - wipeEnrollment (H1): returns DEFAULT_ENROLLMENT and deletes the key
 */

import * as SecureStore from 'expo-secure-store'
import * as Crypto from 'expo-crypto'
import {
  readEnrollment,
  writeEnrollment,
  wipeEnrollment,
  hashPin,
  verifyPin,
  storageKeyFor,
  DEFAULT_ENROLLMENT,
  type EnrollmentRecord,
} from './enrollmentStorage'
// migrateRaw is intentionally not re-exported from index.ts (review N2).
// Import directly from the source file for white-box testing.
import { migrateRaw } from './enrollmentStorage'

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
  getRandomBytesAsync: jest.fn(),
  digestStringAsync: jest.fn(),
}))

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>
const mockedCrypto = Crypto as jest.Mocked<typeof Crypto>

beforeEach(() => {
  jest.resetAllMocks()
})

// ── storageKeyFor ─────────────────────────────────────────────────────────────

describe('storageKeyFor', () => {
  it('builds the canonical key', () => {
    expect(storageKeyFor('consumer')).toBe('ble_consumer_biometric_enrollment')
    expect(storageKeyFor('sales_agent')).toBe('ble_sales_agent_biometric_enrollment')
  })
})

// ── migrateRaw — schema-version gating (C2) ───────────────────────────────────

describe('migrateRaw — schema version', () => {
  it('returns DEFAULT_ENROLLMENT for null', () => {
    expect(migrateRaw(null)).toEqual(DEFAULT_ENROLLMENT)
  })

  it('returns DEFAULT_ENROLLMENT for non-object input', () => {
    expect(migrateRaw('not an object')).toEqual(DEFAULT_ENROLLMENT)
    expect(migrateRaw(42)).toEqual(DEFAULT_ENROLLMENT)
  })

  it('returns DEFAULT_ENROLLMENT for missing schemaVersion', () => {
    // C2: a record without schemaVersion should NOT be partial-migrated
    expect(migrateRaw({ isEnrolled: true })).toEqual(DEFAULT_ENROLLMENT)
  })

  it('returns DEFAULT_ENROLLMENT for unknown future schemaVersion (downgrade safety)', () => {
    // C2: a v=2 record on a downgraded app must NOT be silently mapped
    expect(migrateRaw({ schemaVersion: 2, isEnrolled: true, failCount: 5 }))
      .toEqual(DEFAULT_ENROLLMENT)
    expect(migrateRaw({ schemaVersion: 99 })).toEqual(DEFAULT_ENROLLMENT)
  })

  it('accepts schemaVersion: 1 records', () => {
    const v1: EnrollmentRecord = {
      ...DEFAULT_ENROLLMENT,
      schemaVersion: 1,
      isEnrolled: true,
      failCount: 2,
    }
    expect(migrateRaw(v1)).toEqual(v1)
  })
})

// ── migrateRaw — NaN/Infinity rejection (H3) ──────────────────────────────────

describe('migrateRaw — numeric guards (H3)', () => {
  it('rejects NaN failCount', () => {
    const r = migrateRaw({ schemaVersion: 1, failCount: NaN })
    expect(r.failCount).toBe(0)
  })

  it('rejects Infinity failCount', () => {
    const r = migrateRaw({ schemaVersion: 1, failCount: Infinity })
    expect(r.failCount).toBe(0)
  })

  it('rejects -Infinity failCount', () => {
    const r = migrateRaw({ schemaVersion: 1, failCount: -Infinity })
    expect(r.failCount).toBe(0)
  })

  it('rejects NaN lastSuccessMs (3-min threshold safety)', () => {
    // If lastSuccessMs is Infinity, the Smart-3-min check
    // (nowMs - lastSuccessMs < 180_000) is always false —
    // permanently suppressing re-prompts.
    const r = migrateRaw({ schemaVersion: 1, lastSuccessMs: NaN })
    expect(r.lastSuccessMs).toBeNull()
  })

  it('rejects Infinity lastSuccessMs', () => {
    const r = migrateRaw({ schemaVersion: 1, lastSuccessMs: Infinity })
    expect(r.lastSuccessMs).toBeNull()
  })

  it('accepts finite numeric timestamps', () => {
    const r = migrateRaw({ schemaVersion: 1, lastSuccessMs: 1_700_000_000_000 })
    expect(r.lastSuccessMs).toBe(1_700_000_000_000)
  })
})

// ── isValidLockoutState via migrateRaw (C1) ───────────────────────────────────

describe('migrateRaw — LOCKED state validation (C1)', () => {
  it('rejects LOCKED with null unlocksAtMs', () => {
    const r = migrateRaw({
      schemaVersion: 1,
      lockoutState: { phase: 'LOCKED', unlocksAtMs: null },
    })
    expect(r.lockoutState).toEqual({ phase: 'OPEN' })
  })

  it('rejects LOCKED with NaN unlocksAtMs', () => {
    const r = migrateRaw({
      schemaVersion: 1,
      lockoutState: { phase: 'LOCKED', unlocksAtMs: NaN },
    })
    expect(r.lockoutState).toEqual({ phase: 'OPEN' })
  })

  it('rejects LOCKED with string unlocksAtMs', () => {
    const r = migrateRaw({
      schemaVersion: 1,
      lockoutState: { phase: 'LOCKED', unlocksAtMs: '60000' },
    })
    expect(r.lockoutState).toEqual({ phase: 'OPEN' })
  })

  it('rejects LOCKED with missing unlocksAtMs', () => {
    const r = migrateRaw({
      schemaVersion: 1,
      lockoutState: { phase: 'LOCKED' },
    })
    expect(r.lockoutState).toEqual({ phase: 'OPEN' })
  })

  it('accepts LOCKED with valid finite unlocksAtMs', () => {
    const r = migrateRaw({
      schemaVersion: 1,
      lockoutState: { phase: 'LOCKED', unlocksAtMs: 1_700_000_060_000 },
    })
    expect(r.lockoutState).toEqual({ phase: 'LOCKED', unlocksAtMs: 1_700_000_060_000 })
  })

  it('accepts OPEN and WIPED without further validation', () => {
    expect(migrateRaw({ schemaVersion: 1, lockoutState: { phase: 'OPEN' } }).lockoutState)
      .toEqual({ phase: 'OPEN' })
    expect(migrateRaw({ schemaVersion: 1, lockoutState: { phase: 'WIPED' } }).lockoutState)
      .toEqual({ phase: 'WIPED' })
  })

  it('rejects unknown phase string', () => {
    const r = migrateRaw({
      schemaVersion: 1,
      lockoutState: { phase: 'EXOTIC' },
    })
    expect(r.lockoutState).toEqual({ phase: 'OPEN' })
  })
})

// ── readEnrollment / writeEnrollment / wipeEnrollment ─────────────────────────

describe('readEnrollment', () => {
  it('returns DEFAULT_ENROLLMENT when key is absent', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValueOnce(null)
    expect(await readEnrollment('consumer')).toEqual(DEFAULT_ENROLLMENT)
  })

  it('returns DEFAULT_ENROLLMENT on JSON parse error', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValueOnce('not-json{')
    expect(await readEnrollment('consumer')).toEqual(DEFAULT_ENROLLMENT)
  })

  it('returns DEFAULT_ENROLLMENT on SecureStore failure', async () => {
    mockedSecureStore.getItemAsync.mockRejectedValueOnce(new Error('keychain locked'))
    expect(await readEnrollment('consumer')).toEqual(DEFAULT_ENROLLMENT)
  })

  it('returns the migrated record on a valid v1 entry', async () => {
    const valid: EnrollmentRecord = {
      ...DEFAULT_ENROLLMENT,
      isEnrolled: true,
      failCount: 2,
    }
    mockedSecureStore.getItemAsync.mockResolvedValueOnce(JSON.stringify(valid))
    expect(await readEnrollment('consumer')).toEqual(valid)
  })
})

describe('writeEnrollment', () => {
  it('writes the JSON-stringified record under the canonical key', async () => {
    mockedSecureStore.setItemAsync.mockResolvedValueOnce(undefined)
    await writeEnrollment('consumer', DEFAULT_ENROLLMENT)
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith(
      'ble_consumer_biometric_enrollment',
      JSON.stringify(DEFAULT_ENROLLMENT),
    )
  })

  it('propagates SecureStore errors (M2 contract)', async () => {
    mockedSecureStore.setItemAsync.mockRejectedValueOnce(new Error('disk full'))
    await expect(writeEnrollment('consumer', DEFAULT_ENROLLMENT))
      .rejects.toThrow('disk full')
  })
})

describe('wipeEnrollment (H1)', () => {
  it('returns DEFAULT_ENROLLMENT after wiping', async () => {
    mockedSecureStore.deleteItemAsync.mockResolvedValueOnce(undefined)
    const result = await wipeEnrollment('consumer')
    expect(result).toEqual(DEFAULT_ENROLLMENT)
  })

  it('calls deleteItemAsync with the canonical key', async () => {
    mockedSecureStore.deleteItemAsync.mockResolvedValueOnce(undefined)
    await wipeEnrollment('consumer')
    expect(mockedSecureStore.deleteItemAsync)
      .toHaveBeenCalledWith('ble_consumer_biometric_enrollment')
  })
})

// ── hashPin / verifyPin ──────────────────────────────────────────────────────

describe('hashPin (H6)', () => {
  it('returns hash + salt on happy path', async () => {
    mockedCrypto.getRandomBytesAsync.mockResolvedValueOnce(
      new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
    )
    mockedCrypto.digestStringAsync.mockResolvedValueOnce('a1b2c3d4'.repeat(8))
    const result = await hashPin('123456')
    expect(result.salt).toBe('0102030405060708090a0b0c0d0e0f10')
    expect(result.hash).toBe('a1b2c3d4'.repeat(8))
    expect(mockedCrypto.digestStringAsync).toHaveBeenCalledWith(
      'SHA-256',
      '0102030405060708090a0b0c0d0e0f10:123456',
      { encoding: 'hex' },
    )
  })

  it('throws explicit error when getRandomBytesAsync rejects (H6)', async () => {
    mockedCrypto.getRandomBytesAsync.mockRejectedValueOnce(new Error('native bridge crashed'))
    await expect(hashPin('123456')).rejects.toThrow(
      '[auth/biometric] Salt generation failed',
    )
  })
})

describe('verifyPin', () => {
  it('returns true for matching pin', async () => {
    const expectedHash = 'cafebabe'.repeat(8)
    mockedCrypto.digestStringAsync.mockResolvedValueOnce(expectedHash)
    const result = await verifyPin('123456', expectedHash, 'salt-hex')
    expect(result).toBe(true)
  })

  it('returns false for non-matching pin', async () => {
    const storedHash = 'cafebabe'.repeat(8)
    const wrongHash = 'deadbeef'.repeat(8)
    mockedCrypto.digestStringAsync.mockResolvedValueOnce(wrongHash)
    expect(await verifyPin('999999', storedHash, 'salt-hex')).toBe(false)
  })

  it('returns false even when candidate length differs (H4 indirect)', async () => {
    // The constant-time comparator no longer early-returns on length
    // mismatch; verify wrong-length input still resolves to false.
    const storedHash = 'cafebabe'.repeat(8)        // 64 chars
    const truncatedHash = 'cafebabe'.repeat(4)     // 32 chars (broken stored value)
    mockedCrypto.digestStringAsync.mockResolvedValueOnce(truncatedHash)
    expect(await verifyPin('123456', storedHash, 'salt-hex')).toBe(false)
  })

  it('uses the same salt:pin format as hashPin', async () => {
    mockedCrypto.digestStringAsync.mockResolvedValueOnce('any-hash')
    await verifyPin('123456', 'stored-hash', 'my-salt')
    expect(mockedCrypto.digestStringAsync).toHaveBeenCalledWith(
      'SHA-256',
      'my-salt:123456',
      { encoding: 'hex' },
    )
  })
})
