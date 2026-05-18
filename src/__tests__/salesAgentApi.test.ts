/**
 * FU-51: Unit tests for the remaining salesAgentApi surfaces not covered by
 * beaconApi.test.ts — registrationRequestsApi, kitDeliveryApi,
 * salesAgentProfileApi, royaltiesApi, merchantsApi, and the proximity-gated
 * beacon password endpoints.
 *
 * These exercise verb + path + body wiring against a mocked fetch, mirroring
 * the existing client/beacon test style.
 */
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }))

jest.mock('expo-secure-store', () => ({
  getItemAsync:    jest.fn().mockResolvedValue('agent-token'),
  setItemAsync:    jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../auth/AuthContext', () => ({
  TOKEN_KEY:   'ble_sales_agent_token',
  REFRESH_KEY: 'ble_sales_agent_refresh_token',
}))

import {
  registrationRequestsApi,
  kitDeliveryApi,
  salesAgentProfileApi,
  royaltiesApi,
  merchantsApi,
  beaconApi,
} from '../api/salesAgentApi'

const mockFetch = jest.fn()
;(globalThis as unknown as { fetch: jest.Mock }).fetch = mockFetch

function res(status: number, body: unknown) {
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
  mockFetch.mockResolvedValue(res(200, {}))
})

describe('registrationRequestsApi', () => {
  it('list() with no status omits the query string', async () => {
    await registrationRequestsApi.list()
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/registration-requests')
    expect(url).not.toContain('?status=')
  })

  it('list("PENDING") appends ?status=PENDING', async () => {
    await registrationRequestsApi.list('PENDING')
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/registration-requests?status=PENDING')
  })

  it('updateStatus() PUTs the status + notes body', async () => {
    await registrationRequestsApi.updateStatus('req-1', 'APPROVED', 'looks good')
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/registration-requests/req-1/status')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual({ status: 'APPROVED', notes: 'looks good' })
  })

  it('updateStatus() works without notes', async () => {
    await registrationRequestsApi.updateStatus('req-2', 'REJECTED')
    const [, init] = mockFetch.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({ status: 'REJECTED' })
  })
})

describe('kitDeliveryApi', () => {
  it('list() with agentId appends the query string', async () => {
    await kitDeliveryApi.list('agent-9')
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/kit-deliveries?agentId=agent-9')
  })

  it('list() without agentId omits the query string', async () => {
    await kitDeliveryApi.list()
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/kit-deliveries')
    expect(url).not.toContain('?agentId=')
  })

  it('create() POSTs the request body', async () => {
    await kitDeliveryApi.create({ registrationRequestId: 'rr-1', items: 'beacon-kit-x3' })
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/kit-deliveries')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ registrationRequestId: 'rr-1', items: 'beacon-kit-x3' })
  })

  it('updateStatus() merges extra data into the PUT body', async () => {
    await kitDeliveryApi.updateStatus('kd-1', 'SHIPPED', { trackingNumber: 'TRK99', carrier: 'BRT' })
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/kit-deliveries/kd-1/status')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual({ status: 'SHIPPED', trackingNumber: 'TRK99', carrier: 'BRT' })
  })
})

describe('salesAgentProfileApi', () => {
  it('getById() GETs /api/v1/sales-agents/:id', async () => {
    await salesAgentProfileApi.getById('sa-7')
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/sales-agents/sa-7')
    expect(init.method).toBe('GET')
  })

  it('getAssignments() GETs the /assignments sub-resource', async () => {
    await salesAgentProfileApi.getAssignments('sa-7')
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/sales-agents/sa-7/assignments')
  })
})

describe('royaltiesApi', () => {
  it('list() with agentId appends the query string', async () => {
    await royaltiesApi.list('a-1')
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/agent-royalties?agentId=a-1')
  })

  it('list() without agentId omits the query string', async () => {
    await royaltiesApi.list()
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/agent-royalties')
    expect(url).not.toContain('?agentId=')
  })
})

describe('merchantsApi', () => {
  it('listByAgent() GETs merchants filtered by managedByAgent', async () => {
    await merchantsApi.listByAgent()
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/merchants?managedByAgent=true')
  })
})

describe('beaconApi proximity-gated password endpoints', () => {
  it('setPassword() PUTs with the X-BLE-Proximity header', async () => {
    mockFetch.mockResolvedValueOnce(res(200, { ok: true }))
    await beaconApi.setPassword('b-1', 'newpass')
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/beacons/b-1/password')
    expect(init.method).toBe('PUT')
    expect(init.headers['X-BLE-Proximity']).toBe('true')
    expect(JSON.parse(init.body)).toEqual({ password: 'newpass' })
  })

  it('setPassword() throws when the backend rejects', async () => {
    mockFetch.mockResolvedValueOnce(res(403, 'forbidden'))
    await expect(beaconApi.setPassword('b-1', 'x')).rejects.toThrow('Set password failed')
  })

  it('resetPassword() POSTs to the /password/reset sub-resource', async () => {
    mockFetch.mockResolvedValueOnce(res(200, { ok: true }))
    await beaconApi.resetPassword('b-2', 'resetpass')
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/v1/beacons/b-2/password/reset')
    expect(init.method).toBe('POST')
    expect(init.headers['X-BLE-Proximity']).toBe('true')
  })

  it('resetPassword() throws when the backend rejects', async () => {
    mockFetch.mockResolvedValueOnce(res(409, 'conflict'))
    await expect(beaconApi.resetPassword('b-2', 'x')).rejects.toThrow('Reset password failed')
  })
})
