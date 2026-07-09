import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import {
  prospectsApi,
  Prospect,
  ProspectStage,
} from '../../../src/api/prospectsApi'
import { ApiError } from '../../../src/api/client'
import { TOKENS } from '../../../src/theme/defaults/tokens'

// ── Stage config ────────────────────────────────────────────────────────────
//
// FU-26: stages now come from the backend domain
// (com.ble.registry.salesagent.ProspectStage). The kanban shows the happy-path
// columns; LOST prospects are surfaced in their own column at the end.

type Column = ProspectStage

const COLUMNS: Column[] = ['LEAD', 'CONTACTED', 'DEMO', 'CONTRACT', 'CLOSED', 'LOST']

/** Happy-path order — used to compute the single legal "advance" target. */
const HAPPY_PATH: ProspectStage[] = ['LEAD', 'CONTACTED', 'DEMO', 'CONTRACT', 'CLOSED']

const STAGE_COLORS: Record<Column, string> = {
  LEAD:      '#e0f2fe',
  CONTACTED: '#fef9c3',
  DEMO:      '#ede9fe',
  CONTRACT:  '#d1fae5',
  CLOSED:    '#bbf7d0',
  LOST:      '#fee2e2',
}

const STAGE_TEXT_COLORS: Record<Column, string> = {
  LEAD:      '#0369a1',
  CONTACTED: '#92400e',
  DEMO:      '#5b21b6',
  CONTRACT:  '#065f46',
  CLOSED:    '#15803d',
  LOST:      '#b91c1c',
}

/** Next stage on the happy path, or null when terminal. Mirrors the backend. */
function nextHappyStage(stage: ProspectStage): ProspectStage | null {
  const idx = HAPPY_PATH.indexOf(stage)
  if (idx < 0 || idx >= HAPPY_PATH.length - 1) return null
  return HAPPY_PATH[idx + 1]
}

/** Render an API/network error as a short user-facing string. */
function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'Sessione scaduta. Effettua di nuovo il login.'
    if (e.status === 403) return 'Non hai i permessi per questa operazione.'
    if (e.status === 409) return 'Spostamento di fase non consentito.'
    return e.message || `Errore ${e.status}`
  }
  return 'Errore di rete. Riprova.'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProspectKanbanScreen() {
  const router = useRouter()

  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  // id of the prospect whose stage move is in-flight (disables its buttons)
  const [movingId, setMovingId]   = useState<string | null>(null)

  // New-prospect inline form
  const [newOrg, setNewOrg]       = useState('')
  const [creating, setCreating]   = useState(false)

  const loadProspects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const page = await prospectsApi.list()
      setProspects(page.items)
    } catch (e) {
      setError(describeError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProspects()
  }, [loadProspects])

  const createProspect = useCallback(async () => {
    const organization = newOrg.trim()
    if (!organization) return
    setCreating(true)
    try {
      const created = await prospectsApi.create({ organization })
      setProspects(prev => [created, ...prev])
      setNewOrg('')
    } catch (e) {
      Alert.alert('Creazione non riuscita', describeError(e))
    } finally {
      setCreating(false)
    }
  }, [newOrg])

  const moveStage = useCallback(async (id: string, target: ProspectStage) => {
    setMovingId(id)
    try {
      const updated = await prospectsApi.moveStage(id, target)
      setProspects(prev => prev.map(p => (p.id === id ? updated : p)))
    } catch (e) {
      Alert.alert('Spostamento non riuscito', describeError(e))
    } finally {
      setMovingId(null)
    }
  }, [])

  const prospectsInStage = (stage: Column) =>
    prospects.filter(p => p.stage === stage)

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]} testID="kanban-loading">
        <ActivityIndicator size="large" color="#1a3f6f" />
        <Text style={styles.stateText}>Caricamento pipeline…</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered]} testID="kanban-error">
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => void loadProspects()}>
          <Text style={styles.retryBtnText}>Riprova</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // ── Main board ────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Pipeline prospect</Text>

      {/* New-prospect inline form */}
      <View style={styles.addRow} testID="kanban-add-row">
        <TextInput
          style={styles.addInput}
          placeholder="Nuovo prospect (ragione sociale)"
          placeholderTextColor="#9ca3af"
          value={newOrg}
          onChangeText={setNewOrg}
          editable={!creating}
          testID="kanban-add-input"
        />
        <TouchableOpacity
          style={[styles.addBtn, (!newOrg.trim() || creating) && styles.addBtnDisabled]}
          onPress={() => void createProspect()}
          disabled={!newOrg.trim() || creating}
          testID="kanban-add-button"
        >
          {creating
            ? <ActivityIndicator size="small" color={TOKENS.colors.neutral.white} />
            : <Text style={styles.addBtnText}>Aggiungi</Text>}
        </TouchableOpacity>
      </View>

      {prospects.length === 0 ? (
        <View style={[styles.centered, styles.emptyBoard]} testID="kanban-empty">
          <Text style={styles.stateText}>Nessun prospect ancora.</Text>
          <Text style={styles.emptyHint}>
            Aggiungi il primo prospect con il campo qui sopra.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          contentContainerStyle={styles.board}
          testID="kanban-board"
        >
          {COLUMNS.map(stage => {
            const items = prospectsInStage(stage)
            return (
              <View key={stage} style={styles.column} testID={`kanban-col-${stage}`}>
                <View style={[styles.columnHeader, { backgroundColor: STAGE_COLORS[stage] }]}>
                  <Text style={[styles.columnTitle, { color: STAGE_TEXT_COLORS[stage] }]}>
                    {stage}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: STAGE_TEXT_COLORS[stage] }]}>
                    <Text style={styles.badgeText}>{items.length}</Text>
                  </View>
                </View>

                <FlatList
                  data={items}
                  keyExtractor={i => i.id}
                  scrollEnabled={false}
                  ListEmptyComponent={
                    <Text style={styles.emptyColumn}>Nessun prospect</Text>
                  }
                  renderItem={({ item }) => {
                    const advanceTo = nextHappyStage(item.stage)
                    const canLose   = item.stage !== 'CLOSED' && item.stage !== 'LOST'
                    const busy      = movingId === item.id
                    return (
                      <View style={styles.card} testID={`kanban-card-${item.id}`}>
                        <Text style={styles.cardName}>{item.organization}</Text>
                        {item.address ? (
                          <Text style={styles.cardMeta}>{item.address}</Text>
                        ) : null}
                        <Text style={styles.cardMeta}>
                          Ultimo contatto: {item.lastContactAt
                            ? item.lastContactAt.slice(0, 10)
                            : '—'}
                        </Text>
                        <View style={styles.cardActions}>
                          <TouchableOpacity
                            style={styles.detailBtn}
                            onPress={() => router.push(`/(app)/merchants` as never)}
                          >
                            <Text style={styles.detailBtnText}>Dettaglio</Text>
                          </TouchableOpacity>
                          {advanceTo && (
                            <TouchableOpacity
                              style={[styles.moveBtn, busy && styles.moveBtnDisabled]}
                              disabled={busy}
                              onPress={() => void moveStage(item.id, advanceTo)}
                              testID={`kanban-move-${item.id}`}
                            >
                              {busy
                                ? <ActivityIndicator size="small" color={TOKENS.colors.neutral.white} />
                                : <Text style={styles.moveBtnText}>Sposta a →</Text>}
                            </TouchableOpacity>
                          )}
                        </View>
                        {canLose && (
                          <TouchableOpacity
                            style={[styles.loseBtn, busy && styles.moveBtnDisabled]}
                            disabled={busy}
                            onPress={() => void moveStage(item.id, 'LOST')}
                            testID={`kanban-lose-${item.id}`}
                          >
                            <Text style={styles.loseBtnText}>Segna come perso</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )
                  }}
                />
              </View>
            )
          })}
        </ScrollView>
      )}
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const COLUMN_WIDTH = 220

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f5f7fa' },
  centered:     { alignItems: 'center', justifyContent: 'center', padding: 24 },
  header:       { fontSize: 20, fontWeight: '700', color: '#1a3f6f', padding: 20, paddingBottom: 10 },
  board:        { paddingHorizontal: 12, paddingBottom: 20, gap: 10 },

  stateText:    { marginTop: 12, fontSize: 14, color: TOKENS.colors.neutral.gray500 },
  emptyBoard:   { flex: 1 },
  emptyHint:    { marginTop: 6, fontSize: 13, color: '#9ca3af', textAlign: 'center' },
  errorText:    { fontSize: 14, color: '#b91c1c', textAlign: 'center', marginBottom: 16 },

  retryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#1a3f6f',
  },
  retryBtnText: { color: TOKENS.colors.neutral.white, fontSize: 14, fontWeight: '600' },

  // New-prospect form
  addRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  addInput: {
    flex: 1,
    backgroundColor: TOKENS.colors.neutral.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: TOKENS.colors.neutral.gray300,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111',
  },
  addBtn: {
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1a3f6f',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  addBtnDisabled: { backgroundColor: '#9ca3af' },
  addBtnText:     { color: TOKENS.colors.neutral.white, fontSize: 14, fontWeight: '600' },

  column: {
    width: COLUMN_WIDTH,
    backgroundColor: TOKENS.colors.neutral.white,
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
  badgeText: { color: TOKENS.colors.neutral.white, fontSize: 11, fontWeight: '700' },

  emptyColumn: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 13,
    padding: 20,
  },

  card: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: TOKENS.colors.neutral.gray100,
  },
  cardName:    { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 4 },
  cardMeta:    { fontSize: 12, color: TOKENS.colors.neutral.gray500, marginBottom: 2 },

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
    justifyContent: 'center',
  },
  moveBtnDisabled: { opacity: 0.6 },
  moveBtnText: { fontSize: 12, color: TOKENS.colors.neutral.white, fontWeight: '600' },

  loseBtn: {
    marginTop: 6,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#b91c1c',
    alignItems: 'center',
  },
  loseBtnText: { fontSize: 12, color: '#b91c1c', fontWeight: '600' },
})
