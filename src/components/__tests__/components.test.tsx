/**
 * FU-51: Behaviour tests for the shared sales-agent components —
 * BleConfigDisplay, GpsCaptureButton, TotpVerifyModal, TotpSetupModal.
 *
 * Each test drives the component the way a user would and asserts on the
 * visible result + the side effects (API calls, callbacks, Alerts).
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'

// ── module mocks ─────────────────────────────────────────────────────────────
jest.mock('../../api/tenantBleConfig', () => ({ fetchTenantBleConfig: jest.fn() }))
jest.mock('../../api/beaconGpsApi', () => ({ captureBeaconGps: jest.fn() }))
jest.mock('../../api/client', () => ({ api: { post: jest.fn() } }))
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { High: 4 },
}))

import { fetchTenantBleConfig } from '../../api/tenantBleConfig'
import { captureBeaconGps } from '../../api/beaconGpsApi'
import { api } from '../../api/client'
import * as Location from 'expo-location'
import { BleConfigDisplay } from '../BleConfigDisplay'
import { GpsCaptureButton } from '../GpsCaptureButton'
import { TotpVerifyModal } from '../TotpVerifyModal'
import { TotpSetupModal } from '../TotpSetupModal'
import SignatureCanvas from '../SignatureCanvas'

const mockFetchCfg = fetchTenantBleConfig as jest.Mock
const mockCaptureGps = captureBeaconGps as jest.Mock
const mockApiPost = api.post as jest.Mock
const mockReqPerm = Location.requestForegroundPermissionsAsync as jest.Mock
const mockGetPos = Location.getCurrentPositionAsync as jest.Mock

let alertSpy: jest.SpyInstance
beforeEach(() => {
  jest.clearAllMocks()
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
})
afterEach(() => alertSpy.mockRestore())

// ── BleConfigDisplay ─────────────────────────────────────────────────────────

describe('BleConfigDisplay', () => {
  it('shows a loading spinner before the config resolves', () => {
    mockFetchCfg.mockReturnValue(new Promise(() => {}))
    render(<BleConfigDisplay />)
    expect(screen.getByTestId('ble-config-loading')).toBeTruthy()
  })

  it('renders the threshold value to 2 decimals once loaded', async () => {
    mockFetchCfg.mockResolvedValue({ tenantId: 't-1', beaconImmediateThresholdM: 3 })
    render(<BleConfigDisplay />)
    expect(await screen.findByTestId('ble-config-value')).toHaveTextContent('3.00 m')
  })

  it('renders the unconfigured warning when the tenant has no config', async () => {
    mockFetchCfg.mockResolvedValue(null)
    render(<BleConfigDisplay />)
    expect(await screen.findByTestId('ble-config-empty')).toBeTruthy()
  })

  it('renders the error message when the fetch rejects', async () => {
    mockFetchCfg.mockRejectedValue(new Error('network down'))
    render(<BleConfigDisplay />)
    expect(await screen.findByTestId('ble-config-error')).toHaveTextContent('network down')
  })
})

// ── GpsCaptureButton ─────────────────────────────────────────────────────────

describe('GpsCaptureButton', () => {
  it('labels itself "Cattura GPS" when no prior coordinate exists', () => {
    render(<GpsCaptureButton beaconId="b-1" />)
    expect(screen.getByText('Cattura GPS')).toBeTruthy()
  })

  it('labels itself "Riacquisisci GPS" when hasGps is set', () => {
    render(<GpsCaptureButton beaconId="b-1" hasGps />)
    expect(screen.getByText('Riacquisisci GPS')).toBeTruthy()
  })

  it('captures a precise fix, POSTs it, and calls onCaptured', async () => {
    mockReqPerm.mockResolvedValue({ granted: true })
    mockGetPos.mockResolvedValue({ coords: { latitude: 45.07, longitude: 7.68, accuracy: 5 } })
    mockCaptureGps.mockResolvedValue({})
    const onCaptured = jest.fn()
    render(<GpsCaptureButton beaconId="b-9" onCaptured={onCaptured} />)

    fireEvent.press(screen.getByTestId('gps-capture-b-9'))
    await waitFor(() => expect(mockCaptureGps).toHaveBeenCalledWith('b-9', { latitude: 45.07, longitude: 7.68 }))
    expect(onCaptured).toHaveBeenCalledWith(45.07, 7.68)
  })

  it('refuses to submit when location permission is denied', async () => {
    mockReqPerm.mockResolvedValue({ granted: false })
    render(<GpsCaptureButton beaconId="b-1" />)
    fireEvent.press(screen.getByTestId('gps-capture-b-1'))
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Permesso negato', expect.any(String)))
    expect(mockCaptureGps).not.toHaveBeenCalled()
  })

  it('rejects a fix whose accuracy is worse than 10 m', async () => {
    mockReqPerm.mockResolvedValue({ granted: true })
    mockGetPos.mockResolvedValue({ coords: { latitude: 1, longitude: 2, accuracy: 25 } })
    render(<GpsCaptureButton beaconId="b-1" />)
    fireEvent.press(screen.getByTestId('gps-capture-b-1'))
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Accuratezza insufficiente', expect.any(String)))
    expect(mockCaptureGps).not.toHaveBeenCalled()
  })

  it('surfaces a capture error via Alert', async () => {
    mockReqPerm.mockResolvedValue({ granted: true })
    mockGetPos.mockResolvedValue({ coords: { latitude: 1, longitude: 2, accuracy: 3 } })
    mockCaptureGps.mockRejectedValue(new Error('409 conflict'))
    render(<GpsCaptureButton beaconId="b-1" />)
    fireEvent.press(screen.getByTestId('gps-capture-b-1'))
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Errore cattura GPS', '409 conflict'))
  })
})

// ── TotpVerifyModal ──────────────────────────────────────────────────────────

describe('TotpVerifyModal', () => {
  const baseProps = {
    visible: true, onClose: jest.fn(), onVerified: jest.fn(),
    totpSecret: 'SECRET123', operationLabel: 'approve the review',
  }

  it('renders the operation-specific prompt', () => {
    render(<TotpVerifyModal {...baseProps} />)
    expect(screen.getByText('Enter code to approve the review.')).toBeTruthy()
  })

  it('strips non-digits and caps the code at 6 chars', () => {
    render(<TotpVerifyModal {...baseProps} />)
    const input = screen.getByPlaceholderText('000000')
    fireEvent.changeText(input, '12ab34cd5678')
    expect(input.props.value).toBe('123456')
  })

  it('validates the code against the backend and calls onVerified on success', async () => {
    mockApiPost.mockResolvedValue({ valid: true })
    const onVerified = jest.fn()
    render(<TotpVerifyModal {...baseProps} onVerified={onVerified} />)
    fireEvent.changeText(screen.getByPlaceholderText('000000'), '123456')
    fireEvent.press(screen.getByText('Verify'))
    await waitFor(() => expect(onVerified).toHaveBeenCalled())
    expect(mockApiPost).toHaveBeenCalledWith(
      '/api/v1/auth/totp/validate', { secret: 'SECRET123', code: '123456' },
    )
  })

  it('shows an "Invalid code" error when the backend rejects the code', async () => {
    mockApiPost.mockResolvedValue({ valid: false })
    render(<TotpVerifyModal {...baseProps} />)
    fireEvent.changeText(screen.getByPlaceholderText('000000'), '999999')
    fireEvent.press(screen.getByText('Verify'))
    expect(await screen.findByText('Invalid code.')).toBeTruthy()
  })

  it('shows a generic error when the validation request throws', async () => {
    mockApiPost.mockRejectedValue(new Error('boom'))
    render(<TotpVerifyModal {...baseProps} />)
    fireEvent.changeText(screen.getByPlaceholderText('000000'), '123456')
    fireEvent.press(screen.getByText('Verify'))
    expect(await screen.findByText('Validation failed.')).toBeTruthy()
  })

  it('clears state and closes when Cancel is pressed', () => {
    const onClose = jest.fn()
    render(<TotpVerifyModal {...baseProps} onClose={onClose} />)
    fireEvent.press(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })
})

// ── TotpSetupModal ───────────────────────────────────────────────────────────

describe('TotpSetupModal', () => {
  const baseProps = { visible: true, onClose: jest.fn(), onSetupComplete: jest.fn() }

  it('starts on the init step with a Generate Secret button', () => {
    render(<TotpSetupModal {...baseProps} />)
    expect(screen.getByText('Generate Secret')).toBeTruthy()
  })

  it('advances to the verify step and shows the generated secret', async () => {
    mockApiPost.mockResolvedValue({
      secret: 'BASE32SECRET', otpauthUri: 'otpauth://x', issuer: 'Terrio',
    })
    render(<TotpSetupModal {...baseProps} />)
    fireEvent.press(screen.getByText('Generate Secret'))
    expect(await screen.findByText('BASE32SECRET')).toBeTruthy()
  })

  it('completes setup when the first code verifies', async () => {
    mockApiPost
      .mockResolvedValueOnce({ secret: 'S1', otpauthUri: 'otpauth://x', issuer: 'Terrio' })
      .mockResolvedValueOnce({ verified: true })
    const onSetupComplete = jest.fn()
    render(<TotpSetupModal {...baseProps} onSetupComplete={onSetupComplete} />)
    fireEvent.press(screen.getByText('Generate Secret'))
    await screen.findByText('S1')
    fireEvent.changeText(screen.getByPlaceholderText('000000'), '123456')
    fireEvent.press(screen.getByText('Verify & Enable'))
    await waitFor(() => expect(onSetupComplete).toHaveBeenCalledWith('S1'))
    expect(await screen.findByText('2FA is now enabled.')).toBeTruthy()
  })

  it('stays on the init step (does not advance to verify) when secret generation fails', async () => {
    mockApiPost.mockRejectedValue(new Error('500'))
    render(<TotpSetupModal {...baseProps} />)
    fireEvent.press(screen.getByText('Generate Secret'))
    // The setup call rejected — the modal must not advance to the verify step.
    await waitFor(() => expect(mockApiPost).toHaveBeenCalled())
    expect(screen.getByText('Generate Secret')).toBeTruthy()
    expect(screen.queryByText('Verify & Enable')).toBeNull()
  })
})

// ── SignatureCanvas ──────────────────────────────────────────────────────────

describe('SignatureCanvas', () => {
  it('shows the placeholder while the canvas is empty', () => {
    render(<SignatureCanvas onSave={jest.fn()} onClear={jest.fn()} />)
    expect(screen.getByText('Firma qui')).toBeTruthy()
    expect(screen.getByTestId('signature-canvas')).toBeTruthy()
  })

  it('wires the canvas through a PanResponder for stroke capture', () => {
    render(<SignatureCanvas onSave={jest.fn()} onClear={jest.fn()} />)
    const canvas = screen.getByTestId('signature-canvas')
    // The drawing surface must expose responder handlers (PanResponder.panHandlers).
    expect(typeof canvas.props.onStartShouldSetResponder).toBe('function')
    expect(typeof canvas.props.onMoveShouldSetResponder).toBe('function')
    // onLayout is used to translate page coords into canvas-local coords.
    expect(typeof canvas.props.onLayout).toBe('function')
    canvas.props.onLayout({ nativeEvent: { layout: { x: 5, y: 5, width: 300, height: 180 } } })
  })

  it('save emits a base64 PNG payload through onSave', () => {
    const onSave = jest.fn()
    render(<SignatureCanvas onSave={onSave} onClear={jest.fn()} />)
    fireEvent.press(screen.getByTestId('signature-save-btn'))
    expect(onSave).toHaveBeenCalledWith(expect.stringContaining('data:image/png;base64,'))
  })

  it('clear invokes onClear and keeps the canvas empty', () => {
    const onClear = jest.fn()
    render(<SignatureCanvas onSave={jest.fn()} onClear={onClear} />)
    fireEvent.press(screen.getByTestId('signature-clear-btn'))
    expect(onClear).toHaveBeenCalled()
    expect(screen.getByText('Firma qui')).toBeTruthy()
  })
})
