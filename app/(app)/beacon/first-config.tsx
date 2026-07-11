/**
 * §9 — Sales agent BLE first-config screen.
 *
 * Flow:
 *   1) Sales agent arrives at merchant → opens merchant detail → "Test BLE"
 *   2) Screen loads expected 4 beacons for the merchant (from core-registry)
 *   3) Tap "Scansiona" → BleManager discover (via BeaconHealthCheck helper)
 *   4) Each beacon shown with ✅ RSSI-OK / ❌ non rilevato / ⚠ batteria bassa
 *   5) On all-pass, tap "Conferma on-boarding" → POST /beacon-health → persisted
 */

import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { scanBeacons, BeaconCheckResult, summarise, BeaconCheckTarget } from '../../../src/ble/BeaconHealthCheck'
import { TOKENS, spacing, radius } from '../../../src/theme/defaults/tokens'
import { typography } from '../../../src/theme/typography'
import { Card } from '../../../src/components/piazza/ui'

// Redesign «La Piazza» C4 (2026-07-11): SOLO restyle stati esistenti — la
// fixture 4-beacon hardcoded e il submit console.log restano stub (contract:
// deprecazione = decisione prodotto fuori scope). Emoji stato → Ionicons.
const P = TOKENS.colors.surface

export default function BeaconFirstConfigScreen() {
  const { merchantId } = useLocalSearchParams<{ merchantId: string }>()
  const router = useRouter()

  const [scanning, setScanning] = useState(false)
  const [results, setResults]   = useState<BeaconCheckResult[] | null>(null)

  // Hard-coded 4-beacon fixture. In production this comes from
  // GET /v1/merchants/:id/beacons which returns the kit assigned to the merchant.
  const targets: BeaconCheckTarget[] = [
    { code: 'H-01', label: 'Ingresso',  uuid: 'FDA50693-A4E2-4FB1-AFCF-C6EB07647825', major: 1, minor: 101 },
    { code: 'H-02', label: 'Cassa Bar', uuid: 'FDA50693-A4E2-4FB1-AFCF-C6EB07647825', major: 1, minor: 102 },
    { code: 'H-03', label: 'Info Point',uuid: 'FDA50693-A4E2-4FB1-AFCF-C6EB07647825', major: 2, minor: 201 },
    { code: 'H-04', label: 'Parcheggio',uuid: 'FDA50693-A4E2-4FB1-AFCF-C6EB07647825', major: 2, minor: 202 },
  ]

  async function runScan() {
    setScanning(true)
    try {
      const r = await scanBeacons(targets, 15_000)
      setResults(r)
    } catch (e) {
      Alert.alert('Errore scan BLE', (e as Error).message)
    } finally {
      setScanning(false)
    }
  }

  async function confirmOnboarding() {
    if (!results) return
    const summary = summarise(results)
    if (!summary.allOk) {
      Alert.alert('Attenzione',
        `${summary.failed} beacon non rilevati. Confermi comunque?`,
        [
          { text: 'Riprova', style: 'cancel' },
          { text: 'Conferma', onPress: () => submitResults(results) },
        ])
      return
    }
    submitResults(results)
  }

  async function submitResults(r: BeaconCheckResult[]) {
    // POST to core-registry beacon-health endpoint (stub: log only for now).
    console.log('[first-config] submitting beacon health', merchantId, r)
    Alert.alert('On-boarding confermato', 'Salute beacon salvata in piattaforma.')
    router.back()
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Indietro</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Test BLE kit</Text>
        <Text style={styles.subtitle}>Merchant #{merchantId}</Text>
      </View>

      <View style={styles.actionsTop}>
        <TouchableOpacity
          style={[styles.scanBtn, scanning && styles.scanBtnDisabled]}
          disabled={scanning}
          onPress={runScan}
          testID="scan-btn"
        >
          <Text style={styles.scanBtnText}>
            {scanning ? 'Scansione in corso…' : 'Scansiona 4 beacon'}
          </Text>
        </TouchableOpacity>
      </View>

      {scanning && <ActivityIndicator style={{ marginTop: 20 }} color={TOKENS.colors.brand.primary} />}

      {results && results.map((r) => {
        const icon = r.pass
          ? { name: 'checkmark-circle' as const, color: TOKENS.colors.semantic.success }
          : r.detected
            ? { name: 'alert-circle' as const, color: TOKENS.colors.semantic.warning }
            : { name: 'close-circle' as const, color: TOKENS.colors.semantic.danger }
        return (
          <Card key={r.code} style={styles.row} testID={`beacon-row-${r.code}`}>
            <Ionicons name={icon.name} size={24} color={icon.color} style={styles.icon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{r.code} — {r.label}</Text>
              {r.detected ? (
                <Text style={styles.rowMeta}>
                  RSSI {r.rssi} dBm  ·  batteria {r.batteryLevel ?? '?'}%
                </Text>
              ) : (
                <Text style={styles.rowMetaFail}>{r.reason}</Text>
              )}
            </View>
          </Card>
        )
      })}

      {results && (
        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={confirmOnboarding}
          testID="confirm-btn"
        >
          <Text style={styles.confirmBtnText}>
            Conferma on-boarding ({summarise(results).passed}/{results.length})
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  )
}

// Redesign C4: via lo slab brand — header su canvas base, titolo display,
// merchant id mono; righe risultato in Card kit.
const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: P.base },
  header:          { paddingHorizontal: spacing.s5, paddingTop: spacing.s4, paddingBottom: spacing.s2 },
  back:            { ...typography.bodyS, fontSize: 13, color: TOKENS.colors.brand.primary, marginBottom: spacing.s1 },
  title:           { ...typography.displayL, color: P.ink },
  subtitle:        { fontFamily: 'JetBrainsMono_400Regular', fontSize: 12, color: P.inkSoft, marginTop: spacing.s1 },
  actionsTop:      { padding: spacing.s4 },
  scanBtn:         { backgroundColor: TOKENS.colors.brand.primary, padding: spacing.s4, borderRadius: radius.m, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  scanBtnDisabled: { opacity: 0.5 },
  scanBtnText:     { ...typography.titleM, fontSize: 15, color: P.onBrand },
  row:             { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.s4, marginBottom: spacing.s2 },
  icon:            { marginRight: spacing.s3 },
  rowTitle:        { ...typography.titleM, fontSize: 15, color: P.ink },
  rowMeta:         { fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, color: P.inkSoft, marginTop: spacing.s1 },
  rowMetaFail:     { ...typography.bodyS, fontSize: 13, color: TOKENS.colors.semantic.danger, marginTop: spacing.s1 },
  confirmBtn:      { backgroundColor: TOKENS.colors.semantic.success, margin: spacing.s4, padding: spacing.s4, borderRadius: radius.m, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  confirmBtnText:  { ...typography.titleM, fontSize: 15, color: P.onBrand },
})
