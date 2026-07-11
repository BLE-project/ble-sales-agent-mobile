/**
 * Mappa prospect — redesign «La Piazza» C5 (2026-07-11, self-approved delega).
 *
 * ⚠ SCHERMATA MOCK (gap #3 del DATA_CONTRACT, confermato on-device): dati
 * hardcoded in-file, nessuna API, riquadro mappa = placeholder (manca
 * react-native-maps). SOLO restyle: card kit, coordinate mono, Tag stage con
 * token, emoji→Ionicons. Nessun endpoint/campo lat-lng inventato — endpoint
 * reale <<DA POPOLARE>> lato prodotto.
 * testID invariati: prospect-map, prospect-marker-{id} (jest prospects.test).
 */
import React from 'react'
import { View, Text, StyleSheet, FlatList } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { TOKENS, spacing, radius } from '../../../src/theme/defaults/tokens'
import { typography } from '../../../src/theme/typography'
import { Card, Tag } from '../../../src/components/piazza/ui'

const P = TOKENS.colors.surface
const B = TOKENS.colors.brand.primary

// ── Types ──────────────────────────────────────────────────────────────────

interface ProspectLocation {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  stage: string
}

// ── Mock data — Milan area (gap #3: resta mock, vedi header) ────────────────

const PROSPECTS: ProspectLocation[] = [
  { id: 'p1', name: 'Bar Centrale',        address: 'Via Roma 12, Milano',      lat: 45.4654,  lng: 9.1859,  stage: 'LEAD' },
  { id: 'p2', name: 'Ristorante da Mario', address: 'Corso Venezia 44, Milano', lat: 45.4731,  lng: 9.2050,  stage: 'CONTACTED' },
  { id: 'p3', name: 'Pizzeria Napoli',     address: 'Via Torino 8, Milano',     lat: 45.4608,  lng: 9.1845,  stage: 'DEMO' },
  { id: 'p4', name: 'Caffè Brera',         address: 'Via Solferino 3, Milano',  lat: 45.4720,  lng: 9.1865,  stage: 'CONTRACT' },
  { id: 'p5', name: 'Osteria del Porto',   address: 'Via Savona 23, Milano',    lat: 45.4574,  lng: 9.1752,  stage: 'CLOSED' },
]

const STAGE_TONES: Record<string, { bg: string; fg: string }> = {
  LEAD:      { bg: TOKENS.colors.semanticSoft.infoSoft,    fg: TOKENS.colors.semantic.info },
  CONTACTED: { bg: TOKENS.colors.semanticSoft.warningSoft, fg: P.rewardInk },
  DEMO:      { bg: TOKENS.colors.brand.primarySoft,        fg: B },
  CONTRACT:  { bg: TOKENS.colors.semanticSoft.successSoft, fg: TOKENS.colors.semantic.success },
  CLOSED:    { bg: TOKENS.colors.semanticSoft.successSoft, fg: TOKENS.colors.semantic.success },
}

// ── Component — placeholder (react-native-maps not installed) ─────────────────

export default function ProspectMapScreen() {
  const router = useRouter()

  return (
    <View style={styles.container}>
      {/* Map placeholder — stub documentato (gap #3) */}
      <View style={styles.mapPlaceholder} testID="prospect-map">
        <Ionicons name="map-outline" size={36} color={P.inkSoft} />
        <Text style={styles.mapText}>Mappa prospect</Text>
        <Text style={styles.mapSubText}>
          Installa react-native-maps per visualizzare la mappa interattiva
        </Text>
      </View>

      {/* Prospect list below map */}
      <FlatList
        data={PROSPECTS}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card
            style={styles.card}
            testID={`prospect-marker-${item.id}`}
            onPress={() => router.push(`/(app)/merchants` as never)}
          >
            <View style={styles.cardRow}>
              <Ionicons name="location-outline" size={20} color={B} style={styles.pinIcon} />
              <View style={styles.cardContent}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardAddress}>{item.address}</Text>
                <Text style={styles.cardCoords}>
                  {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
                </Text>
              </View>
              <Tag
                label={item.stage}
                tone={STAGE_TONES[item.stage] ?? { bg: P.sunk, fg: P.inkSoft }}
              />
            </View>
          </Card>
        )}
      />
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: P.base },

  mapPlaceholder: {
    height: 200,
    backgroundColor: P.sunk,
    borderWidth: 1,
    borderColor: P.line,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    margin: spacing.s4,
    marginBottom: spacing.s3,
    borderRadius: radius.xl,
    gap: spacing.s1,
  },
  mapText:    { ...typography.titleM, color: P.ink },
  mapSubText: { ...typography.bodyS, color: P.inkSoft, textAlign: 'center', paddingHorizontal: spacing.s6 },

  list: { paddingHorizontal: spacing.s4, paddingBottom: spacing.s5 },

  card:       { marginBottom: spacing.s3 },
  cardRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s3 },
  pinIcon:    { marginTop: 2 },
  cardContent:{ flex: 1 },
  cardName:   { ...typography.titleM, fontSize: 15, color: P.ink, marginBottom: 2 },
  cardAddress:{ ...typography.bodyS, fontSize: 13, color: P.inkSoft, marginBottom: 2 },
  cardCoords: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, color: P.inkSoft },
})
