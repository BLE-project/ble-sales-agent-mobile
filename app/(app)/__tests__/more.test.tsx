/**
 * C2 redesign — hub "Altro" (nav 4+Altro): le 5 card navigano alle route
 * secondarie e sanano l'entry-point orfano di /settings/notifications (gap #1).
 * Mock expo-router: stesso pattern di app/__tests__/screens.test.tsx.
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'

// jest-expo non mocka i font di @expo/vector-icons (expo-font memory) —
// nel resto del repo nessuna schermata testata renderizza Ionicons; mock secco.
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }))

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))

import MoreScreen from '../more'

describe('MoreScreen (hub Altro)', () => {
  beforeEach(() => mockPush.mockClear())

  const cases: Array<[string, string, string]> = [
    ['more-item-royalties', 'Royalties', '/royalties'],
    ['more-item-profilo', 'Profilo', '/profile'],
    ['more-item-kanban', 'Kanban', '/prospects/kanban'],
    ['more-item-mappa', 'Mappa', '/prospects/map'],
    ['more-item-notifiche', 'Impostazioni notifiche', '/settings/notifications'],
  ]

  it('renders the 5 cards with legacy-identical labels', () => {
    render(<MoreScreen />)
    for (const [testID, label] of cases) {
      expect(screen.getByTestId(testID)).toBeTruthy()
      expect(screen.getByText(label)).toBeTruthy()
    }
  })

  it.each(cases)('%s navigates to %s', (testID, _label, route) => {
    render(<MoreScreen />)
    fireEvent.press(screen.getByTestId(testID))
    expect(mockPush).toHaveBeenCalledWith(route)
  })
})
