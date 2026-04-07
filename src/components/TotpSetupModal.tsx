/**
 * FEAT-S45-002: TOTP 2FA Setup Modal — React Native (sales-agent-mobile).
 *
 * Guides the user through TOTP setup:
 * 1. Generate secret via POST /api/v1/auth/totp/setup
 * 2. Display secret + otpauth URI for manual entry in authenticator app
 * 3. Verify first code via POST /api/v1/auth/totp/verify
 */
import { useState } from 'react'
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { api } from '../api/client'

interface TotpSetupModalProps {
  visible: boolean
  onClose: () => void
  onSetupComplete: (secret: string) => void
}

interface TotpSetupResponse {
  secret: string
  otpauthUri: string
  issuer: string
}

export function TotpSetupModal({ visible, onClose, onSetupComplete }: TotpSetupModalProps) {
  const [step, setStep] = useState<'init' | 'verify' | 'done'>('init')
  const [secret, setSecret] = useState('')
  const [otpauthUri, setOtpauthUri] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSetup() {
    setLoading(true); setError('')
    try {
      const result = await api.post<TotpSetupResponse>('/api/v1/auth/totp/setup', {})
      setSecret(result.secret)
      setOtpauthUri(result.otpauthUri)
      setStep('verify')
    } catch { setError('Failed to initialize TOTP setup.') }
    finally { setLoading(false) }
  }

  async function handleVerify() {
    if (code.length !== 6) { setError('Code must be 6 digits'); return }
    setLoading(true); setError('')
    try {
      const result = await api.post<{ verified: boolean }>('/api/v1/auth/totp/verify', { secret, code })
      if (result.verified) { setStep('done'); onSetupComplete(secret) }
      else setError('Invalid code.')
    } catch { setError('Verification failed.') }
    finally { setLoading(false) }
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <ScrollView>
            <Text style={styles.title}>Setup 2FA (TOTP)</Text>

            {step === 'init' && (
              <>
                <Text style={styles.desc}>
                  Add two-factor authentication for sensitive operations. You need an authenticator app.
                </Text>
                <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleSetup} disabled={loading}>
                  <Text style={styles.btnText}>{loading ? 'Generating...' : 'Generate Secret'}</Text>
                </TouchableOpacity>
              </>
            )}

            {step === 'verify' && (
              <>
                <Text style={styles.label}>Secret (Base32):</Text>
                <Text style={styles.secretText} selectable>{secret}</Text>
                <Text style={styles.label}>otpauth URI:</Text>
                <Text style={styles.uriText} selectable numberOfLines={3}>{otpauthUri}</Text>
                <Text style={styles.hint}>Copy the secret or URI into your authenticator app.</Text>
                <Text style={styles.label}>Enter 6-digit code:</Text>
                <TextInput style={styles.codeInput} value={code} maxLength={6} keyboardType="numeric"
                  onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 6))} placeholder="000000" />
                {!!error && <Text style={styles.error}>{error}</Text>}
                <TouchableOpacity style={[styles.btn, (loading || code.length !== 6) && styles.btnDisabled]}
                  onPress={handleVerify} disabled={loading || code.length !== 6}>
                  <Text style={styles.btnText}>{loading ? 'Verifying...' : 'Verify & Enable'}</Text>
                </TouchableOpacity>
              </>
            )}

            {step === 'done' && (
              <>
                <Text style={styles.doneText}>2FA is now enabled.</Text>
                <TouchableOpacity style={styles.btn} onPress={onClose}>
                  <Text style={styles.btnText}>Done</Text>
                </TouchableOpacity>
              </>
            )}

            {step !== 'done' && (
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modal: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '90%', maxHeight: '80%' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 },
  desc: { fontSize: 14, color: '#6b7280', marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: '#374151', marginTop: 8, marginBottom: 4 },
  secretText: { fontFamily: 'monospace', fontSize: 13, color: '#111827', backgroundColor: '#f3f4f6', padding: 8, borderRadius: 6 },
  uriText: { fontFamily: 'monospace', fontSize: 10, color: '#6b7280', backgroundColor: '#f3f4f6', padding: 8, borderRadius: 6 },
  hint: { fontSize: 11, color: '#9ca3af', marginTop: 4, marginBottom: 8 },
  codeInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, fontSize: 24, fontFamily: 'monospace', textAlign: 'center', letterSpacing: 8, marginBottom: 12 },
  error: { color: '#dc2626', fontSize: 13, marginBottom: 8 },
  btn: { backgroundColor: '#1a3f6f', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  cancelBtn: { marginTop: 12, alignItems: 'center' },
  cancelText: { color: '#6b7280', fontSize: 14 },
  doneText: { fontSize: 15, color: '#111827', textAlign: 'center', marginVertical: 20 },
})
