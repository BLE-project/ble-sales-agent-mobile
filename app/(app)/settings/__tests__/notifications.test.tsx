/**
 * FU-51 / FU-53: Behaviour tests for the sales-agent notification settings
 * screen — including the regression test for the Sonar S6443 reliability bug
 * (the failed-save rollback must restore the *previous* prefs, not re-apply
 * the stale state binding).
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { IntlProvider } from 'react-intl'
import itIT from '../../../../src/i18n/messages/it-IT.json'

jest.mock('../../../../src/api/notificationPreferencesApi', () => ({
  notificationPreferencesApi: { list: jest.fn(), update: jest.fn() },
}))

import { notificationPreferencesApi } from '../../../../src/api/notificationPreferencesApi'
import NotificationsSettingsScreen from '../notifications'

const mockList = notificationPreferencesApi.list as jest.Mock
const mockUpdate = notificationPreferencesApi.update as jest.Mock

const renderScreen = () =>
  render(
    <IntlProvider locale="it-IT" messages={itIT} defaultLocale="it-IT" onError={() => {}}>
      <NotificationsSettingsScreen />
    </IntlProvider>,
  )

let alertSpy: jest.SpyInstance
beforeEach(() => {
  jest.clearAllMocks()
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  mockList.mockResolvedValue([])
  mockUpdate.mockResolvedValue({ updated: 1, clamped_always_on: 0 })
})
afterEach(() => alertSpy.mockRestore())

describe('NotificationsSettingsScreen', () => {
  it('renders every sales-agent channel after loading', async () => {
    renderScreen()
    expect(await screen.findByTestId('toggle-merchant-support-request')).toBeTruthy()
    expect(screen.getByTestId('toggle-royalty-credit')).toBeTruthy()
    expect(screen.getByTestId('toggle-meeting-reminder')).toBeTruthy()
  })

  it('applies server-side overrides on top of channel defaults', async () => {
    mockList.mockResolvedValue([
      { appId: 'sales', channelId: 'royalty-credit', enabled: false, mandatory: null },
    ])
    renderScreen()
    const toggle = await screen.findByTestId('toggle-royalty-credit')
    // default for royalty-credit is true; the server row flips it to false
    expect(toggle.props.value).toBe(false)
  })

  it('falls back to defaults when the preferences fetch fails', async () => {
    mockList.mockRejectedValue(new Error('offline'))
    renderScreen()
    const toggle = await screen.findByTestId('toggle-kit-shipment')
    expect(toggle.props.value).toBe(true) // kit-shipment default
  })

  it('mandatory channels are rendered disabled', async () => {
    renderScreen()
    const mandatory = await screen.findByTestId('toggle-merchant-support-request')
    expect(mandatory.props.disabled).toBe(true)
  })

  it('persists an optional-channel toggle through the update API', async () => {
    renderScreen()
    const toggle = await screen.findByTestId('toggle-royalty-credit')
    fireEvent(toggle, 'valueChange', false)
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled())
    const sentPrefs = mockUpdate.mock.calls[0][0] as Array<{ channelId: string; enabled: boolean }>
    expect(sentPrefs.find(p => p.channelId === 'royalty-credit')?.enabled).toBe(false)
  })

  /**
   * FU-53 — Sonar S6443 regression test.
   *
   * The bug: the catch block reverted with `setPrefs(prefs)`, re-applying the
   * stale render-scope binding instead of the captured pre-update snapshot.
   * Fixed by capturing `previousPrefs` before the optimistic update. This
   * test fails on the old code (the toggle stays in the failed "off" state)
   * and passes once the rollback uses the snapshot.
   */
  it('rolls back to the previous value when the save fails (S6443 regression)', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('500 server error'))
    renderScreen()
    const toggle = await screen.findByTestId('toggle-royalty-credit')
    expect(toggle.props.value).toBe(true) // starts enabled (default)

    fireEvent(toggle, 'valueChange', false) // optimistic flip → off

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Errore salvataggio', '500 server error'))
    // After the failed save, the toggle must roll back to its prior ON state.
    await waitFor(() => {
      expect(screen.getByTestId('toggle-royalty-credit').props.value).toBe(true)
    })
  })
})
