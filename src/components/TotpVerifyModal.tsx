/**
 * FEAT-S45-002: TOTP 2FA Verification Modal — React Native (sales-agent-mobile).
 * Prompts for a 6-digit code before executing sensitive operations.
 */
import { useState } from 'react'
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { api } from '../api/client'

interface TotpVerifyModalProps {
  visible: boolean
  onClose: () => void
  onVerified: () => void
  totpSecret: string
  operationLabel?: string
}

export function TotpVerifyModal({ visible, onClose, onVerified, totpSecret, operationLabel }: TotpVerifyModalProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleValidate() {
    if (code.length !== 6) { setError('Code must be 6 digits'); return }
    setLoading(true); setError('')
    try {
      const result = await api.post<{ valid: boolean }>('/api/v1/auth/totp/validate', { secret: totpSecret, code })
      if (result.valid) { setCode(''); onVerified() }
      else setError('Invalid code.')
    } catch { setError('Validation failed.') }
    finally { setLoading(false) }
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>2FA Verification</Text>
          <Text style={styles.desc}>
            {operationLabel ? `Enter code to ${operationLabel}.` : 'Enter your authenticator code.'}
          </Text>
          <TextInput style={styles.codeInput} value={code} maxLength={6} keyboardType="numeric"
            onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 6))} placeholder="000000" autoFocus />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.row}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setCode(''); setError(''); onClose() }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, (loading || code.length !== 6) && styles.btnDisabled]}
              onPress={handleValidate} disabled={loading || code.length !== 6}>
              <Text style={styles.btnText}>{loading ? 'Verifying...' : 'Verify'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modal: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '85%' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  desc: { fontSize: 14, color: '#6b7280', marginBottom: 16 },
  codeInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, fontSize: 24, fontFamily: 'monospace', textAlign: 'center', letterSpacing: 8, marginBottom: 12 },
  error: { color: '#dc2626', fontSize: 13, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  cancelText: { color: '#374151', fontSize: 14 },
  btn: { flex: 1, backgroundColor: '#1a3f6f', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
})
