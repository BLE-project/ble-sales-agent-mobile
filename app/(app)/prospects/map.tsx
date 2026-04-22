import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native'
import { useRouter } from 'expo-router'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProspectLocation {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  stage: string
}

// ── Mock data — Milan area ────────────────────────────────────────────────────

const PROSPECTS: ProspectLocation[] = [
  { id: 'p1', name: 'Bar Centrale',        address: 'Via Roma 12, Milano',      lat: 45.4654,  lng: 9.1859,  stage: 'LEAD' },
  { id: 'p2', name: 'Ristorante da Mario', address: 'Corso Venezia 44, Milano', lat: 45.4731,  lng: 9.2050,  stage: 'CONTACTED' },
  { id: 'p3', name: 'Pizzeria Napoli',     address: 'Via Torino 8, Milano',     lat: 45.4608,  lng: 9.1845,  stage: 'DEMO' },
  { id: 'p4', name: 'Caffè Brera',         address: 'Via Solferino 3, Milano',  lat: 45.4720,  lng: 9.1865,  stage: 'CONTRACT' },
  { id: 'p5', name: 'Osteria del Porto',   address: 'Via Savona 23, Milano',    lat: 45.4574,  lng: 9.1752,  stage: 'CLOSED' },
]

// ── Component — placeholder (react-native-maps not installed) ─────────────────

export default function ProspectMapScreen() {
  const router = useRouter()

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Mappa prospect</Text>

      {/* Map placeholder */}
      <View style={styles.mapPlaceholder} testID="prospect-map">
        <Text style={styles.mapIcon}>📍</Text>
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
          <TouchableOpacity
            style={styles.card}
            testID={`prospect-marker-${item.id}`}
            onPress={() => router.push(`/(app)/merchants` as never)}
          >
            <View style={styles.cardRow}>
              <Text style={styles.pinIcon}>📍</Text>
              <View style={styles.cardContent}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardAddress}>{item.address}</Text>
                <Text style={styles.cardCoords}>
                  {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
                </Text>
              </View>
              <View style={[styles.stageBadge, stageStyle(item.stage)]}>
                <Text style={styles.stageText}>{item.stage}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stageStyle(stage: string) {
  const map: Record<string, object> = {
    LEAD:      { backgroundColor: '#e0f2fe' },
    CONTACTED: { backgroundColor: '#fef9c3' },
    DEMO:      { backgroundColor: '#ede9fe' },
    CONTRACT:  { backgroundColor: '#d1fae5' },
    CLOSED:    { backgroundColor: '#d1d5db' },
  }
  return map[stage] ?? { backgroundColor: '#f3f4f6' }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f5f7fa' },
  header:      { fontSize: 20, fontWeight: '700', color: '#1a3f6f', padding: 20, paddingBottom: 10 },

  mapPlaceholder: {
    height: 200,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
  },
  mapIcon:    { fontSize: 36, marginBottom: 8 },
  mapText:    { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 4 },
  mapSubText: { fontSize: 12, color: '#6b7280', textAlign: 'center', paddingHorizontal: 24 },

  list: { paddingHorizontal: 16, paddingBottom: 20 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
  },
  cardRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  pinIcon:    { fontSize: 22, marginTop: 2 },
  cardContent:{ flex: 1 },
  cardName:   { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 2 },
  cardAddress:{ fontSize: 13, color: '#6b7280', marginBottom: 2 },
  cardCoords: { fontSize: 11, color: '#9ca3af' },

  stageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  stageText:  { fontSize: 10, fontWeight: '700', color: '#374151' },
})
