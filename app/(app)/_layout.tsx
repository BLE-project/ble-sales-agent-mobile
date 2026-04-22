import { Tabs } from 'expo-router'
import { useAuth } from '../../src/auth/AuthContext'
import { Redirect } from 'expo-router'

export default function AppLayout() {
  const { user, isLoading } = useAuth()

  if (isLoading) return null
  // FEAT-SA-FALLBACK: SUPER_ADMIN can log in and act as the default sales agent
  const isAllowed = user &&
    (user.roles.includes('SALES_AGENT') || user.roles.includes('SUPER_ADMIN'))
  if (!isAllowed) {
    return <Redirect href="/login" />
  }

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#1a3f6f' }}>
      <Tabs.Screen name="index"     options={{ title: 'Dashboard',   tabBarLabel: 'Home' }} />
      <Tabs.Screen name="requests"  options={{ title: 'Richieste',   tabBarLabel: 'Richieste' }} />
      <Tabs.Screen name="merchants" options={{ title: 'Merchant',    tabBarLabel: 'Merchant' }} />
      <Tabs.Screen name="royalties" options={{ title: 'Royalties',   tabBarLabel: 'Royalties' }} />
      <Tabs.Screen name="profile"   options={{ title: 'Profilo',     tabBarLabel: 'Profilo' }} />
      <Tabs.Screen name="beacon-config" options={{ title: 'Beacon',  tabBarLabel: 'Beacon' }} />
      {/* Detail screens — hidden from tab bar */}
      <Tabs.Screen name="request/[id]" options={{ href: null }} />
      {/* §9bis moderation flow — accessed via Home card, not tab bar */}
      <Tabs.Screen name="moderation" options={{ href: null }} />
      {/* §9 BLE first-config — accessed via Merchant detail */}
      <Tabs.Screen name="beacon" options={{ href: null }} />
      <Tabs.Screen name="beacon/first-config" options={{ href: null }} />
      {/* §7.3 notification preferences — accessed via Profilo */}
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="settings/notifications" options={{ href: null }} />
      {/* DS-006 prospect pipeline */}
      <Tabs.Screen name="prospects/kanban" options={{ title: 'Kanban',    tabBarLabel: 'Kanban' }} />
      <Tabs.Screen name="prospects/map"    options={{ title: 'Mappa',     tabBarLabel: 'Mappa' }} />
    </Tabs>
  )
}
