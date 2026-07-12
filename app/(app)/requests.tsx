/**
 * Richieste lista — redesign «La Piazza» C3 (2026-07-11, self-approved delega).
 * Chips filtro mono (label RAW — contratto Maestro requests.yaml), Card kit,
 * Tag stato soft-semantic, data mono. Copy asserita (jest screens.test):
 * "Nessuna richiesta trovata", tap card → /request/{id}, default PENDING.
 */
import React, { useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { registrationRequestsApi, RegistrationRequest } from '../../src/api/salesAgentApi'
import { TOKENS, spacing, radius } from '../../src/theme/defaults/tokens'
import { typography } from '../../src/theme/typography'
import { Card, Tag, EmptyState, SkeletonCard } from '../../src/components/piazza/ui'

const P = TOKENS.colors.surface
const B = TOKENS.colors.brand.primary

const STATUS_FILTERS = ['ALL', 'PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED'] as const
const STATUS_TONES: Record<string, { bg: string; fg: string }> = {
  PENDING:   { bg: TOKENS.colors.semanticSoft.warningSoft, fg: P.rewardInk },
  IN_REVIEW: { bg: TOKENS.colors.semanticSoft.infoSoft,    fg: TOKENS.colors.semantic.info },
  APPROVED:  { bg: TOKENS.colors.semanticSoft.successSoft, fg: TOKENS.colors.semantic.success },
  REJECTED:  { bg: TOKENS.colors.semanticSoft.dangerSoft,  fg: TOKENS.colors.semantic.danger },
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
      <Card
        style={styles.card}
        onPress={() => router.push(`/request/${item.id}` as never)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.bizName}>{item.businessName}</Text>
          <Tag
            label={item.status}
            tone={STATUS_TONES[item.status] ?? { bg: P.sunk, fg: P.inkSoft }}
          />
        </View>
        <Text style={styles.meta}>{item.ownerName} · {item.businessType}</Text>
        <Text style={styles.meta}>{item.email}</Text>
        <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString('it-IT')}</Text>
      </Card>
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
            accessibilityRole="button"
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading
        ? <View style={styles.skeletons}><SkeletonCard /><SkeletonCard /><SkeletonCard /></View>
        : <FlatList
            data={data ?? []}
            keyExtractor={i => i.id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: spacing.s4 }}
            onRefresh={refetch}
            refreshing={isLoading}
            ListEmptyComponent={<EmptyState title="Nessuna richiesta trovata" />}
          />
      }
    </View>
  )
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: P.base },
  skeletons:       { padding: spacing.s4, gap: spacing.s3 },
  filters:         { paddingHorizontal: spacing.s3, paddingVertical: spacing.s3, flexGrow: 0 },
  filterBtn:       {
    paddingHorizontal: spacing.s4, paddingVertical: 7, borderRadius: radius.full,
    marginRight: spacing.s2, backgroundColor: P.surface, borderWidth: 1, borderColor: P.line,
  },
  filterActive:    { backgroundColor: B, borderColor: B },
  filterText:      { ...typography.tag, fontSize: 11, textTransform: 'none', color: P.inkSoft },
  filterTextActive:{ color: P.onBrand },
  card:            { marginBottom: spacing.s3 },
  cardHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.s2, gap: spacing.s2 },
  bizName:         { ...typography.titleM, color: P.ink, flex: 1 },
  meta:            { ...typography.bodyS, fontSize: 13, color: P.inkSoft, marginBottom: 2 },
  date:            { ...typography.tag, fontSize: 11, textTransform: 'none', color: P.inkSoft, marginTop: spacing.s2 },
})
