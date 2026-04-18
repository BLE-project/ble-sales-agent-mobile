import { Stack } from 'expo-router'

/**
 * §9 BLE first-config nested layout — Stack so expo-router
 * treats this subdir as nested routes rather than auto-exposing
 * as a tab in the parent Tabs layout.
 */
export default function BeaconLayout() {
  return (
    <Stack>
      <Stack.Screen name="first-config" options={{ headerShown: false }} />
    </Stack>
  )
}
