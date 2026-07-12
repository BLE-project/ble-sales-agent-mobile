/**
 * §9bis M5 — Moderation review queue screen.
 *
 * Lists all PENDING_HUMAN ADVs assigned to the agent's scope.
 * Tap a card → detail screen `/moderation/[advId]`.
 * React Query with 30s polling (Q12 decision).
 */

import React from 'react'
import { View, Text, StyleSheet, FlatList } from 'react-native'
import { FormattedMessage, useIntl } from 'react-intl'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { moderationApi, ReviewTask } from '../../../src/api/moderationApi'
import { TOKENS, spacing } from '../../../src/theme/defaults/tokens'
import { typography } from '../../../src/theme/typography'
import { Card, Tag, EmptyState, SkeletonCard } from '../../../src/components/piazza/ui'

const P = TOKENS.colors.surface

// Redesign «La Piazza» C3 (2026-07-11): Tag kit tone soft-semantic; label raw
// LOW/MEDIUM/HIGH invariata (jest screens.test asserisce 'HIGH').
function RiskBadge({ level }: Readonly<{ level: ReviewTask['claudeRiskLevel'] }>) {
  if (!level) return null
  const tone =
    level === 'HIGH'   ? { bg: TOKENS.colors.semanticSoft.dangerSoft,  fg: TOKENS.colors.semantic.danger }
    : level === 'MEDIUM' ? { bg: TOKENS.colors.semanticSoft.warningSoft, fg: P.rewardInk }
    : { bg: TOKENS.colors.semanticSoft.successSoft, fg: TOKENS.colors.semantic.success }
  return <Tag label={level} tone={tone} />
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
      <Card
        testID="moderation-row"
        style={[styles.card, scaduta ? styles.cardExpired : null]}
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
      </Card>
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
        ? <View style={styles.skeletons}><SkeletonCard /><SkeletonCard /><SkeletonCard /></View>
        : <FlatList
            data={data ?? []}
            keyExtractor={(i) => i.advId}
            renderItem={renderItem}
            contentContainerStyle={{ padding: spacing.s4 }}
            onRefresh={refetch}
            refreshing={isLoading}
            ListEmptyComponent={<EmptyState title={intl.formatMessage({ id: 'moderation.empty_queue' })} />}
          />
      }
    </View>
  )
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: P.base },
  skeletons:     { padding: spacing.s4, gap: spacing.s3 },
  // Redesign C3: via lo slab brand — header su canvas base, titolo display.
  header:        { paddingHorizontal: spacing.s5, paddingTop: spacing.s4, paddingBottom: spacing.s2 },
  headerTitle:   { ...typography.displayL, color: TOKENS.colors.brand.primary },
  headerCount:   { ...typography.tag, fontSize: 11, textTransform: 'none', color: P.inkSoft, marginTop: spacing.s1 },
  card:          { marginBottom: spacing.s3 },
  cardExpired:   { borderLeftColor: TOKENS.colors.semantic.danger, borderLeftWidth: 4 },
  cardHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.s2 },
  title:         { ...typography.titleM, color: P.ink, flex: 1 },
  desc:          { ...typography.bodyS, fontSize: 13, color: P.inkSoft, marginTop: spacing.s2 },
  cardFooter:    { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.s3 },
  expiry:        { ...typography.tag, fontSize: 11, textTransform: 'none', color: P.inkSoft },
  escalated:     { ...typography.label, fontSize: 12, color: P.rewardInk },
})
