/**
 * L4 §5-6 — Sales agent: read-only merchant landing view.
 *
 * Route: /merchants/:id
 * Data: GET /v1/merchants/:id/landing — the sales agent sees whatever
 *       landing the merchant has configured (useful for on-site visits,
 *       to verify what consumers see).
 *
 * No edit/moderation actions — that's tenant-mobile's role.
 * Cross-linking from merchants.tsx list (tap a row).
 *
 * Redesign «La Piazza» C3 (2026-07-11, self-approved delega): emoji→Ionicons,
 * Card kit per contatti/social, label sezione mono, Tag stato landing con
 * tone semantic-soft. Fetch useEffect INVARIATO (i test renderizzano senza
 * QueryClientProvider — migrazione react-query rimandata, decisione fuori
 * scope restyle). Copy asserita (jest detail-screens.test) invariata.
 */

import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Image,
  TouchableOpacity, Linking,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { api } from '../../../src/api/client'
import { TOKENS, spacing, radius } from '../../../src/theme/defaults/tokens'
import { typography } from '../../../src/theme/typography'
import { Card, Tag } from '../../../src/components/piazza/ui'

const P = TOKENS.colors.surface
const B = TOKENS.colors.brand.primary

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

interface MerchantLanding {
  id:             string
  name:           string
  description:    string | null
  logoUrl:        string | null
  coverImageUrl:  string | null
  landingStatus:  string
  addressLine:    string | null
  city:           string | null
  phone:          string | null
  email:          string | null
  ratingAvg:      number | null
  ratingCount:    number
  // v7.9.10 — social links
  socialLinks?: {
    instagram?: string; facebook?: string; whatsapp?: string;
    website?: string;   tiktok?: string
  } | null
}

const STATUS_LABEL: Record<MerchantLanding['landingStatus'], string> = {
  DRAFT: 'Bozza', PENDING_REVIEW: 'In revisione', PUBLISHED: 'Pubblicata', ARCHIVED: 'Archiviata',
}
const STATUS_TONE: Record<MerchantLanding['landingStatus'], { bg: string; fg: string }> = {
  DRAFT:          { bg: P.sunk, fg: P.inkSoft },
  PENDING_REVIEW: { bg: TOKENS.colors.semanticSoft.warningSoft, fg: P.rewardInk },
  PUBLISHED:      { bg: TOKENS.colors.semanticSoft.successSoft, fg: TOKENS.colors.semantic.success },
  ARCHIVED:       { bg: P.sunk, fg: P.inkSoft },
}

export default function SalesAgentMerchantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  const [data, setData] = useState<MerchantLanding | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const json = await api.get<MerchantLanding>(`/api/v1/merchants/${id}/landing`)
        setData(json)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  function openMaps() {
    if (!data?.addressLine) return
    const q = encodeURIComponent(`${data.addressLine} ${data.city ?? ''}`)
    Linking.openURL(`https://maps.google.com/?q=${q}`)
  }
  function openPhone() {
    if (!data?.phone) return
    Linking.openURL(`tel:${data.phone}`)
  }
  function openEmail() {
    if (!data?.email) return
    Linking.openURL(`mailto:${data.email}`)
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={B} /></View>
  if (error || !data) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>Merchant non trovato</Text>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text style={s.link}>Indietro</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={s.container}>
      {data.coverImageUrl && <Image source={{ uri: data.coverImageUrl }} style={s.cover} resizeMode="cover" />}

      <View style={s.content}>
        <View style={s.headerRow}>
          {data.logoUrl && <Image source={{ uri: data.logoUrl }} style={s.logo} />}
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{data.name}</Text>
            {data.ratingAvg != null && data.ratingCount > 0 && (
              <View style={s.ratingRow}>
                <Ionicons name="star" size={13} color={TOKENS.colors.brand.accent} />
                <Text style={s.rating}>{data.ratingAvg.toFixed(1)} ({data.ratingCount})</Text>
              </View>
            )}
          </View>
          <Tag
            label={STATUS_LABEL[data.landingStatus]}
            tone={STATUS_TONE[data.landingStatus] ?? { bg: P.sunk, fg: P.inkSoft }}
          />
        </View>

        {data.description && (
          <>
            <Text style={s.sectionLabel}>Descrizione</Text>
            <Text style={s.desc}>{data.description}</Text>
          </>
        )}

        <Text style={s.sectionLabel}>Contatti</Text>
        <Card style={s.contactList}>
          {data.addressLine && (
            <TouchableOpacity style={s.contactRow} onPress={openMaps} accessibilityRole="button">
              <Ionicons name="location-outline" size={18} color={B} style={s.contactIcon} />
              <Text style={s.contactText}>
                {data.addressLine}{data.city ? `, ${data.city}` : ''}
              </Text>
            </TouchableOpacity>
          )}
          {data.phone && (
            <TouchableOpacity style={s.contactRow} onPress={openPhone} accessibilityRole="button">
              <Ionicons name="call-outline" size={18} color={B} style={s.contactIcon} />
              <Text style={s.contactText}>{data.phone}</Text>
            </TouchableOpacity>
          )}
          {data.email && (
            <TouchableOpacity style={s.contactRow} onPress={openEmail} accessibilityRole="button">
              <Ionicons name="mail-outline" size={18} color={B} style={s.contactIcon} />
              <Text style={s.contactText}>{data.email}</Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* v7.9.10 — social links as inline rows */}
        {data.socialLinks && Object.values(data.socialLinks).some(Boolean) && (
          <>
            <Text style={s.sectionLabel}>Social</Text>
            <Card style={s.contactList}>
              {([
                ['instagram', 'logo-instagram', 'Instagram'] as const,
                ['facebook',  'logo-facebook',  'Facebook']  as const,
                ['whatsapp',  'logo-whatsapp',  'WhatsApp']  as const,
                ['website',   'globe-outline',  'Sito web']  as const,
                ['tiktok',    'logo-tiktok',    'TikTok']    as const,
              ]).map(([k, icon, label]) => {
                const url = data.socialLinks?.[k]
                return url ? (
                  <TouchableOpacity key={k} style={s.contactRow} onPress={() => Linking.openURL(url)} accessibilityRole="button">
                    <Ionicons name={icon as IoniconName} size={18} color={B} style={s.contactIcon} />
                    <Text style={s.contactText} numberOfLines={1}>{label} — {url}</Text>
                  </TouchableOpacity>
                ) : null
              })}
            </Card>
          </>
        )}

        <View style={s.readOnlyNote}>
          <Ionicons name="information-circle-outline" size={14} color={P.inkSoft} />
          <Text style={s.readOnlyText}>
            Sola lettura. Per modifiche → contatta l'admin tenant.
          </Text>
        </View>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: P.base },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: P.base },
  cover:       { width: '100%', height: 160 },
  content:     { padding: spacing.s4 },
  headerRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.s2, gap: spacing.s2 },
  logo:        { width: 56, height: 56, borderRadius: radius.m, marginRight: spacing.s1, backgroundColor: P.sunk },
  name:        { ...typography.displayM, color: P.ink },
  ratingRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  rating:      { ...typography.bodyS, fontSize: 13, color: P.inkSoft },
  sectionLabel:{ ...typography.tag, fontSize: 11, textTransform: 'none', color: P.inkSoft, marginTop: spacing.s5, marginBottom: spacing.s2 },
  desc:        { ...typography.bodyM, color: P.ink },
  contactList: { padding: 0, overflow: 'hidden' },
  contactRow:  {
    flexDirection: 'row', alignItems: 'center', padding: spacing.s3,
    borderBottomWidth: 1, borderBottomColor: P.line,
  },
  contactIcon: { marginRight: spacing.s2 },
  contactText: { ...typography.bodyM, color: B, flex: 1 },
  readOnlyNote:{
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.s1,
    backgroundColor: P.sunk, borderRadius: radius.m, padding: spacing.s3, marginTop: spacing.s5,
  },
  readOnlyText:{ ...typography.bodyS, color: P.inkSoft, textAlign: 'center' },
  errorText:   { ...typography.titleL, color: TOKENS.colors.semantic.danger, marginBottom: spacing.s2 },
  link:        { ...typography.bodyM, color: B, textDecorationLine: 'underline' },
})
