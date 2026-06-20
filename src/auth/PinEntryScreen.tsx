/**
 * 6-digit PIN entry screen — M4b.
 *
 * Renders a numeric keypad (3×4 grid + backspace), a 6-dot indicator
 * for entered characters, and a lockout countdown when applicable.
 * Reads {@link useBiometricAuth} for the submit + lockout state.
 *
 * ## Visual contract
 *
 * - I4-compliant: only neutral grays + system colors. Brand-token
 *   integration deferred to a polish PR (kept simple here so the
 *   pilot ships fast).
 * - Accessibility: each digit button has a numeric `accessibilityLabel`.
 * - Auto-submit: when 6th digit is entered, `submitPin` fires
 *   automatically — no extra "OK" button.
 *
 * ## Lockout countdown
 *
 * When `state.isLocked` is true the keypad is disabled and a banner
 * shows `remainingLockoutSeconds`. The hook re-renders every time
 * a state value changes; we add a 1-second tick effect here so the
 * countdown decreases visibly without the user having to interact.
 */

import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
} from 'react-native'
import { FormattedMessage, useIntl } from 'react-intl'
import { useBiometricAuth, type BiometricResult } from './useBiometricAuth'

const KEYPAD_LAYOUT = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', '⌫'],
] as const

export interface PinEntryScreenProps {
  /** Optional caption above the dots row. */
  title?: string
  /** Optional subtitle (e.g. "Hai 8 tentativi rimanenti"). */
  subtitle?: string
  /** Show a "Use biometric" link at the bottom. */
  onBiometricPressed?: () => void
}

export function PinEntryScreen({
  title,
  subtitle,
  onBiometricPressed,
}: Readonly<PinEntryScreenProps>) {
  const intl = useIntl()
  const auth = useBiometricAuth()
  const [pin, setPin] = useState('')
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [tick, setTick] = useState(0)  // forces re-render for lockout countdown
  // Default title comes from the i18n catalog; callers may override (e.g.
  // BiometricGate passes a "Try again shortly" variant when the lockout is
  // active so the visible title differs from the keypad hint).
  const resolvedTitle = title ?? intl.formatMessage({ id: 'auth.biometric.pin.title' })

  // 1-second tick while locked, so the countdown number updates visibly.
  useEffect(() => {
    if (!auth.isLocked) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [auth.isLocked])

  // Derived from `tick` reads (the hook already recomputes remainingSeconds
  // when re-rendered).
  void tick

  async function handleDigit(d: string) {
    if (auth.isLocked) return
    if (pin.length >= 6) return
    const next = pin + d
    setPin(next)
    setErrorBanner(null)
    if (next.length === 6) {
      const result: BiometricResult = await auth.submitPin(next)
      if (result === 'wrong') {
        Vibration.vibrate(80)
        setErrorBanner(
          intl.formatMessage(
            { id: 'auth.biometric.pin.error.wrong' },
            { remaining: 10 - auth.failCount - 1 },
          ),
        )
      } else if (result === 'locked') {
        Vibration.vibrate(80)
        setErrorBanner(intl.formatMessage({ id: 'auth.biometric.pin.error.locked' }))
      } else if (result === 'wiped') {
        Vibration.vibrate([0, 80, 80, 80])
        setErrorBanner(intl.formatMessage({ id: 'auth.biometric.pin.error.wiped' }))
      }
      // 'ok' / 'cancelled' → gate dismisses; we just clear the field.
      setPin('')
    }
  }

  function handleBackspace() {
    if (auth.isLocked) return
    setPin((p) => p.slice(0, -1))
    setErrorBanner(null)
  }

  return (
    <View style={styles.container} accessibilityRole="none">
      <Text style={styles.title}>{resolvedTitle}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      {/* 6 dots indicator */}
      <View style={styles.dotsRow}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={[styles.dot, i < pin.length && styles.dotFilled]}
            accessibilityLabel={
              i < pin.length
                ? intl.formatMessage({ id: 'auth.biometric.pin.a11y.dot_filled' })
                : intl.formatMessage({ id: 'auth.biometric.pin.a11y.dot_empty' })
            }
          />
        ))}
      </View>

      {/* Lockout banner */}
      {auth.isLocked ? (
        <View style={styles.lockoutBanner}>
          <Text style={styles.lockoutText}>
            <FormattedMessage
              id="auth.biometric.pin.lockout.banner"
              values={{ seconds: Math.ceil(auth.remainingLockoutSeconds) }}
            />
          </Text>
        </View>
      ) : errorBanner ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorBanner}</Text>
        </View>
      ) : (
        <View style={styles.bannerSpacer} />
      )}

      {/* Keypad */}
      <View style={styles.keypad} accessibilityRole="none">
        {KEYPAD_LAYOUT.map((row, ri) => (
          <View key={ri} style={styles.keypadRow}>
            {row.map((cell, ci) => {
              if (cell === '') {
                return <View key={ci} style={styles.keyEmpty} />
              }
              if (cell === '⌫') {
                return (
                  <TouchableOpacity
                    key={ci}
                    style={[styles.key, auth.isLocked && styles.keyDisabled]}
                    onPress={handleBackspace}
                    disabled={auth.isLocked}
                    accessibilityLabel={intl.formatMessage({ id: 'auth.biometric.pin.a11y.backspace' })}
                    accessibilityRole="button"
                    testID="pin-backspace"
                  >
                    <Text style={styles.keyText}>{cell}</Text>
                  </TouchableOpacity>
                )
              }
              return (
                <TouchableOpacity
                  key={ci}
                  style={[styles.key, auth.isLocked && styles.keyDisabled]}
                  onPress={() => handleDigit(cell)}
                  disabled={auth.isLocked}
                  accessibilityLabel={intl.formatMessage({ id: 'auth.biometric.pin.a11y.digit' }, { digit: cell })}
                  accessibilityRole="button"
                  testID={`pin-digit-${cell}`}
                >
                  <Text style={styles.keyText}>{cell}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        ))}
      </View>

      {/* Biometric link (optional) */}
      {onBiometricPressed && !auth.isLocked ? (
        <TouchableOpacity
          style={styles.biometricLink}
          onPress={onBiometricPressed}
          accessibilityLabel={intl.formatMessage({ id: 'auth.biometric.pin.a11y.use_biometric' })}
          accessibilityRole="link"
          testID="pin-use-biometric"
        >
          <Text style={styles.biometricLinkText}>
            <FormattedMessage id="auth.biometric.pin.use_biometric_link" />
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
    color: '#111111',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginVertical: 24,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#DDDDDD',
  },
  dotFilled: {
    backgroundColor: '#222222',
  },
  bannerSpacer: { height: 40 },
  errorBanner: {
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FFE4E4',
    borderRadius: 8,
    marginVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#A60000',
    fontSize: 13,
    textAlign: 'center',
  },
  lockoutBanner: {
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FFF4D6',
    borderRadius: 8,
    marginVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockoutText: {
    color: '#7A5A00',
    fontSize: 13,
    textAlign: 'center',
  },
  keypad: {
    width: '100%',
    maxWidth: 320,
    marginTop: 16,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  key: {
    width: 88,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#F2F2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyDisabled: {
    opacity: 0.4,
  },
  keyEmpty: {
    width: 88,
    height: 64,
  },
  keyText: {
    fontSize: 24,
    fontWeight: '500',
    color: '#222222',
  },
  biometricLink: {
    marginTop: 24,
    padding: 12,
  },
  biometricLinkText: {
    fontSize: 15,
    color: '#0066CC',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
})
