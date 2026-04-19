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
 */

import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Image,
  TouchableOpacity, Linking,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { api } from '../../../src/api/client'

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
const STATUS_COLOR: Record<MerchantLanding['landingStatus'], string> = {
  DRAFT: '#6b7280', PENDING_REVIEW: '#d97706', PUBLISHED: '#059669', ARCHIVED: '#9ca3af',
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

  if (loading) return <View style={s.center}><ActivityIndicator color="#1a3f6f" /></View>
  if (error || !data) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>Merchant non trovato</Text>
        <TouchableOpacity onPress={() => router.back()}>
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
              <Text style={s.rating}>⭐ {data.ratingAvg.toFixed(1)} ({data.ratingCount})</Text>
            )}
          </View>
          <View style={[s.statusBadge, { backgroundColor: STATUS_COLOR[data.landingStatus] + '22' }]}>
            <Text style={[s.statusText, { color: STATUS_COLOR[data.landingStatus] }]}>
              {STATUS_LABEL[data.landingStatus]}
            </Text>
          </View>
        </View>

        {data.description && (
          <>
            <Text style={s.sectionLabel}>Descrizione</Text>
            <Text style={s.desc}>{data.description}</Text>
          </>
        )}

        <Text style={s.sectionLabel}>Contatti</Text>
        <View style={s.contactList}>
          {data.addressLine && (
            <TouchableOpacity style={s.contactRow} onPress={openMaps}>
              <Text style={s.contactIcon}>📍</Text>
              <Text style={s.contactText}>
                {data.addressLine}{data.city ? `, ${data.city}` : ''}
              </Text>
            </TouchableOpacity>
          )}
          {data.phone && (
            <TouchableOpacity style={s.contactRow} onPress={openPhone}>
              <Text style={s.contactIcon}>📞</Text>
              <Text style={s.contactText}>{data.phone}</Text>
            </TouchableOpacity>
          )}
          {data.email && (
            <TouchableOpacity style={s.contactRow} onPress={openEmail}>
              <Text style={s.contactIcon}>✉</Text>
              <Text style={s.contactText}>{data.email}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* v7.9.10 — social links as inline rows */}
        {data.socialLinks && Object.values(data.socialLinks).some(Boolean) && (
          <>
            <Text style={s.sectionLabel}>Social</Text>
            <View style={s.contactList}>
              {([
                ['instagram','📸','Instagram'], ['facebook','👥','Facebook'],
                ['whatsapp','💬','WhatsApp'],  ['website','🌐','Sito web'],
                ['tiktok','🎵','TikTok'],
              ] as const).map(([k, icon, label]) => {
                const url = data.socialLinks?.[k]
                return url ? (
                  <TouchableOpacity key={k} style={s.contactRow} onPress={() => Linking.openURL(url)}>
                    <Text style={s.contactIcon}>{icon}</Text>
                    <Text style={s.contactText} numberOfLines={1}>{label} — {url}</Text>
                  </TouchableOpacity>
                ) : null
              })}
            </View>
          </>
        )}

        <View style={s.readOnlyNote}>
          <Text style={s.readOnlyText}>
            ℹ Sola lettura. Per modifiche → contatta l'admin tenant.
          </Text>
        </View>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f5f7fa' },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cover:       { width: '100%', height: 160 },
  content:     { padding: 16 },
  headerRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  logo:        { width: 56, height: 56, borderRadius: 8, marginRight: 12, backgroundColor: '#e5e7eb' },
  name:        { fontSize: 20, fontWeight: '700', color: '#111' },
  rating:      { fontSize: 13, color: '#374151', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText:  { fontSize: 11, fontWeight: '600' },
  sectionLabel:{ fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 20, marginBottom: 8 },
  desc:        { fontSize: 14, color: '#111', lineHeight: 20 },
  contactList: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  contactRow:  { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1,
                 borderBottomColor: '#f3f4f6' },
  contactIcon: { fontSize: 18, marginRight: 10 },
  contactText: { fontSize: 14, color: '#1a3f6f', flex: 1 },
  readOnlyNote:{ backgroundColor: '#f3f4f6', borderRadius: 8, padding: 12, marginTop: 20 },
  readOnlyText:{ fontSize: 12, color: '#6b7280', textAlign: 'center' },
  errorText:   { fontSize: 16, color: '#dc2626', marginBottom: 8 },
  link:        { color: '#1a3f6f', textDecorationLine: 'underline', fontSize: 14 },
})
