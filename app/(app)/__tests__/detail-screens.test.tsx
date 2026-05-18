/**
 * FU-51: Behaviour tests for the parametrised detail screens —
 * RequestDetailScreen, SalesAgentMerchantDetailScreen, and the BLE
 * first-config screen.
 */
import React, { type ReactNode } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Alert, Linking } from 'react-native'

const mockBack = jest.fn()
const mockPush = jest.fn()
let mockParams: Record<string, string> = { id: 'req-1' }
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack }),
  useLocalSearchParams: () => mockParams,
}))
jest.mock('../../../src/api/salesAgentApi', () => ({
  registrationRequestsApi: { list: jest.fn(), updateStatus: jest.fn() },
  kitDeliveryApi: { create: jest.fn() },
}))
jest.mock('../../../src/api/client', () => ({ api: { get: jest.fn() } }))
jest.mock('../../../src/ble/BeaconHealthCheck', () => {
  const actual = jest.requireActual('../../../src/ble/BeaconHealthCheck')
  return { ...actual, scanBeacons: jest.fn() }
})

import { registrationRequestsApi, kitDeliveryApi } from '../../../src/api/salesAgentApi'
import { api } from '../../../src/api/client'
import { scanBeacons } from '../../../src/ble/BeaconHealthCheck'

import RequestDetailScreen from '../request/[id]'
import SalesAgentMerchantDetailScreen from '../merchants/[id]'
import BeaconFirstConfigScreen from '../beacon/first-config'

const mockReqList = registrationRequestsApi.list as jest.Mock
const mockReqUpdate = registrationRequestsApi.updateStatus as jest.Mock
const mockKitCreate = kitDeliveryApi.create as jest.Mock
const mockApiGet = api.get as jest.Mock
const mockScan = scanBeacons as jest.Mock

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

let alertSpy: jest.SpyInstance
let linkSpy: jest.SpyInstance
beforeEach(() => {
  jest.clearAllMocks()
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  linkSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never)
  mockReqList.mockResolvedValue([])
  mockReqUpdate.mockResolvedValue({})
  mockKitCreate.mockResolvedValue({})
  mockApiGet.mockResolvedValue(null)
  mockScan.mockResolvedValue([])
})
afterEach(() => { alertSpy.mockRestore(); linkSpy.mockRestore() })

// ── RequestDetailScreen ──────────────────────────────────────────────────────

describe('RequestDetailScreen', () => {
  const pendingReq = {
    id: 'req-1', businessName: 'Pizzeria Sole', ownerName: 'Anna',
    email: 'anna@x.it', phone: '333', businessType: 'FOOD',
    status: 'PENDING', notes: null, createdAt: '2026-05-01T00:00:00Z',
  }

  beforeEach(() => { mockParams = { id: 'req-1' } })

  it('renders the request detail fields', async () => {
    mockReqList.mockResolvedValue([pendingReq])
    render(<RequestDetailScreen />, { wrapper: wrapper() })
    expect(await screen.findByText('Pizzeria Sole')).toBeTruthy()
    expect(screen.getByText('Proprietario: Anna')).toBeTruthy()
    expect(screen.getByText('Stato: PENDING')).toBeTruthy()
  })

  it('shows the "take in charge" action for a PENDING request', async () => {
    mockReqList.mockResolvedValue([pendingReq])
    render(<RequestDetailScreen />, { wrapper: wrapper() })
    expect(await screen.findByText('Prendi in carico')).toBeTruthy()
  })

  it('taking a request in charge updates its status to IN_REVIEW', async () => {
    mockReqList.mockResolvedValue([pendingReq])
    render(<RequestDetailScreen />, { wrapper: wrapper() })
    await screen.findByText('Prendi in carico')
    fireEvent.press(screen.getByText('▶ Prendi in carico'))
    await waitFor(() => expect(mockReqUpdate).toHaveBeenCalledWith('req-1', 'IN_REVIEW', ''))
  })

  it('shows the approve action for an IN_REVIEW request', async () => {
    mockReqList.mockResolvedValue([{ ...pendingReq, status: 'IN_REVIEW' }])
    render(<RequestDetailScreen />, { wrapper: wrapper() })
    expect(await screen.findByText('Approva richiesta')).toBeTruthy()
  })

  it('shows the kit-delivery form for an APPROVED request and creates the kit', async () => {
    mockReqList.mockResolvedValue([{ ...pendingReq, status: 'APPROVED' }])
    render(<RequestDetailScreen />, { wrapper: wrapper() })
    expect(await screen.findByText('Registra consegna kit')).toBeTruthy()
    fireEvent.press(screen.getByText('📦 Crea consegna kit'))
    await waitFor(() => expect(mockKitCreate).toHaveBeenCalled())
    expect(mockKitCreate.mock.calls[0][0].registrationRequestId).toBe('req-1')
  })
})

// ── SalesAgentMerchantDetailScreen ───────────────────────────────────────────

describe('SalesAgentMerchantDetailScreen', () => {
  beforeEach(() => { mockParams = { id: 'm-1' } })

  it('renders the merchant landing once loaded', async () => {
    mockApiGet.mockResolvedValue({
      id: 'm-1', name: 'Bar Roma', description: 'Caffè storico',
      logoUrl: null, coverImageUrl: null, landingStatus: 'PUBLISHED',
      addressLine: 'Via Po 1', city: 'Torino', phone: '011', email: 'bar@x.it',
      ratingAvg: 4.5, ratingCount: 12,
    })
    render(<SalesAgentMerchantDetailScreen />)
    expect(await screen.findByText('Bar Roma')).toBeTruthy()
    expect(screen.getByText('Caffè storico')).toBeTruthy()
    expect(screen.getByText('Pubblicata')).toBeTruthy()
  })

  it('opens Google Maps when the address row is tapped', async () => {
    mockApiGet.mockResolvedValue({
      id: 'm-1', name: 'Bar Roma', description: null,
      logoUrl: null, coverImageUrl: null, landingStatus: 'DRAFT',
      addressLine: 'Via Po 1', city: 'Torino', phone: null, email: null,
      ratingAvg: null, ratingCount: 0,
    })
    render(<SalesAgentMerchantDetailScreen />)
    fireEvent.press(await screen.findByText('Via Po 1, Torino'))
    expect(linkSpy).toHaveBeenCalledWith(expect.stringContaining('maps.google.com'))
  })

  it('shows the not-found state when the landing fetch fails', async () => {
    mockApiGet.mockRejectedValue(new Error('404'))
    render(<SalesAgentMerchantDetailScreen />)
    expect(await screen.findByText('Merchant non trovato')).toBeTruthy()
  })
})

// ── BeaconFirstConfigScreen ──────────────────────────────────────────────────

describe('BeaconFirstConfigScreen', () => {
  beforeEach(() => { mockParams = { merchantId: 'm-1' } })

  it('renders the scan button and merchant id', () => {
    render(<BeaconFirstConfigScreen />)
    expect(screen.getByText('Scansiona 4 beacon')).toBeTruthy()
    expect(screen.getByText('Merchant #m-1')).toBeTruthy()
  })

  it('runs a scan and renders one row per detected beacon', async () => {
    mockScan.mockResolvedValue([
      { code: 'H-01', label: 'Ingresso', detected: true, rssi: -55, batteryLevel: 90, pass: true, reason: '' },
      { code: 'H-02', label: 'Cassa Bar', detected: false, rssi: null, batteryLevel: null, pass: false, reason: 'non rilevato' },
    ])
    render(<BeaconFirstConfigScreen />)
    fireEvent.press(screen.getByTestId('scan-btn'))
    expect(await screen.findByTestId('beacon-row-H-01')).toBeTruthy()
    expect(screen.getByTestId('beacon-row-H-02')).toBeTruthy()
  })

  it('confirming an all-pass scan submits and navigates back', async () => {
    mockScan.mockResolvedValue([
      { code: 'H-01', label: 'Ingresso', detected: true, rssi: -55, batteryLevel: 90, pass: true, reason: '' },
    ])
    render(<BeaconFirstConfigScreen />)
    fireEvent.press(screen.getByTestId('scan-btn'))
    await screen.findByTestId('confirm-btn')
    fireEvent.press(screen.getByTestId('confirm-btn'))
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('On-boarding confermato', expect.any(String)))
    expect(mockBack).toHaveBeenCalled()
  })

  it('warns before confirming when some beacons failed the scan', async () => {
    mockScan.mockResolvedValue([
      { code: 'H-01', label: 'Ingresso', detected: false, rssi: null, batteryLevel: null, pass: false, reason: 'non rilevato' },
    ])
    render(<BeaconFirstConfigScreen />)
    fireEvent.press(screen.getByTestId('scan-btn'))
    await screen.findByTestId('confirm-btn')
    fireEvent.press(screen.getByTestId('confirm-btn'))
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
      'Attenzione', expect.stringContaining('beacon non rilevati'), expect.any(Array),
    ))
  })

  it('surfaces a scan error via Alert', async () => {
    mockScan.mockRejectedValue(new Error('ble-plx unavailable'))
    render(<BeaconFirstConfigScreen />)
    fireEvent.press(screen.getByTestId('scan-btn'))
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Errore scan BLE', 'ble-plx unavailable'))
  })
})
