/**
 * C1 redesign «La Piazza» — smoke test del kit condiviso.
 * Pattern: src/components/__tests__/components.test.tsx (testing-library/react-native).
 * ponytail: smoke render + interazioni minime, non snapshot per-stile.
 */
import React from 'react'
import { Text, AccessibilityInfo } from 'react-native'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'

import {
  Card, Tag, Field, Metric, ScreenHeader, BeaconRadar,
  EmptyState, ErrorState, SkeletonCard, brandSoft,
} from '../ui'
import { TOKENS } from '../../../theme/defaults/tokens'

describe('piazza/ui kit', () => {
  it('brandSoft appends ~12% alpha to the brand hex', () => {
    expect(brandSoft('#5E30C9')).toBe('#5E30C91F')
    expect(brandSoft()).toBe(`${TOKENS.colors.brand.primary}1F`)
  })

  it('Card renders children; with onPress becomes a pressable with testID', () => {
    const onPress = jest.fn()
    render(<Card onPress={onPress} testID="card-y"><Text>Contenuto</Text></Card>)
    expect(screen.getByText('Contenuto')).toBeTruthy()
    fireEvent.press(screen.getByTestId('card-y'))
    expect(onPress).toHaveBeenCalled()
  })

  it('Tag keeps raw children (uppercase is style-only) and honours tone', () => {
    render(<Tag label="Attivo" tone={{ bg: '#DCFCE7', fg: '#10B981' }} testID="tag-1" />)
    // Maestro/jest asseriscono il testo raw, non l'upcase visivo.
    expect(screen.getByTestId('tag-1').props.children).toBe('Attivo')
  })

  it('Field shows label, help and error (with errorTestID)', () => {
    render(
      <Field label="Nome" required help="aiuto" error="obbligatorio" errorTestID="fld-err">
        <Text>input</Text>
      </Field>,
    )
    expect(screen.getByText(/NOME/)).toBeTruthy()
    expect(screen.getByText('aiuto')).toBeTruthy()
    expect(screen.getByTestId('fld-err').props.children).toBe('obbligatorio')
  })

  it('Metric renders value with testID', () => {
    render(<Metric label="Beacon" value={4} testID="kpi-beacon" />)
    expect(screen.getByTestId('kpi-beacon').props.children).toBe(4)
  })

  it('ScreenHeader renders the title', () => {
    render(<ScreenHeader title="Richieste" />)
    expect(screen.getByText('Richieste')).toBeTruthy()
  })

  it('EmptyState / ErrorState expose titleTestID; ErrorState retry fires', () => {
    render(<EmptyState title="Nessun elemento" titleTestID="empty-t" />)
    expect(screen.getByTestId('empty-t')).toBeTruthy()

    const onRetry = jest.fn()
    render(<ErrorState title="Errore" retryLabel="Riprova" onRetry={onRetry} titleTestID="err-t" />)
    expect(screen.getByTestId('err-t')).toBeTruthy()
    fireEvent.press(screen.getByText('Riprova'))
    expect(onRetry).toHaveBeenCalled()
  })

  it('SkeletonCard renders with its testID', () => {
    render(<SkeletonCard />)
    expect(screen.getByTestId('skeleton-card')).toBeTruthy()
  })

  it('BeaconRadar renders animated radar by default', () => {
    const { unmount } = render(<BeaconRadar size={100} />)
    // il radar è decorativo (accessibilityElementsHidden) → includeHiddenElements
    expect(screen.getByTestId('beacon-radar', { includeHiddenElements: true })).toBeTruthy()
    unmount() // ferma i loop Animated
  })

  it('BeaconRadar falls back to static ripple under reduced motion', async () => {
    const spy = jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true)
    render(<BeaconRadar size={100} />)
    await waitFor(() =>
      expect(screen.queryByTestId('beacon-radar', { includeHiddenElements: true })).toBeNull(),
    )
    spy.mockRestore()
  })
})
