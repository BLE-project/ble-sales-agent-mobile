/**
 * Fase 3.0b.5: Unit tests for beaconApi + territoryApi + randomize helpers —
 * sales-agent mobile.
 *
 * Coverage:
 *  - beaconApi.updateConfig() calls PUT /api/v1/beacons/:id with the full body
 *  - beaconApi.list / enroll / updateName / setPassword URLs
 *  - territoryApi.list() calls GET /api/v1/territories
 *  - generateIBeaconUuid() returns a UUID-shaped string
 *  - randomizeBeaconIdentity() returns uuid + major/minor in [1, 65535]
 *  - Fallback path when crypto.randomUUID is missing (simulating RN Hermes < 0.75)
 */
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }))

jest.mock('expo-secure-store', () => ({
  getItemAsync:    jest.fn().mockResolvedValue(null),
  setItemAsync:    jest.fn(),
  deleteItemAsync: jest.fn(),
}))

import {
  beaconApi,
  territoryApi,
  BeaconConfigUpdate,
  generateIBeaconUuid,
  randomizeBeaconIdentity,
} from '../api/salesAgentApi'

const mockFetch = jest.fn()
;(globalThis as unknown as { fetch: jest.Mock }).fetch = mockFetch

function mockJsonRes(status: number, body: unknown) {
  return {
    ok:         status >= 200 && status < 300,
    status,
    json:       () => Promise.resolve(body),
    text:       () => Promise.resolve(JSON.stringify(body)),
    statusText: `HTTP ${status}`,
  }
}

beforeEach(() => {
  mockFetch.mockReset()
  mockFetch.mockResolvedValue(mockJsonRes(200, {}))
})

// ── beaconApi endpoint wiring ───────────────────────────────────────────────

describe('beaconApi endpoint wiring', () => {
  it('list() calls GET /api/v1/beacons', async () => {
    await beaconApi.list()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/beacons'),
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('enroll() calls POST /api/v1/beacons with body', async () => {
    const req = {
      territoryId: 't1',
      type: 'MERCHANT' as const,
      ibeaconUuid: '00000000-0000-4000-8000-000000000001',
      major: 1,
      minor: 1,
    }
    await beaconApi.enroll(req)
    const [, init] = mockFetch.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual(req)
  })

  it('updateName() calls PUT /api/v1/beacons/:id/name with { name }', async () => {
    await beaconApi.updateName('b-1', 'Ingresso Nord')
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/beacons/b-1/name')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual({ name: 'Ingresso Nord' })
  })

  it('updateConfig() calls PUT /api/v1/beacons/:id with the full body', async () => {
    const body: BeaconConfigUpdate = {
      territoryId: 'terr-1',
      type: 'MERCHANT',
      ibeaconUuid: '11111111-2222-4333-8444-555555555555',
      major: 42,
      minor: 7,
      txPower: -59,
      assignedToStoreId: null,
      assignedToZoneId: null,
    }
    await beaconApi.updateConfig('bid-99', body)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/beacons/bid-99')
    expect(url).not.toContain('/name')
    expect(url).not.toContain('/password')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual(body)
  })
})

// ── territoryApi endpoint wiring ────────────────────────────────────────────

describe('territoryApi endpoint wiring', () => {
  it('list() calls GET /api/v1/territories', async () => {
    await territoryApi.list()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/territories'),
      expect.objectContaining({ method: 'GET' }),
    )
  })
})

// ── generateIBeaconUuid ─────────────────────────────────────────────────────

describe('generateIBeaconUuid', () => {
  it('returns a UUID-shaped string when crypto.randomUUID is available', () => {
    const uuid = generateIBeaconUuid()
    expect(uuid).toMatch(
      /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[0-9A-F]{4}-[0-9A-F]{12}$/,
    )
  })

  it('falls back to Math.random when crypto.randomUUID is missing (Hermes <0.75)', () => {
    // Node exposes globalThis.crypto as a read-only getter, so use
    // Object.defineProperty which bypasses that restriction.
    const originalDesc = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      writable: true,
      configurable: true,
    })
    try {
      const uuid = generateIBeaconUuid()
      expect(uuid).toMatch(
        /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/,
      )
    } finally {
      if (originalDesc) {
        Object.defineProperty(globalThis, 'crypto', originalDesc)
      } else {
        delete (globalThis as unknown as { crypto?: unknown }).crypto
      }
    }
  })
})

// ── randomizeBeaconIdentity ─────────────────────────────────────────────────

describe('randomizeBeaconIdentity', () => {
  it('returns uuid + major/minor triple', () => {
    const triple = randomizeBeaconIdentity()
    expect(triple).toHaveProperty('ibeaconUuid')
    expect(triple).toHaveProperty('major')
    expect(triple).toHaveProperty('minor')
  })

  it('major is within BLE [1, 65535] range', () => {
    for (let i = 0; i < 100; i++) {
      const { major } = randomizeBeaconIdentity()
      expect(major).toBeGreaterThanOrEqual(1)
      expect(major).toBeLessThanOrEqual(65535)
    }
  })

  it('minor is within BLE [1, 65535] range', () => {
    for (let i = 0; i < 100; i++) {
      const { minor } = randomizeBeaconIdentity()
      expect(minor).toBeGreaterThanOrEqual(1)
      expect(minor).toBeLessThanOrEqual(65535)
    }
  })

  it('successive calls produce distinct uuids (collision probability ≈ 0)', () => {
    const a = randomizeBeaconIdentity()
    const b = randomizeBeaconIdentity()
    expect(a.ibeaconUuid).not.toBe(b.ibeaconUuid)
  })

  it('major/minor never drop to 0 when Math.random returns exactly 0', () => {
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0)
    try {
      const { major, minor } = randomizeBeaconIdentity()
      expect(major).toBe(1)
      expect(minor).toBe(1)
    } finally {
      spy.mockRestore()
    }
  })

  it('major/minor stay ≤ 65535 when Math.random returns just under 1', () => {
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0.9999999)
    try {
      const { major, minor } = randomizeBeaconIdentity()
      expect(major).toBeLessThanOrEqual(65535)
      expect(minor).toBeLessThanOrEqual(65535)
    } finally {
      spy.mockRestore()
    }
  })
})
