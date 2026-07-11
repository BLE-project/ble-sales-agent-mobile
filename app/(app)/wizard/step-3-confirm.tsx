/**
 * BCN-CFG-002 Wizard — Step 3: confirm scan results, allow per-beacon retry
 * before submission.
 *
 * Reference: BLE-project/ble-platform-docs#186
 */
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { getWizardState, upsertScanResult } from '../../../src/wizard/wizardState'
import { TOKENS, spacing, radius } from '../../../src/theme/defaults/tokens'
import { typography } from '../../../src/theme/typography'

// Redesign «La Piazza» C4 (2026-07-11): solo restyle token/font — retry
// Phase-1 (gap #4) INVARIATO; testID wizard-confirm-* e copy asserite
// ("X/Y beacon hanno superato lo scan.", "detected/missed · pass=…") intatte.
const P = TOKENS.colors.surface

export default function WizardStep3Confirm() {
  const router = useRouter()
  const state = getWizardState()

  function retry(beaconId: string) {
    // Phase-1 skeleton: marks the beacon as 'retried' (forces a single
    // detected=true placeholder so the operator can submit). Real retry
    // re-arms the BLE scanner for that single beacon — wired by the
    // operator on follow-up.
    upsertScanResult({ beaconId, detected: true, pass: true })
    // force re-render via router replace trick
    router.replace('/(app)/wizard/step-3-confirm' as never)
  }

  const passCount = state.scanResults.filter(s => s.pass).length

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Step 3 — Conferma</Text>
      <Text style={styles.subtitle}>
        {passCount}/{state.scanResults.length} beacon hanno superato lo scan.
      </Text>

      <FlatList
        data={state.scanResults}
        keyExtractor={s => s.beaconId}
        renderItem={({ item }) => {
          const b = state.beacons.find(x => x.id === item.beaconId)
          return (
            <View style={styles.row} testID={`wizard-confirm-row-${item.beaconId}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>
                  {b ? `${b.major}-${b.minor}` : item.beaconId.substring(0, 8) + '…'}
                </Text>
                <Text style={styles.rowMeta}>
                  {item.detected ? 'detected' : 'missed'} · pass={String(item.pass)}
                </Text>
              </View>
              {!item.pass && (
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => retry(item.beaconId)}
                  testID={`wizard-confirm-retry-${item.beaconId}`}
                >
                  <Text style={styles.retryBtnText}>Riprova</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }}
      />

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.btnSecondary]}
          onPress={() => router.back()}
          testID="wizard-confirm-back"
        >
          <Text style={[styles.btnText, styles.btnTextSecondary]}>Indietro</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary]}
          onPress={() => router.push('/(app)/wizard/step-4-submit' as never)}
          testID="wizard-confirm-next"
        >
          <Text style={styles.btnText}>Conferma + invia</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: P.base, padding: spacing.s4 },
  title:      { ...typography.displayL, color: P.ink },
  subtitle:   { ...typography.bodyS, fontSize: 13, color: P.inkSoft, marginTop: spacing.s1, marginBottom: spacing.s3 },
  row:        {
    flexDirection: 'row', alignItems: 'center', gap: spacing.s3,
    paddingVertical: spacing.s3, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.line,
  },
  rowName:    { fontFamily: 'JetBrainsMono_600SemiBold', fontSize: 14, color: P.ink },
  rowMeta:    { fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, color: P.inkSoft, marginTop: 2 },
  retryBtn:   {
    backgroundColor: TOKENS.colors.semanticSoft.warningSoft, borderWidth: 1,
    borderColor: TOKENS.colors.semantic.warning,
    paddingVertical: spacing.s2, paddingHorizontal: spacing.s3, borderRadius: radius.m,
  },
  retryBtnText: { ...typography.label, fontSize: 13, color: P.rewardInk },
  actions:    { flexDirection: 'row', gap: spacing.s3, marginTop: spacing.s4 },
  btn:        { flex: 1, paddingVertical: spacing.s3, borderRadius: radius.m, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  btnPrimary: { backgroundColor: TOKENS.colors.brand.primary },
  btnSecondary: { backgroundColor: P.surface, borderWidth: 1, borderColor: P.line },
  btnText:    { ...typography.titleM, fontSize: 14, color: P.onBrand },
  btnTextSecondary: { ...typography.titleM, fontSize: 14, color: P.ink },
})
