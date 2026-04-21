/**
 * T-162 FCM integration — sales-agent push token registration.
 *
 * Similar to consumer version but POSTs to /bff/v1/sales-agent/push-token
 * with the list of territory IDs the agent covers (so notification-service
 * can fan-out beacon-health alerts for the right scope).
 */

import * as Notifications from 'expo-notifications'
import * as Application    from 'expo-application'
import { Platform }        from 'react-native'

const GATEWAY = process.env.EXPO_PUBLIC_GATEWAY_URL ?? 'http://localhost:8080'

export interface RegisterSalesAgentPushTokenOptions {
  authToken:    string
  tenantId:     string
  territoryIds: string[]    // UUIDs of covered territories
  gateway?:     string
}

export interface RegisterResult {
  pushToken:  string | null
  registered: boolean
  reason?:    string
}

export async function registerSalesAgentPushToken(
  opts: RegisterSalesAgentPushTokenOptions,
): Promise<RegisterResult> {
  const perm = await Notifications.getPermissionsAsync().catch(() => ({ status: 'denied' }))
  if (perm.status !== 'granted') {
    return { pushToken: null, registered: false, reason: 'no-permission' }
  }

  // Fetch token — native → Expo fallback (same strategy as consumer)
  let pushToken: string | null = null
  let platform: 'android' | 'ios' | 'expo' | 'web' =
    Platform.OS === 'ios' ? 'ios' : Platform.OS === 'web' ? 'web' : 'android'

  try {
    const native = await Notifications.getDevicePushTokenAsync().catch(() => null)
    if (native && typeof native.data === 'string') pushToken = native.data
  } catch { /* ignore */ }

  if (!pushToken) {
    try {
      const expo = await Notifications.getExpoPushTokenAsync({})
      if (expo?.data) { pushToken = expo.data; platform = 'expo' }
    } catch (e) {
      return { pushToken: null, registered: false, reason: `token-fetch-failed: ${(e as Error).message}` }
    }
  }
  if (!pushToken) return { pushToken: null, registered: false, reason: 'token-unavailable' }

  const gateway = opts.gateway ?? GATEWAY
  const appVersion = `${Application.nativeApplicationVersion ?? 'dev'}` +
                     `+${Application.nativeBuildVersion ?? '0'}`
  const deviceModel = `${Platform.OS}-${Platform.Version}`

  try {
    const res = await fetch(`${gateway}/bff/v1/sales-agent/push-token`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'X-Tenant-Id':   opts.tenantId,
        'Authorization': `Bearer ${opts.authToken}`,
      },
      body: JSON.stringify({
        pushToken, platform, appVersion, deviceModel,
        territoryIds: opts.territoryIds ?? [],
      }),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      return { pushToken, registered: false, reason: `bff-${res.status}: ${txt.slice(0, 200)}` }
    }
    return { pushToken, registered: true }
  } catch (e) {
    return { pushToken, registered: false, reason: `network: ${(e as Error).message}` }
  }
}

/**
 * T-162: best-effort unregister on logout — DELETE /bff/v1/sales-agent/push-token/:token
 * Fire-and-forget; network errors are swallowed so logout is never blocked.
 */
export async function unregisterPushToken(
  pushToken: string,
  opts: { authToken: string; tenantId: string; gateway?: string },
): Promise<void> {
  const gateway = opts.gateway ?? GATEWAY
  await fetch(`${gateway}/bff/v1/sales-agent/push-token/${encodeURIComponent(pushToken)}`, {
    method: 'DELETE',
    headers: {
      'X-Tenant-Id':   opts.tenantId,
      'Authorization': `Bearer ${opts.authToken}`,
    },
  }).catch(() => {})
}
