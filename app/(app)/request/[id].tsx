import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { registrationRequestsApi, kitDeliveryApi } from '../../../src/api/salesAgentApi'

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()

  const { data: request, isLoading } = useQuery({
    queryKey: ['request', id],
    queryFn: () => registrationRequestsApi.list().then(list => list.find(r => r.id === id)!),
  })

  const [notes, setNotes]     = useState('')
  const [kitNotes, setKitNotes] = useState('')
  const [showKitForm, setShowKitForm] = useState(false)

  const acceptMutation = useMutation({
    mutationFn: () => registrationRequestsApi.updateStatus(id, 'IN_REVIEW', notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requests'] })
      Alert.alert('Richiesta presa in carico', 'Lo stato è stato aggiornato a IN_REVIEW')
    },
  })

  const approveMutation = useMutation({
    mutationFn: () => registrationRequestsApi.updateStatus(id, 'APPROVED', notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requests'] })
      setShowKitForm(true)
      Alert.alert('Approvata!', 'Ora puoi segnalare la preparazione del kit.')
    },
  })

  const kitMutation = useMutation({
    mutationFn: () => kitDeliveryApi.create({
      registrationRequestId: id as unknown as string,
      notes: kitNotes,
      items: JSON.stringify([
        { type: 'BEACON', quantity: 2 },
        { type: 'STICKERS', quantity: 10 },
        { type: 'GRAPHICS_FOLDER', quantity: 1 },
      ]),
    } as never),
    onSuccess: () => {
      Alert.alert('Kit creato', 'La consegna del kit è stata registrata come PREPARING.')
      router.back()
    },
  })

  if (isLoading || !request) {
    return <ActivityIndicator style={{ flex: 1, marginTop: 40 }} color="#1a3f6f" />
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>{request.businessName}</Text>
      <Text style={styles.meta}>Proprietario: {request.ownerName}</Text>
      <Text style={styles.meta}>Tipo: {request.businessType}</Text>
      <Text style={styles.meta}>Email: {request.email}</Text>
      <Text style={styles.meta}>Tel: {request.phone}</Text>
      <Text style={[styles.status, { color: request.status === 'PENDING' ? '#f59e0b' : '#10b981' }]}>
        Stato: {request.status}
      </Text>

      {request.status === 'PENDING' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prendi in carico</Text>
          <TextInput
            style={styles.input}
            placeholder="Note (opzionale)"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending}
          >
            <Text style={styles.btnText}>
              {acceptMutation.isPending ? 'Aggiornamento...' : '▶ Prendi in carico'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {request.status === 'IN_REVIEW' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Approva richiesta</Text>
          <TextInput
            style={styles.input}
            placeholder="Note approvazione"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
          <TouchableOpacity
            style={styles.btnSuccess}
            onPress={() => approveMutation.mutate()}
            disabled={approveMutation.isPending}
          >
            <Text style={styles.btnText}>
              {approveMutation.isPending ? 'Approvazione...' : '✓ Approva'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {(showKitForm || request.status === 'APPROVED') && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Registra consegna kit</Text>
          <Text style={styles.kitItems}>Kit standard: 2x Beacon, 10x Stickers, 1x Cartella grafica</Text>
          <TextInput
            style={styles.input}
            placeholder="Note consegna"
            value={kitNotes}
            onChangeText={setKitNotes}
            multiline
          />
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => kitMutation.mutate()}
            disabled={kitMutation.isPending}
          >
            <Text style={styles.btnText}>
              {kitMutation.isPending ? 'Creazione...' : '📦 Crea consegna kit'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f5f7fa' },
  title:        { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 8 },
  meta:         { fontSize: 14, color: '#555', marginBottom: 4 },
  status:       { fontSize: 15, fontWeight: '600', marginVertical: 12 },
  section:      { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 16, elevation: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a3f6f', marginBottom: 12 },
  input:        { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 12, minHeight: 60, textAlignVertical: 'top' },
  kitItems:     { fontSize: 13, color: '#6b7280', marginBottom: 12, fontStyle: 'italic' },
  btnPrimary:   { backgroundColor: '#1a3f6f', borderRadius: 8, padding: 14, alignItems: 'center' },
  btnSuccess:   { backgroundColor: '#10b981', borderRadius: 8, padding: 14, alignItems: 'center' },
  btnText:      { color: '#fff', fontWeight: '700', fontSize: 15 },
})
