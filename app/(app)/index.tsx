import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../src/auth/AuthContext'
import { registrationRequestsApi, royaltiesApi } from '../../src/api/salesAgentApi'

export default function DashboardScreen() {
  const { user, logout } = useAuth()
  const router = useRouter()

  const { data: pendingRequests } = useQuery({
    queryKey: ['requests', 'PENDING'],
    queryFn: () => registrationRequestsApi.list('PENDING'),
  })

  const { data: royalties } = useQuery({
    queryKey: ['royalties'],
    queryFn: () => royaltiesApi.list(),
  })

  const lastRoyalty = royalties?.[0]
  const totalPayout = lastRoyalty ? (lastRoyalty.totalPayoutCents / 100).toFixed(2) : '—'

  const tiles = [
    {
      label: 'Richieste pending',
      value: pendingRequests?.length ?? '—',
      color: '#f59e0b',
      route: '/requests',
    },
    {
      label: 'Ultimo payout',
      value: totalPayout !== '—' ? `€${totalPayout}` : '—',
      color: '#1a3f6f',
      route: '/royalties',
    },
  ]

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Ciao,</Text>
          <Text style={styles.name}>{user?.name ?? user?.sub}</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.signOut}>Esci →</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Panoramica</Text>
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

      <Text style={styles.sectionTitle}>Azioni rapide</Text>
      <TouchableOpacity style={styles.action} onPress={() => router.push('/requests')}>
        <Text style={styles.actionText}>📋 Gestisci richieste merchant</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.action} onPress={() => router.push('/royalties')}>
        <Text style={styles.actionText}>💰 Visualizza royalties</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f5f7fa' },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#1a3f6f' },
  greeting:     { color: '#93c5fd', fontSize: 13 },
  name:         { color: '#fff', fontSize: 18, fontWeight: '700' },
  signOut:      { color: '#93c5fd', fontSize: 13 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#6b7280', marginLeft: 20, marginTop: 20, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  tile:         { width: '45%', margin: 8, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderLeftWidth: 4, elevation: 2 },
  tileValue:    { fontSize: 24, fontWeight: '700', color: '#111' },
  tileLabel:    { fontSize: 12, color: '#6b7280', marginTop: 4 },
  action:       { backgroundColor: '#fff', marginHorizontal: 20, marginBottom: 10, borderRadius: 10, padding: 16, elevation: 1 },
  actionText:   { fontSize: 15, color: '#1a3f6f', fontWeight: '500' },
})
