/**
 * §9bis M5 — Moderation review detail screen.
 *
 * Loads ADV detail; shows Claude verdict, image, full description, merchant
 * identity. Actions: approve / reject / escalate, with TOTP prompt for first two.
 */

import React, { useState } from 'react'
import {
  View, Text, StyleSheet, Image, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { moderationApi, ReviewTask } from '../../../src/api/moderationApi'

type PendingAction = 'approve' | 'reject' | 'escalate' | null

export default function ReviewDetailScreen() {
  const { advId } = useLocalSearchParams<{ advId: string }>()
  const router = useRouter()
  const qc = useQueryClient()

  const [pending, setPending]   = useState<PendingAction>(null)
  const [reason, setReason]     = useState('')
  const [totpCode, setTotpCode] = useState('')

  const { data: adv, isLoading } = useQuery<ReviewTask>({
    queryKey: ['moderation', advId],
    queryFn: () => moderationApi.get(advId!),
    enabled: !!advId,
  })

  const approveMutation = useMutation({
    mutationFn: ({ reason, totp }: { reason: string; totp: string }) =>
      moderationApi.approve(advId!, reason, totp),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['moderation-queue'] })
      Alert.alert('Approvata', 'ADV approvata con successo')
      router.back()
    },
    onError: (err: Error) => Alert.alert('Errore', err.message),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ reason, totp }: { reason: string; totp: string }) =>
      moderationApi.reject(advId!, reason, totp),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['moderation-queue'] })
      Alert.alert('Rifiutata', 'ADV rifiutata')
      router.back()
    },
    onError: (err: Error) => Alert.alert('Errore', err.message),
  })

  const escalateMutation = useMutation({
    mutationFn: (reason: string) => moderationApi.escalate(advId!, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['moderation-queue'] })
      Alert.alert('Escalata', 'ADV escalata al tenant admin')
      router.back()
    },
    onError: (err: Error) => Alert.alert('Errore', err.message),
  })

  function confirmAction() {
    if (!pending) return
    if (pending === 'escalate') {
      escalateMutation.mutate(reason)
    } else if (pending === 'approve') {
      approveMutation.mutate({ reason: reason || 'ok', totp: totpCode })
    } else if (pending === 'reject') {
      rejectMutation.mutate({ reason, totp: totpCode })
    }
  }

  if (isLoading || !adv) {
    return <View style={styles.center}><ActivityIndicator color="#6C3FCF" /></View>
  }

  const riskColor = adv.claudeRiskLevel === 'HIGH' ? '#ef4444'
                  : adv.claudeRiskLevel === 'MEDIUM' ? '#f59e0b' : '#10b981'

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Indietro</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{adv.title}</Text>
      </View>

      {adv.imageUrl && (
        <Image source={{ uri: adv.imageUrl }} style={styles.image} resizeMode="cover" />
      )}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>DESCRIZIONE</Text>
        <Text style={styles.description}>{adv.description}</Text>
      </View>

      {adv.claudeRiskLevel && (
        <View style={[styles.card, { borderLeftColor: riskColor, borderLeftWidth: 4 }]}>
          <Text style={styles.sectionLabel}>ANALISI AI</Text>
          <Text style={[styles.claudeRisk, { color: riskColor }]}>
            {adv.claudeRiskLevel} {adv.claudeConfidence != null && `(${adv.claudeConfidence}%)`}
          </Text>
          {adv.claudeReasons && (
            <Text style={styles.claudeReasons}>{adv.claudeReasons}</Text>
          )}
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          testID="btn-reject"
          style={[styles.actionBtn, styles.btnReject]}
          onPress={() => setPending('reject')}
        >
          <Text style={styles.actionText}>Rifiuta</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="btn-escalate"
          style={[styles.actionBtn, styles.btnEscalate]}
          onPress={() => setPending('escalate')}
        >
          <Text style={styles.actionText}>Escala</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="btn-approve"
          style={[styles.actionBtn, styles.btnApprove]}
          onPress={() => setPending('approve')}
        >
          <Text style={styles.actionText}>Approva</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={pending !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setPending(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBody}>
            <Text style={styles.modalTitle}>
              {pending === 'approve' ? 'Approva ADV'
               : pending === 'reject' ? 'Rifiuta ADV'
               : 'Escala a tenant admin'}
            </Text>

            <Text style={styles.modalLabel}>Motivazione</Text>
            <TextInput
              testID="reason-input"
              style={styles.textInput}
              multiline
              value={reason}
              onChangeText={setReason}
              placeholder="Descrivi la motivazione..."
            />

            {pending !== 'escalate' && (
              <>
                <Text style={styles.modalLabel}>Codice TOTP</Text>
                <TextInput
                  testID="totp-input"
                  style={styles.textInput}
                  value={totpCode}
                  onChangeText={setTotpCode}
                  placeholder="6 cifre"
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => { setPending(null); setReason(''); setTotpCode('') }}
              >
                <Text style={styles.actionText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="confirm-action"
                style={[
                  styles.btnPrimary,
                  (reason.length < 3 || (pending !== 'escalate' && totpCode.length !== 6)) && styles.btnDisabled,
                ]}
                disabled={reason.length < 3 || (pending !== 'escalate' && totpCode.length !== 6)}
                onPress={confirmAction}
              >
                <Text style={styles.actionText}>Conferma</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f5f7fa' },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:         { padding: 20, backgroundColor: '#6C3FCF' },
  back:           { color: '#e9d5ff', marginBottom: 4 },
  title:          { color: '#fff', fontSize: 20, fontWeight: '700' },
  image:          { width: '100%', height: 200 },
  card:           { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 12, elevation: 2 },
  sectionLabel:   { fontSize: 11, fontWeight: '700', color: '#6b7280', marginBottom: 8, letterSpacing: 0.5 },
  description:    { fontSize: 14, color: '#111', lineHeight: 20 },
  claudeRisk:     { fontSize: 18, fontWeight: '700' },
  claudeReasons:  { fontSize: 13, color: '#6b7280', marginTop: 6 },
  actions:        { flexDirection: 'row', padding: 16, gap: 8 },
  actionBtn:      { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
  btnReject:      { backgroundColor: '#ef4444' },
  btnEscalate:    { backgroundColor: '#f59e0b' },
  btnApprove:     { backgroundColor: '#10b981' },
  btnSecondary:   { backgroundColor: '#6b7280', padding: 14, borderRadius: 10, flex: 1, alignItems: 'center' },
  btnPrimary:     { backgroundColor: '#6C3FCF', padding: 14, borderRadius: 10, flex: 1, alignItems: 'center' },
  btnDisabled:    { opacity: 0.5 },
  actionText:     { color: '#fff', fontWeight: '700', fontSize: 14 },
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBody:      { backgroundColor: '#fff', padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalTitle:     { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  modalLabel:     { fontSize: 12, fontWeight: '600', color: '#6b7280', marginTop: 12, marginBottom: 4, textTransform: 'uppercase' },
  textInput:      { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10, fontSize: 14, minHeight: 48 },
  modalActions:   { flexDirection: 'row', gap: 8, marginTop: 20 },
})
