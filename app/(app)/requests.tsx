import React, { useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { registrationRequestsApi, RegistrationRequest } from '../../src/api/salesAgentApi'

const STATUS_FILTERS = ['ALL', 'PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED'] as const
const STATUS_COLORS: Record<string, string> = {
  PENDING:   '#f59e0b',
  IN_REVIEW: '#3b82f6',
  APPROVED:  '#10b981',
  REJECTED:  '#ef4444',
}

export default function RequestsScreen() {
  const router = useRouter()
  const [filter, setFilter] = useState<string>('PENDING')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['requests', filter],
    queryFn: () => registrationRequestsApi.list(filter === 'ALL' ? undefined : filter),
  })

  function renderItem({ item }: { item: RegistrationRequest }) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/request/${item.id}` as never)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.bizName}>{item.businessName}</Text>
          <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] ?? '#999' }]}>
            <Text style={styles.badgeText}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.meta}>{item.ownerName} · {item.businessType}</Text>
        <Text style={styles.meta}>{item.email}</Text>
        <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString('it-IT')}</Text>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading
        ? <ActivityIndicator style={{ marginTop: 40 }} color="#1a3f6f" />
        : <FlatList
            data={data ?? []}
            keyExtractor={i => i.id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16 }}
            onRefresh={refetch}
            refreshing={isLoading}
            ListEmptyComponent={<Text style={styles.empty}>Nessuna richiesta trovata</Text>}
          />
      }
    </View>
  )
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#f5f7fa' },
  filters:         { paddingHorizontal: 12, paddingVertical: 10, flexGrow: 0 },
  filterBtn:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginRight: 8, backgroundColor: '#e5e7eb' },
  filterActive:    { backgroundColor: '#1a3f6f' },
  filterText:      { color: '#374151', fontSize: 13, fontWeight: '500' },
  filterTextActive:{ color: '#fff' },
  card:            { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, elevation: 2 },
  cardHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  bizName:         { fontSize: 16, fontWeight: '700', color: '#111', flex: 1 },
  badge:           { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText:       { color: '#fff', fontSize: 11, fontWeight: '600' },
  meta:            { fontSize: 13, color: '#6b7280', marginBottom: 2 },
  date:            { fontSize: 12, color: '#9ca3af', marginTop: 6 },
  empty:           { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 15 },
})
