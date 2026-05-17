/**
 * FU-26: Unit tests for prospectsApi — sales-agent mobile.
 *
 * Covers:
 *  - list / create / moveStage call the right verb + path
 *  - every call carries the X-Tenant-Id header resolved from the JWT
 *  - tenant resolution fails cleanly with no token / no claim / "ANY" claim
 *  - ApiError surfaced on backend rejections (e.g. 409 illegal transition)
 */
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }))

const mockGetItem = jest.fn()
jest.mock('expo-secure-store', () => ({
  getItemAsync:    (...a: unknown[]) => mockGetItem(...a),
  setItemAsync:    jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))

// prospectsApi → client.ts → AuthContext. Mock AuthContext so the transitive
// notifications / expo-asset import chain doesn't crash jest-expo.
jest.mock('../auth/AuthContext', () => ({
  TOKEN_KEY:   'ble_sales_agent_token',
  REFRESH_KEY: 'ble_sales_agent_refresh_token',
}))

import { prospectsApi } from '../api/prospectsApi'
import { ApiError } from '../api/client'

const TENANT_ID = '11111111-1111-1111-1111-111111111111'

/** Build a (signature-less) JWT whose payload carries the given claims. */
function makeJwt(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${b64({ alg: 'none' })}.${b64(claims)}.sig`
}

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
  mockGetItem.mockReset()
  // Default: a healthy token with a real tenant claim.
  mockGetItem.mockResolvedValue(makeJwt({ ble_tenant_id: TENANT_ID, sub: 'agent-1' }))
  mockFetch.mockResolvedValue(mockJsonRes(200, { items: [], page: 0, size: 200, total: 0 }))
})

// ── list ────────────────────────────────────────────────────────────────────

describe('prospectsApi.list', () => {
  it('calls GET /api/v1/prospects with paging params', async () => {
    await prospectsApi.list()
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/prospects?page=0&size=200')
    expect(init.method).toBe('GET')
  })

  it('sends the X-Tenant-Id header from the JWT claim', async () => {
    await prospectsApi.list()
    const [, init] = mockFetch.mock.calls[0]
    expect(init.headers['X-Tenant-Id']).toBe(TENANT_ID)
    expect(init.headers['Authorization']).toBe(`Bearer ${await mockGetItem.mock.results[0].value}`)
  })

  it('honours custom page / size arguments', async () => {
    await prospectsApi.list(2, 25)
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('page=2&size=25')
  })

  it('returns the paged envelope from the backend', async () => {
    const page = {
      items: [{ id: 'p1', organization: 'Bar Centrale', stage: 'LEAD' }],
      page: 0, size: 200, total: 1,
    }
    mockFetch.mockResolvedValueOnce(mockJsonRes(200, page))
    const result = await prospectsApi.list()
    expect(result.total).toBe(1)
    expect(result.items[0].organization).toBe('Bar Centrale')
  })
})

// ── create ──────────────────────────────────────────────────────────────────

describe('prospectsApi.create', () => {
  it('calls POST /api/v1/prospects with the body + tenant header', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonRes(201, { id: 'p9', stage: 'LEAD' }))
    await prospectsApi.create({ organization: 'Nuovo Bar' })
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/prospects')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ organization: 'Nuovo Bar' })
    expect(init.headers['X-Tenant-Id']).toBe(TENANT_ID)
  })

  it('forwards optional contact fields', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonRes(201, { id: 'p9' }))
    await prospectsApi.create({
      organization: 'Pizzeria Napoli',
      address: 'Via Torino 8',
      contactEmail: 'info@napoli.it',
    })
    const [, init] = mockFetch.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({
      organization: 'Pizzeria Napoli',
      address: 'Via Torino 8',
      contactEmail: 'info@napoli.it',
    })
  })
})

// ── moveStage ───────────────────────────────────────────────────────────────

describe('prospectsApi.moveStage', () => {
  it('calls POST /api/v1/prospects/:id/stage with { stage }', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonRes(200, { id: 'p1', stage: 'CONTACTED' }))
    await prospectsApi.moveStage('p1', 'CONTACTED')
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/prospects/p1/stage')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ stage: 'CONTACTED' })
    expect(init.headers['X-Tenant-Id']).toBe(TENANT_ID)
  })

  it('surfaces a 409 illegal-transition as an ApiError', async () => {
    mockFetch.mockResolvedValue(
      mockJsonRes(409, { error: { code: 'ILLEGAL_STAGE_TRANSITION' } }),
    )
    await expect(prospectsApi.moveStage('p1', 'CONTRACT')).rejects.toBeInstanceOf(ApiError)
    await expect(prospectsApi.moveStage('p1', 'CONTRACT')).rejects.toMatchObject({ status: 409 })
  })
})

// ── tenant resolution failures ──────────────────────────────────────────────

describe('tenant resolution', () => {
  it('throws ApiError(401) when there is no stored token', async () => {
    mockGetItem.mockResolvedValue(null)
    await expect(prospectsApi.list()).rejects.toMatchObject({ status: 401 })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('throws ApiError(400) when the JWT carries no tenant claim', async () => {
    mockGetItem.mockResolvedValue(makeJwt({ sub: 'agent-1' }))
    await expect(prospectsApi.list()).rejects.toMatchObject({ status: 400 })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('throws ApiError(400) when the tenant claim is the "ANY" sentinel', async () => {
    mockGetItem.mockResolvedValue(makeJwt({ ble_tenant_id: 'ANY', sub: 'agent-1' }))
    await expect(prospectsApi.create({ organization: 'X' }))
      .rejects.toMatchObject({ status: 400 })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('throws ApiError(400) when the token is malformed', async () => {
    mockGetItem.mockResolvedValue('not-a-jwt')
    await expect(prospectsApi.list()).rejects.toMatchObject({ status: 400 })
  })

  it('accepts a legacy tenantId claim as a fallback', async () => {
    mockGetItem.mockResolvedValue(makeJwt({ tenantId: TENANT_ID, sub: 'agent-1' }))
    await prospectsApi.list()
    const [, init] = mockFetch.mock.calls[0]
    expect(init.headers['X-Tenant-Id']).toBe(TENANT_ID)
  })
})
