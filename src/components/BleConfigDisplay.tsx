/**
 * BCN-CFG-001 — read-only display of the tenant beacon-detection threshold
 * for sales-agent-mobile. Edits live in backoffice-tenant-web.
 *
 * Reference: BLE-project/ble-platform-docs#183
 */
import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { fetchTenantBleConfig, type TenantBleConfig } from '../api/tenantBleConfig'

export function BleConfigDisplay() {
  const [data, setData] = useState<TenantBleConfig | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchTenantBleConfig()
      .then(cfg => { if (!cancelled) { setData(cfg); setError(null) } })
      .catch(e  => { if (!cancelled) setError((e as Error).message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <View style={styles.center} testID="ble-config-loading">
        <ActivityIndicator />
      </View>
    )
  }
  if (error) {
    return <Text style={styles.error} testID="ble-config-error">{error}</Text>
  }

  return (
    <View style={styles.card} testID="ble-config-card">
      <Text style={styles.label}>Soglia rilevamento beacon (tenant)</Text>
      {data ? (
        <>
          <Text style={styles.value} testID="ble-config-value">
            {data.beaconImmediateThresholdM.toFixed(2)} m
          </Text>
          <Text style={styles.helper}>
            Configurato dal tenant. Comunicalo al merchant durante il sopralluogo.
          </Text>
        </>
      ) : (
        <Text style={styles.helperWarn} testID="ble-config-empty">
          Soglia non configurata. Il tenant deve impostarla prima del go-live.
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card:       { backgroundColor: '#fff', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#e5e7eb' },
  center:     { padding: 16, alignItems: 'center' },
  label:      { fontSize: 12, textTransform: 'uppercase', color: '#6b7280' },
  value:      { fontSize: 32, fontWeight: '800', marginVertical: 4 },
  helper:     { fontSize: 12, color: '#6b7280' },
  helperWarn: { fontSize: 14, color: '#b45309', marginTop: 4 },
  error:      { padding: 16, color: '#b91c1c' },
})
