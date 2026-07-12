/**
 * Profilo — redesign «La Piazza» C3 (2026-07-11, self-approved delega).
 * Sezione account in Card kit, label mono, nome display Bricolage.
 * INVARIATI (contratto Maestro login/logout + jest screens.test): testID
 * `btn-logout`, copy "Esci dall'account", "Agente Commerciale", "SALES_AGENT",
 * fallback email "—", iniziale avatar maiuscola.
 */
import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useAuth } from '../../src/auth/AuthContext'
import { TOKENS, spacing, radius } from '../../src/theme/defaults/tokens'
import { typography } from '../../src/theme/typography'
import { Card, brandSoft } from '../../src/components/piazza/ui'

const P = TOKENS.colors.surface
const B = TOKENS.colors.brand.primary

export default function ProfileScreen() {
  const { user, logout } = useAuth()

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.s5 }}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(user?.name ?? user?.sub ?? '?').charAt(0).toUpperCase()}
        </Text>
      </View>
      <Text style={styles.name}>{user?.name ?? user?.sub}</Text>
      <Text style={styles.email}>{user?.email}</Text>
      <Text style={styles.role}>Agente Commerciale</Text>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Informazioni account</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Username</Text>
          <Text style={styles.rowValue}>{user?.sub}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Email</Text>
          <Text style={styles.rowValue}>{user?.email ?? '—'}</Text>
        </View>
        <View style={[styles.row, styles.rowLast]}>
          <Text style={styles.rowLabel}>Ruolo</Text>
          <Text style={styles.rowValueMono}>SALES_AGENT</Text>
        </View>
      </Card>

      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={logout}
        testID="btn-logout"
        accessibilityRole="button"
      >
        <Text style={styles.logoutText}>Esci dall'account</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: P.base },
  avatar:       {
    width: 80, height: 80, borderRadius: radius.full, backgroundColor: B,
    borderWidth: 4, borderColor: brandSoft(B),
    alignSelf: 'center', marginTop: spacing.s5, marginBottom: spacing.s3,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText:   { ...typography.displayL, fontSize: 32, lineHeight: 38, color: P.onBrand },
  name:         { ...typography.displayL, color: P.ink, textAlign: 'center' },
  email:        { ...typography.bodyM, color: P.inkSoft, textAlign: 'center', marginBottom: spacing.s1 },
  role:         { ...typography.tag, fontSize: 11, color: B, textAlign: 'center', marginBottom: spacing.s6 },
  section:      { marginBottom: spacing.s4 },
  sectionTitle: { ...typography.tag, fontSize: 11, textTransform: 'none', color: P.inkSoft, marginBottom: spacing.s3 },
  row:          { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.s2, borderBottomWidth: 1, borderBottomColor: P.line },
  rowLast:      { borderBottomWidth: 0 },
  rowLabel:     { ...typography.bodyM, color: P.inkSoft },
  rowValue:     { ...typography.titleM, fontSize: 14, color: P.ink },
  rowValueMono: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 13, color: P.ink },
  logoutBtn:    {
    backgroundColor: TOKENS.colors.semanticSoft.dangerSoft,
    borderRadius: radius.m, padding: spacing.s4, alignItems: 'center',
    marginTop: spacing.s2, minHeight: 44, justifyContent: 'center',
  },
  logoutText:   { ...typography.titleM, fontSize: 15, color: TOKENS.colors.semantic.danger },
})
