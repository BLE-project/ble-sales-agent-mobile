/**
 * Hub "Altro" — nav "4 + Altro" (decisione fleet 2026-07-10, redesign C2).
 *
 * Card Piazza (icona Ionicons + label + chevron) verso le route secondarie.
 * Label IDENTICHE alle vecchie tabBarLabel (contratto flow Maestro);
 * "Impostazioni notifiche" sana l'entry-point orfano di /settings/notifications
 * (DATA_CONTRACT gap #1 — pura navigazione, la schermata esiste già).
 */
import React from 'react'
import { ScrollView, View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Card } from '../../src/components/piazza/ui'
import { TOKENS, spacing } from '../../src/theme/defaults/tokens'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

const ITEMS = [
  { testID: 'more-item-royalties', label: 'Royalties',              icon: 'cash-outline'          as IoniconName, route: '/royalties' },
  { testID: 'more-item-profilo',   label: 'Profilo',                icon: 'person-outline'        as IoniconName, route: '/profile' },
  { testID: 'more-item-kanban',    label: 'Kanban',                 icon: 'grid-outline'          as IoniconName, route: '/prospects/kanban' },
  { testID: 'more-item-mappa',     label: 'Mappa',                  icon: 'map-outline'           as IoniconName, route: '/prospects/map' },
  { testID: 'more-item-notifiche', label: 'Impostazioni notifiche', icon: 'notifications-outline' as IoniconName, route: '/settings/notifications' },
] as const

export default function MoreScreen() {
  const router = useRouter()
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      {ITEMS.map(item => (
        <Card key={item.testID} testID={item.testID} onPress={() => router.push(item.route)}>
          <View style={s.rowInner}>
            <Ionicons name={item.icon} size={22} color={TOKENS.colors.brand.primary} />
            <Text style={s.label}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={TOKENS.colors.surface.inkSoft} />
          </View>
        </Card>
      ))}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TOKENS.colors.surface.base },
  content: { padding: spacing.s4, gap: spacing.s3 },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.s3 },
  label: {
    flex: 1,
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: 15,
    color: TOKENS.colors.surface.ink,
  },
})
