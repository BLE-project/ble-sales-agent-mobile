/**
 * BiometricGate render + status-dispatch tests (sales-agent).
 *
 * Mocks the hook surfaces (useAuth from ./AuthContext, useBiometricAuth) plus
 * the heavy child screens (PinEntryScreen, BiometricEnrollModal) so the Gate's
 * own dispatch logic + first-login enroll trigger are exercised in isolation.
 * Native modules (expo-local-authentication) are reached only through the
 * mocked hook. No branding hook in this repo.
 */
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { IntlProvider } from 'react-intl'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockTriggerBiometric = jest.fn(async () => 'ok')
let mockBio: {
  status: 'idle' | 'prompting' | 'pin-required' | 'locked'
  isEnrolled: boolean
  optedOut: boolean
  isLocked: boolean
  failCount: number
  triggerBiometric: jest.Mock
}
let mockAuthenticated = true

jest.mock('./useBiometricAuth', () => ({
  useBiometricAuth: () => mockBio,
}))
// Cluster B: sales-agent uses AuthContext.tsx (vs Cluster A's useAuth.tsx).
jest.mock('./AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: mockAuthenticated }),
}))

// Heavy child screens stubbed so we assert *which* overlay the Gate picks,
// and so PinEntryScreen's biometric button forwards to the hook.
jest.mock('./PinEntryScreen', () => ({
  PinEntryScreen: ({ title, subtitle, onBiometricPressed }: {
    title: string
    subtitle?: string
    onBiometricPressed: () => void
  }) => {
    const { Text, TouchableOpacity } = require('react-native')
    return (
      <>
        <Text testID="pin-title">{title}</Text>
        {subtitle ? <Text testID="pin-subtitle">{subtitle}</Text> : null}
        <TouchableOpacity testID="pin-biometric" onPress={onBiometricPressed}>
          <Text>bio</Text>
        </TouchableOpacity>
      </>
    )
  },
}))
jest.mock('./BiometricEnrollModal', () => ({
  BiometricEnrollModal: ({ visible, onDone }: { visible: boolean; onDone: () => void }) => {
    const { Text, TouchableOpacity } = require('react-native')
    return visible ? (
      <TouchableOpacity testID="enroll-modal" onPress={onDone}>
        <Text>ENROLL</Text>
      </TouchableOpacity>
    ) : null
  },
}))

import { BiometricGate } from './BiometricGate'
import { Text } from 'react-native'

function renderGate() {
  return render(
    <IntlProvider locale="en" onError={() => {}}>
      <BiometricGate>
        <Text testID="protected">PROTECTED</Text>
      </BiometricGate>
    </IntlProvider>,
  )
}

beforeEach(() => {
  mockTriggerBiometric.mockReset()
  mockTriggerBiometric.mockResolvedValue('ok')
  mockAuthenticated = true
  mockBio = {
    status: 'idle',
    isEnrolled: true, // default: no enroll modal unless a test opts in
    optedOut: false,
    isLocked: false,
    failCount: 0,
    triggerBiometric: mockTriggerBiometric,
  }
})

describe('BiometricGate — status dispatch', () => {
  it('renders children with no overlay when idle', () => {
    const { getByTestId, queryByTestId } = renderGate()
    expect(getByTestId('protected')).toBeTruthy()
    expect(queryByTestId('pin-title')).toBeNull()
  })

  it('auto-triggers biometric on mount when prompting', async () => {
    mockBio.status = 'prompting'
    const { queryByTestId } = renderGate()
    expect(queryByTestId('protected')).toBeNull()
    await waitFor(() => expect(mockTriggerBiometric).toHaveBeenCalledTimes(1))
  })

  it('exposes a "use PIN" link in the prompting overlay', () => {
    mockBio.status = 'prompting'
    const { getByTestId } = renderGate()
    // Tapping the link is a no-op (hook drives status) but must not throw.
    fireEvent.press(getByTestId('biometric-use-pin'))
    expect(getByTestId('biometric-use-pin')).toBeTruthy()
  })

  it('shows the PIN screen with the standard title when pin-required', () => {
    mockBio.status = 'pin-required'
    const { getByTestId } = renderGate()
    expect(getByTestId('pin-title').props.children).toBe('auth.biometric.pin.title')
  })

  it('shows the locked title when locked', () => {
    mockBio.status = 'locked'
    mockBio.isLocked = true
    mockBio.failCount = 3
    const { getByTestId } = renderGate()
    expect(getByTestId('pin-title').props.children).toBe('auth.biometric.pin.title_locked')
  })

  it('shows an attempts-remaining subtitle when failCount>0 and not locked', () => {
    mockBio.status = 'pin-required'
    mockBio.failCount = 4
    const { getByTestId } = renderGate()
    // 10 - 4 = 6 remaining; subtitle is present (FormattedMessage id passthrough)
    expect(getByTestId('pin-subtitle')).toBeTruthy()
  })

  it('omits the subtitle when failCount is 0', () => {
    mockBio.status = 'pin-required'
    mockBio.failCount = 0
    const { queryByTestId } = renderGate()
    expect(queryByTestId('pin-subtitle')).toBeNull()
  })

  it('forwards the PIN-screen biometric button to triggerBiometric', async () => {
    mockBio.status = 'pin-required'
    const { getByTestId } = renderGate()
    fireEvent.press(getByTestId('pin-biometric'))
    await waitFor(() => expect(mockTriggerBiometric).toHaveBeenCalledTimes(1))
  })
})

describe('BiometricGate — first-login enroll modal', () => {
  it('shows the enroll modal when authenticated + not enrolled + not opted out', async () => {
    mockBio.isEnrolled = false
    const { getByTestId } = renderGate()
    await waitFor(() => expect(getByTestId('enroll-modal')).toBeTruthy())
  })

  it('does NOT show the enroll modal when already enrolled', () => {
    mockBio.isEnrolled = true
    const { queryByTestId } = renderGate()
    expect(queryByTestId('enroll-modal')).toBeNull()
  })

  it('does NOT show the enroll modal when the user opted out', () => {
    mockBio.isEnrolled = false
    mockBio.optedOut = true
    const { queryByTestId } = renderGate()
    expect(queryByTestId('enroll-modal')).toBeNull()
  })

  it('does NOT show the enroll modal when there is no live session', () => {
    mockBio.isEnrolled = false
    mockAuthenticated = false
    const { queryByTestId } = renderGate()
    expect(queryByTestId('enroll-modal')).toBeNull()
  })

  it('dismisses the enroll modal via onDone', async () => {
    mockBio.isEnrolled = false
    const { getByTestId, queryByTestId } = renderGate()
    const modal = await waitFor(() => getByTestId('enroll-modal'))
    fireEvent.press(modal)
    await waitFor(() => expect(queryByTestId('enroll-modal')).toBeNull())
  })
})
