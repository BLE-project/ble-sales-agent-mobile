import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
} from 'react-native'
import { useRouter } from 'expo-router'

// ── Types ──────────────────────────────────────────────────────────────────────

type Stage = 'LEAD' | 'CONTACTED' | 'DEMO' | 'CONTRACT' | 'CLOSED'

const STAGES: Stage[] = ['LEAD', 'CONTACTED', 'DEMO', 'CONTRACT', 'CLOSED']

const STAGE_COLORS: Record<Stage, string> = {
  LEAD:      '#e0f2fe',
  CONTACTED: '#fef9c3',
  DEMO:      '#ede9fe',
  CONTRACT:  '#d1fae5',
  CLOSED:    '#d1d5db',
}

const STAGE_TEXT_COLORS: Record<Stage, string> = {
  LEAD:      '#0369a1',
  CONTACTED: '#92400e',
  DEMO:      '#5b21b6',
  CONTRACT:  '#065f46',
  CLOSED:    '#374151',
}

interface Prospect {
  id: string
  name: string
  address: string
  lastContact: string
  stage: Stage
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const INITIAL_PROSPECTS: Prospect[] = [
  { id: 'p1', name: 'Bar Centrale',        address: 'Via Roma 12, Milano',      lastContact: '2026-04-20', stage: 'LEAD' },
  { id: 'p2', name: 'Ristorante da Mario', address: 'Corso Venezia 44, Milano', lastContact: '2026-04-18', stage: 'CONTACTED' },
  { id: 'p3', name: 'Pizzeria Napoli',     address: 'Via Torino 8, Milano',     lastContact: '2026-04-15', stage: 'DEMO' },
  { id: 'p4', name: 'Caffè Brera',         address: 'Via Solferino 3, Milano',  lastContact: '2026-04-10', stage: 'CONTRACT' },
  { id: 'p5', name: 'Osteria del Porto',   address: 'Via Savona 23, Milano',    lastContact: '2026-04-05', stage: 'CLOSED' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProspectKanbanScreen() {
  const [prospects, setProspects] = useState<Prospect[]>(INITIAL_PROSPECTS)
  const router = useRouter()

  const moveToNextStage = (id: string) => {
    setProspects(prev =>
      prev.map(p => {
        if (p.id !== id) return p
        const currentIdx = STAGES.indexOf(p.stage)
        const nextStage = STAGES[Math.min(currentIdx + 1, STAGES.length - 1)]
        return { ...p, stage: nextStage }
      })
    )
  }

  const prospectsInStage = (stage: Stage) =>
    prospects.filter(p => p.stage === stage)

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Pipeline prospect</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={styles.board}
        testID="kanban-board"
      >
        {STAGES.map(stage => {
          const items = prospectsInStage(stage)
          return (
            <View key={stage} style={styles.column} testID={`kanban-col-${stage}`}>
              {/* Column header */}
              <View style={[styles.columnHeader, { backgroundColor: STAGE_COLORS[stage] }]}>
                <Text style={[styles.columnTitle, { color: STAGE_TEXT_COLORS[stage] }]}>
                  {stage}
                </Text>
                <View style={[styles.badge, { backgroundColor: STAGE_TEXT_COLORS[stage] }]}>
                  <Text style={styles.badgeText}>{items.length}</Text>
                </View>
              </View>

              {/* Cards */}
              <FlatList
                data={items}
                keyExtractor={i => i.id}
                scrollEnabled={false}
                ListEmptyComponent={
                  <Text style={styles.emptyColumn}>Nessun prospect</Text>
                }
                renderItem={({ item }) => {
                  const isLast = STAGES.indexOf(item.stage) === STAGES.length - 1
                  return (
                    <View style={styles.card} testID={`kanban-card-${item.id}`}>
                      <Text style={styles.cardName}>{item.name}</Text>
                      <Text style={styles.cardMeta}>{item.address}</Text>
                      <Text style={styles.cardMeta}>
                        Ultimo contatto: {item.lastContact}
                      </Text>
                      <View style={styles.cardActions}>
                        <TouchableOpacity
                          style={styles.detailBtn}
                          onPress={() => router.push(`/(app)/merchants` as never)}
                        >
                          <Text style={styles.detailBtnText}>Dettaglio</Text>
                        </TouchableOpacity>
                        {!isLast && (
                          <TouchableOpacity
                            style={styles.moveBtn}
                            onPress={() => moveToNextStage(item.id)}
                          >
                            <Text style={styles.moveBtnText}>Sposta a →</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )
                }}
              />
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const COLUMN_WIDTH = 220

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f5f7fa' },
  header:       { fontSize: 20, fontWeight: '700', color: '#1a3f6f', padding: 20, paddingBottom: 10 },
  board:        { paddingHorizontal: 12, paddingBottom: 20, gap: 10 },

  column: {
    width: COLUMN_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  columnTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  emptyColumn: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 13,
    padding: 20,
  },

  card: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  cardName:    { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 4 },
  cardMeta:    { fontSize: 12, color: '#6b7280', marginBottom: 2 },

  cardActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  detailBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1a3f6f',
    alignItems: 'center',
  },
  detailBtnText: { fontSize: 12, color: '#1a3f6f', fontWeight: '600' },

  moveBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#1a3f6f',
    alignItems: 'center',
  },
  moveBtnText: { fontSize: 12, color: '#fff', fontWeight: '600' },
})
