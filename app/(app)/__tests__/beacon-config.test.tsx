/**
 * FU-51: Behaviour tests for the beacon-configuration screen
 * (FEAT-S45-001 / Fase 3.0b) — enrollment form, beacon list, and the
 * reconfigure modal incl. the territory/type pickers + randomize helper.
 */
import React, { type ReactNode } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Alert } from 'react-native'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}))
jest.mock('../../../src/api/salesAgentApi', () => ({
  beaconApi: { list: jest.fn(), enroll: jest.fn(), updateConfig: jest.fn() },
  territoryApi: { list: jest.fn() },
  randomizeBeaconIdentity: jest.fn(),
}))
jest.mock('../../../src/components/BleConfigDisplay', () => ({
  BleConfigDisplay: () => null,
}))
jest.mock('../../../src/components/GpsCaptureButton', () => ({
  GpsCaptureButton: () => null,
}))

import { beaconApi, territoryApi, randomizeBeaconIdentity } from '../../../src/api/salesAgentApi'
import BeaconConfigScreen from '../beacon-config'

const mockList = beaconApi.list as jest.Mock
const mockEnroll = beaconApi.enroll as jest.Mock
const mockUpdateConfig = beaconApi.updateConfig as jest.Mock
const mockTerritories = territoryApi.list as jest.Mock
const mockRandomize = randomizeBeaconIdentity as jest.Mock

const beacon = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'b-1', tenantId: 't', territoryId: 'terr-1', name: 'Ingresso',
  ibeaconUuid: '11111111-1111-4111-8111-111111111111', major: 10, minor: 20,
  type: 'MERCHANT', status: 'ACTIVE', enrolledBy: null, enrolledAt: null,
  ...over,
})

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

let alertSpy: jest.SpyInstance
beforeEach(() => {
  jest.clearAllMocks()
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  mockList.mockResolvedValue([])
  mockTerritories.mockResolvedValue([
    { id: 'terr-1', tenantId: 't', name: 'Centro', visibility: 'public', territoryType: 'standard' },
    { id: 'terr-2', tenantId: 't', name: 'Periferia', visibility: 'public', territoryType: 'standard' },
  ])
  mockEnroll.mockResolvedValue(beacon())
  mockUpdateConfig.mockResolvedValue(beacon())
  mockRandomize.mockReturnValue({ ibeaconUuid: 'RAND-UUID', major: 999, minor: 888 })
})
afterEach(() => alertSpy.mockRestore())

describe('BeaconConfigScreen', () => {
  it('renders the title and empty beacon list state', async () => {
    render(<BeaconConfigScreen />, { wrapper: wrapper() })
    expect(screen.getByText('Beacon Configuration')).toBeTruthy()
    expect(await screen.findByText('No beacons registered.')).toBeTruthy()
  })

  it('navigates into the first-config wizard', () => {
    render(<BeaconConfigScreen />, { wrapper: wrapper() })
    fireEvent.press(screen.getByTestId('start-first-config-wizard'))
    expect(mockPush).toHaveBeenCalledWith('/(app)/wizard/step-1-merchant')
  })

  it('toggles the enrollment form open and closed', () => {
    render(<BeaconConfigScreen />, { wrapper: wrapper() })
    fireEvent.press(screen.getByText('+ Enroll Beacon'))
    expect(screen.getByText('UUID *')).toBeTruthy()
    fireEvent.press(screen.getByText('Cancel'))
    expect(screen.queryByText('UUID *')).toBeNull()
  })

  it('blocks enrollment with an alert when UUID/territory are missing', () => {
    render(<BeaconConfigScreen />, { wrapper: wrapper() })
    fireEvent.press(screen.getByText('+ Enroll Beacon'))
    fireEvent.press(screen.getByText('Enroll'))
    expect(alertSpy).toHaveBeenCalledWith('Missing fields', expect.any(String))
    expect(mockEnroll).not.toHaveBeenCalled()
  })

  it('enrolls a beacon once UUID + territory are filled', async () => {
    render(<BeaconConfigScreen />, { wrapper: wrapper() })
    fireEvent.press(screen.getByText('+ Enroll Beacon'))
    fireEvent.changeText(screen.getByPlaceholderText('iBeacon UUID'), 'UUID-X')
    fireEvent.changeText(screen.getByPlaceholderText('UUID'), 'terr-1')
    fireEvent.press(screen.getByText('Enroll'))
    await waitFor(() => expect(mockEnroll).toHaveBeenCalled())
    const sent = mockEnroll.mock.calls[0][0]
    expect(sent.ibeaconUuid).toBe('UUID-X')
    expect(sent.territoryId).toBe('terr-1')
  })

  it('renders a card per registered beacon', async () => {
    mockList.mockResolvedValue([beacon({ id: 'b-1', name: 'Ingresso Nord' })])
    render(<BeaconConfigScreen />, { wrapper: wrapper() })
    expect(await screen.findByText('Ingresso Nord')).toBeTruthy()
    expect(screen.getByTestId('beacon-config-b-1')).toBeTruthy()
  })

  it('opens the reconfigure modal seeded from the tapped beacon', async () => {
    mockList.mockResolvedValue([beacon({ id: 'b-1', name: 'Ingresso Nord' })])
    render(<BeaconConfigScreen />, { wrapper: wrapper() })
    fireEvent.press(await screen.findByTestId('beacon-config-b-1'))
    expect(await screen.findByText('Reconfigure Beacon')).toBeTruthy()
    expect(screen.getByTestId('config-uuid-input').props.value)
      .toBe('11111111-1111-4111-8111-111111111111')
  })

  it('randomize replaces UUID/major/minor in the reconfigure form', async () => {
    mockList.mockResolvedValue([beacon({ id: 'b-1' })])
    render(<BeaconConfigScreen />, { wrapper: wrapper() })
    fireEvent.press(await screen.findByTestId('beacon-config-b-1'))
    await screen.findByTestId('config-randomize-btn')
    fireEvent.press(screen.getByTestId('config-randomize-btn'))
    expect(mockRandomize).toHaveBeenCalled()
    expect(screen.getByTestId('config-uuid-input').props.value).toBe('RAND-UUID')
    expect(screen.getByTestId('config-major-input').props.value).toBe('999')
  })

  it('saving the reconfigure form calls updateConfig with the new body', async () => {
    mockList.mockResolvedValue([beacon({ id: 'b-1' })])
    render(<BeaconConfigScreen />, { wrapper: wrapper() })
    fireEvent.press(await screen.findByTestId('beacon-config-b-1'))
    await screen.findByTestId('config-save-btn')
    fireEvent.changeText(screen.getByTestId('config-minor-input'), '42')
    fireEvent.press(screen.getByTestId('type-chip-TRACKING'))
    fireEvent.press(screen.getByTestId('config-save-btn'))
    await waitFor(() => expect(mockUpdateConfig).toHaveBeenCalled())
    const [id, body] = mockUpdateConfig.mock.calls[0]
    expect(id).toBe('b-1')
    expect(body.minor).toBe(42)
    expect(body.type).toBe('TRACKING')
  })

  it('shows a targeted duplicate-identity error from the backend envelope', async () => {
    mockList.mockResolvedValue([beacon({ id: 'b-1' })])
    mockUpdateConfig.mockRejectedValue(new Error(JSON.stringify({
      error: { code: 'BEACON_DUPLICATE_IDENTITY', message: 'triple already used' },
    })))
    render(<BeaconConfigScreen />, { wrapper: wrapper() })
    fireEvent.press(await screen.findByTestId('beacon-config-b-1'))
    await screen.findByTestId('config-save-btn')
    fireEvent.press(screen.getByTestId('config-save-btn'))
    expect(await screen.findByText(/Duplicate identity: triple already used/)).toBeTruthy()
  })

  it('switching the territory chip updates the reconfigure form', async () => {
    mockList.mockResolvedValue([beacon({ id: 'b-1', territoryId: 'terr-1' })])
    render(<BeaconConfigScreen />, { wrapper: wrapper() })
    fireEvent.press(await screen.findByTestId('beacon-config-b-1'))
    await screen.findByTestId('territory-chip-terr-2')
    fireEvent.press(screen.getByTestId('territory-chip-terr-2'))
    fireEvent.press(screen.getByTestId('config-save-btn'))
    await waitFor(() => expect(mockUpdateConfig).toHaveBeenCalled())
    expect(mockUpdateConfig.mock.calls[0][1].territoryId).toBe('terr-2')
  })

  it('closing the modal via Cancel dismisses it', async () => {
    mockList.mockResolvedValue([beacon({ id: 'b-1' })])
    render(<BeaconConfigScreen />, { wrapper: wrapper() })
    fireEvent.press(await screen.findByTestId('beacon-config-b-1'))
    await screen.findByTestId('config-cancel-btn')
    fireEvent.press(screen.getByTestId('config-cancel-btn'))
    await waitFor(() => expect(screen.queryByText('Reconfigure Beacon')).toBeNull())
  })

  it('shows the Holy-IOT factory password hint inside the reconfigure modal', async () => {
    mockList.mockResolvedValue([beacon({ id: 'b-1' })])
    render(<BeaconConfigScreen />, { wrapper: wrapper() })
    fireEvent.press(await screen.findByTestId('beacon-config-b-1'))
    expect(await screen.findByTestId('holy-iot-default-password-hint')).toBeTruthy()
    expect(screen.getByTestId('holy-iot-default-password-value')).toBeTruthy()
  })
})
