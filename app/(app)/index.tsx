import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { FormattedMessage, useIntl } from 'react-intl'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../src/auth/AuthContext'
import { registrationRequestsApi, royaltiesApi, salesAgentProfileApi, RegistrationRequest } from '../../src/api/salesAgentApi'
import { moderationApi } from '../../src/api/moderationApi'
import { TOKENS } from '../../src/theme/defaults/tokens'

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
      color: TOKENS.colors.semantic.warning,
      route: '/requests',
    },
    {
      label: intl.formatMessage({ id: 'overview.tile.moderations' }),
      value: moderationQueue?.length ?? 0,
      color: TOKENS.colors.brand.primary,
      route: '/moderation',
    },
    {
      label: intl.formatMessage({ id: 'overview.tile.last_payout' }),
      value: totalPayout !== '--' ? `EUR ${totalPayout}` : '--',
      color: TOKENS.colors.brand.primary,
      route: '/royalties',
    },
  ]

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}><FormattedMessage id="overview.greeting" /></Text>
          <Text style={styles.name}>{user?.name ?? user?.sub}</Text>
        </View>
        <TouchableOpacity onPress={logout} testID="btn-logout">
          <Text style={styles.signOut}><FormattedMessage id="auth.logout" /></Text>
        </TouchableOpacity>
      </View>

      {/* Territory selector — shown only if agent has multiple territory assignments */}
      {hasMultipleTerritories && (
        <View style={styles.territorySelectorContainer}>
          <Text style={styles.territorySelectorLabel}><FormattedMessage id="overview.territory" /></Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.territoryChips}>
            <TouchableOpacity
              style={[styles.territoryChip, !selectedTerritoryId && styles.territoryChipActive]}
              onPress={() => setSelectedTerritoryId(null)}
            >
              <Text style={[styles.territoryChipText, !selectedTerritoryId && styles.territoryChipTextActive]}>
                <FormattedMessage id="overview.all" />
              </Text>
            </TouchableOpacity>
            {assignments?.map(a => (
              <TouchableOpacity
                key={a.territoryId}
                style={[styles.territoryChip, selectedTerritoryId === a.territoryId && styles.territoryChipActive]}
                onPress={() => setSelectedTerritoryId(a.territoryId)}
              >
                <Text style={[styles.territoryChipText, selectedTerritoryId === a.territoryId && styles.territoryChipTextActive]}>
                  {a.territoryName}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <Text style={styles.sectionTitle}><FormattedMessage id="tab.overview" /></Text>
      <View style={styles.grid}>
        {tiles.map(t => (
          <TouchableOpacity
            key={t.label}
            style={[styles.tile, { borderLeftColor: t.color }]}
            onPress={() => router.push(t.route as never)}
          >
            <Text style={styles.tileValue}>{String(t.value)}</Text>
            <Text style={styles.tileLabel}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}><FormattedMessage id="overview.quick_actions" /></Text>
      <TouchableOpacity style={styles.action} onPress={() => router.push('/requests')}>
        <Text style={styles.actionText}><FormattedMessage id="overview.manage_merchant_requests" /></Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.action} onPress={() => router.push('/royalties')}>
        <Text style={styles.actionText}><FormattedMessage id="overview.view_royalties" /></Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: TOKENS.colors.surface.base },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: TOKENS.colors.brand.primary },
  greeting:     { color: TOKENS.colors.brand.primarySoft, fontSize: 13 },
  name:         { color: TOKENS.colors.neutral.white, fontSize: 18, fontWeight: '700' },
  signOut:      { color: TOKENS.colors.brand.primarySoft, fontSize: 13 },
  // Territory selector
  territorySelectorContainer: { backgroundColor: TOKENS.colors.neutral.white, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: TOKENS.colors.neutral.gray200 },
  territorySelectorLabel: { fontSize: 11, fontWeight: '600', color: TOKENS.colors.neutral.gray500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  territoryChips: { flexDirection: 'row' },
  territoryChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: TOKENS.colors.neutral.gray100, marginRight: 8 },
  territoryChipActive: { backgroundColor: TOKENS.colors.brand.primary },
  territoryChipText: { fontSize: 13, fontWeight: '500', color: TOKENS.colors.neutral.gray700 },
  territoryChipTextActive: { color: TOKENS.colors.neutral.white },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: TOKENS.colors.neutral.gray500, marginLeft: 20, marginTop: 20, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  tile:         { width: '45%', margin: 8, backgroundColor: TOKENS.colors.neutral.white, borderRadius: 12, padding: 16, borderLeftWidth: 4, elevation: 2 },
  tileValue:    { fontSize: 24, fontWeight: '700', color: TOKENS.colors.surface.ink },
  tileLabel:    { fontSize: 12, color: TOKENS.colors.neutral.gray500, marginTop: 4 },
  action:       { backgroundColor: TOKENS.colors.neutral.white, marginHorizontal: 20, marginBottom: 10, borderRadius: 10, padding: 16, elevation: 1 },
  actionText:   { fontSize: 15, color: TOKENS.colors.brand.primary, fontWeight: '500' },
})
