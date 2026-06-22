import { Stack, useRouter } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../src/auth/AuthContext'
import { BiometricAuthProvider } from '../src/auth/useBiometricAuth'
import { BiometricGate } from '../src/auth/BiometricGate'
import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import { I18nProvider } from '../src/i18n/I18nProvider'
import { ensureLocale } from '../src/i18n/config'
import { initSentry, SentryErrorBoundary } from '../src/observability/sentry'

// ADR-020: Sentry init — dormant until EXPO_PUBLIC_SENTRY_DSN set
// post Privacy→Legal sign-off (legal-review-log.md entry 2026-05-27).
initSentry()

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
  // Warm the cached active locale at startup so pre-mount lookups (splash,
  // error boundaries) read the resolved locale. IntlProvider still performs
  // its own async resolution inside I18nProvider — this only seeds the cache.
  useEffect(() => { void ensureLocale(null) }, [])

  return (
    <SentryErrorBoundary>
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <I18nProvider tenantLocaleHint={null}>
          {/*
            BiometricAuthProvider (Cluster B sales-agent integration) MUST sit
            INSIDE I18nProvider: the hook calls useIntl() to localize
            biometric-prompt strings. Sitting outside I18nProvider crashes the
            React tree at mount with "[React Intl] Could not find required
            `intl` object". AuthProvider stays above so the hook can still
            read auth state + call loginWithToken/logout — the Cluster B
            wiring contract is preserved.
          */}
          <BiometricAuthProvider>
            <BiometricGate>
              <NotificationListener />
              <Stack>
                <Stack.Screen name="login"  options={{ headerShown: false }} />
                <Stack.Screen name="(app)"  options={{ headerShown: false }} />
              </Stack>
            </BiometricGate>
          </BiometricAuthProvider>
        </I18nProvider>
      </AuthProvider>
    </QueryClientProvider>
    </SentryErrorBoundary>
  )
}
