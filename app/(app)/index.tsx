/**
 * Redesign «La Piazza» 2026-07-11 (cluster C6): canvas base, header con
 * greeting mono + nome Bricolage + logout ghost, tile → Metric kit, chip
 * territorio brand-soft, sezioni mono, quick actions come Card.
 *
 * INVARIATO riga per riga: il gate ruoli Sprint14 P2 (canSeeRegistrations/
 * canSeeModeration + `enabled` delle query) che ferma la logout-cascade;
 * testID `btn-logout`; tutti gli id i18n (nessun testo asserito cambiato).
 */
import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { FormattedMessage, useIntl } from 'react-intl'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../src/auth/AuthContext'
import { registrationRequestsApi, royaltiesApi, salesAgentProfileApi, RegistrationRequest } from '../../src/api/salesAgentApi'
import { moderationApi } from '../../src/api/moderationApi'
import { TOKENS, spacing, radius } from '../../src/theme/defaults/tokens'
import { Card, Metric } from '../../src/components/piazza/ui'

const S = TOKENS.colors.surface
const BRAND = TOKENS.colors.brand.primary
const F = {
  display: 'BricolageGrotesque_700Bold',
  body: 'HankenGrotesk_400Regular',
  bodySemiBold: 'HankenGrotesk_600SemiBold',
  mono: 'JetBrainsMono_400Regular',
}

interface TerritoryAssignment {
  territoryId: string
  territoryName: string
  tenantId: string
}

export default function DashboardScreen() {
  const { user, logout } = useAuth()
  const intl = useIntl()
  const router = useRouter()
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string | null>(null)

  // Sprint14 P2 (2026-05-06): gate role-restricted queries to stop a logout cascade.
  // /v1/registration-requests requires TENANT_ADMIN/SUPER_ADMIN (MerchantRegistrationResource:128);
  // /v1/moderation/reviews requires X-Tenant-Id which SALES_AGENT lacks. Without these
  // gates, the 401 from registration-requests reached client.ts → doRefresh → if the
  // post-login SecureStore.setItemAsync(REFRESH_KEY) write hadn't drained yet (BUG-003
  // fire-and-forget on iOS Keychain), doRefresh sees a null refresh token → _onLogout()
  // → setUser(null) → /(app)/_layout Redirect to /login. Race surfaced reliably as the
  // sales-agent navigation+logout E2E failure that didn't reproduce on territory.
  const canSeeRegistrations = user?.roles.some(r => r === 'TENANT_ADMIN' || r === 'SUPER_ADMIN') ?? false
  const canSeeModeration    = user?.roles.some(r => r === 'TENANT_ADMIN' || r === 'SUPER_ADMIN') ?? false

  // Fetch territory assignments for the agent
  const { data: assignments } = useQuery<TerritoryAssignment[]>({
    queryKey: ['agent-assignments', user?.agentId],
    queryFn: () => user?.agentId
      ? salesAgentProfileApi.getAssignments(user.agentId) as Promise<TerritoryAssignment[]>
      : Promise.resolve([]),
    enabled: !!user?.agentId,
  })

  const hasMultipleTerritories = (assignments?.length ?? 0) > 1

  const { data: pendingRequests } = useQuery({
    queryKey: ['requests', 'PENDING', selectedTerritoryId],
    queryFn: () => registrationRequestsApi.list('PENDING'),
    enabled: canSeeRegistrations,
  })

  const { data: royalties } = useQuery({
    queryKey: ['royalties', selectedTerritoryId],
    queryFn: () => royaltiesApi.list(),
  })

  // §9bis M5 — Moderation queue count (polling 30s)
  const { data: moderationQueue } = useQuery({
    queryKey: ['moderation-queue-count'],
    queryFn: () => moderationApi.list(),
    refetchInterval: 30_000,
    enabled: canSeeModeration,
  })

  const lastRoyalty = royalties?.[0]
  const totalPayout = lastRoyalty ? (lastRoyalty.totalPayoutCents / 100).toFixed(2) : '--'

  // Filter pending requests by territory if selected
  const filteredPending = selectedTerritoryId
    ? pendingRequests?.filter((r: RegistrationRequest) => r.territoryId === selectedTerritoryId)
    : pendingRequests

  const tiles = [
    {
      label: intl.formatMessage({ id: 'overview.tile.pending_requests' }),
      value: filteredPending?.length ?? '--',
      route: '/requests',
    },
    {
      label: intl.formatMessage({ id: 'overview.tile.moderations' }),
      value: moderationQueue?.length ?? 0,
      route: '/moderation',
    },
    {
      label: intl.formatMessage({ id: 'overview.tile.last_payout' }),
      value: totalPayout !== '--' ? `EUR ${totalPayout}` : '--',
      route: '/royalties',
    },
  ]

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}><FormattedMessage id="overview.greeting" /></Text>
          <Text style={styles.name} numberOfLines={1}>{user?.name ?? user?.sub}</Text>
        </View>
        <TouchableOpacity onPress={logout} testID="btn-logout" style={styles.logoutBtn}>
          <Text style={styles.signOut}><FormattedMessage id="auth.logout" /></Text>
        </TouchableOpacity>
      </View>

      {/* Territory selector — shown only if agent has multiple territory assignments */}
      {hasMultipleTerritories && (
        <View style={styles.territorySelectorContainer}>
          <Text style={styles.sectionLabel}>{intl.formatMessage({ id: 'overview.territory' }).toUpperCase()}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.territoryChips}>
            <TouchableOpacity
              style={[styles.chip, !selectedTerritoryId && styles.chipActive]}
              onPress={() => setSelectedTerritoryId(null)}
            >
              <Text style={[styles.chipText, !selectedTerritoryId && styles.chipTextActive]}>
                <FormattedMessage id="overview.all" />
              </Text>
            </TouchableOpacity>
            {assignments?.map(a => (
              <TouchableOpacity
                key={a.territoryId}
                style={[styles.chip, selectedTerritoryId === a.territoryId && styles.chipActive]}
                onPress={() => setSelectedTerritoryId(a.territoryId)}
              >
                <Text style={[styles.chipText, selectedTerritoryId === a.territoryId && styles.chipTextActive]}>
                  {a.territoryName}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <Text style={styles.sectionLabel}>{intl.formatMessage({ id: 'tab.overview' }).toUpperCase()}</Text>
      <View style={styles.grid}>
        {tiles.map(t => (
          <TouchableOpacity
            key={t.label}
            style={styles.tileWrap}
            onPress={() => router.push(t.route as never)}
          >
            <Metric label={t.label} value={String(t.value)} />
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>{intl.formatMessage({ id: 'overview.quick_actions' }).toUpperCase()}</Text>
      <Card style={styles.action} onPress={() => router.push('/requests')}>
        <Text style={styles.actionText}><FormattedMessage id="overview.manage_merchant_requests" /></Text>
        <Text style={styles.actionChevron}>›</Text>
      </Card>
      <Card style={styles.action} onPress={() => router.push('/royalties')}>
        <Text style={styles.actionText}><FormattedMessage id="overview.view_royalties" /></Text>
        <Text style={styles.actionChevron}>›</Text>
      </Card>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: S.base },
  content:      { paddingBottom: spacing.s10 },
  header:       { flexDirection: 'row', alignItems: 'center', gap: spacing.s3, paddingHorizontal: spacing.s5, paddingTop: spacing.s6, paddingBottom: spacing.s2 },
  greeting:     { fontFamily: F.mono, fontSize: 11, letterSpacing: 1, color: S.inkSoft },
  name:         { fontFamily: F.display, fontSize: 24, letterSpacing: -0.5, color: S.ink, marginTop: 2 },
  logoutBtn:    { paddingVertical: spacing.s3, paddingLeft: spacing.s4, minHeight: 44, justifyContent: 'center' },
  signOut:      { fontFamily: F.bodySemiBold, fontSize: 14, color: S.inkSoft },
  territorySelectorContainer: { paddingHorizontal: spacing.s5, paddingTop: spacing.s3 },
  territoryChips: { flexDirection: 'row', marginTop: spacing.s2 },
  chip:         { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full, backgroundColor: S.sunk, marginRight: 8 },
  chipActive:   { backgroundColor: BRAND },
  chipText:     { fontFamily: F.bodySemiBold, fontSize: 13, color: S.inkSoft },
  chipTextActive: { color: S.onBrand },
  sectionLabel: { fontFamily: F.mono, fontSize: 10, letterSpacing: 0.8, color: S.inkSoft, marginLeft: spacing.s5, marginTop: spacing.s6, marginBottom: spacing.s2 },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.s5 - 4 },
  tileWrap:     { width: '50%', padding: 4 },
  action:       { marginHorizontal: spacing.s5, marginBottom: spacing.s2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionText:   { fontFamily: F.bodySemiBold, fontSize: 15, color: S.ink, flex: 1 },
  actionChevron:{ fontSize: 18, color: S.inkSoft, marginLeft: spacing.s2 },
})
