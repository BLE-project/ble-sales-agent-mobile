import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../src/auth/AuthContext'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } })

export default function RootLayout() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <Stack>
          <Stack.Screen name="login"  options={{ headerShown: false }} />
          <Stack.Screen name="(app)"  options={{ headerShown: false }} />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  )
}
