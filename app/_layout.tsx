import { Stack, useRouter } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../src/auth/AuthContext'
import { BiometricAuthProvider } from '../src/auth/useBiometricAuth'
import { BiometricGate } from '../src/auth/BiometricGate'
import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import { I18nProvider } from '../src/i18n/I18nProvider'

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
        {/*
          BiometricAuthProvider (Cluster B sales-agent integration) sits inside
          AuthProvider so the biometric hook can read auth state + call
          loginWithToken/logout. BiometricGate below wraps the screens for
          the status-driven overlay (PIN entry / locked / prompting).
        */}
        <BiometricAuthProvider>
          <I18nProvider tenantLocaleHint={null}>
            <BiometricGate>
              <NotificationListener />
              <Stack>
                <Stack.Screen name="login"  options={{ headerShown: false }} />
                <Stack.Screen name="(app)"  options={{ headerShown: false }} />
              </Stack>
            </BiometricGate>
          </I18nProvider>
        </BiometricAuthProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
