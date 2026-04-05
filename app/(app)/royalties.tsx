import React from 'react'
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { royaltiesApi, AgentRoyalty } from '../../src/api/salesAgentApi'
import { useAuth } from '../../src/auth/AuthContext'

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     '#f59e0b',
  CONFIRMED: '#3b82f6',
  PAID:      '#10b981',
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
          <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] ?? '#999' }]}>
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
        ? <ActivityIndicator style={{ marginTop: 40 }} color="#1a3f6f" />
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
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header:    { fontSize: 20, fontWeight: '700', color: '#1a3f6f', padding: 20, paddingBottom: 10 },
  card:      { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, elevation: 2 },
  cardRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  period:    { fontSize: 15, fontWeight: '600', color: '#111' },
  badge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  payout:    { fontSize: 28, fontWeight: '800', color: '#1a3f6f', marginBottom: 8 },
  meta:      { fontSize: 13, color: '#6b7280', marginBottom: 2 },
  ref:       { fontSize: 12, color: '#9ca3af', marginTop: 6 },
  empty:     { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
})
