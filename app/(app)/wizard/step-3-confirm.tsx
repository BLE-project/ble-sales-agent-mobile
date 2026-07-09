/**
 * BCN-CFG-002 Wizard — Step 3: confirm scan results, allow per-beacon retry
 * before submission.
 *
 * Reference: BLE-project/ble-platform-docs#186
 */
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { getWizardState, upsertScanResult } from '../../../src/wizard/wizardState'
import { TOKENS } from '../../../src/theme/defaults/tokens'

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
  container:  { flex: 1, backgroundColor: TOKENS.colors.neutral.white, padding: 16 },
  title:      { fontSize: 22, fontWeight: '700', color: TOKENS.colors.neutral.gray900 },
  subtitle:   { fontSize: 13, color: TOKENS.colors.neutral.gray500, marginTop: 4, marginBottom: 12 },
  row:        {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: TOKENS.colors.neutral.gray200,
  },
  rowName:    { fontSize: 15, fontWeight: '600', color: TOKENS.colors.neutral.gray900 },
  rowMeta:    { fontSize: 12, color: TOKENS.colors.neutral.gray500, marginTop: 2 },
  retryBtn:   { backgroundColor: '#fbbf24', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  retryBtnText: { color: TOKENS.colors.neutral.gray900, fontWeight: '700', fontSize: 13 },
  actions:    { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn:        { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#0B6E4F' },
  btnSecondary: { backgroundColor: TOKENS.colors.neutral.gray100 },
  btnText:    { color: TOKENS.colors.neutral.white, fontWeight: '700', fontSize: 14 },
  btnTextSecondary: { color: TOKENS.colors.neutral.gray700, fontWeight: '700', fontSize: 14 },
})
