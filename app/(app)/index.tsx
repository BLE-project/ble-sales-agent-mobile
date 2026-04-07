import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../src/auth/AuthContext'
import { registrationRequestsApi, royaltiesApi, salesAgentProfileApi } from '../../src/api/salesAgentApi'

interface TerritoryAssignment {
  territoryId: string
  territoryName: string
  tenantId: string
}

export default function DashboardScreen() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string | null>(null)

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
  })

  const { data: royalties } = useQuery({
    queryKey: ['royalties', selectedTerritoryId],
    queryFn: () => royaltiesApi.list(),
  })

  const lastRoyalty = royalties?.[0]
  const totalPayout = lastRoyalty ? (lastRoyalty.totalPayoutCents / 100).toFixed(2) : '--'

  // Filter pending requests by territory if selected
  const filteredPending = selectedTerritoryId
    ? pendingRequests?.filter((r: Record<string, unknown>) => (r as { territoryId?: string }).territoryId === selectedTerritoryId)
    : pendingRequests

  const tiles = [
    {
      label: 'Richieste pending',
      value: filteredPending?.length ?? '--',
      color: '#f59e0b',
      route: '/requests',
    },
    {
      label: 'Ultimo payout',
      value: totalPayout !== '--' ? `EUR ${totalPayout}` : '--',
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
          <Text style={styles.signOut}>Esci</Text>
        </TouchableOpacity>
      </View>

      {/* Territory selector — shown only if agent has multiple territory assignments */}
      {hasMultipleTerritories && (
        <View style={styles.territorySelectorContainer}>
          <Text style={styles.territorySelectorLabel}>Territory</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.territoryChips}>
            <TouchableOpacity
              style={[styles.territoryChip, !selectedTerritoryId && styles.territoryChipActive]}
              onPress={() => setSelectedTerritoryId(null)}
            >
              <Text style={[styles.territoryChipText, !selectedTerritoryId && styles.territoryChipTextActive]}>
                Tutti
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
        <Text style={styles.actionText}>Gestisci richieste merchant</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.action} onPress={() => router.push('/royalties')}>
        <Text style={styles.actionText}>Visualizza royalties</Text>
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
  // Territory selector
  territorySelectorContainer: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  territorySelectorLabel: { fontSize: 11, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  territoryChips: { flexDirection: 'row' },
  territoryChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f3f4f6', marginRight: 8 },
  territoryChipActive: { backgroundColor: '#1a3f6f' },
  territoryChipText: { fontSize: 13, fontWeight: '500', color: '#374151' },
  territoryChipTextActive: { color: '#fff' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#6b7280', marginLeft: 20, marginTop: 20, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  tile:         { width: '45%', margin: 8, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderLeftWidth: 4, elevation: 2 },
  tileValue:    { fontSize: 24, fontWeight: '700', color: '#111' },
  tileLabel:    { fontSize: 12, color: '#6b7280', marginTop: 4 },
  action:       { backgroundColor: '#fff', marginHorizontal: 20, marginBottom: 10, borderRadius: 10, padding: 16, elevation: 1 },
  actionText:   { fontSize: 15, color: '#1a3f6f', fontWeight: '500' },
})
