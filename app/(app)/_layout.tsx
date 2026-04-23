import { Tabs, Redirect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../src/auth/AuthContext'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

// ── Tab icon map ───────────────────────────────────────────────────────────────
const TAB_ICONS: Record<string, { active: IoniconName; inactive: IoniconName }> = {
  index:              { active: 'home',              inactive: 'home-outline'             },
  requests:           { active: 'document-text',     inactive: 'document-text-outline'    },
  merchants:          { active: 'storefront',        inactive: 'storefront-outline'       },
  royalties:          { active: 'cash',              inactive: 'cash-outline'             },
  profile:            { active: 'person',            inactive: 'person-outline'           },
  'beacon-config':    { active: 'bluetooth',         inactive: 'bluetooth-outline'        },
  'prospects/kanban': { active: 'grid',              inactive: 'grid-outline'             },
  'prospects/map':    { active: 'map',               inactive: 'map-outline'              },
}

function makeIcon(screenName: string) {
  return ({
    color,
    size,
    focused,
  }: {
    color: string
    size: number
    focused: boolean
  }) => {
    const map  = TAB_ICONS[screenName]
    const name = (focused ? map?.active : map?.inactive) ?? 'ellipse-outline'
    return <Ionicons name={name} size={size} color={color} />
  }
}

export default function AppLayout() {
  const { user, isLoading } = useAuth()

  if (isLoading) return null
  // FEAT-SA-FALLBACK: SUPER_ADMIN can log in and act as the default sales agent
  const isAllowed =
    user &&
    (user.roles.includes('SALES_AGENT') || user.roles.includes('SUPER_ADMIN'))
  if (!isAllowed) {
    return <Redirect href="/login" />
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   '#1a3f6f',
        tabBarInactiveTintColor: '#9E9E9E',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Dashboard', tabBarLabel: 'Home', tabBarIcon: makeIcon('index') }}
      />
      <Tabs.Screen
        name="requests"
        options={{ title: 'Richieste', tabBarLabel: 'Richieste', tabBarIcon: makeIcon('requests') }}
      />
      <Tabs.Screen
        name="merchants"
        options={{ title: 'Merchant', tabBarLabel: 'Merchant', tabBarIcon: makeIcon('merchants') }}
      />
      <Tabs.Screen
        name="royalties"
        options={{ title: 'Royalties', tabBarLabel: 'Royalties', tabBarIcon: makeIcon('royalties') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profilo', tabBarLabel: 'Profilo', tabBarIcon: makeIcon('profile') }}
      />
      <Tabs.Screen
        name="beacon-config"
        options={{ title: 'Beacon', tabBarLabel: 'Beacon', tabBarIcon: makeIcon('beacon-config') }}
      />
      {/* Detail screens — hidden from tab bar */}
      <Tabs.Screen name="request/[id]"           options={{ href: null }} />
      {/* §9bis moderation flow — accessed via Home card, not tab bar */}
      <Tabs.Screen name="moderation"             options={{ href: null }} />
      {/* §9 BLE first-config — accessed via Merchant detail */}
      <Tabs.Screen name="beacon"                 options={{ href: null }} />
      <Tabs.Screen name="beacon/first-config"    options={{ href: null }} />
      {/* §7.3 notification preferences — accessed via Profilo */}
      <Tabs.Screen name="settings"               options={{ href: null }} />
      <Tabs.Screen name="settings/notifications" options={{ href: null }} />
      {/* DS-006 prospect pipeline */}
      <Tabs.Screen
        name="prospects/kanban"
        options={{ title: 'Kanban', tabBarLabel: 'Kanban', tabBarIcon: makeIcon('prospects/kanban') }}
      />
      <Tabs.Screen
        name="prospects/map"
        options={{ title: 'Mappa', tabBarLabel: 'Mappa', tabBarIcon: makeIcon('prospects/map') }}
      />
    </Tabs>
  )
}
