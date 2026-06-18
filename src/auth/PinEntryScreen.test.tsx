/**
 * PinEntryScreen render + interaction tests — M4b (sales-agent).
 *
 * Mocks useBiometricAuth (to drive submitPin results) and react-native
 * Vibration. Exercises digit entry, the 6-dot indicator, auto-submit on the
 * 6th digit, wrong/locked/wiped error banners, backspace, the lockout banner,
 * and the optional biometric link. No branding hook in this repo.
 */
import React from 'react'
import { render, fireEvent, act } from '@testing-library/react-native'
import { IntlProvider } from 'react-intl'
import enMessages from '../i18n/messages/en-US.json'

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockSubmitPin = jest.fn()
let mockAuth: {
  isLocked: boolean
  remainingLockoutSeconds: number
  failCount: number
  submitPin: jest.Mock
}

jest.mock('./useBiometricAuth', () => ({
  useBiometricAuth: () => mockAuth,
}))

// Vibration — capture calls without touching the native module.
import { Vibration } from 'react-native'
const vibrateSpy = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {})

import { PinEntryScreen, type PinEntryScreenProps } from './PinEntryScreen'

// ── Helpers ─────────────────────────────────────────────────────────────────

function renderScreen(props: PinEntryScreenProps = {}) {
  return render(
    <IntlProvider locale="en" messages={enMessages} onError={() => {}}>
      <PinEntryScreen {...props} />
    </IntlProvider>,
  )
}

async function pressDigits(getByTestId: (id: string) => any, digits: string) {
  for (const d of digits) {
    // each digit press may trigger the async submitPin on the 6th — wrap in act
    await act(async () => {
      fireEvent.press(getByTestId(`pin-digit-${d}`))
    })
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAuth = {
    isLocked: false,
    remainingLockoutSeconds: 0,
    failCount: 0,
    submitPin: mockSubmitPin,
  }
})

// ── Render ────────────────────────────────────────────────────────────────

describe('PinEntryScreen — render', () => {
  it('renders the default i18n title, the keypad, and 6 empty dots', () => {
    const { getByText, getByTestId, getAllByLabelText } = renderScreen()
    expect(getByText('Enter your PIN')).toBeTruthy()
    for (const d of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
      expect(getByTestId(`pin-digit-${d}`)).toBeTruthy()
    }
    expect(getByTestId('pin-backspace')).toBeTruthy()
    expect(getAllByLabelText('digit empty')).toHaveLength(6)
  })

  it('renders a caller-provided title + subtitle override', () => {
    const { getByText } = renderScreen({ title: 'Custom title', subtitle: 'Sub here' })
    expect(getByText('Custom title')).toBeTruthy()
    expect(getByText('Sub here')).toBeTruthy()
  })
})

// ── Digit entry + dots indicator ────────────────────────────────────────────

describe('PinEntryScreen — digit entry', () => {
  it('fills dots as digits are entered', async () => {
    const { getByTestId, getAllByLabelText } = renderScreen()
    await pressDigits(getByTestId, '123')
    expect(getAllByLabelText('digit entered')).toHaveLength(3)
    expect(getAllByLabelText('digit empty')).toHaveLength(3)
  })

  it('backspace removes the last entered digit', async () => {
    const { getByTestId, getAllByLabelText } = renderScreen()
    await pressDigits(getByTestId, '12')
    expect(getAllByLabelText('digit entered')).toHaveLength(2)
    await act(async () => { fireEvent.press(getByTestId('pin-backspace')) })
    expect(getAllByLabelText('digit entered')).toHaveLength(1)
  })

  it('does not auto-submit before the 6th digit', async () => {
    const { getByTestId } = renderScreen()
    await pressDigits(getByTestId, '12345')
    expect(mockSubmitPin).not.toHaveBeenCalled()
  })
})

// ── Auto-submit on 6th digit ────────────────────────────────────────────────

describe('PinEntryScreen — auto-submit', () => {
  it('calls submitPin with the full 6-digit PIN on the 6th digit', async () => {
    mockSubmitPin.mockResolvedValue('ok')
    const { getByTestId, getAllByLabelText } = renderScreen()
    await pressDigits(getByTestId, '123456')
    expect(mockSubmitPin).toHaveBeenCalledWith('123456')
    expect(getAllByLabelText('digit empty')).toHaveLength(6)
  })

  it('shows the wrong-PIN error banner and vibrates on a wrong result', async () => {
    mockSubmitPin.mockResolvedValue('wrong')
    const { getByTestId, getByText } = renderScreen()
    await pressDigits(getByTestId, '999999')
    // remaining = 10 - failCount(0) - 1 = 9
    expect(getByText(/9 attempts remaining before lockout/)).toBeTruthy()
    expect(vibrateSpy).toHaveBeenCalledWith(80)
  })

  it('shows the locked error banner on a locked result', async () => {
    mockSubmitPin.mockResolvedValue('locked')
    const { getByTestId, getByText } = renderScreen()
    await pressDigits(getByTestId, '111111')
    expect(getByText('Too many attempts. Try again in a few minutes.')).toBeTruthy()
    expect(vibrateSpy).toHaveBeenCalledWith(80)
  })

  it('shows the wiped error banner + pattern vibration on a wiped result', async () => {
    mockSubmitPin.mockResolvedValue('wiped')
    const { getByTestId, getByText } = renderScreen()
    await pressDigits(getByTestId, '222222')
    expect(getByText('Credentials wiped for security. Please sign in again.')).toBeTruthy()
    expect(vibrateSpy).toHaveBeenCalledWith([0, 80, 80, 80])
  })

  it('clears a stale error banner when the user starts typing again', async () => {
    mockSubmitPin.mockResolvedValue('wrong')
    const { getByTestId, queryByText } = renderScreen()
    await pressDigits(getByTestId, '999999')
    expect(queryByText(/remaining before lockout/)).toBeTruthy()
    await pressDigits(getByTestId, '1')
    expect(queryByText(/remaining before lockout/)).toBeNull()
  })
})

// ── Lockout state ────────────────────────────────────────────────────────────

describe('PinEntryScreen — locked', () => {
  beforeEach(() => {
    mockAuth.isLocked = true
    mockAuth.remainingLockoutSeconds = 42
  })

  it('shows the lockout banner with the rounded-up seconds', () => {
    mockAuth.remainingLockoutSeconds = 41.2
    const { getByText } = renderScreen()
    expect(getByText('Locked. Try again in 42s.')).toBeTruthy()
  })

  it('ignores digit presses while locked (submitPin never called)', async () => {
    const { getByTestId, getAllByLabelText } = renderScreen()
    await pressDigits(getByTestId, '123456')
    expect(mockSubmitPin).not.toHaveBeenCalled()
    expect(getAllByLabelText('digit empty')).toHaveLength(6)
  })

  it('does not render the biometric link while locked', () => {
    const onBiometricPressed = jest.fn()
    const { queryByTestId } = renderScreen({ onBiometricPressed })
    expect(queryByTestId('pin-use-biometric')).toBeNull()
  })
})

// ── Biometric link ───────────────────────────────────────────────────────────

describe('PinEntryScreen — biometric link', () => {
  it('is hidden when no handler is provided', () => {
    const { queryByTestId } = renderScreen()
    expect(queryByTestId('pin-use-biometric')).toBeNull()
  })

  it('renders and fires onBiometricPressed when tapped (unlocked)', () => {
    const onBiometricPressed = jest.fn()
    const { getByTestId } = renderScreen({ onBiometricPressed })
    fireEvent.press(getByTestId('pin-use-biometric'))
    expect(onBiometricPressed).toHaveBeenCalledTimes(1)
  })
})
