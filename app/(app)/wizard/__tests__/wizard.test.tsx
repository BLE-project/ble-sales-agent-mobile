/**
 * FU-51: Behaviour tests for the 4-step beacon-config wizard (BCN-CFG-002).
 *
 * The wizard threads state through the module-level wizardState singleton,
 * so each test resets it and asserts on the singleton + the screen output.
 */
import React, { type ReactNode } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Alert } from 'react-native'

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockBack = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
}))
jest.mock('../../../../src/api/salesAgentApi', () => ({
  merchantsApi: { listByAgent: jest.fn() },
}))
jest.mock('../../../../src/api/beaconHealthApi', () => ({
  fetchMerchantBeacons: jest.fn(),
  submitBeaconHealth: jest.fn(),
}))
jest.mock('../../../../src/ble/BeaconHealthCheck', () => ({
  scanBeacons: jest.fn(),
}))

import { merchantsApi } from '../../../../src/api/salesAgentApi'
import { fetchMerchantBeacons, submitBeaconHealth } from '../../../../src/api/beaconHealthApi'
import { scanBeacons } from '../../../../src/ble/BeaconHealthCheck'
import {
  getWizardState, setMerchant, setBeacons, setScanResults, resetWizard,
} from '../../../../src/wizard/wizardState'

import WizardStep1Merchant from '../step-1-merchant'
import WizardStep2Scan from '../step-2-scan'
import WizardStep3Confirm from '../step-3-confirm'
import WizardStep4Submit from '../step-4-submit'

const mockListMerchants = merchantsApi.listByAgent as jest.Mock
const mockFetchBeacons = fetchMerchantBeacons as jest.Mock
const mockSubmit = submitBeaconHealth as jest.Mock
const mockScan = scanBeacons as jest.Mock

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

let alertSpy: jest.SpyInstance
beforeEach(() => {
  jest.clearAllMocks()
  resetWizard()
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  mockListMerchants.mockResolvedValue([])
  mockFetchBeacons.mockResolvedValue([])
  mockSubmit.mockResolvedValue({ healthSnapshotId: 'snap-1' })
  mockScan.mockResolvedValue([])
})
afterEach(() => { alertSpy.mockRestore(); resetWizard() })

// ── Step 1 ───────────────────────────────────────────────────────────────────

describe('WizardStep1Merchant', () => {
  it('renders the merchant list and an empty state when there are none', async () => {
    render(<WizardStep1Merchant />, { wrapper: wrapper() })
    expect(await screen.findByText('Nessun merchant trovato.')).toBeTruthy()
  })

  it('filters the merchant list by the search text', async () => {
    mockListMerchants.mockResolvedValue([
      { id: 'm-aaa11111', businessName: 'Bar Roma', tenantId: 't', status: 'ACTIVE', totalTransactions: 0, totalVolumeCents: 0 },
      { id: 'm-bbb22222', businessName: 'Pizzeria Sole', tenantId: 't', status: 'ACTIVE', totalTransactions: 0, totalVolumeCents: 0 },
    ])
    render(<WizardStep1Merchant />, { wrapper: wrapper() })
    await screen.findByText('Bar Roma')
    fireEvent.changeText(screen.getByTestId('wizard-merchant-search'), 'pizz')
    expect(screen.queryByText('Bar Roma')).toBeNull()
    expect(screen.getByText('Pizzeria Sole')).toBeTruthy()
  })

  it('selecting a merchant records it in the wizard state and advances', async () => {
    mockListMerchants.mockResolvedValue([
      { id: 'm-1', businessName: 'Bar Roma', tenantId: 't', status: 'ACTIVE', totalTransactions: 0, totalVolumeCents: 0 },
    ])
    render(<WizardStep1Merchant />, { wrapper: wrapper() })
    fireEvent.press(await screen.findByTestId('wizard-merchant-m-1'))
    expect(getWizardState().merchantId).toBe('m-1')
    expect(getWizardState().merchantName).toBe('Bar Roma')
    expect(mockPush).toHaveBeenCalledWith('/(app)/wizard/step-2-scan')
  })
})

// ── Step 2 ───────────────────────────────────────────────────────────────────

describe('WizardStep2Scan', () => {
  it('errors out when no merchant was selected upstream', async () => {
    render(<WizardStep2Scan />, { wrapper: wrapper() })
    expect(await screen.findByText(/Merchant non selezionato/)).toBeTruthy()
  })

  it('lists the merchant beacons as pending rows', async () => {
    setMerchant('m-1', 'Bar Roma')
    mockFetchBeacons.mockResolvedValue([
      { id: 'b-1', ibeaconUuid: 'u1', major: 10, minor: 20 },
    ])
    render(<WizardStep2Scan />, { wrapper: wrapper() })
    expect(await screen.findByTestId('wizard-scan-row-b-1')).toBeTruthy()
    expect(screen.getByText('pending')).toBeTruthy()
  })

  it('running a scan records ScanResults and updates the row badges', async () => {
    setMerchant('m-1', 'Bar Roma')
    mockFetchBeacons.mockResolvedValue([
      { id: 'b-1', ibeaconUuid: 'u1', major: 10, minor: 20 },
    ])
    mockScan.mockResolvedValue([
      { code: 'b-1', label: '10-20', detected: true, rssi: -55, batteryLevel: 90, pass: true, reason: '' },
    ])
    render(<WizardStep2Scan />, { wrapper: wrapper() })
    await screen.findByTestId('wizard-scan-row-b-1')
    fireEvent.press(screen.getByTestId('wizard-scan-start'))
    await waitFor(() => expect(screen.getByText('detected')).toBeTruthy())
    expect(getWizardState().scanResults).toEqual([
      { beaconId: 'b-1', detected: true, rssi: -55, batteryLevel: 90, pass: true },
    ])
  })
})

// ── Step 3 ───────────────────────────────────────────────────────────────────

describe('WizardStep3Confirm', () => {
  it('summarises the pass count over the total scanned', () => {
    setBeacons([{ id: 'b-1', ibeaconUuid: 'u', major: 1, minor: 1 }])
    setScanResults([
      { beaconId: 'b-1', detected: true, pass: true },
      { beaconId: 'b-2', detected: false, pass: false },
    ])
    render(<WizardStep3Confirm />)
    expect(screen.getByText('1/2 beacon hanno superato lo scan.')).toBeTruthy()
  })

  it('shows a retry button only for failed beacons', () => {
    setScanResults([
      { beaconId: 'b-pass', detected: true, pass: true },
      { beaconId: 'b-fail', detected: false, pass: false },
    ])
    render(<WizardStep3Confirm />)
    expect(screen.getByTestId('wizard-confirm-retry-b-fail')).toBeTruthy()
    expect(screen.queryByTestId('wizard-confirm-retry-b-pass')).toBeNull()
  })

  it('retry marks the failed beacon as passed in the wizard state', () => {
    setScanResults([{ beaconId: 'b-fail', detected: false, pass: false }])
    render(<WizardStep3Confirm />)
    fireEvent.press(screen.getByTestId('wizard-confirm-retry-b-fail'))
    expect(getWizardState().scanResults[0]).toEqual({ beaconId: 'b-fail', detected: true, pass: true })
  })

  it('advances to the submit step on confirm', () => {
    render(<WizardStep3Confirm />)
    fireEvent.press(screen.getByTestId('wizard-confirm-next'))
    expect(mockPush).toHaveBeenCalledWith('/(app)/wizard/step-4-submit')
  })
})

// ── Step 4 ───────────────────────────────────────────────────────────────────

describe('WizardStep4Submit', () => {
  it('redirects to step 1 when the wizard state has no merchant', async () => {
    render(<WizardStep4Submit />)
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(app)/wizard/step-1-merchant'))
    expect(alertSpy).toHaveBeenCalledWith('Stato wizard incoerente', expect.any(String))
  })

  it('submits the snapshot and shows the success screen with the snapshot id', async () => {
    setMerchant('m-1', 'Bar Roma')
    setScanResults([{ beaconId: 'b-1', detected: true, pass: true }])
    mockSubmit.mockResolvedValue({ healthSnapshotId: 'SNAP-XYZ' })
    render(<WizardStep4Submit />)
    expect(await screen.findByTestId('wizard-submit-ok')).toBeTruthy()
    expect(screen.getByText('SNAP-XYZ')).toBeTruthy()
    expect(mockSubmit).toHaveBeenCalledWith({
      merchantId: 'm-1',
      scanResults: [{ beaconId: 'b-1', detected: true, pass: true }],
    })
  })

  it('shows the error screen when the submission fails', async () => {
    setMerchant('m-1', 'Bar Roma')
    mockSubmit.mockRejectedValue(new Error('409 conflict'))
    render(<WizardStep4Submit />)
    expect(await screen.findByTestId('wizard-submit-error')).toHaveTextContent(/409 conflict/)
  })

  it('finishing resets the wizard state and returns to beacon-config', async () => {
    setMerchant('m-1', 'Bar Roma')
    render(<WizardStep4Submit />)
    fireEvent.press(await screen.findByTestId('wizard-submit-finish'))
    expect(getWizardState().merchantId).toBeNull()
    expect(mockReplace).toHaveBeenCalledWith('/(app)/beacon-config')
  })
})
