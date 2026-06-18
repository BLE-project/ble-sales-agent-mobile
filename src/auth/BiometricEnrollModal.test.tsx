/**
 * BiometricEnrollModal step-machine tests (sales-agent).
 *
 * Exercises the REAL component (only useBiometricAuth mocked) through its
 * steps: intro → pin1 → pin2 → (enroll | mismatch). Also covers
 * "Never ask again" (optOut) and the not-visible short-circuit.
 *
 * Note: this repo's intro renders only Enable + Never CTAs — the "Not now"
 * skip button was removed (Anomaly H, 2026-05-02).
 */
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { IntlProvider } from 'react-intl'
import enMessages from '../i18n/messages/en-US.json'

const mockEnroll = jest.fn(async () => undefined)
const mockOptOut = jest.fn(async () => undefined)

jest.mock('./useBiometricAuth', () => ({
  useBiometricAuth: () => ({ enroll: mockEnroll, optOut: mockOptOut }),
}))

import { BiometricEnrollModal } from './BiometricEnrollModal'

function renderModal(visible = true) {
  const onDone = jest.fn()
  const utils = render(
    <IntlProvider locale="en" messages={enMessages} onError={() => {}}>
      <BiometricEnrollModal visible={visible} onDone={onDone} />
    </IntlProvider>,
  )
  return { ...utils, onDone }
}

beforeEach(() => {
  mockEnroll.mockReset()
  mockEnroll.mockResolvedValue(undefined)
  mockOptOut.mockReset()
  mockOptOut.mockResolvedValue(undefined)
})

describe('BiometricEnrollModal — intro', () => {
  it('renders the intro with Enable + Never CTAs when visible', () => {
    const { getByTestId } = renderModal()
    expect(getByTestId('enroll-enable')).toBeTruthy()
    expect(getByTestId('enroll-never')).toBeTruthy()
  })

  it('calls optOut and onDone when "Never ask again" is pressed', async () => {
    const { getByTestId, onDone } = renderModal()
    fireEvent.press(getByTestId('enroll-never'))
    await waitFor(() => expect(mockOptOut).toHaveBeenCalledTimes(1))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('advances to the pin1 step when Enable is pressed', async () => {
    const { getByTestId } = renderModal()
    fireEvent.press(getByTestId('enroll-enable'))
    await waitFor(() => expect(getByTestId('enroll-pin1')).toBeTruthy())
  })
})

describe('BiometricEnrollModal — pin entry', () => {
  it('does not advance to pin2 while pin1 has fewer than 6 digits', () => {
    const { getByTestId, queryByTestId } = renderModal()
    fireEvent.press(getByTestId('enroll-enable'))
    fireEvent.changeText(getByTestId('enroll-pin1'), '123')
    fireEvent.press(getByTestId('enroll-pin1-submit'))
    expect(queryByTestId('enroll-pin2')).toBeNull()
  })

  it('advances to pin2 once pin1 has 6 digits', async () => {
    const { getByTestId } = renderModal()
    fireEvent.press(getByTestId('enroll-enable'))
    fireEvent.changeText(getByTestId('enroll-pin1'), '123456')
    fireEvent.press(getByTestId('enroll-pin1-submit'))
    await waitFor(() => expect(getByTestId('enroll-pin2')).toBeTruthy())
  })

  it('enrolls and dismisses when both PINs match', async () => {
    const { getByTestId, onDone } = renderModal()
    fireEvent.press(getByTestId('enroll-enable'))
    fireEvent.changeText(getByTestId('enroll-pin1'), '123456')
    fireEvent.press(getByTestId('enroll-pin1-submit'))
    await waitFor(() => getByTestId('enroll-pin2'))
    fireEvent.changeText(getByTestId('enroll-pin2'), '123456')
    fireEvent.press(getByTestId('enroll-pin2-submit'))
    await waitFor(() => expect(mockEnroll).toHaveBeenCalledWith('123456'))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('shows the mismatch banner and restarts at intro when PINs differ', async () => {
    const { getByTestId, queryByTestId } = renderModal()
    fireEvent.press(getByTestId('enroll-enable'))
    fireEvent.changeText(getByTestId('enroll-pin1'), '111111')
    fireEvent.press(getByTestId('enroll-pin1-submit'))
    await waitFor(() => getByTestId('enroll-pin2'))
    fireEvent.changeText(getByTestId('enroll-pin2'), '222222')
    fireEvent.press(getByTestId('enroll-pin2-submit'))
    // mismatch → back to intro view (enable CTA visible again), no enroll call
    await waitFor(() => expect(getByTestId('enroll-enable')).toBeTruthy())
    expect(mockEnroll).not.toHaveBeenCalled()
    expect(queryByTestId('enroll-pin2')).toBeNull()
  })

  it('does not enroll while pin2 has fewer than 6 digits', async () => {
    const { getByTestId } = renderModal()
    fireEvent.press(getByTestId('enroll-enable'))
    fireEvent.changeText(getByTestId('enroll-pin1'), '123456')
    fireEvent.press(getByTestId('enroll-pin1-submit'))
    await waitFor(() => getByTestId('enroll-pin2'))
    fireEvent.changeText(getByTestId('enroll-pin2'), '12')
    fireEvent.press(getByTestId('enroll-pin2-submit'))
    expect(mockEnroll).not.toHaveBeenCalled()
  })
})

describe('BiometricEnrollModal — visibility', () => {
  it('renders nothing interactive when not visible', () => {
    const { queryByTestId } = renderModal(false)
    expect(queryByTestId('enroll-enable')).toBeNull()
  })
})
