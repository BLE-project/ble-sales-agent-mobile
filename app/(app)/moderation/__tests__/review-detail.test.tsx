/**
 * FU-51: Behaviour tests for the moderation review detail screen
 * (§9bis M5) — verdict rendering + the approve/reject/escalate action
 * modal incl. TOTP gating.
 */
import React, { type ReactNode } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Alert } from 'react-native'

const mockBack = jest.fn()
let mockParams: Record<string, string> = { advId: 'adv-1' }
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: mockBack }),
  useLocalSearchParams: () => mockParams,
}))
jest.mock('../../../../src/api/moderationApi', () => ({
  moderationApi: { get: jest.fn(), approve: jest.fn(), reject: jest.fn(), escalate: jest.fn() },
}))

import { moderationApi } from '../../../../src/api/moderationApi'
import ReviewDetailScreen from '../[advId]'

const mockGet = moderationApi.get as jest.Mock
const mockApprove = moderationApi.approve as jest.Mock
const mockReject = moderationApi.reject as jest.Mock
const mockEscalate = moderationApi.escalate as jest.Mock

const ADV = {
  advId: 'adv-1', tenantId: 't', merchantId: 'm', title: 'Sconto estate',
  description: 'Promo cashback 20%', imageUrl: null,
  moderationStatus: 'PENDING_HUMAN', claudeRiskLevel: 'HIGH',
  claudeConfidence: 88, claudeReasons: 'Possibile claim non verificabile',
  createdAt: '2026-05-01T00:00:00Z',
  salesReviewExpiresAt: null, tenantReviewExpiresAt: null,
}

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

let alertSpy: jest.SpyInstance
beforeEach(() => {
  jest.clearAllMocks()
  mockParams = { advId: 'adv-1' }
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  mockGet.mockResolvedValue(ADV)
  mockApprove.mockResolvedValue({ status: 'APPROVED' })
  mockReject.mockResolvedValue({ status: 'REJECTED' })
  mockEscalate.mockResolvedValue({ status: 'ESCALATED_TO_ADMIN' })
})
afterEach(() => alertSpy.mockRestore())

describe('ReviewDetailScreen', () => {
  it('renders the ADV title, description and AI verdict', async () => {
    render(<ReviewDetailScreen />, { wrapper: wrapper() })
    expect(await screen.findByText('Sconto estate')).toBeTruthy()
    expect(screen.getByText('Promo cashback 20%')).toBeTruthy()
    expect(screen.getByText('HIGH (88%)')).toBeTruthy()
    expect(screen.getByText('Possibile claim non verificabile')).toBeTruthy()
  })

  it('escalate requires only a reason (no TOTP) and calls the escalate API', async () => {
    render(<ReviewDetailScreen />, { wrapper: wrapper() })
    await screen.findByText('Sconto estate')
    fireEvent.press(screen.getByTestId('btn-escalate'))
    fireEvent.changeText(screen.getByTestId('reason-input'), 'serve revisione admin')
    fireEvent.press(screen.getByTestId('confirm-action'))
    await waitFor(() => expect(mockEscalate).toHaveBeenCalledWith('adv-1', 'serve revisione admin'))
    expect(mockBack).toHaveBeenCalled()
  })

  it('approve requires reason + a 6-digit TOTP code', async () => {
    render(<ReviewDetailScreen />, { wrapper: wrapper() })
    await screen.findByText('Sconto estate')
    fireEvent.press(screen.getByTestId('btn-approve'))
    fireEvent.changeText(screen.getByTestId('reason-input'), 'tutto ok')

    // Without a complete TOTP code the confirm button is disabled.
    const confirm = screen.getByTestId('confirm-action')
    expect(confirm.props.accessibilityState?.disabled).toBe(true)

    fireEvent.changeText(screen.getByTestId('totp-input'), '123456')
    fireEvent.press(screen.getByTestId('confirm-action'))
    await waitFor(() => expect(mockApprove).toHaveBeenCalledWith('adv-1', 'tutto ok', '123456'))
  })

  it('reject sends reason + TOTP through the reject API', async () => {
    render(<ReviewDetailScreen />, { wrapper: wrapper() })
    await screen.findByText('Sconto estate')
    fireEvent.press(screen.getByTestId('btn-reject'))
    fireEvent.changeText(screen.getByTestId('reason-input'), 'claim ingannevole')
    fireEvent.changeText(screen.getByTestId('totp-input'), '654321')
    fireEvent.press(screen.getByTestId('confirm-action'))
    await waitFor(() => expect(mockReject).toHaveBeenCalledWith('adv-1', 'claim ingannevole', '654321'))
  })

  it('surfaces a backend error through Alert', async () => {
    mockEscalate.mockRejectedValue(new Error('409 already escalated'))
    render(<ReviewDetailScreen />, { wrapper: wrapper() })
    await screen.findByText('Sconto estate')
    fireEvent.press(screen.getByTestId('btn-escalate'))
    fireEvent.changeText(screen.getByTestId('reason-input'), 'escala adesso')
    fireEvent.press(screen.getByTestId('confirm-action'))
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Errore', '409 already escalated'))
  })
})
