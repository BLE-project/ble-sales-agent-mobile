/**
 * §7.3 Sales-agent notification preferences screen.
 *
 * Matrix reference: S57_TO_Q3_MASTER_PLAN.md §7.1 — sales-agent-mobile.
 * NEVER_DISABLEABLE:
 *   - merchant-support-request (critical workflow)
 *   - moderation-review-request (§9bis Q11)
 *
 * Redesign «La Piazza» C3 (2026-07-11, self-approved delega — pattern twin
 * tenant/territory-mobile): via lo slab hero brand (il titolo vive nell'header
 * nativo "Impostazioni" da app/(app)/_layout.tsx), preferenze in Card kit,
 * switch con track brand statico (DS-003, nessun BrandingContext), loading
 * SkeletonCard, canale mandatory = switch disabled + Tag "Sempre attivo".
 * testID toggle-<channelId>, logica optimistic+rollback (S6443) e chiavi i18n
 * INVARIATI.
 */

import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Switch, Alert } from 'react-native'
import { useIntl } from 'react-intl'
import { notificationPreferencesApi, NotificationPref } from '../../../src/api/notificationPreferencesApi'
import { TOKENS, spacing } from '../../../src/theme/defaults/tokens'
import { typography } from '../../../src/theme/typography'
import { Card, Tag, SkeletonCard } from '../../../src/components/piazza/ui'

const P = TOKENS.colors.surface

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
  const intl = useIntl()
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
      Alert.alert(
        intl.formatMessage({ id: 'settings.notifications.mandatory.title' }),
        intl.formatMessage({ id: 'settings.notifications.mandatory.body' }),
      )
      return
    }
    // Capture the pre-update snapshot so a failed save can be rolled back to
    // the *previous* value. Sonar S6443: never pass the matching state variable
    // straight back to its setter — after the optimistic setPrefs(nextPrefs)
    // below, `prefs` is still the stale render-scope binding, so reverting must
    // use an explicitly captured copy, not the variable itself.
    const previousPrefs = prefs
    const nextPrefs = { ...previousPrefs, [channelId]: next }
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
      Alert.alert(intl.formatMessage({ id: 'settings.notifications.save_error.title' }), (err as Error).message)
      setPrefs(previousPrefs)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.skeletons}>
        {SALES_AGENT_CHANNELS.slice(0, 5).map((c) => <SkeletonCard key={c.channelId} />)}
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        {intl.formatMessage({ id: 'settings.notifications.subtitle' })}
      </Text>
      {SALES_AGENT_CHANNELS.map((c) => (
        <Card key={c.channelId} style={styles.row}>
          <View style={styles.rowText}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>{c.label}</Text>
              {c.mandatory && (
                <Tag
                  label={intl.formatMessage({ id: 'settings.notifications.always_on' })}
                  tone={{ bg: TOKENS.colors.semanticSoft.warningSoft, fg: P.rewardInk }}
                />
              )}
            </View>
            <Text style={styles.description}>{c.description}</Text>
          </View>
          <Switch
            testID={`toggle-${c.channelId}`}
            value={prefs[c.channelId] ?? c.defaultEnabled}
            disabled={c.mandatory || saving}
            onValueChange={(v) => toggle(c.channelId, v, c.mandatory)}
            trackColor={{ true: TOKENS.colors.brand.primary, false: P.line }}
            thumbColor={P.surface}
          />
        </Card>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: P.base },
  content:     { padding: spacing.s4, gap: spacing.s2 },
  skeletons:   { flex: 1, backgroundColor: P.base, padding: spacing.s4, gap: spacing.s3 },
  intro:       { ...typography.bodyS, fontSize: 13, lineHeight: 20, color: P.inkSoft, marginBottom: spacing.s2 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: spacing.s3 },
  rowText:     { flex: 1 },
  labelRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.s2, flexWrap: 'wrap' },
  label:       { ...typography.titleM, fontSize: 15, color: P.ink },
  description: { ...typography.bodyS, fontSize: 13, color: P.inkSoft, marginTop: spacing.s1, lineHeight: 18 },
})
