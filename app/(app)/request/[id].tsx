import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { registrationRequestsApi, kitDeliveryApi } from '../../../src/api/salesAgentApi'
import { TOKENS } from '../../../src/theme/defaults/tokens'

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
    return <ActivityIndicator style={{ flex: 1, marginTop: 40 }} color={TOKENS.colors.brand.primary} />
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }} testID="request-detail">
      <Text style={styles.title} testID="request-title">{request.businessName}</Text>
      <Text style={styles.meta}>Proprietario: {request.ownerName}</Text>
      <Text style={styles.meta}>Tipo: {request.businessType}</Text>
      <Text style={styles.meta}>Email: {request.email}</Text>
      <Text style={styles.meta}>Tel: {request.phone}</Text>
      <Text style={[styles.status, { color: request.status === 'PENDING' ? TOKENS.colors.semantic.warning : TOKENS.colors.semantic.success }]}>
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
            testID="request-accept-notes"
          />
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending}
            testID="request-accept-btn"
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
            testID="request-approve-notes"
          />
          <TouchableOpacity
            style={styles.btnSuccess}
            onPress={() => approveMutation.mutate()}
            disabled={approveMutation.isPending}
            testID="request-approve-btn"
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
            testID="request-kit-notes"
          />
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => kitMutation.mutate()}
            disabled={kitMutation.isPending}
            testID="request-kit-btn"
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
  container:    { flex: 1, backgroundColor: TOKENS.colors.surface.base },
  title:        { fontSize: 22, fontWeight: '700', color: TOKENS.colors.surface.ink, marginBottom: 8 },
  meta:         { fontSize: 14, color: TOKENS.colors.surface.inkSoft, marginBottom: 4 },
  status:       { fontSize: 15, fontWeight: '600', marginVertical: 12 },
  section:      { backgroundColor: TOKENS.colors.neutral.white, borderRadius: 12, padding: 16, marginTop: 16, elevation: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: TOKENS.colors.brand.primary, marginBottom: 12 },
  input:        { borderWidth: 1, borderColor: TOKENS.colors.surface.line, borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 12, minHeight: 60, textAlignVertical: 'top' },
  kitItems:     { fontSize: 13, color: TOKENS.colors.neutral.gray500, marginBottom: 12, fontStyle: 'italic' },
  btnPrimary:   { backgroundColor: TOKENS.colors.brand.primary, borderRadius: 8, padding: 14, alignItems: 'center' },
  btnSuccess:   { backgroundColor: TOKENS.colors.semantic.success, borderRadius: 8, padding: 14, alignItems: 'center' },
  btnText:      { color: TOKENS.colors.neutral.white, fontWeight: '700', fontSize: 15 },
})
