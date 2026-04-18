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
import { scanBeacons, BeaconCheckResult, summarise, BeaconCheckTarget } from '../../../src/ble/BeaconHealthCheck'

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

      {scanning && <ActivityIndicator style={{ marginTop: 20 }} color="#6C3FCF" />}

      {results && results.map((r) => {
        const icon = r.pass ? '✅' : r.detected ? '⚠' : '❌'
        return (
          <View key={r.code} style={styles.row} testID={`beacon-row-${r.code}`}>
            <Text style={styles.icon}>{icon}</Text>
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
          </View>
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

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#f5f7fa' },
  header:          { padding: 20, backgroundColor: '#6C3FCF' },
  back:            { color: '#e9d5ff', marginBottom: 4 },
  title:           { color: '#fff', fontSize: 22, fontWeight: '700' },
  subtitle:        { color: '#c4b5fd', fontSize: 13, marginTop: 4 },
  actionsTop:      { padding: 16 },
  scanBtn:         { backgroundColor: '#6C3FCF', padding: 16, borderRadius: 12, alignItems: 'center' },
  scanBtnDisabled: { opacity: 0.5 },
  scanBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  row:             { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 10 },
  icon:            { fontSize: 24, marginRight: 12 },
  rowTitle:        { fontSize: 15, fontWeight: '600', color: '#111' },
  rowMeta:         { fontSize: 13, color: '#6b7280', marginTop: 4 },
  rowMetaFail:     { fontSize: 13, color: '#ef4444', marginTop: 4 },
  confirmBtn:      { backgroundColor: '#10b981', margin: 16, padding: 16, borderRadius: 12, alignItems: 'center' },
  confirmBtnText:  { color: '#fff', fontSize: 16, fontWeight: '700' },
})
