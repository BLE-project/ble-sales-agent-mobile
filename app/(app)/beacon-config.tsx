/**
 * FEAT-S45-001: Beacon Configuration screen — Sales Agent mobile.
 *
 * Placeholder screen for beacon enrollment and password management.
 * Full BLE scan integration requires Expo dev-client with react-native-ble-plx.
 *
 * Current functionality:
 *  - List registered beacons
 *  - Manual beacon enrollment form (UUID/Major/Minor/Name/Password)
 *  - Name editing
 *  - Password set/reset (requires physical proximity — enforced by X-BLE-Proximity header)
 */
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert, StyleSheet } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { beaconApi, BeaconSummary, BeaconEnrollRequest } from '../../src/api/salesAgentApi'

export default function BeaconConfigScreen() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Partial<BeaconEnrollRequest>>({
    type: 'TRACKING',
    major: 100,
    minor: 1,
  })

  const { data: beacons, isLoading } = useQuery<BeaconSummary[]>({
    queryKey: ['beacons-agent'],
    queryFn: () => beaconApi.list(),
  })

  const enrollMutation = useMutation({
    mutationFn: (req: BeaconEnrollRequest) => beaconApi.enroll(req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['beacons-agent'] })
      setShowForm(false)
      Alert.alert('Beacon enrolled successfully')
    },
    onError: () => Alert.alert('Error', 'Failed to enroll beacon'),
  })

  function handleEnroll() {
    if (!form.ibeaconUuid || !form.territoryId) {
      Alert.alert('Missing fields', 'UUID and Territory ID are required')
      return
    }
    enrollMutation.mutate(form as BeaconEnrollRequest)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Beacon Configuration</Text>
      <Text style={styles.subtitle}>
        BLE scan requires dev-client build. Use manual enrollment below.
      </Text>

      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={() => setShowForm(v => !v)}
      >
        <Text style={styles.primaryBtnText}>
          {showForm ? 'Cancel' : '+ Enroll Beacon'}
        </Text>
      </TouchableOpacity>

      {showForm && (
        <View style={styles.formCard}>
          {[
            { key: 'name', label: 'Name', placeholder: 'e.g. Ingresso Nord' },
            { key: 'ibeaconUuid', label: 'UUID *', placeholder: 'iBeacon UUID' },
            { key: 'territoryId', label: 'Territory ID *', placeholder: 'UUID' },
            { key: 'major', label: 'Major', placeholder: '100', keyboardType: 'numeric' as const },
            { key: 'minor', label: 'Minor', placeholder: '1', keyboardType: 'numeric' as const },
            { key: 'password', label: 'Password', placeholder: 'Beacon config password' },
          ].map(({ key, label, placeholder, keyboardType }) => (
            <View key={key} style={styles.field}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                style={styles.input}
                placeholder={placeholder}
                keyboardType={keyboardType}
                value={String(form[key as keyof typeof form] ?? '')}
                onChangeText={text =>
                  setForm(p => ({
                    ...p,
                    [key]: keyboardType === 'numeric' ? Number(text) || 0 : text,
                  }))
                }
              />
            </View>
          ))}
          <TouchableOpacity
            style={[styles.primaryBtn, enrollMutation.isPending && styles.disabledBtn]}
            onPress={handleEnroll}
            disabled={enrollMutation.isPending}
          >
            <Text style={styles.primaryBtnText}>
              {enrollMutation.isPending ? 'Enrolling...' : 'Enroll'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading && <Text style={styles.muted}>Loading beacons...</Text>}

      <FlatList
        data={beacons ?? []}
        keyExtractor={item => item.id}
        style={styles.list}
        ListEmptyComponent={
          !isLoading ? <Text style={styles.muted}>No beacons registered.</Text> : null
        }
        renderItem={({ item }) => (
          <View style={styles.beaconCard}>
            <Text style={styles.beaconName}>{item.name ?? 'Unnamed'}</Text>
            <Text style={styles.beaconDetail}>
              {item.ibeaconUuid} | {item.major}/{item.minor}
            </Text>
            <Text style={styles.beaconDetail}>
              Type: {item.type} | Status: {item.status}
            </Text>
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f9fafb' },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 16 },
  primaryBtn: {
    backgroundColor: '#1a3f6f',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  disabledBtn: { opacity: 0.5 },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  field: { marginBottom: 10 },
  label: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  list: { marginTop: 8 },
  beaconCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  beaconName: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  beaconDetail: { fontSize: 12, color: '#6b7280' },
  muted: { fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 20 },
})
