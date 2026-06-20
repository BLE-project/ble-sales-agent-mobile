/**
 * Opt-out enrollment modal — M4b.
 *
 * Shown after the first successful credential login when the user has
 * neither enrolled nor explicitly opted out (Q6: opt-out style — pushed
 * proactively, but with a clear "Skip" + "Never ask again" path).
 *
 * Flow:
 *   intro  → 3 CTAs (Enable / Skip-now / Never)
 *   pin1   → first PIN input (6 digits)
 *   pin2   → confirm PIN, then call enroll() and dismiss
 *   error  → if PINs don't match, restart flow at pin1
 */

import { useState } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { FormattedMessage } from 'react-intl'
import { useBiometricAuth } from './useBiometricAuth'

export interface BiometricEnrollModalProps {
  visible: boolean
  /** Invoked when the user finishes (enrolled OR explicitly skipped). */
  onDone: () => void
}

type Step = 'intro' | 'pin1' | 'pin2' | 'mismatch'

export function BiometricEnrollModal({ visible, onDone }: Readonly<BiometricEnrollModalProps>) {
  const auth = useBiometricAuth()
  const [step, setStep] = useState<Step>('intro')
  const [pin1, setPin1] = useState('')
  const [pin2, setPin2] = useState('')

  function reset() {
    setStep('intro')
    setPin1('')
    setPin2('')
  }

  async function handleEnable() {
    setStep('pin1')
  }

  async function handleSkip() {
    // Plain skip — just dismiss; the modal will appear again next session
    // unless the optedOut flag is set. The hook's optOut() persists the
    // "never ask again" state when called explicitly.
    reset()
    onDone()
  }

  async function handleNeverAsk() {
    await auth.optOut()
    reset()
    onDone()
  }

  async function handlePin1Submit() {
    if (pin1.length !== 6) return
    setStep('pin2')
  }

  async function handlePin2Submit() {
    if (pin2.length !== 6) return
    if (pin1 !== pin2) {
      setStep('mismatch')
      setPin1('')
      setPin2('')
      return
    }
    await auth.enroll(pin1)
    reset()
    onDone()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onDone}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {step === 'intro' || step === 'mismatch' ? (
          <View style={styles.card}>
            <Text style={styles.title}>
              <FormattedMessage id="auth.biometric.enroll.title" />
            </Text>
            <Text style={styles.subtitle}>
              <FormattedMessage id="auth.biometric.enroll.subtitle" />
            </Text>
            {step === 'mismatch' ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>
                  <FormattedMessage id="auth.biometric.enroll.error.mismatch" />
                </Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleEnable}
              accessibilityRole="button"
              testID="enroll-enable"
            >
              <Text style={styles.primaryButtonText}>
                <FormattedMessage id="auth.biometric.enroll.cta.enable" />
              </Text>
            </TouchableOpacity>
            {/* Anomaly H (2026-05-02): "Non ora" (skip) button removed — caused
                perceived logout regression. See terrio-consumer-mobile for full
                rationale. handleSkip() kept for backward compat. */}
            <TouchableOpacity
              style={styles.tertiaryButton}
              onPress={handleNeverAsk}
              accessibilityRole="button"
              testID="enroll-never"
            >
              <Text style={styles.tertiaryButtonText}>
                <FormattedMessage id="auth.biometric.enroll.cta.never" />
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {step === 'pin1' ? (
          <View style={styles.card}>
            <Text style={styles.title}>
              <FormattedMessage id="auth.biometric.enroll.pin1.title" />
            </Text>
            <Text style={styles.subtitle}>
              <FormattedMessage id="auth.biometric.enroll.pin1.subtitle" />
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              value={pin1}
              onChangeText={setPin1}
              placeholder="••••••"
              autoFocus
              testID="enroll-pin1"
            />
            <TouchableOpacity
              style={[
                styles.primaryButton,
                pin1.length !== 6 && styles.buttonDisabled,
              ]}
              onPress={handlePin1Submit}
              disabled={pin1.length !== 6}
              accessibilityRole="button"
              testID="enroll-pin1-submit"
            >
              <Text style={styles.primaryButtonText}>
                <FormattedMessage id="auth.biometric.enroll.cta.next" />
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {step === 'pin2' ? (
          <View style={styles.card}>
            <Text style={styles.title}>
              <FormattedMessage id="auth.biometric.enroll.pin2.title" />
            </Text>
            <Text style={styles.subtitle}>
              <FormattedMessage id="auth.biometric.enroll.pin2.subtitle" />
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              value={pin2}
              onChangeText={setPin2}
              placeholder="••••••"
              autoFocus
              testID="enroll-pin2"
            />
            <TouchableOpacity
              style={[
                styles.primaryButton,
                pin2.length !== 6 && styles.buttonDisabled,
              ]}
              onPress={handlePin2Submit}
              disabled={pin2.length !== 6}
              accessibilityRole="button"
              testID="enroll-pin2-submit"
            >
              <Text style={styles.primaryButtonText}>
                <FormattedMessage id="auth.biometric.enroll.cta.confirm" />
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    paddingVertical: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111111',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  input: {
    height: 56,
    backgroundColor: '#F2F2F2',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 16,
  },
  primaryButton: {
    height: 52,
    backgroundColor: '#222222',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  secondaryButton: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#DDDDDD',
  },
  secondaryButtonText: {
    color: '#222222',
    fontSize: 16,
    fontWeight: '500',
  },
  tertiaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  tertiaryButtonText: {
    color: '#888888',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  errorBanner: {
    backgroundColor: '#FFE4E4',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#A60000',
    fontSize: 13,
    textAlign: 'center',
  },
})
