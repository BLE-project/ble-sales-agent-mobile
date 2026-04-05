import React from 'react'
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../src/api/client'

interface MerchantSummary {
  id: string
  businessName: string
  tenantId: string
  status: string
  totalTransactions: number
  totalVolumeCents: number
}

export default function MerchantsScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['agent-merchants'],
    queryFn: () => api.get<MerchantSummary[]>('/api/v1/merchants?managedByAgent=true'),
  })

  return (
    <View style={styles.container}>
      <Text style={styles.header}>I tuoi merchant</Text>
      {isLoading
        ? <ActivityIndicator style={{ marginTop: 40 }} color="#1a3f6f" />
        : <FlatList
            data={data ?? []}
            keyExtractor={i => i.id}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={<Text style={styles.empty}>Nessun merchant ancora associato</Text>}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <Text style={styles.bizName}>{item.businessName}</Text>
                  <Text style={[styles.status,
                    item.status === 'ACTIVE' ? styles.statusActive : styles.statusOther]}>
                    {item.status}
                  </Text>
                </View>
                <Text style={styles.meta}>Transazioni: {item.totalTransactions}</Text>
                <Text style={styles.meta}>Volume: €{(item.totalVolumeCents / 100).toFixed(2)}</Text>
              </View>
            )}
          />
      }
    </View>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f5f7fa' },
  header:      { fontSize: 20, fontWeight: '700', color: '#1a3f6f', padding: 20, paddingBottom: 10 },
  card:        { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, elevation: 2 },
  cardRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  bizName:     { fontSize: 16, fontWeight: '600', color: '#111' },
  status:      { fontSize: 12, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusActive:{ backgroundColor: '#d1fae5', color: '#059669' },
  statusOther: { backgroundColor: '#f3f4f6', color: '#6b7280' },
  meta:        { fontSize: 13, color: '#6b7280', marginBottom: 2 },
  empty:       { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
})
