/**
 * Royalties — redesign «La Piazza» C3 (2026-07-11, self-approved delega).
 * Card kit + Tag stato (soft semantic) + importi mono (monoAmount).
 * Header in-screen rimosso: il titolo "Royalties" vive nell'header nativo Tabs.
 * Copy asserita (jest screens.test): "Nessun calcolo disponibile", status raw, "Ref: …".
 */
import React from 'react'
import { View, Text, StyleSheet, FlatList } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { royaltiesApi, AgentRoyalty } from '../../src/api/salesAgentApi'
import { useAuth } from '../../src/auth/AuthContext'
import { TOKENS, spacing } from '../../src/theme/defaults/tokens'
import { typography } from '../../src/theme/typography'
import { Card, Tag, EmptyState, SkeletonCard } from '../../src/components/piazza/ui'

const P = TOKENS.colors.surface

const STATUS_TONES: Record<string, { bg: string; fg: string }> = {
  DRAFT:     { bg: TOKENS.colors.semanticSoft.warningSoft, fg: P.rewardInk },
  CONFIRMED: { bg: TOKENS.colors.semanticSoft.infoSoft,    fg: TOKENS.colors.semantic.info },
  PAID:      { bg: TOKENS.colors.semanticSoft.successSoft, fg: TOKENS.colors.semantic.success },
}

export default function RoyaltiesScreen() {
  const { user } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['royalties', user?.sub],
    queryFn: () => royaltiesApi.list(),
  })

  function renderItem({ item }: { item: AgentRoyalty }) {
    const period = new Date(item.periodMonth).toLocaleDateString('it-IT', { year: 'numeric', month: 'long' })
    const payout = (item.totalPayoutCents / 100).toFixed(2)
    const volume = (item.totalMerchantVolumeCents / 100).toFixed(2)

    return (
      <Card style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.period}>{period}</Text>
          <Tag
            label={item.status}
            tone={STATUS_TONES[item.status] ?? { bg: P.sunk, fg: P.inkSoft }}
          />
        </View>
        <Text style={styles.payout}>€{payout}</Text>
        <Text style={styles.meta}>Volume merchant: €{volume}</Text>
        <Text style={styles.meta}>Royalty {item.royaltyPercentSnapshot}% + €{(item.fixedFeeCents / 100).toFixed(2)} fisso</Text>
        {item.status === 'PAID' && item.paymentReference && (
          <Text style={styles.ref}>Ref: {item.paymentReference}</Text>
        )}
      </Card>
    )
  }

  return (
    <View style={styles.container}>
      {isLoading
        ? <View style={styles.skeletons}><SkeletonCard /><SkeletonCard /><SkeletonCard /></View>
        : <FlatList
            data={data ?? []}
            keyExtractor={i => i.id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: spacing.s4 }}
            ListEmptyComponent={<EmptyState title="Nessun calcolo disponibile" />}
          />
      }
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.base },
  skeletons: { padding: spacing.s4, gap: spacing.s3 },
  card:      { marginBottom: spacing.s3 },
  cardRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.s2 },
  period:    { ...typography.titleM, color: P.ink },
  payout:    { ...typography.monoAmount, fontSize: 26, color: TOKENS.colors.brand.primary, marginBottom: spacing.s2 },
  meta:      { ...typography.bodyS, fontSize: 13, color: P.inkSoft, marginBottom: 2 },
  ref:       { ...typography.tag, fontSize: 11, textTransform: 'none', color: P.inkSoft, marginTop: spacing.s2 },
})
