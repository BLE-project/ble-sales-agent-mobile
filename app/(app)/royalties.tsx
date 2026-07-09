import React from 'react'
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { royaltiesApi, AgentRoyalty } from '../../src/api/salesAgentApi'
import { useAuth } from '../../src/auth/AuthContext'
import { TOKENS } from '../../src/theme/defaults/tokens'

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     TOKENS.colors.semantic.warning,
  CONFIRMED: TOKENS.colors.semantic.info,
  PAID:      TOKENS.colors.semantic.success,
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
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.period}>{period}</Text>
          <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] ?? TOKENS.colors.surface.inkSoft }]}>
            <Text style={styles.badgeText}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.payout}>€{payout}</Text>
        <Text style={styles.meta}>Volume merchant: €{volume}</Text>
        <Text style={styles.meta}>Royalty {item.royaltyPercentSnapshot}% + €{(item.fixedFeeCents / 100).toFixed(2)} fisso</Text>
        {item.status === 'PAID' && item.paymentReference && (
          <Text style={styles.ref}>Ref: {item.paymentReference}</Text>
        )}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Royalties</Text>
      {isLoading
        ? <ActivityIndicator style={{ marginTop: 40 }} color={TOKENS.colors.brand.primary} />
        : <FlatList
            data={data ?? []}
            keyExtractor={i => i.id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={<Text style={styles.empty}>Nessun calcolo disponibile</Text>}
          />
      }
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TOKENS.colors.surface.base },
  header:    { fontSize: 20, fontWeight: '700', color: TOKENS.colors.brand.primary, padding: 20, paddingBottom: 10 },
  card:      { backgroundColor: TOKENS.colors.neutral.white, borderRadius: 12, padding: 16, marginBottom: 10, elevation: 2 },
  cardRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  period:    { fontSize: 15, fontWeight: '600', color: TOKENS.colors.surface.ink },
  badge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { color: TOKENS.colors.neutral.white, fontSize: 11, fontWeight: '600' },
  payout:    { fontSize: 28, fontWeight: '800', color: TOKENS.colors.brand.primary, marginBottom: 8 },
  meta:      { fontSize: 13, color: TOKENS.colors.neutral.gray500, marginBottom: 2 },
  ref:       { fontSize: 12, color: '#9ca3af', marginTop: 6 },
  empty:     { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
})
