/**
 * FU-51: Behaviour tests for the sales-agent screen tree.
 *
 * Renders the real screens against mocked API clients + a fresh React Query
 * client per test, then asserts on what the user actually sees and the
 * navigation/logout side effects each screen triggers.
 */
import React, { type ReactNode } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlProvider } from 'react-intl'
import itIT from '../../src/i18n/messages/it-IT.json'

// ── expo-router ──────────────────────────────────────────────────────────────
const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))

// ── AuthContext ──────────────────────────────────────────────────────────────
const mockLogout = jest.fn()
let mockUser: Record<string, unknown> | null = {
  sub: 'agent-001', name: 'Mario Rossi', email: 'mario@terrio.it',
  roles: ['SALES_AGENT'], agentId: 'a-1',
}
jest.mock('../../src/auth/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser, accessToken: 'tok', isLoading: false,
    isAuthenticated: mockUser !== null,
    login: jest.fn(), loginWithToken: jest.fn(), logout: mockLogout,
  }),
}))

// ── API clients ──────────────────────────────────────────────────────────────
jest.mock('../../src/api/salesAgentApi', () => ({
  registrationRequestsApi: { list: jest.fn() },
  royaltiesApi: { list: jest.fn() },
  merchantsApi: { listByAgent: jest.fn() },
  salesAgentProfileApi: { getAssignments: jest.fn() },
}))
jest.mock('../../src/api/moderationApi', () => ({
  moderationApi: { list: jest.fn() },
}))

import { registrationRequestsApi, royaltiesApi, merchantsApi, salesAgentProfileApi } from '../../src/api/salesAgentApi'
import { moderationApi } from '../../src/api/moderationApi'

import ProfileScreen from '../(app)/profile'
import RoyaltiesScreen from '../(app)/royalties'
import MerchantsScreen from '../(app)/merchants'
import RequestsScreen from '../(app)/requests'
import DashboardScreen from '../(app)/index'
import ModerationQueueScreen from '../(app)/moderation/index'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <IntlProvider locale="it-IT" messages={itIT} defaultLocale="it-IT" onError={() => {}}>
        {children}
      </IntlProvider>
    </QueryClientProvider>
  )
}

const mockReg = registrationRequestsApi.list as jest.Mock
const mockRoy = royaltiesApi.list as jest.Mock
const mockMer = merchantsApi.listByAgent as jest.Mock
const mockAssign = salesAgentProfileApi.getAssignments as jest.Mock
const mockMod = moderationApi.list as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  mockUser = {
    sub: 'agent-001', name: 'Mario Rossi', email: 'mario@terrio.it',
    roles: ['SALES_AGENT'], agentId: 'a-1',
  }
  mockReg.mockResolvedValue([])
  mockRoy.mockResolvedValue([])
  mockMer.mockResolvedValue([])
  mockAssign.mockResolvedValue([])
  mockMod.mockResolvedValue([])
})

// ── ProfileScreen ────────────────────────────────────────────────────────────

describe('ProfileScreen', () => {
  it('renders the agent name + email from the auth context', () => {
    render(<ProfileScreen />)
    expect(screen.getByText('Mario Rossi')).toBeTruthy()
    expect(screen.getByText('Agente Commerciale')).toBeTruthy()
    // The email shows both in the header and in the account-info row.
    expect(screen.getAllByText('mario@terrio.it').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('SALES_AGENT')).toBeTruthy()
  })

  it('shows the uppercase avatar initial', () => {
    render(<ProfileScreen />)
    expect(screen.getByText('M')).toBeTruthy()
  })

  it('falls back to the sub initial and em-dash email when name/email are absent', () => {
    mockUser = { sub: 'agent-x', roles: ['SALES_AGENT'] }
    render(<ProfileScreen />)
    expect(screen.getByText('A')).toBeTruthy() // 'agent-x' → 'A'
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('invokes logout when the logout button is pressed', () => {
    render(<ProfileScreen />)
    fireEvent.press(screen.getByTestId('btn-logout'))
    expect(mockLogout).toHaveBeenCalledTimes(1)
  })
})

// ── RoyaltiesScreen ──────────────────────────────────────────────────────────

describe('RoyaltiesScreen', () => {
  it('renders an empty-state message when there are no royalties', async () => {
    render(<RoyaltiesScreen />, { wrapper: wrapper() })
    expect(await screen.findByText('Nessun calcolo disponibile')).toBeTruthy()
  })

  it('renders a royalty card with payout + status', async () => {
    mockRoy.mockResolvedValue([{
      id: 'r-1', agentId: 'a-1', periodMonth: '2026-04-01',
      totalMerchantVolumeCents: 1_000_00, royaltyCents: 50_00,
      fixedFeeCents: 10_00, totalPayoutCents: 60_00,
      royaltyPercentSnapshot: 5, status: 'PAID',
      paymentReference: 'PAY-9', paidAt: '2026-05-01', calculatedAt: '2026-05-01',
    }])
    render(<RoyaltiesScreen />, { wrapper: wrapper() })
    // The payout amount renders as "€" + "60.00" sibling text segments; a
    // regex matches the combined node text.
    expect(await screen.findByText(/60\.00/)).toBeTruthy()
    expect(screen.getByText('PAID')).toBeTruthy()
    expect(screen.getByText('Ref: PAY-9')).toBeTruthy()
  })
})

// ── MerchantsScreen ──────────────────────────────────────────────────────────

describe('MerchantsScreen', () => {
  it('renders an empty-state message when the agent has no merchants', async () => {
    render(<MerchantsScreen />, { wrapper: wrapper() })
    expect(await screen.findByText('Nessun merchant ancora associato')).toBeTruthy()
  })

  it('renders a merchant card and navigates to its detail on tap', async () => {
    mockMer.mockResolvedValue([{
      id: 'm-1', businessName: 'Bar Roma', tenantId: 't-1',
      status: 'ACTIVE', totalTransactions: 12, totalVolumeCents: 4_500_00,
    }])
    render(<MerchantsScreen />, { wrapper: wrapper() })
    const card = await screen.findByText('Bar Roma')
    // Volume renders as "Volume: €" + "4500.00" sibling text segments.
    expect(screen.getByText(/4500\.00/)).toBeTruthy()
    expect(screen.getByText('ACTIVE')).toBeTruthy()
    fireEvent.press(card)
    expect(mockPush).toHaveBeenCalledWith('/merchants/m-1')
  })
})

// ── RequestsScreen ───────────────────────────────────────────────────────────

describe('RequestsScreen', () => {
  it('defaults to the PENDING filter and queries with it', async () => {
    render(<RequestsScreen />, { wrapper: wrapper() })
    await waitFor(() => expect(mockReg).toHaveBeenCalledWith('PENDING'))
  })

  it('switching to the ALL filter queries with no status arg', async () => {
    render(<RequestsScreen />, { wrapper: wrapper() })
    await screen.findByText('Nessuna richiesta trovata')
    fireEvent.press(screen.getByText('ALL'))
    await waitFor(() => expect(mockReg).toHaveBeenCalledWith(undefined))
  })

  it('renders a request card and navigates to its detail on tap', async () => {
    mockReg.mockResolvedValue([{
      id: 'req-1', businessName: 'Pizzeria Sole', ownerName: 'Anna',
      email: 'anna@x.it', phone: '333', businessType: 'FOOD',
      status: 'PENDING', notes: null, createdAt: '2026-05-01T00:00:00Z',
    }])
    render(<RequestsScreen />, { wrapper: wrapper() })
    const card = await screen.findByText('Pizzeria Sole')
    fireEvent.press(card)
    expect(mockPush).toHaveBeenCalledWith('/request/req-1')
  })
})

// ── DashboardScreen ──────────────────────────────────────────────────────────

describe('DashboardScreen', () => {
  it('greets the agent by name and renders the overview tiles', async () => {
    render(<DashboardScreen />, { wrapper: wrapper() })
    expect(screen.getByText('Mario Rossi')).toBeTruthy()
    expect(screen.getByText('Richieste pending')).toBeTruthy()
    expect(screen.getByText('Moderazioni')).toBeTruthy()
    expect(screen.getByText('Ultimo payout')).toBeTruthy()
  })

  it('does NOT query registrations/moderation for a plain SALES_AGENT', async () => {
    render(<DashboardScreen />, { wrapper: wrapper() })
    await waitFor(() => expect(mockRoy).toHaveBeenCalled())
    expect(mockReg).not.toHaveBeenCalled()
    expect(mockMod).not.toHaveBeenCalled()
  })

  it('DOES query registrations + moderation for a TENANT_ADMIN', async () => {
    mockUser = { sub: 'admin', name: 'Admin', roles: ['TENANT_ADMIN'], agentId: 'a-1' }
    render(<DashboardScreen />, { wrapper: wrapper() })
    await waitFor(() => expect(mockReg).toHaveBeenCalledWith('PENDING'))
    await waitFor(() => expect(mockMod).toHaveBeenCalled())
  })

  it('renders the last payout amount when royalties exist', async () => {
    mockRoy.mockResolvedValue([{
      id: 'r-1', agentId: 'a-1', periodMonth: '2026-04-01',
      totalMerchantVolumeCents: 0, royaltyCents: 0, fixedFeeCents: 0,
      totalPayoutCents: 123_45, royaltyPercentSnapshot: 5,
      status: 'PAID', paymentReference: null, paidAt: null, calculatedAt: '2026-05-01',
    }])
    render(<DashboardScreen />, { wrapper: wrapper() })
    expect(await screen.findByText('EUR 123.45')).toBeTruthy()
  })

  it('navigates to /requests from the quick action', async () => {
    render(<DashboardScreen />, { wrapper: wrapper() })
    fireEvent.press(screen.getByText('Gestisci richieste merchant'))
    expect(mockPush).toHaveBeenCalledWith('/requests')
  })

  it('logs out from the header sign-out button', async () => {
    render(<DashboardScreen />, { wrapper: wrapper() })
    fireEvent.press(screen.getByTestId('btn-logout'))
    expect(mockLogout).toHaveBeenCalled()
  })

  it('shows the territory selector when the agent covers >1 territory', async () => {
    mockAssign.mockResolvedValue([
      { territoryId: 't-1', territoryName: 'Centro', tenantId: 'x' },
      { territoryId: 't-2', territoryName: 'Periferia', tenantId: 'x' },
    ])
    render(<DashboardScreen />, { wrapper: wrapper() })
    expect(await screen.findByText('Centro')).toBeTruthy()
    expect(screen.getByText('Periferia')).toBeTruthy()
  })
})

// ── ModerationQueueScreen ────────────────────────────────────────────────────

describe('ModerationQueueScreen', () => {
  it('renders the empty-state when no ADVs await moderation', async () => {
    render(<ModerationQueueScreen />, { wrapper: wrapper() })
    expect(await screen.findByText(/Nessuna ADV da moderare/)).toBeTruthy()
  })

  it('renders a review card with its risk badge and navigates on tap', async () => {
    mockMod.mockResolvedValue([{
      advId: 'adv-1', tenantId: 't', merchantId: 'm', title: 'Sconto estate',
      description: 'Promo cashback 20%', imageUrl: null,
      moderationStatus: 'PENDING_HUMAN', claudeRiskLevel: 'HIGH',
      claudeConfidence: 0.9, claudeReasons: null,
      createdAt: '2026-05-01T00:00:00Z',
      salesReviewExpiresAt: new Date(Date.now() + 7_200_000).toISOString(),
      tenantReviewExpiresAt: null,
    }])
    render(<ModerationQueueScreen />, { wrapper: wrapper() })
    const card = await screen.findByText('Sconto estate')
    expect(screen.getByText('HIGH')).toBeTruthy()
    fireEvent.press(screen.getByTestId('moderation-row'))
    expect(mockPush).toHaveBeenCalledWith('/moderation/adv-1')
  })

  it('shows the in-attesa count in the header', async () => {
    mockMod.mockResolvedValue([
      { advId: 'a', tenantId: 't', merchantId: 'm', title: 'A', description: 'd',
        imageUrl: null, moderationStatus: 'PENDING_HUMAN', claudeRiskLevel: null,
        claudeConfidence: null, claudeReasons: null, createdAt: '2026-05-01',
        salesReviewExpiresAt: null, tenantReviewExpiresAt: null },
    ])
    render(<ModerationQueueScreen />, { wrapper: wrapper() })
    expect(await screen.findByText('1 in attesa')).toBeTruthy()
  })
})
