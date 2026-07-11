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
import { TOKENS, spacing, radius } from '../../../src/theme/defaults/tokens'
import { typography } from '../../../src/theme/typography'

// Redesign «La Piazza» C4 (2026-07-11): solo restyle token/font; testID
// wizard-submit-{loading,error,ok,finish} e copy "Invio snapshot in corso…"/
// "Torna alla conferma" INVARIATI (jest asserisce i testID, Maestro
// beacon-first-config.yaml attende wizard-submit-ok).
const P = TOKENS.colors.surface

type Phase = 'submitting' | 'ok' | 'error'

export default function WizardStep4Submit() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('submitting')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [localSnapshotId, setLocalSnapshotId] = useState<string | null>(null)

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
        setLocalSnapshotId(res.healthSnapshotId)
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
        <ActivityIndicator size="large" color={TOKENS.colors.brand.primary} />
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
      <Text style={styles.ok} testID="wizard-submit-ok">First-config registrata</Text>
      <Text style={styles.muted}>Health Snapshot ID:</Text>
      <Text style={styles.snapshot}>{localSnapshotId}</Text>
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
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.s6, backgroundColor: P.base },
  ok:         { ...typography.displayL, color: TOKENS.colors.semantic.success, marginBottom: spacing.s4 },
  error:      { ...typography.bodyM, color: TOKENS.colors.semantic.danger, textAlign: 'center' },
  muted:      { ...typography.bodyM, color: P.inkSoft, marginTop: spacing.s3 },
  snapshot:   { fontFamily: 'JetBrainsMono_400Regular', fontSize: 12, color: P.ink, marginTop: spacing.s1, textAlign: 'center' },
  btn:        { paddingVertical: spacing.s3, paddingHorizontal: spacing.s5, borderRadius: radius.m, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  btnPrimary: { backgroundColor: TOKENS.colors.brand.primary },
  btnText:    { ...typography.titleM, fontSize: 14, color: P.onBrand },
})
