/**
 * §7.3 — Notification preferences REST client (sales-agent-mobile).
 */

export interface NotificationPref {
  appId:     string
  channelId: string
  enabled:   boolean
  mandatory: boolean | null
}

const GATEWAY = process.env.EXPO_PUBLIC_GATEWAY_URL ?? 'http://localhost:8080'
const TOKEN_KEY = 'ble_sales_agent_token'

async function getToken(): Promise<string | null> {
  const SecureStore = await import('expo-secure-store')
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY)
  } catch {
    return null
  }
}

async function request<T>(method: 'GET' | 'PUT', body?: unknown): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${GATEWAY}/api/v1/notifications/preferences`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`[${res.status}] ${await res.text().catch(() => res.statusText)}`)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const notificationPreferencesApi = {
  list: () => request<NotificationPref[]>('GET'),
  update: (prefs: Omit<NotificationPref, 'mandatory'>[]) =>
    request<{ updated: number; clamped_always_on: number }>('PUT',
      prefs.map((p) => ({ ...p, mandatory: null }))),
}
