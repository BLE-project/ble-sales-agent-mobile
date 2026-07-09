import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useAuth } from '../../src/auth/AuthContext'
import { TOKENS } from '../../src/theme/defaults/tokens'

export default function ProfileScreen() {
  const { user, logout } = useAuth()

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(user?.name ?? user?.sub ?? '?').charAt(0).toUpperCase()}
        </Text>
      </View>
      <Text style={styles.name}>{user?.name ?? user?.sub}</Text>
      <Text style={styles.email}>{user?.email}</Text>
      <Text style={styles.role}>Agente Commerciale</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informazioni account</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Username</Text>
          <Text style={styles.rowValue}>{user?.sub}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Email</Text>
          <Text style={styles.rowValue}>{user?.email ?? '—'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Ruolo</Text>
          <Text style={styles.rowValue}>SALES_AGENT</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={logout}
        testID="btn-logout"
      >
        <Text style={styles.logoutText}>Esci dall'account</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f5f7fa' },
  avatar:       { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1a3f6f', alignSelf: 'center', marginTop: 20, marginBottom: 12, justifyContent: 'center', alignItems: 'center' },
  avatarText:   { color: TOKENS.colors.neutral.white, fontSize: 32, fontWeight: '700' },
  name:         { fontSize: 22, fontWeight: '700', color: '#111', textAlign: 'center' },
  email:        { fontSize: 14, color: TOKENS.colors.neutral.gray500, textAlign: 'center', marginBottom: 4 },
  role:         { fontSize: 13, color: '#1a3f6f', textAlign: 'center', fontWeight: '600', marginBottom: 24 },
  section:      { backgroundColor: TOKENS.colors.neutral.white, borderRadius: 12, padding: 16, marginBottom: 16, elevation: 1 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: TOKENS.colors.neutral.gray500, marginBottom: 12, textTransform: 'uppercase' },
  row:          { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: TOKENS.colors.neutral.gray100 },
  rowLabel:     { fontSize: 14, color: TOKENS.colors.neutral.gray500 },
  rowValue:     { fontSize: 14, color: '#111', fontWeight: '500' },
  logoutBtn:    { backgroundColor: '#fee2e2', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  logoutText:   { color: TOKENS.colors.semantic.danger, fontWeight: '700', fontSize: 15 },
})
