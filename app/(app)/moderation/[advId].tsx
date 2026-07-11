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
import { TOKENS, spacing, radius } from '../../../src/theme/defaults/tokens'
import { typography } from '../../../src/theme/typography'
import { Card } from '../../../src/components/piazza/ui'

const P = TOKENS.colors.surface

type PendingAction = 'approve' | 'reject' | 'escalate' | null

/**
 * D4 (fix presentazione, redesign C3 2026-07-11): claudeReasons arriva come
 * JSON-string di lista → lista puntata; qualunque altro formato → stringa raw
 * com'era (il jest asserisce il testo piano 'Possibile claim non verificabile').
 */
function parseClaudeReasons(raw: string): string[] | null {
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every(x => typeof x === 'string')) return parsed
  } catch { /* non-JSON → fallback raw */ }
  return null
}

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
    return <View style={styles.center}><ActivityIndicator color={TOKENS.colors.brand.primary} /></View>
  }

  const riskColor = adv.claudeRiskLevel === 'HIGH' ? TOKENS.colors.semantic.danger
                  : adv.claudeRiskLevel === 'MEDIUM' ? TOKENS.colors.semantic.warning : TOKENS.colors.semantic.success

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

      <Card style={styles.card}>
        <Text style={styles.sectionLabel}>DESCRIZIONE</Text>
        <Text style={styles.description}>{adv.description}</Text>
      </Card>

      {adv.claudeRiskLevel && (
        <Card style={[styles.card, { borderLeftColor: riskColor, borderLeftWidth: 4 }]}>
          <Text style={styles.sectionLabel}>ANALISI AI</Text>
          <Text style={[styles.claudeRisk, { color: riskColor }]}>
            {adv.claudeRiskLevel} {adv.claudeConfidence != null && `(${adv.claudeConfidence}%)`}
          </Text>
          {adv.claudeReasons && (() => {
            const reasons = parseClaudeReasons(adv.claudeReasons)
            return reasons
              ? reasons.map((r, i) => (
                  <Text key={i} style={styles.claudeReasons}>{'•'} {r}</Text>
                ))
              : <Text style={styles.claudeReasons}>{adv.claudeReasons}</Text>
          })()}
        </Card>
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
                <Text style={styles.btnSecondaryText}>Annulla</Text>
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

// Redesign «La Piazza» C3 (2026-07-11): via lo slab brand (header su base,
// back link brand), Card kit, label sezione mono, bottom-sheet con token.
const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: P.base },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: P.base },
  header:         { paddingHorizontal: spacing.s5, paddingTop: spacing.s4, paddingBottom: spacing.s2 },
  back:           { ...typography.bodyS, fontSize: 13, color: TOKENS.colors.brand.primary, marginBottom: spacing.s1 },
  title:          { ...typography.displayM, color: P.ink },
  image:          { width: '100%', height: 200 },
  card:           { marginHorizontal: spacing.s4, marginTop: spacing.s3 },
  sectionLabel:   { ...typography.tag, fontSize: 11, textTransform: 'none', color: P.inkSoft, marginBottom: spacing.s2 },
  description:    { ...typography.bodyM, color: P.ink },
  claudeRisk:     { ...typography.monoAmount, fontSize: 18, lineHeight: 24 },
  claudeReasons:  { ...typography.bodyS, fontSize: 13, color: P.inkSoft, marginTop: spacing.s2, lineHeight: 18 },
  actions:        { flexDirection: 'row', padding: spacing.s4, gap: spacing.s2 },
  actionBtn:      { flex: 1, padding: spacing.s4, borderRadius: radius.m, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  btnReject:      { backgroundColor: TOKENS.colors.semantic.danger },
  btnEscalate:    { backgroundColor: TOKENS.colors.semantic.warning },
  btnApprove:     { backgroundColor: TOKENS.colors.semantic.success },
  btnSecondary:   {
    backgroundColor: P.surface, borderWidth: 1, borderColor: P.line,
    padding: spacing.s4, borderRadius: radius.m, flex: 1, alignItems: 'center',
    minHeight: 44, justifyContent: 'center',
  },
  btnSecondaryText:{ ...typography.titleM, fontSize: 14, color: P.ink },
  btnPrimary:     {
    backgroundColor: TOKENS.colors.brand.primary, padding: spacing.s4,
    borderRadius: radius.m, flex: 1, alignItems: 'center', minHeight: 44, justifyContent: 'center',
  },
  btnDisabled:    { opacity: 0.5 },
  actionText:     { ...typography.titleM, fontSize: 14, color: P.onBrand },
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBody:      { backgroundColor: P.surface, padding: spacing.s6, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl },
  modalTitle:     { ...typography.displayM, color: P.ink, marginBottom: spacing.s4 },
  modalLabel:     { ...typography.tag, fontSize: 10, color: P.inkSoft, marginTop: spacing.s3, marginBottom: spacing.s1 },
  textInput:      {
    ...typography.bodyM, borderWidth: 1, borderColor: P.line, borderRadius: radius.m,
    backgroundColor: P.surface, padding: spacing.s3, minHeight: 48, color: P.ink,
  },
  modalActions:   { flexDirection: 'row', gap: spacing.s2, marginTop: spacing.s5 },
})
