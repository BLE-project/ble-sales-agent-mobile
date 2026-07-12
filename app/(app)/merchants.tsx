/**
 * Merchant lista — redesign «La Piazza» C3 (2026-07-11, self-approved delega).
 * Card kit + Tag stato; header in-screen "I tuoi merchant" → ScreenHeader.
 * D2 (gap BFF #84): il BFF può omettere businessName/status/totali → rendering
 * difensivo con fallback '—' (niente "€NaN"); NESSUNA normalizzazione oltre,
 * il fix dati resta lato backend.
 * Copy asserita (jest screens.test): "Nessun merchant ancora associato",
 * "Bar Roma", /4500\.00/, "ACTIVE"; tap card → /merchants/{id}.
 */
import React from 'react'
import { View, Text, StyleSheet, FlatList } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { merchantsApi } from '../../src/api/salesAgentApi'
import { TOKENS, spacing } from '../../src/theme/defaults/tokens'
import { typography } from '../../src/theme/typography'
import { Card, Tag, ScreenHeader, EmptyState, SkeletonCard } from '../../src/components/piazza/ui'

const P = TOKENS.colors.surface

/** D2: cents → "€x.xx" solo se numero finito, altrimenti '—' (gap BFF #84). */
function euroOrDash(cents: unknown): string {
  return typeof cents === 'number' && Number.isFinite(cents)
    ? `€${(cents / 100).toFixed(2)}`
    : '—'
}

export default function MerchantsScreen() {
  const router = useRouter()
  const { data, isLoading } = useQuery({
    queryKey: ['agent-merchants'],
    queryFn: () => merchantsApi.listByAgent(),
  })

  return (
    <View style={styles.container}>
      <ScreenHeader title="I tuoi merchant" />
      {isLoading
        ? <View style={styles.skeletons}><SkeletonCard /><SkeletonCard /><SkeletonCard /></View>
        : <FlatList
            data={data ?? []}
            keyExtractor={i => i.id}
            contentContainerStyle={{ padding: spacing.s4 }}
            ListEmptyComponent={<EmptyState title="Nessun merchant ancora associato" />}
            renderItem={({ item }) => (
              // L4 §5-6: tap row → /merchants/:id detail (read-only landing view)
              <Card
                style={styles.card}
                onPress={() => router.push(`/merchants/${item.id}`)}
              >
                <View style={styles.cardRow}>
                  <Text style={styles.bizName}>{item.businessName ?? '—'}</Text>
                  {item.status ? (
                    <Tag
                      label={item.status}
                      tone={item.status === 'ACTIVE'
                        ? { bg: TOKENS.colors.semanticSoft.successSoft, fg: TOKENS.colors.semantic.success }
                        : { bg: P.sunk, fg: P.inkSoft }}
                    />
                  ) : null}
                </View>
                <Text style={styles.meta}>
                  Transazioni: {Number.isFinite(item.totalTransactions) ? item.totalTransactions : '—'}
                </Text>
                <Text style={styles.meta}>Volume: {euroOrDash(item.totalVolumeCents)}</Text>
              </Card>
            )}
          />
      }
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.base },
  skeletons: { padding: spacing.s4, gap: spacing.s3 },
  card:      { marginBottom: spacing.s3 },
  cardRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.s2, gap: spacing.s2 },
  bizName:   { ...typography.titleM, color: P.ink, flexShrink: 1 },
  meta:      { ...typography.bodyS, fontSize: 13, color: P.inkSoft, marginBottom: 2 },
})
