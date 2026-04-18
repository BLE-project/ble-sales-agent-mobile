import { Stack } from 'expo-router'

export default function ModerationLayout() {
  return (
    <Stack>
      <Stack.Screen name="index"   options={{ headerShown: false }} />
      <Stack.Screen name="[advId]" options={{ headerShown: false }} />
    </Stack>
  )
}
