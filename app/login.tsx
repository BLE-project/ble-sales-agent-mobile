import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../src/auth/AuthContext'

export default function LoginScreen() {
  const { login } = useAuth()
  const router    = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleLogin() {
    if (!username.trim() || !password) {
      Alert.alert('Inserisci username e password')
      return
    }
    setLoading(true)
    try {
      await login(username.trim(), password)
      router.replace('/(app)')
    } catch (e: unknown) {
      Alert.alert('Accesso negato', e instanceof Error ? e.message : 'Errore sconosciuto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.brand}>Terrio</Text>
        <Text style={styles.subtitle}>Agente Commerciale</Text>

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#999"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
          testID="username-input"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#999"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          testID="password-input"
        />
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          testID="login-btn"
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Accedi</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const BRAND = '#1a3f6f'

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: BRAND, justifyContent: 'center', padding: 24 },
  card:       { backgroundColor: '#fff', borderRadius: 16, padding: 28 },
  brand:      { fontSize: 32, fontWeight: '800', color: BRAND, textAlign: 'center', marginBottom: 4 },
  subtitle:   { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 28 },
  input:      { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 14 },
  btn:        { backgroundColor: BRAND, borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 4 },
  btnDisabled:{ opacity: 0.6 },
  btnText:    { color: '#fff', fontWeight: '700', fontSize: 16 },
})
