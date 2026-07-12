/**
 * v8.0.0-SNAPSHOT.3 session 7-bis: migrated to react-intl FormattedMessage.
 *
 * Redesign «La Piazza» 2026-07-11 (pattern login fleet, cluster C7): canvas
 * base, kicker mono, titolo two-tone (prima parola ink + resto brand, nodo
 * Text unico → il match "TERRIO Sales" dei flow resta), tagline, BeaconRadar
 * di sfondo, label mono sopra gli input, footer mono per-app. testID e logica
 * auth invariati; sentinelle login.yaml ("TERRIO Sales", "Assistenza merchant")
 * restano a video via app.name/app.tagline.
 */
import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { FormattedMessage, useIntl } from 'react-intl'
import { useRouter } from 'expo-router'
import { useAuth } from '../src/auth/AuthContext'
import { TOKENS, spacing, radius } from '../src/theme/defaults/tokens'
import { BeaconRadar } from '../src/components/piazza/ui'

const S = TOKENS.colors.surface
const BRAND = TOKENS.colors.brand.primary
const F = {
  display: 'BricolageGrotesque_700Bold',
  body: 'HankenGrotesk_400Regular',
  bodySemiBold: 'HankenGrotesk_600SemiBold',
  mono: 'JetBrainsMono_400Regular',
}

export default function LoginScreen() {
  const intl      = useIntl()
  const { login } = useAuth()
  const router    = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleLogin() {
    if (!username.trim() || !password) {
      Alert.alert(intl.formatMessage({ id: 'auth.login.missing_credentials' }))
      return
    }
    setLoading(true)
    try {
      await login(username.trim(), password)
      router.replace('/(app)')
    } catch (e: unknown) {
      Alert.alert(
        intl.formatMessage({ id: 'auth.login.error.denied' }),
        e instanceof Error ? e.message : intl.formatMessage({ id: 'auth.login.error.unknown' }),
      )
    } finally {
      setLoading(false)
    }
  }

  const usernamePlaceholder = intl.formatMessage({ id: 'auth.login.username' })
  const passwordPlaceholder = intl.formatMessage({ id: 'auth.login.password' })
  // Two-tone: prima parola ink, resto brand ("TERRIO Sales" → TERRIO +
  // Sales). Nodo Text unico → i match testuali interi (Maestro/jest) valgono.
  const brandName = intl.formatMessage({ id: 'app.name' })
  const [brandFirst, ...brandRest] = brandName.split(' ')

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.radarBg} pointerEvents="none">
        <BeaconRadar />
      </View>

      <View style={styles.lockup}>
        <Text style={styles.kicker}>
          {intl.formatMessage({ id: 'auth.login.kicker' }).toUpperCase()}
        </Text>
        <Text style={styles.title}>
          {brandFirst}
          {brandRest.length > 0 && <Text style={{ color: BRAND }}> {brandRest.join(' ')}</Text>}
        </Text>
        <Text style={styles.tagline}>
          <FormattedMessage id="app.tagline" />
        </Text>
      </View>

      <View>
        <Text style={styles.fieldLabel}>{usernamePlaceholder.toUpperCase()}</Text>
        <TextInput
          style={styles.input}
          placeholder={usernamePlaceholder}
          placeholderTextColor={S.inkSoft}
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
          testID="username-input"
          autoComplete="off"
          importantForAutofill="no"
        />
        <Text style={styles.fieldLabel}>{passwordPlaceholder.toUpperCase()}</Text>
        <TextInput
          style={styles.input}
          placeholder={passwordPlaceholder}
          placeholderTextColor={S.inkSoft}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          testID="password-input"
          autoComplete="off"
          importantForAutofill="no"
        />
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          testID="login-btn"
        >
          {loading
            ? (
              <View style={styles.btnLoading}>
                <ActivityIndicator color={S.onBrand} />
                <Text style={styles.btnText}>
                  <FormattedMessage id="auth.login.submitting" />
                </Text>
              </View>
            )
            : <Text style={styles.btnText}>
                <FormattedMessage id="auth.login.submit" />
              </Text>
          }
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>TERRIO · SALES AGENT</Text>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: S.base, justifyContent: 'center', padding: spacing.s6 + 4 },
  radarBg:    { position: 'absolute', top: 40, left: 0, right: 0, alignItems: 'center', opacity: 0.6 },
  lockup:     { marginBottom: spacing.s10 },
  kicker:     { fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: S.inkSoft, marginBottom: spacing.s2 },
  title:      { fontFamily: F.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.8, color: S.ink },
  tagline:    { fontFamily: F.body, fontSize: 15, lineHeight: 22, color: S.inkSoft, marginTop: spacing.s3 },
  fieldLabel: { fontFamily: F.mono, fontSize: 10, letterSpacing: 0.8, color: S.inkSoft, marginBottom: spacing.s1, marginLeft: 2 },
  input:      {
    backgroundColor: S.surface, borderWidth: 1, borderColor: S.line, borderRadius: radius.l,
    padding: spacing.s4 - 2, fontSize: 16, fontFamily: F.body, color: S.ink,
    marginBottom: spacing.s3, minHeight: 48,
  },
  btn:        { backgroundColor: BRAND, borderRadius: radius.l, padding: spacing.s4, alignItems: 'center', marginTop: spacing.s2, minHeight: 52, justifyContent: 'center' },
  btnDisabled:{ opacity: 0.85 },
  btnLoading: { flexDirection: 'row', alignItems: 'center', gap: spacing.s2 },
  btnText:    { color: S.onBrand, fontFamily: F.bodySemiBold, fontSize: 16 },
  footer:     {
    position: 'absolute', bottom: spacing.s8, alignSelf: 'center',
    fontFamily: F.mono, fontSize: 10, letterSpacing: 1.2, color: S.inkSoft, opacity: 0.7,
  },
})
