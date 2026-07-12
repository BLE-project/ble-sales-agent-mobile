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
import { TOKENS, spacing, radius } from '../../../src/theme/defaults/tokens'
import { typography } from '../../../src/theme/typography'
import { ScreenHeader } from '../../../src/components/piazza/ui'

// Redesign «La Piazza» C5 (2026-07-11, self-approved delega): SOLO restyle —
// colonne/card con token Piazza, header display, tone stage soft-semantic.
// Logica pipeline, testID kanban-* e copy invariati; "Dettaglio" continua a
// puntare a /merchants (contract §17, nessun dettaglio prospect inventato).
const P = TOKENS.colors.surface

// ── Stage config ────────────────────────────────────────────────────────────
//
// FU-26: stages now come from the backend domain
// (com.ble.registry.salesagent.ProspectStage). The kanban shows the happy-path
// columns; LOST prospects are surfaced in their own column at the end.

type Column = ProspectStage

const COLUMNS: Column[] = ['LEAD', 'CONTACTED', 'DEMO', 'CONTRACT', 'CLOSED', 'LOST']

/** Happy-path order — used to compute the single legal "advance" target. */
const HAPPY_PATH: ProspectStage[] = ['LEAD', 'CONTACTED', 'DEMO', 'CONTRACT', 'CLOSED']

// C5: hex fuori token → palette Piazza (soft bg + ink forte per colonna).
const STAGE_COLORS: Record<Column, string> = {
  LEAD:      TOKENS.colors.semanticSoft.infoSoft,
  CONTACTED: TOKENS.colors.semanticSoft.warningSoft,
  DEMO:      TOKENS.colors.brand.primarySoft,
  CONTRACT:  TOKENS.colors.semanticSoft.successSoft,
  CLOSED:    TOKENS.colors.semanticSoft.successSoft,
  LOST:      TOKENS.colors.semanticSoft.dangerSoft,
}

const STAGE_TEXT_COLORS: Record<Column, string> = {
  LEAD:      TOKENS.colors.semantic.info,
  CONTACTED: TOKENS.colors.surface.rewardInk,
  DEMO:      TOKENS.colors.brand.primary,
  CONTRACT:  TOKENS.colors.semantic.success,
  CLOSED:    TOKENS.colors.semantic.success,
  LOST:      TOKENS.colors.semantic.danger,
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
        <ActivityIndicator size="large" color={TOKENS.colors.brand.primary} />
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
      <ScreenHeader title="Pipeline prospect" />

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
  container:    { flex: 1, backgroundColor: P.base },
  centered:     { alignItems: 'center', justifyContent: 'center', padding: spacing.s6 },
  board:        { paddingHorizontal: spacing.s3, paddingBottom: spacing.s5, gap: spacing.s3 },

  stateText:    { ...typography.bodyM, marginTop: spacing.s3, color: P.inkSoft },
  emptyBoard:   { flex: 1 },
  emptyHint:    { ...typography.bodyS, fontSize: 13, marginTop: 6, color: P.inkSoft, textAlign: 'center' },
  errorText:    { ...typography.bodyM, color: TOKENS.colors.semantic.danger, textAlign: 'center', marginBottom: spacing.s4 },

  retryBtn: {
    paddingVertical: spacing.s2,
    paddingHorizontal: spacing.s5,
    borderRadius: radius.m,
    backgroundColor: TOKENS.colors.brand.primary,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryBtnText: { ...typography.titleM, fontSize: 14, color: P.onBrand },

  // New-prospect form
  addRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.s4,
    paddingBottom: spacing.s3,
    gap: spacing.s2,
  },
  addInput: {
    ...typography.bodyM,
    flex: 1,
    backgroundColor: P.surface,
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: P.line,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
    color: P.ink,
  },
  addBtn: {
    paddingHorizontal: spacing.s4,
    borderRadius: radius.m,
    backgroundColor: TOKENS.colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText:     { ...typography.titleM, fontSize: 14, color: P.onBrand },

  column: {
    width: COLUMN_WIDTH,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.line,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.s3,
  },
  columnTitle: {
    ...typography.tag,
    fontSize: 11,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { fontFamily: 'JetBrainsMono_600SemiBold', color: P.onBrand, fontSize: 11 },

  emptyColumn: {
    ...typography.bodyS,
    fontSize: 13,
    textAlign: 'center',
    color: P.inkSoft,
    padding: spacing.s5,
  },

  card: {
    padding: spacing.s3,
    borderTopWidth: 1,
    borderTopColor: P.line,
  },
  cardName:    { ...typography.titleM, fontSize: 14, color: P.ink, marginBottom: spacing.s1 },
  cardMeta:    { ...typography.bodyS, color: P.inkSoft, marginBottom: 2 },

  cardActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.s3,
  },
  detailBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: radius.s,
    borderWidth: 1,
    borderColor: TOKENS.colors.brand.primary,
    alignItems: 'center',
  },
  detailBtnText: { ...typography.label, fontSize: 12, color: TOKENS.colors.brand.primary },

  moveBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: radius.s,
    backgroundColor: TOKENS.colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveBtnDisabled: { opacity: 0.6 },
  moveBtnText: { ...typography.label, fontSize: 12, color: P.onBrand },

  loseBtn: {
    marginTop: 6,
    paddingVertical: 6,
    borderRadius: radius.s,
    borderWidth: 1,
    borderColor: TOKENS.colors.semantic.danger,
    alignItems: 'center',
  },
  loseBtnText: { ...typography.label, fontSize: 12, color: TOKENS.colors.semantic.danger },
})
