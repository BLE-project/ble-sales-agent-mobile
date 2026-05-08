/**
 * BCN-MAP-001 Phase 2 — GPS capture button.
 *
 * Tapped by sales-agent / merchant during beacon configuration. Opens
 * expo-location with high accuracy, refuses to submit when accuracy > 10 m
 * (door-of-store granularity per #185 spec), POSTs the lat/lng to
 * /api/v1/beacons/{id}/gps, then notifies the parent via onCaptured.
 *
 * Reference: BLE-project/ble-platform-docs#185
 */
import { useState } from 'react'
import { TouchableOpacity, Text, ActivityIndicator, Alert, StyleSheet } from 'react-native'
import * as Location from 'expo-location'
import { captureBeaconGps } from '../api/beaconGpsApi'

const MAX_ACCURACY_METERS = 10

export interface GpsCaptureButtonProps {
  beaconId: string
  /** Optional: prior captured coordinate to label the button differently. */
  hasGps?: boolean
  onCaptured?: (lat: number, lng: number) => void
  testID?: string
}

export function GpsCaptureButton(props: GpsCaptureButtonProps) {
  const [busy, setBusy] = useState(false)

  async function handleCapture() {
    setBusy(true)
    try {
      const perm = await Location.requestForegroundPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('Permesso negato', 'Concedi il permesso di localizzazione per catturare le coordinate GPS del beacon.')
        return
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      })
      const acc = pos.coords.accuracy ?? Number.POSITIVE_INFINITY
      if (acc > MAX_ACCURACY_METERS) {
        Alert.alert(
          'Accuratezza insufficiente',
          `Precisione attuale ${acc.toFixed(1)} m (richiesta ≤ ${MAX_ACCURACY_METERS} m). Avvicinati al beacon e riprova.`,
        )
        return
      }

      const { latitude, longitude } = pos.coords
      await captureBeaconGps(props.beaconId, { latitude, longitude })
      Alert.alert('GPS salvato', `Coordinate ${latitude.toFixed(5)}, ${longitude.toFixed(5)} associate al beacon.`)
      props.onCaptured?.(latitude, longitude)
    } catch (e) {
      Alert.alert('Errore cattura GPS', (e as Error).message ?? 'Riprova fra qualche secondo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <TouchableOpacity
      style={[styles.btn, props.hasGps ? styles.btnReplace : styles.btnPrimary]}
      onPress={handleCapture}
      disabled={busy}
      testID={props.testID ?? `gps-capture-${props.beaconId}`}
      accessibilityLabel={props.hasGps ? 'Riacquisisci GPS' : 'Cattura GPS'}
    >
      {busy
        ? <ActivityIndicator color="#fff" />
        : <Text style={styles.btnText}>{props.hasGps ? 'Riacquisisci GPS' : 'Cattura GPS'}</Text>}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  btn:         {
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 10, alignItems: 'center',
  },
  btnPrimary:  { backgroundColor: '#0B6E4F' },
  btnReplace:  { backgroundColor: '#0E7490' },
  btnText:     { color: '#fff', fontWeight: '700', fontSize: 14 },
})
