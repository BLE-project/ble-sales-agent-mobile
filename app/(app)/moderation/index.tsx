/**
 * §9bis M5 — Moderation review queue screen.
 *
 * Lists all PENDING_HUMAN ADVs assigned to the agent's scope.
 * Tap a card → detail screen `/moderation/[advId]`.
 * React Query with 30s polling (Q12 decision).
 */

import React from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native'
import { FormattedMessage, useIntl } from 'react-intl'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { moderationApi, ReviewTask } from '../../../src/api/moderationApi'
import { TOKENS } from '../../../src/theme/defaults/tokens'

function RiskBadge({ level }: Readonly<{ level: ReviewTask['claudeRiskLevel'] }>) {
  if (!level) return null
  const color = level === 'HIGH' ? TOKENS.colors.semantic.danger : level === 'MEDIUM' ? TOKENS.colors.semantic.warning : TOKENS.colors.semantic.success
  return (
    <View style={[styles.riskBadge, { backgroundColor: color }]}>
      <Text style={styles.riskBadgeText}>{level}</Text>
    </View>
  )
}

/** Remaining time as a compact "Xh Ym" / "Ym" string, or null when expired/absent. */
function countdownText(expiresAt: string | null): string | null {
  if (!expiresAt) return null
  const diffMs = new Date(expiresAt).getTime() - Date.now()
  if (diffMs <= 0) return null
  const h = Math.floor(diffMs / 3_600_000)
  const m = Math.floor((diffMs % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function ModerationQueueScreen() {
  const router = useRouter()
  const intl = useIntl()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['moderation-queue'],
    queryFn: () => moderationApi.list(),
    refetchInterval: 30_000,   // 30s polling — Q12
  })

  function renderItem({ item }: { item: ReviewTask }) {
    const scaduta = item.salesReviewExpiresAt
      && new Date(item.salesReviewExpiresAt).getTime() < Date.now()
    return (
      <TouchableOpacity
        testID="moderation-row"
        style={[styles.card, scaduta && styles.cardExpired]}
        onPress={() => router.push(`/moderation/${item.advId}` as never)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.title}>{item.title}</Text>
          <RiskBadge level={item.claudeRiskLevel} />
        </View>
        <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.expiry}>
            {(() => {
              const remaining = countdownText(item.salesReviewExpiresAt)
              return remaining === null
                ? intl.formatMessage({ id: 'moderation.expired' })
                : intl.formatMessage({ id: 'moderation.expires_in' }, { time: remaining })
            })()}
          </Text>
          {item.moderationStatus === 'ESCALATED_TO_ADMIN' && (
            <Text style={styles.escalated}><FormattedMessage id="moderation.escalated" /></Text>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}><FormattedMessage id="moderation.header.title" /></Text>
        <Text style={styles.headerCount}>
          <FormattedMessage id="moderation.header.waiting" values={{ count: data?.length ?? 0 }} />
        </Text>
      </View>

      {isLoading
        ? <ActivityIndicator style={{ marginTop: 40 }} color={TOKENS.colors.brand.primary} />
        : <FlatList
            data={data ?? []}
            keyExtractor={(i) => i.advId}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16 }}
            onRefresh={refetch}
            refreshing={isLoading}
            ListEmptyComponent={<Text style={styles.empty}><FormattedMessage id="moderation.empty_queue" /></Text>}
          />
      }
    </View>
  )
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: TOKENS.colors.surface.base },
  header:        { padding: 20, backgroundColor: TOKENS.colors.brand.primary },
  headerTitle:   { color: TOKENS.colors.neutral.white, fontSize: 22, fontWeight: '700' },
  headerCount:   { color: '#e9d5ff', fontSize: 14, marginTop: 4 },
  card:          { backgroundColor: TOKENS.colors.neutral.white, borderRadius: 12, padding: 16, marginBottom: 10, elevation: 2 },
  cardExpired:   { borderLeftColor: TOKENS.colors.semantic.danger, borderLeftWidth: 4 },
  cardHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title:         { fontSize: 16, fontWeight: '700', color: TOKENS.colors.surface.ink, flex: 1 },
  desc:          { fontSize: 13, color: TOKENS.colors.neutral.gray500, marginTop: 6 },
  cardFooter:    { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  expiry:        { fontSize: 12, color: '#9ca3af' },
  escalated:     { fontSize: 12, color: TOKENS.colors.semantic.warning, fontWeight: '600' },
  riskBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginLeft: 8 },
  riskBadgeText: { color: TOKENS.colors.neutral.white, fontSize: 11, fontWeight: '700' },
  empty:         { textAlign: 'center', color: '#9ca3af', marginTop: 60, fontSize: 15 },
})
