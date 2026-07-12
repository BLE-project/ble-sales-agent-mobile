import { Tabs, Redirect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../src/auth/AuthContext'
import { TOKENS } from '../../src/theme/defaults/tokens'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

// ── Tab icon map (SOLO Ionicons — mai emoji/tofu) ─────────────────────────────
const TAB_ICONS: Record<string, { active: IoniconName; inactive: IoniconName }> = {
  index:           { active: 'home',          inactive: 'home-outline'          },
  requests:        { active: 'document-text', inactive: 'document-text-outline' },
  merchants:       { active: 'storefront',    inactive: 'storefront-outline'    },
  'beacon-config': { active: 'bluetooth',     inactive: 'bluetooth-outline'     },
  more:            { active: 'ellipsis-horizontal-circle', inactive: 'ellipsis-horizontal-circle-outline' },
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
        tabBarActiveTintColor:   TOKENS.colors.brand.primary,
        tabBarInactiveTintColor: TOKENS.colors.surface.inkSoft,
      }}
    >
      {/* Nav "4 + Altro" (decisione fleet 2026-07-10, redesign C2): tab visibili
          = Home, Richieste, Merchant, Beacon + hub "Altro" (app/(app)/more.tsx:
          Royalties, Profilo, Kanban, Mappa, Impostazioni notifiche).
          #24 — tabBarButtonTestID convention: tab-{lowercase-italian-label}.
          Maestro flows reference these stable ids instead of label text
          (which drifts under i18n). */}
      <Tabs.Screen
        name="index"
        options={{ title: 'Dashboard', tabBarLabel: 'Home', tabBarButtonTestID: 'tab-home', tabBarIcon: makeIcon('index') }}
      />
      <Tabs.Screen
        name="requests"
        options={{ title: 'Richieste', tabBarLabel: 'Richieste', tabBarButtonTestID: 'tab-richieste', tabBarIcon: makeIcon('requests') }}
      />
      <Tabs.Screen
        name="merchants"
        options={{ title: 'Merchant', tabBarLabel: 'Merchant', tabBarButtonTestID: 'tab-merchant', tabBarIcon: makeIcon('merchants') }}
      />
      <Tabs.Screen
        name="beacon-config"
        options={{ title: 'Beacon', tabBarLabel: 'Beacon', tabBarButtonTestID: 'tab-beacon', tabBarIcon: makeIcon('beacon-config') }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'Altro', tabBarLabel: 'Altro', tabBarButtonTestID: 'tab-altro', tabBarIcon: makeIcon('more') }}
      />

      {/* Route secondarie — raggiunte dall'hub "Altro", non più tab (C2).
          `title` esplicito: senza, l'header di Tabs mostra il nome route raw. */}
      <Tabs.Screen name="royalties"              options={{ href: null, title: 'Royalties' }} />
      <Tabs.Screen name="profile"                options={{ href: null, title: 'Profilo' }} />
      <Tabs.Screen name="prospects/kanban"       options={{ href: null, title: 'Kanban' }} />
      <Tabs.Screen name="prospects/map"          options={{ href: null, title: 'Mappa' }} />

      {/* Detail screens — hidden from tab bar */}
      <Tabs.Screen name="request/[id]"           options={{ href: null }} />
      {/* Fix leak D1: senza href:null queste route comparivano come tab
          con label raw e icona tofu (observed 2026-07-10). */}
      <Tabs.Screen name="merchants/[id]"         options={{ href: null }} />
      <Tabs.Screen name="wizard/step-1-merchant" options={{ href: null }} />
      <Tabs.Screen name="wizard/step-2-scan"     options={{ href: null }} />
      <Tabs.Screen name="wizard/step-3-confirm"  options={{ href: null }} />
      <Tabs.Screen name="wizard/step-4-submit"   options={{ href: null }} />
      {/* §9bis moderation flow — accessed via Home card, not tab bar.
          Fix D4: title localizzato al posto dell'header raw "moderation"
          ("Moderazioni" è già copy asserito dai flow — nessun testo nuovo). */}
      <Tabs.Screen name="moderation"             options={{ href: null, title: 'Moderazioni' }} />
      {/* §9 BLE first-config — accessed via Merchant detail (fix D4 "beacon") */}
      <Tabs.Screen name="beacon"                 options={{ href: null, title: 'Beacon' }} />
      <Tabs.Screen name="beacon/first-config"    options={{ href: null }} />
      {/* §7.3 notification preferences — entry point: hub "Altro" (fix D4 "settings") */}
      <Tabs.Screen name="settings"               options={{ href: null, title: 'Impostazioni' }} />
      <Tabs.Screen name="settings/notifications" options={{ href: null }} />
    </Tabs>
  )
}
