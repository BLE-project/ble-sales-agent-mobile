/**
 * v8.0.0-SNAPSHOT.3 session 7-bis: migrated to react-intl FormattedMessage.
 */
import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { FormattedMessage, useIntl } from 'react-intl'
import { useRouter } from 'expo-router'
import { useAuth } from '../src/auth/AuthContext'
import { TOKENS } from '../src/theme/defaults/tokens'

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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.brand}>
          <FormattedMessage id="app.name" />
        </Text>
        <Text style={styles.subtitle}>
          <FormattedMessage id="app.tagline" />
        </Text>

        <TextInput
          style={styles.input}
          placeholder={usernamePlaceholder}
          placeholderTextColor={TOKENS.colors.surface.inkSoft}
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
          testID="username-input"
          autoComplete="off"
          importantForAutofill="no"
        />
        <TextInput
          style={styles.input}
          placeholder={passwordPlaceholder}
          placeholderTextColor={TOKENS.colors.surface.inkSoft}
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
            ? <ActivityIndicator color={TOKENS.colors.surface.onBrand} />
            : <Text style={styles.btnText}>
                <FormattedMessage id="auth.login.submit" />
              </Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const BRAND = TOKENS.colors.brand.primary

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: BRAND, justifyContent: 'center', padding: 24 },
  card:       { backgroundColor: TOKENS.colors.surface.surface, borderRadius: 16, padding: 28 },
  brand:      { fontSize: 32, fontWeight: '800', color: BRAND, textAlign: 'center', marginBottom: 4 },
  subtitle:   { fontSize: 14, color: TOKENS.colors.surface.inkSoft, textAlign: 'center', marginBottom: 28 },
  input:      { borderWidth: 1, borderColor: TOKENS.colors.surface.line, borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 14 },
  btn:        { backgroundColor: BRAND, borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 4 },
  btnDisabled:{ opacity: 0.6 },
  btnText:    { color: TOKENS.colors.surface.onBrand, fontWeight: '700', fontSize: 16 },
})
