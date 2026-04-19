/**
 * FEAT-S45-001 + Fase 3.0b: Beacon Configuration screen — Sales Agent mobile.
 *
 * Functionality:
 *  - List registered beacons (with territory/UUID/major/minor)
 *  - Manual beacon enrollment (UUID/Major/Minor/Name/Password)
 *  - Fase 3.0b: Reconfigure existing beacon (UUID/Major/Minor/Type + territory switch)
 *    with a territory picker and an explicit "Randomize" helper for
 *    dual-territory test fixtures
 *  - Name editing via tap on name
 *  - Password set/reset (requires physical proximity — enforced by X-BLE-Proximity header)
 *
 * Full BLE scan integration still requires Expo dev-client with react-native-ble-plx;
 * this screen provides the manual-entry fallback used by agents on site.
 */
import { useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  beaconApi,
  BeaconSummary,
  BeaconEnrollRequest,
  BeaconConfigUpdate,
  BeaconType,
  Territory,
  territoryApi,
  randomizeBeaconIdentity,
} from '../../src/api/salesAgentApi'
import {
  DEFAULT_HOLYIOT_PASSWORD,
  DEFAULT_HOLYIOT_PASSWORD_LABEL,
} from '../../src/constants/holyIot'

// Fase 3.1 fixup: aligned with backend BeaconType enum — only 3 valid
// values. The chip picker used to show 5 chips, two of which ('INFO' and
// 'ENTRANCE') would silently 400 on save.
const BEACON_TYPES: BeaconType[] = ['TRACKING', 'MERCHANT', 'TOURIST_INFO']

export default function BeaconConfigScreen() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Partial<BeaconEnrollRequest>>({
    type: 'TRACKING',
    major: 100,
    minor: 1,
  })

  // Fase 3.0b: reconfigure modal state
  const [configBeacon, setConfigBeacon] = useState<BeaconSummary | null>(null)
  const [configForm, setConfigForm] = useState<BeaconConfigUpdate | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)

  const { data: beacons, isLoading } = useQuery<BeaconSummary[]>({
    queryKey: ['beacons-agent'],
    queryFn: () => beaconApi.list(),
  })

  // Territories are used by both the enroll form (when it grows up) and the
  // reconfigure modal. Fetched eagerly so the picker feels instant on tap.
  const { data: territories } = useQuery<Territory[]>({
    queryKey: ['territories-agent'],
    queryFn: () => territoryApi.list(),
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

  const configMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: BeaconConfigUpdate }) =>
      beaconApi.updateConfig(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['beacons-agent'] })
      setConfigBeacon(null)
      setConfigForm(null)
      setConfigError(null)
      Alert.alert('Saved', 'Beacon reconfigured successfully')
    },
    onError: (err: Error) => {
      // ApiError.message carries the response body verbatim; try to parse
      // the standard { error: { code, message } } envelope so we can give
      // the agent a targeted message for the duplicate-identity case.
      const raw = err.message ?? ''
      try {
        const parsed = JSON.parse(raw)
        const code = parsed?.error?.code
        const msg = parsed?.error?.message ?? raw
        if (code === 'BEACON_DUPLICATE_IDENTITY') {
          setConfigError(`Duplicate identity: ${msg}`)
          return
        }
        setConfigError(msg)
      } catch {
        setConfigError(raw || 'Failed to update beacon config')
      }
    },
  })

  // Seed the form whenever a new beacon is opened for reconfigure.
  useEffect(() => {
    if (configBeacon) {
      setConfigForm({
        territoryId: configBeacon.territoryId,
        type: configBeacon.type,
        ibeaconUuid: configBeacon.ibeaconUuid,
        major: configBeacon.major,
        minor: configBeacon.minor,
        txPower: configBeacon.txPower ?? null,
        assignedToStoreId: configBeacon.assignedToStoreId ?? null,
        assignedToZoneId: configBeacon.assignedToZoneId ?? null,
      })
      setConfigError(null)
    }
  }, [configBeacon])

  function openConfig(b: BeaconSummary) {
    setConfigBeacon(b)
  }
  function closeConfig() {
    setConfigBeacon(null)
    setConfigForm(null)
    setConfigError(null)
  }
  function randomizeConfig() {
    if (!configForm) return
    const fresh = randomizeBeaconIdentity()
    setConfigForm({ ...configForm, ...fresh })
    setConfigError(null)
  }
  function submitConfig() {
    if (!configBeacon || !configForm) return
    setConfigError(null)
    configMutation.mutate({ id: configBeacon.id, body: configForm })
  }

  function handleEnroll() {
    if (!form.ibeaconUuid || !form.territoryId) {
      Alert.alert('Missing fields', 'UUID and Territory ID are required')
      return
    }
    enrollMutation.mutate(form as BeaconEnrollRequest)
  }

  // Helper: map territoryId → name for the list cards
  function territoryName(id: string): string {
    return territories?.find(t => t.id === id)?.name ?? id.substring(0, 8) + '…'
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
            <Text style={styles.beaconDetail}>
              Territory: {territoryName(item.territoryId)}
            </Text>
            <TouchableOpacity
              style={styles.configBtn}
              onPress={() => openConfig(item)}
              testID={`beacon-config-${item.id}`}
            >
              <Text style={styles.configBtnText}>Reconfigure</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Fase 3.0b: Reconfigure Modal ────────────────────────────────────── */}
      <Modal
        visible={!!configBeacon && !!configForm}
        animationType="slide"
        transparent
        onRequestClose={closeConfig}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={styles.modalTitle}>Reconfigure Beacon</Text>
              {configBeacon && (
                <Text style={styles.modalSubtitle}>
                  {configBeacon.name ?? 'Unnamed'}{' '}
                  <Text style={styles.mono}>
                    ({configBeacon.id.substring(0, 8)}…)
                  </Text>
                </Text>
              )}

              {configForm && (
                <>
                  {/* Territory picker */}
                  <Text style={styles.label}>Territory</Text>
                  <View style={styles.pickerRow}>
                    {(territories ?? []).map(t => {
                      const active = configForm.territoryId === t.id
                      return (
                        <TouchableOpacity
                          key={t.id}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() =>
                            setConfigForm({ ...configForm, territoryId: t.id })
                          }
                          testID={`territory-chip-${t.id}`}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              active && styles.chipTextActive,
                            ]}
                          >
                            {t.name}
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                    {(territories?.length ?? 0) === 0 && (
                      <Text style={styles.muted}>No territories loaded.</Text>
                    )}
                  </View>

                  {/* Type picker */}
                  <Text style={styles.label}>Type</Text>
                  <View style={styles.pickerRow}>
                    {BEACON_TYPES.map(t => {
                      const active = configForm.type === t
                      return (
                        <TouchableOpacity
                          key={t}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() =>
                            setConfigForm({ ...configForm, type: t })
                          }
                          testID={`type-chip-${t}`}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              active && styles.chipTextActive,
                            ]}
                          >
                            {t}
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>

                  {/* UUID */}
                  <View style={styles.field}>
                    <Text style={styles.label}>iBeacon UUID</Text>
                    <TextInput
                      style={[styles.input, styles.monoInput]}
                      value={configForm.ibeaconUuid}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      onChangeText={text =>
                        setConfigForm({ ...configForm, ibeaconUuid: text })
                      }
                      testID="config-uuid-input"
                    />
                  </View>

                  {/* Major / Minor */}
                  <View style={styles.row}>
                    <View style={[styles.field, styles.flex1]}>
                      <Text style={styles.label}>Major</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={String(configForm.major)}
                        onChangeText={text =>
                          setConfigForm({
                            ...configForm,
                            major: parseInt(text, 10) || 0,
                          })
                        }
                        testID="config-major-input"
                      />
                    </View>
                    <View style={[styles.field, styles.flex1]}>
                      <Text style={styles.label}>Minor</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={String(configForm.minor)}
                        onChangeText={text =>
                          setConfigForm({
                            ...configForm,
                            minor: parseInt(text, 10) || 0,
                          })
                        }
                        testID="config-minor-input"
                      />
                    </View>
                  </View>

                  {/* Randomize helper */}
                  <TouchableOpacity
                    style={styles.randomizeBtn}
                    onPress={randomizeConfig}
                    testID="config-randomize-btn"
                  >
                    <Text style={styles.randomizeBtnText}>
                      🎲 Randomize UUID / Major / Minor
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.helper}>
                    Useful for dual-territory test fixtures — avoids manual
                    collisions when cloning a beacon into a new territory.
                  </Text>

                  {/* Holy-IOT factory password helper — Fase 3.1 */}
                  <View
                    style={styles.holyIotHint}
                    testID="holy-iot-default-password-hint"
                  >
                    <Text style={styles.holyIotLabel}>
                      {DEFAULT_HOLYIOT_PASSWORD_LABEL}
                    </Text>
                    <Text
                      style={styles.holyIotPassword}
                      selectable
                      testID="holy-iot-default-password-value"
                    >
                      {DEFAULT_HOLYIOT_PASSWORD}
                    </Text>
                    <Text style={styles.holyIotHelp}>
                      Usala nell&apos;app Holy-IOT Beacon Setting per autenticarti
                      e modificare UUID/Major/Minor dell&apos;hardware sul campo.
                    </Text>
                  </View>

                  {configError && (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>{configError}</Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            {/* Footer actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.secondaryBtn, styles.flex1]}
                onPress={closeConfig}
                disabled={configMutation.isPending}
                testID="config-cancel-btn"
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  styles.flex1,
                  configMutation.isPending && styles.disabledBtn,
                ]}
                onPress={submitConfig}
                disabled={configMutation.isPending}
                testID="config-save-btn"
              >
                <Text style={styles.primaryBtnText}>
                  {configMutation.isPending ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  secondaryBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryBtnText: { color: '#374151', fontWeight: '600', fontSize: 14 },
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
  row: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
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
  monoInput: { fontFamily: 'Courier', fontSize: 12 },
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
  configBtn: {
    marginTop: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  configBtnText: { color: '#1d4ed8', fontWeight: '600', fontSize: 12 },
  muted: { fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 20 },
  mono: { fontFamily: 'Courier', fontSize: 12, color: '#6b7280' },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
  },
  modalScroll: { padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 4 },
  modalSubtitle: { fontSize: 12, color: '#6b7280', marginBottom: 16 },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  chipActive: {
    backgroundColor: '#1a3f6f',
    borderColor: '#1a3f6f',
  },
  chipText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  randomizeBtn: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 6,
  },
  randomizeBtnText: { color: '#92400e', fontWeight: '600', fontSize: 13 },
  helper: { fontSize: 11, color: '#6b7280', marginBottom: 12 },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 6,
    padding: 10,
    marginBottom: 4,
  },
  errorText: { color: '#991b1b', fontSize: 13 },
  // Fase 3.1: Holy-IOT factory password hint box (shown inside reconfigure modal)
  holyIotHint: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    marginBottom: 12,
  },
  holyIotLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e3a8a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  holyIotPassword: {
    fontFamily: 'Courier',
    fontSize: 15,
    color: '#1d4ed8',
    marginBottom: 4,
  },
  holyIotHelp: { fontSize: 11, color: '#1e40af' },
})
