/**
 * FU-51: Unit tests for moderationApi — sales-agent mobile (§9bis M5).
 *
 * Covers:
 *  - list / get call the right verb + path
 *  - approve / reject inject the X-TOTP-Code header + bearer token
 *  - escalate goes through the base api wrapper (no TOTP)
 *  - non-ok responses surface as Error with the status code
 *  - 204 responses resolve to undefined
 */
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }))

const mockGetItem = jest.fn()
jest.mock('expo-secure-store', () => ({
  getItemAsync:    (...a: unknown[]) => mockGetItem(...a),
  setItemAsync:    jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../auth/AuthContext', () => ({
  TOKEN_KEY:   'ble_sales_agent_token',
  REFRESH_KEY: 'ble_sales_agent_refresh_token',
}))

import { moderationApi } from '../api/moderationApi'

const mockFetch = jest.fn()
;(globalThis as unknown as { fetch: jest.Mock }).fetch = mockFetch

function res(status: number, body: unknown) {
  return {
    ok:         status >= 200 && status < 300,
    status,
    json:       () => Promise.resolve(body),
    text:       () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
    statusText: `HTTP ${status}`,
  }
}

// Stored session token must be a real 3-part JWT so resolveTenantId can decode
// the ble_tenant_id claim used for the X-Tenant-Id header.
const TENANT = 'tenant-xyz'
const JWT = `h.${Buffer.from(JSON.stringify({ ble_tenant_id: TENANT })).toString('base64url')}.s`

beforeEach(() => {
  mockFetch.mockReset()
  mockGetItem.mockReset()
  mockGetItem.mockResolvedValue(JWT)
  mockFetch.mockResolvedValue(res(200, {}))
})

describe('moderationApi.list', () => {
  it('GETs the reviews queue with default paging', async () => {
    await moderationApi.list()
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/moderation/reviews?page=0&size=20')
    expect(init.method).toBe('GET')
    expect(init.headers['X-Tenant-Id']).toBe(TENANT)
  })

  it('honours explicit page + size args', async () => {
    await moderationApi.list(2, 50)
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/moderation/reviews?page=2&size=50')
  })
})

describe('moderationApi.get', () => {
  it('GETs a single review by advId', async () => {
    await moderationApi.get('adv-42')
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/moderation/reviews/adv-42')
  })
})

describe('moderationApi.approve (TOTP)', () => {
  it('POSTs with X-TOTP-Code + bearer token + reason body', async () => {
    mockFetch.mockResolvedValueOnce(res(200, { status: 'APPROVED' }))
    const out = await moderationApi.approve('adv-1', 'compliant', '123456')
    expect(out).toEqual({ status: 'APPROVED' })

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/moderation/reviews/adv-1/approve')
    expect(init.method).toBe('POST')
    expect(init.headers['X-TOTP-Code']).toBe('123456')
    expect(init.headers['Authorization']).toBe(`Bearer ${JWT}`)
    expect(init.headers['X-Tenant-Id']).toBe(TENANT)
    expect(JSON.parse(init.body)).toEqual({ reason: 'compliant' })
  })

  it('rejects (not authenticated) when no token is stored', async () => {
    // Tenant-scoped endpoints need the JWT to resolve X-Tenant-Id; with no token
    // the call fails closed before reaching the network.
    mockGetItem.mockResolvedValue(null)
    await expect(moderationApi.approve('adv-1', 'r', '000000'))
      .rejects.toThrow('Not authenticated')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('throws an Error carrying the status when the backend rejects', async () => {
    mockFetch.mockResolvedValueOnce(res(403, 'totp invalid'))
    await expect(moderationApi.approve('adv-1', 'r', 'bad'))
      .rejects.toThrow('[403]')
  })

  it('resolves to undefined on a 204 response', async () => {
    mockFetch.mockResolvedValueOnce(res(204, ''))
    await expect(moderationApi.approve('adv-1', 'r', '111111')).resolves.toBeUndefined()
  })
})

describe('moderationApi.reject (TOTP)', () => {
  it('POSTs to the /reject sub-resource with the TOTP header', async () => {
    mockFetch.mockResolvedValueOnce(res(200, { status: 'REJECTED' }))
    await moderationApi.reject('adv-9', 'policy breach', '654321')
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/moderation/reviews/adv-9/reject')
    expect(init.headers['X-TOTP-Code']).toBe('654321')
    expect(JSON.parse(init.body)).toEqual({ reason: 'policy breach' })
  })
})

describe('moderationApi.escalate', () => {
  it('POSTs to /escalate via the base api wrapper (no TOTP header)', async () => {
    mockFetch.mockResolvedValueOnce(res(200, { status: 'ESCALATED_TO_ADMIN' }))
    await moderationApi.escalate('adv-7', 'needs admin')
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/moderation/reviews/adv-7/escalate')
    expect(init.method).toBe('POST')
    expect(init.headers['X-TOTP-Code']).toBeUndefined()
    expect(JSON.parse(init.body)).toEqual({ reason: 'needs admin' })
  })
})
