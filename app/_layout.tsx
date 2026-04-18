import { Stack, useRouter } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../src/auth/AuthContext'
import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } })

/**
 * §8 Deep-link listener — opens moderation review detail when a
 * moderation-review-request push is tapped.
 *
 * Expected notification payload:
 *   data: { deepLink: "terrio-sales-agent://moderation/<advId>" }
 */
function NotificationListener() {
  const router   = useRouter()
  const response = useRef<Notifications.Subscription | null>(null)

  useEffect(() => {
    response.current = Notifications.addNotificationResponseReceivedListener((r) => {
      const data = r.notification.request.content.data as Record<string, unknown>
      const deepLink = typeof data?.deepLink === 'string' ? data.deepLink : null
      if (!deepLink) return
      const match = deepLink.match(/^terrio-sales-agent:\/\/moderation\/([^/?#]+)/)
      if (match) router.push(`/(app)/moderation/${match[1]}` as never)
    })
    return () => { response.current?.remove() }
  }, [router])

  return null
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <NotificationListener />
        <Stack>
          <Stack.Screen name="login"  options={{ headerShown: false }} />
          <Stack.Screen name="(app)"  options={{ headerShown: false }} />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  )
}
