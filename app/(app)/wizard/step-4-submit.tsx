/**
 * BCN-CFG-002 Wizard — Step 4: POST /v1/beacon-health, show success/failure.
 *
 * Reference: BLE-project/ble-platform-docs#186
 */
import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { submitBeaconHealth } from '../../../src/api/beaconHealthApi'
import { getWizardState, setSnapshotId, resetWizard } from '../../../src/wizard/wizardState'

type Phase = 'submitting' | 'ok' | 'error'

export default function WizardStep4Submit() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('submitting')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [snapshotId, setSnapshot] = useState<string | null>(null)

  useEffect(() => {
    const state = getWizardState()
    if (!state.merchantId) {
      Alert.alert('Stato wizard incoerente', 'Riavvia il flusso da Step 1.')
      router.replace('/(app)/wizard/step-1-merchant' as never)
      return
    }
    submitBeaconHealth({
      merchantId:  state.merchantId,
      scanResults: state.scanResults,
    })
      .then(res => {
        setSnapshotId(res.healthSnapshotId)
        setSnapshot(res.healthSnapshotId)
        setPhase('ok')
      })
      .catch(e => {
        setErrorMsg((e as Error).message)
        setPhase('error')
      })
  }, [router])

  if (phase === 'submitting') {
    return (
      <View style={styles.center} testID="wizard-submit-loading">
        <ActivityIndicator size="large" color="#6C3FCF" />
        <Text style={styles.muted}>Invio snapshot in corso…</Text>
      </View>
    )
  }
  if (phase === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.error} testID="wizard-submit-error">Errore: {errorMsg}</Text>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary, { marginTop: 16 }]}
          onPress={() => router.replace('/(app)/wizard/step-3-confirm' as never)}
        >
          <Text style={styles.btnText}>Torna alla conferma</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.center}>
      <Text style={styles.ok} testID="wizard-submit-ok">✅ First-config registrata</Text>
      <Text style={styles.muted}>Health Snapshot ID:</Text>
      <Text style={styles.snapshot}>{snapshotId}</Text>
      <TouchableOpacity
        style={[styles.btn, styles.btnPrimary, { marginTop: 24 }]}
        onPress={() => {
          resetWizard()
          router.replace('/(app)/beacon-config' as never)
        }}
        testID="wizard-submit-finish"
      >
        <Text style={styles.btnText}>Fine</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  ok:         { fontSize: 22, fontWeight: '700', color: '#166534', marginBottom: 16 },
  error:      { fontSize: 14, color: '#b91c1c', textAlign: 'center' },
  muted:      { color: '#6b7280', marginTop: 12 },
  snapshot:   { fontFamily: 'Courier', fontSize: 12, color: '#111827', marginTop: 4, textAlign: 'center' },
  btn:        { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#0B6E4F' },
  btnText:    { color: '#fff', fontWeight: '700', fontSize: 14 },
})
