/**
 * BCN-CFG-002 Wizard — Step 2: BLE scan against the merchant's beacon list.
 *
 * Phase 1 — UX skeleton: hooks the existing src/ble/scanner.ts (60s window
 * per beacon) and aggregates ScanResult[]. The real RSSI + battery extraction
 * is wired through the existing scanner emit; missing detections within the
 * window are recorded as detected=false / pass=false and surfaced in step 3
 * for retry.
 *
 * Reference: BLE-project/ble-platform-docs#186
 */
import { useEffect, useRef, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { fetchMerchantBeacons, type BeaconSummary, type ScanResult } from '../../../src/api/beaconHealthApi'
import {
  getWizardState, setBeacons, setScanResults,
} from '../../../src/wizard/wizardState'
import { scanBeacons, type BeaconCheckTarget } from '../../../src/ble/BeaconHealthCheck'
import { TOKENS, spacing, radius } from '../../../src/theme/defaults/tokens'
import { typography } from '../../../src/theme/typography'

// Redesign «La Piazza» C4 (2026-07-11): solo restyle token/font — testID
// wizard-scan-start/-next/-row-* e label stato raw (pending/scanning/
// detected/missed, asserite dal jest) INVARIATI.
const P = TOKENS.colors.surface

const SCAN_WINDOW_MS = 60_000

type RowState = 'pending' | 'scanning' | 'detected' | 'missed'

interface Row {
  beacon: BeaconSummary
  state:  RowState
  rssi?:  number
  battery?: number
}

export default function WizardStep2Scan() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    const merchantId = getWizardState().merchantId
    if (!merchantId) {
      setError('Merchant non selezionato — torna a Step 1.')
      setLoading(false)
      return
    }
    fetchMerchantBeacons(merchantId)
      .then(beacons => {
        if (cancelled.current) return
        setBeacons(beacons)
        setRows(beacons.map(b => ({ beacon: b, state: 'pending' })))
      })
      .catch(e => { if (!cancelled.current) setError((e as Error).message) })
      .finally(() => { if (!cancelled.current) setLoading(false) })
    return () => { cancelled.current = true }
  }, [])

  async function runScan() {
    if (rows.length === 0) return
    setRows(prev => prev.map(r => ({ ...r, state: 'scanning' })))

    // Phase-2 wiring (cross-system integration #2): delegate to the existing
    // src/ble/BeaconHealthCheck#scanBeacons helper which handles ble-plx
    // detection + RSSI/battery extraction natively. The helper falls back to
    // a __DEV__ fixture (pass=true mock) when ble-plx is not loaded — same
    // contract as the rest of the BLE call sites in this app.
    const targets: BeaconCheckTarget[] = rows.map(r => ({
      code:  r.beacon.id,           // map back to ScanResult.beaconId
      label: `${r.beacon.major}-${r.beacon.minor}`,
      uuid:  r.beacon.ibeaconUuid,
      major: r.beacon.major,
      minor: r.beacon.minor,
    }))

    let checkResults: Awaited<ReturnType<typeof scanBeacons>>
    try {
      checkResults = await scanBeacons(targets, SCAN_WINDOW_MS)
    } catch (e) {
      // ble-plx unavailable in production build — record all as missed.
      checkResults = targets.map(t => ({
        code: t.code, label: t.label, detected: false,
        rssi: null, batteryLevel: null, pass: false,
        reason: `Scan unavailable: ${(e as Error).message}`,
      }))
    }

    if (cancelled.current) return

    const results: ScanResult[] = checkResults.map(r => ({
      beaconId:     r.code,
      detected:     r.detected,
      rssi:         r.rssi ?? undefined,
      batteryLevel: r.batteryLevel ?? undefined,
      pass:         r.pass,
    }))
    setScanResults(results)

    const byId = new Map(checkResults.map(r => [r.code, r]))
    setRows(prev => prev.map(r => {
      const cr = byId.get(r.beacon.id)
      return {
        ...r,
        state:   cr?.detected ? 'detected' : 'missed',
        rssi:    cr?.rssi ?? undefined,
        battery: cr?.batteryLevel ?? undefined,
      }
    }))
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={TOKENS.colors.brand.primary} /></View>
  }
  if (error) {
    return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Step 2 — Scan beacon</Text>
      <Text style={styles.subtitle}>
        Avvia uno scan di {SCAN_WINDOW_MS / 1000}s per i beacon assegnati al merchant.
      </Text>

      <FlatList
        data={rows}
        keyExtractor={r => r.beacon.id}
        renderItem={({ item }) => (
          <View style={styles.row} testID={`wizard-scan-row-${item.beacon.id}`}>
            <Text style={styles.rowName}>
              {item.beacon.major}-{item.beacon.minor}
            </Text>
            <Text style={[styles.badge, badgeStyle(item.state)]}>{item.state}</Text>
          </View>
        )}
      />

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary]}
          onPress={() => { void runScan() }}
          testID="wizard-scan-start"
        >
          <Text style={styles.btnText}>Avvia scan</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnSecondary]}
          onPress={() => router.push('/(app)/wizard/step-3-confirm' as never)}
          testID="wizard-scan-next"
        >
          <Text style={[styles.btnText, styles.btnTextSecondary]}>Avanti</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function badgeStyle(s: RowState) {
  switch (s) {
    case 'detected': return { backgroundColor: TOKENS.colors.semanticSoft.successSoft, color: TOKENS.colors.semantic.success }
    case 'missed':   return { backgroundColor: TOKENS.colors.semanticSoft.dangerSoft,  color: TOKENS.colors.semantic.danger }
    case 'scanning': return { backgroundColor: TOKENS.colors.semanticSoft.infoSoft,    color: TOKENS.colors.semantic.info }
    default:         return { backgroundColor: P.sunk, color: P.inkSoft }
  }
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: P.base, padding: spacing.s4 },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.s6, backgroundColor: P.base },
  title:      { ...typography.displayL, color: P.ink },
  subtitle:   { ...typography.bodyS, fontSize: 13, color: P.inkSoft, marginTop: spacing.s1, marginBottom: spacing.s3 },
  row:        {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.s3, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.line,
  },
  rowName:    { fontFamily: 'JetBrainsMono_600SemiBold', fontSize: 14, color: P.ink },
  badge:      {
    fontFamily: 'JetBrainsMono_400Regular',
    paddingVertical: 4, paddingHorizontal: spacing.s3, borderRadius: radius.full,
    fontSize: 11, overflow: 'hidden',
  },
  actions:    { flexDirection: 'row', gap: spacing.s3, marginTop: spacing.s4 },
  btn:        { flex: 1, paddingVertical: spacing.s3, borderRadius: radius.m, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  btnPrimary: { backgroundColor: TOKENS.colors.brand.primary },
  btnSecondary: { backgroundColor: P.surface, borderWidth: 1, borderColor: P.line },
  btnText:    { ...typography.titleM, fontSize: 14, color: P.onBrand },
  btnTextSecondary: { ...typography.titleM, fontSize: 14, color: P.ink },
  error:      { ...typography.bodyM, color: TOKENS.colors.semantic.danger },
})
