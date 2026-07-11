/**
 * FU-51: Behaviour tests for the prospect pipeline screens —
 * ProspectKanbanScreen (FU-26) and ProspectMapScreen.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'

// Redesign C5 2026-07-11: la mappa ora renderizza Ionicons (emoji→Ionicons);
// jest-expo non mocka i font di @expo/vector-icons — stesso mock secco di
// app/(app)/__tests__/more.test.tsx. Nessuna asserzione cambiata.
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }))

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}))
jest.mock('../../../../src/api/prospectsApi', () => ({
  prospectsApi: { list: jest.fn(), create: jest.fn(), moveStage: jest.fn() },
}))

import { prospectsApi } from '../../../../src/api/prospectsApi'
import { ApiError } from '../../../../src/api/client'
import ProspectKanbanScreen from '../kanban'
import ProspectMapScreen from '../map'

const mockListProspects = prospectsApi.list as jest.Mock
const mockCreate = prospectsApi.create as jest.Mock
const mockMove = prospectsApi.moveStage as jest.Mock

const prospect = (id: string, stage: string, org: string) => ({
  id, tenantId: 't', agentId: 'a', organization: org, address: null,
  contactName: null, contactEmail: null, contactPhone: null,
  stage, notes: null, lastContactAt: null,
  createdAt: '2026-05-01', updatedAt: '2026-05-01',
})

let alertSpy: jest.SpyInstance
beforeEach(() => {
  jest.clearAllMocks()
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  mockListProspects.mockResolvedValue({ items: [], page: 0, size: 200, total: 0 })
  mockCreate.mockImplementation((req) => Promise.resolve(prospect('new-1', 'LEAD', req.organization)))
  mockMove.mockImplementation((id, stage) => Promise.resolve(prospect(id, stage, 'X')))
})
afterEach(() => alertSpy.mockRestore())

// ── ProspectKanbanScreen ─────────────────────────────────────────────────────

describe('ProspectKanbanScreen', () => {
  it('shows the empty-board state when there are no prospects', async () => {
    render(<ProspectKanbanScreen />)
    expect(await screen.findByTestId('kanban-empty')).toBeTruthy()
  })

  it('renders the board with one card per prospect in the right column', async () => {
    mockListProspects.mockResolvedValue({
      items: [prospect('p-1', 'LEAD', 'Bar Roma'), prospect('p-2', 'DEMO', 'Pizzeria Sole')],
      page: 0, size: 200, total: 2,
    })
    render(<ProspectKanbanScreen />)
    expect(await screen.findByTestId('kanban-card-p-1')).toBeTruthy()
    expect(screen.getByText('Bar Roma')).toBeTruthy()
    expect(screen.getByText('Pizzeria Sole')).toBeTruthy()
  })

  it('shows an error state with a retry button on a failed load', async () => {
    mockListProspects.mockRejectedValueOnce(new ApiError(403, 'forbidden'))
    render(<ProspectKanbanScreen />)
    expect(await screen.findByTestId('kanban-error')).toBeTruthy()
    expect(screen.getByText('Non hai i permessi per questa operazione.')).toBeTruthy()

    mockListProspects.mockResolvedValue({ items: [], page: 0, size: 200, total: 0 })
    fireEvent.press(screen.getByText('Riprova'))
    await waitFor(() => expect(screen.getByTestId('kanban-empty')).toBeTruthy())
  })

  it('creates a new prospect from the inline form', async () => {
    render(<ProspectKanbanScreen />)
    await screen.findByTestId('kanban-add-input')
    fireEvent.changeText(screen.getByTestId('kanban-add-input'), 'Caffè Nuovo')
    fireEvent.press(screen.getByTestId('kanban-add-button'))
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({ organization: 'Caffè Nuovo' }))
    expect(await screen.findByText('Caffè Nuovo')).toBeTruthy()
  })

  it('advances a prospect to the next happy-path stage', async () => {
    mockListProspects.mockResolvedValue({
      items: [prospect('p-1', 'LEAD', 'Bar Roma')], page: 0, size: 200, total: 1,
    })
    render(<ProspectKanbanScreen />)
    await screen.findByTestId('kanban-card-p-1')
    fireEvent.press(screen.getByTestId('kanban-move-p-1'))
    await waitFor(() => expect(mockMove).toHaveBeenCalledWith('p-1', 'CONTACTED'))
  })

  it('marks a prospect as LOST', async () => {
    mockListProspects.mockResolvedValue({
      items: [prospect('p-1', 'CONTACTED', 'Bar Roma')], page: 0, size: 200, total: 1,
    })
    render(<ProspectKanbanScreen />)
    await screen.findByTestId('kanban-card-p-1')
    fireEvent.press(screen.getByTestId('kanban-lose-p-1'))
    await waitFor(() => expect(mockMove).toHaveBeenCalledWith('p-1', 'LOST'))
  })

  it('surfaces a 409 illegal-transition error via Alert', async () => {
    mockListProspects.mockResolvedValue({
      items: [prospect('p-1', 'LEAD', 'Bar Roma')], page: 0, size: 200, total: 1,
    })
    mockMove.mockRejectedValueOnce(new ApiError(409, 'illegal'))
    render(<ProspectKanbanScreen />)
    await screen.findByTestId('kanban-card-p-1')
    fireEvent.press(screen.getByTestId('kanban-move-p-1'))
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
      'Spostamento non riuscito', 'Spostamento di fase non consentito.',
    ))
  })

  it('does not advance a terminal CLOSED prospect (no move button)', async () => {
    mockListProspects.mockResolvedValue({
      items: [prospect('p-1', 'CLOSED', 'Bar Roma')], page: 0, size: 200, total: 1,
    })
    render(<ProspectKanbanScreen />)
    await screen.findByTestId('kanban-card-p-1')
    expect(screen.queryByTestId('kanban-move-p-1')).toBeNull()
    expect(screen.queryByTestId('kanban-lose-p-1')).toBeNull()
  })
})

// ── ProspectMapScreen ────────────────────────────────────────────────────────

describe('ProspectMapScreen', () => {
  it('renders the map placeholder and a marker card per prospect', () => {
    render(<ProspectMapScreen />)
    expect(screen.getByTestId('prospect-map')).toBeTruthy()
    expect(screen.getByTestId('prospect-marker-p1')).toBeTruthy()
    expect(screen.getByText('Bar Centrale')).toBeTruthy()
  })

  it('navigates to the merchants list when a marker card is tapped', () => {
    render(<ProspectMapScreen />)
    fireEvent.press(screen.getByTestId('prospect-marker-p3'))
    expect(mockPush).toHaveBeenCalledWith('/(app)/merchants')
  })
})
