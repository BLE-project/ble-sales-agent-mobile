/**
 * Biometric/PIN gate overlay — M4b orchestrator.
 *
 * Reads {@link useBiometricAuth} status and dispatches the appropriate
 * UI overlay on top of children. The 4 status states map to:
 *
 *   - idle           → render children (no overlay)
 *   - prompting      → BiometricPromptOverlay (auto-trigger biometric on mount)
 *   - pin-required   → PinEntryScreen
 *   - locked         → PinEntryScreen (with lockout countdown)
 *
 * Plus the orthogonal "first-login enrollment" flow: when the user has
 * a live session but isEnrolled=false AND optedOut=false, the
 * BiometricEnrollModal is shown the first time the user lands on the
 * authenticated tree. This is the Q6 opt-out flow — proactive
 * suggestion at first credential login.
 */

import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { FormattedMessage, useIntl } from 'react-intl'
// Cluster B: sales-agent uses AuthContext.tsx (vs Cluster A's useAuth.tsx).
import { useAuth } from './AuthContext'
import { useBiometricAuth } from './useBiometricAuth'
import { PinEntryScreen } from './PinEntryScreen'
import { BiometricEnrollModal } from './BiometricEnrollModal'

export function BiometricGate({ children }: { children: React.ReactNode }) {
  const intl = useIntl()
  const auth = useAuth()
  const bio = useBiometricAuth()
  const [enrollModalShown, setEnrollModalShown] = useState(false)
  const [enrollModalVisible, setEnrollModalVisible] = useState(false)

  // Trigger enrollment modal once per session, when:
  //   - User is authenticated (live credential session)
  //   - User has not yet enrolled
  //   - User has not previously opted out (record persists across sessions)
  //   - We haven't shown it yet this mount
  useEffect(() => {
    if (
      auth.isAuthenticated &&
      !bio.isEnrolled &&
      !bio.optedOut &&
      !enrollModalShown
    ) {
      setEnrollModalVisible(true)
      setEnrollModalShown(true)
    }
  }, [auth.isAuthenticated, bio.isEnrolled, bio.optedOut, enrollModalShown])

  // ── Status dispatch ────────────────────────────────────────────────────────
  switch (bio.status) {
    case 'prompting':
      return (
        <BiometricPromptOverlay onUsePin={() => { /* hook flips status */ }} />
      )

    case 'pin-required':
    case 'locked':
      return (
        <PinEntryScreen
          title={
            bio.status === 'locked'
              ? intl.formatMessage({ id: 'auth.biometric.pin.title_locked' })
              : intl.formatMessage({ id: 'auth.biometric.pin.title' })
          }
          subtitle={
            bio.failCount > 0 && !bio.isLocked
              ? intl.formatMessage(
                  { id: 'auth.biometric.pin.subtitle.attempts_remaining' },
                  { count: 10 - bio.failCount },
                )
              : undefined
          }
          onBiometricPressed={async () => {
            const result = await bio.triggerBiometric()
            // If biometric succeeds the hook drives status back to 'idle'.
            // If it fails or is unavailable, status flips to 'pin-required'
            // and we keep showing the PIN screen.
            void result
          }}
        />
      )

    case 'idle':
    default:
      return (
        <>
          {children}
          <BiometricEnrollModal
            visible={enrollModalVisible}
            onDone={() => setEnrollModalVisible(false)}
          />
        </>
      )
  }
}

// ── Internal: biometric prompt overlay ───────────────────────────────────────

function BiometricPromptOverlay({ onUsePin }: { onUsePin: () => void }) {
  const bio = useBiometricAuth()

  // Auto-trigger biometric on mount. The hook handles status transitions
  // (success → idle, failure → pin-required, lockout → locked).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await bio.triggerBiometric()
      if (cancelled) return
      // If biometric was unavailable / cancelled, the hook already
      // transitioned status to 'pin-required'. Nothing else to do.
      void result
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <View style={overlayStyles.container}>
      <ActivityIndicator size="large" color="#222222" />
      <Text style={overlayStyles.title}>
        <FormattedMessage id="auth.biometric.gate.title" />
      </Text>
      <Text style={overlayStyles.subtitle}>
        <FormattedMessage id="auth.biometric.gate.subtitle" />
      </Text>
      <TouchableOpacity
        style={overlayStyles.pinLink}
        onPress={onUsePin}
        accessibilityRole="link"
        testID="biometric-use-pin"
      >
        <Text style={overlayStyles.pinLinkText}>
          <FormattedMessage id="auth.biometric.gate.use_pin" />
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const overlayStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#111111',
    marginTop: 24,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
  },
  pinLink: {
    marginTop: 32,
    padding: 12,
  },
  pinLinkText: {
    fontSize: 15,
    color: '#0066CC',
    textDecorationLine: 'underline',
  },
})
