/**
 * §7.3 Sales-agent notification preferences screen.
 *
 * Matrix reference: S57_TO_Q3_MASTER_PLAN.md §7.1 — sales-agent-mobile.
 * NEVER_DISABLEABLE:
 *   - merchant-support-request (critical workflow)
 *   - moderation-review-request (§9bis Q11)
 */

import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Switch, ActivityIndicator, Alert,
} from 'react-native'
import { notificationPreferencesApi, NotificationPref } from '../../../src/api/notificationPreferencesApi'

interface ChannelDef {
  channelId: string
  label:     string
  description: string
  defaultEnabled: boolean
  mandatory: boolean
}

const SALES_AGENT_CHANNELS: ChannelDef[] = [
  { channelId: 'merchant-support-request',
    label: 'Richiesta supporto merchant',
    description: 'Un merchant ha bisogno di supporto (sempre attivo).',
    defaultEnabled: true, mandatory: true },
  { channelId: 'moderation-review-request',
    label: 'Nuova ADV da moderare',
    description: 'Una campagna cashback è pronta per la tua review (§9bis, sempre attivo).',
    defaultEnabled: true, mandatory: true },
  { channelId: 'moderation-review-expiring-soon',
    label: 'Review in scadenza (<4h)',
    description: 'Una review assegnata a te sta per scadere — possibile escalation tenant admin.',
    defaultEnabled: true, mandatory: false },
  { channelId: 'moderation-review-escalated-away',
    label: 'Review escalata via',
    description: 'Una tua review è stata escalata al tenant admin.',
    defaultEnabled: false, mandatory: false },
  { channelId: 'kit-shipment',
    label: 'Spedizione kit beacon',
    description: 'Un nuovo kit beacon è in spedizione al merchant.',
    defaultEnabled: true, mandatory: false },
  { channelId: 'royalty-credit',
    label: 'Commissione royalty',
    description: 'Una commissione royalty è stata accreditata sul tuo conto.',
    defaultEnabled: true, mandatory: false },
  { channelId: 'merchant-assigned',
    label: 'Nuovo merchant assegnato',
    description: 'Un merchant è stato aggiunto al tuo portafoglio.',
    defaultEnabled: true, mandatory: false },
  { channelId: 'meeting-reminder',
    label: 'Reminder appuntamento',
    description: 'Ricorda appuntamenti di on-boarding o follow-up.',
    defaultEnabled: true, mandatory: false },
]

export default function NotificationsSettingsScreen() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [prefs, setPrefs]     = useState<Record<string, boolean>>({})

  useEffect(() => {
    notificationPreferencesApi.list()
      .then((rows: NotificationPref[]) => {
        const map: Record<string, boolean> = {}
        for (const c of SALES_AGENT_CHANNELS) map[c.channelId] = c.defaultEnabled
        for (const r of rows.filter((r) => r.appId === 'sales')) {
          map[r.channelId] = r.enabled
        }
        setPrefs(map)
      })
      .catch(() => {
        const map: Record<string, boolean> = {}
        for (const c of SALES_AGENT_CHANNELS) map[c.channelId] = c.defaultEnabled
        setPrefs(map)
      })
      .finally(() => setLoading(false))
  }, [])

  async function toggle(channelId: string, next: boolean, mandatory: boolean) {
    if (mandatory && !next) {
      Alert.alert('Sempre attivo',
        'Questa notifica critica non può essere disabilitata per motivi di workflow.')
      return
    }
    const nextPrefs = { ...prefs, [channelId]: next }
    setPrefs(nextPrefs)
    setSaving(true)
    try {
      await notificationPreferencesApi.update(
        Object.entries(nextPrefs).map(([cid, enabled]) => ({
          appId:     'sales',
          channelId: cid,
          enabled,
        })),
      )
    } catch (err) {
      Alert.alert('Errore salvataggio', (err as Error).message)
      setPrefs(prefs)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#1a3f6f" /></View>

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Preferenze notifiche</Text>
        <Text style={styles.subtitle}>
          Gestisci le notifiche che ricevi come sales agent. Notifiche critiche sempre attive.
        </Text>
      </View>
      {SALES_AGENT_CHANNELS.map((c) => (
        <View key={c.channelId} style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.label}>
              {c.label}
              {c.mandatory && <Text style={styles.mandatoryBadge}>  • Sempre attivo</Text>}
            </Text>
            <Text style={styles.description}>{c.description}</Text>
          </View>
          <Switch
            testID={`toggle-${c.channelId}`}
            value={prefs[c.channelId] ?? c.defaultEnabled}
            disabled={c.mandatory || saving}
            onValueChange={(v) => toggle(c.channelId, v, c.mandatory)}
            trackColor={{ true: '#1a3f6f', false: '#d1d5db' }}
          />
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f5f7fa' },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:         { padding: 20, backgroundColor: '#1a3f6f' },
  title:          { color: '#fff', fontSize: 22, fontWeight: '700' },
  subtitle:       { color: '#93c5fd', fontSize: 13, marginTop: 6, lineHeight: 18 },
  row:            { flexDirection: 'row', backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  rowText:        { flex: 1, marginRight: 12 },
  label:          { fontSize: 15, fontWeight: '600', color: '#111' },
  mandatoryBadge: { fontSize: 11, color: '#f59e0b', fontWeight: '700' },
  description:    { fontSize: 13, color: '#6b7280', marginTop: 4, lineHeight: 18 },
})
