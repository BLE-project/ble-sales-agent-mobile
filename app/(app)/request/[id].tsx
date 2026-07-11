/**
 * Redesign «La Piazza» C3 (2026-07-11, self-approved delega): sezioni in Card
 * kit, titolo display, input/bottoni con token Piazza. Copy e testID INVARIATI
 * (jest detail-screens.test asserisce le label bottone verbatim, glifi inclusi).
 */
import React, { useState } from 'react'
import {
  Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { registrationRequestsApi, kitDeliveryApi } from '../../../src/api/salesAgentApi'
import { TOKENS, spacing, radius } from '../../../src/theme/defaults/tokens'
import { typography } from '../../../src/theme/typography'
import { Card } from '../../../src/components/piazza/ui'

const P = TOKENS.colors.surface

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
        <Card style={styles.section}>
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
        </Card>
      )}

      {request.status === 'IN_REVIEW' && (
        <Card style={styles.section}>
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
        </Card>
      )}

      {(showKitForm || request.status === 'APPROVED') && (
        <Card style={styles.section}>
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
        </Card>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: P.base },
  title:        { ...typography.displayL, color: P.ink, marginBottom: spacing.s2 },
  meta:         { ...typography.bodyM, color: P.inkSoft, marginBottom: spacing.s1 },
  status:       { ...typography.titleM, fontSize: 15, marginVertical: spacing.s3 },
  section:      { marginTop: spacing.s4 },
  sectionTitle: { ...typography.titleM, fontSize: 15, color: TOKENS.colors.brand.primary, marginBottom: spacing.s3 },
  input:        {
    ...typography.bodyM, borderWidth: 1, borderColor: P.line, borderRadius: radius.m,
    backgroundColor: P.surface, padding: spacing.s3, marginBottom: spacing.s3,
    minHeight: 60, textAlignVertical: 'top', color: P.ink,
  },
  kitItems:     { ...typography.bodyS, fontSize: 13, color: P.inkSoft, marginBottom: spacing.s3, fontStyle: 'italic' },
  btnPrimary:   { backgroundColor: TOKENS.colors.brand.primary, borderRadius: radius.m, padding: spacing.s4, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  btnSuccess:   { backgroundColor: TOKENS.colors.semantic.success, borderRadius: radius.m, padding: spacing.s4, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  btnText:      { ...typography.titleM, fontSize: 15, color: P.onBrand },
})
