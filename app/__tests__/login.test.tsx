/**
 * FU-51: Behaviour tests for the sales-agent login screen.
 *
 * The screen renders react-intl <FormattedMessage> children, so the test
 * wraps it in a real IntlProvider with the it-IT catalogue.
 */
import React, { type ReactNode } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { IntlProvider } from 'react-intl'
import { Alert } from 'react-native'
import itIT from '../../src/i18n/messages/it-IT.json'

const mockReplace = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}))

const mockLogin = jest.fn()
jest.mock('../../src/auth/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}))

import LoginScreen from '../login'

function wrapper({ children }: { children: ReactNode }) {
  return (
    <IntlProvider locale="it-IT" messages={itIT} defaultLocale="it-IT" onError={() => {}}>
      {children}
    </IntlProvider>
  )
}

let alertSpy: jest.SpyInstance
beforeEach(() => {
  jest.clearAllMocks()
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
})
afterEach(() => alertSpy.mockRestore())

describe('LoginScreen', () => {
  it('renders the username + password inputs and submit button', () => {
    render(<LoginScreen />, { wrapper })
    expect(screen.getByTestId('username-input')).toBeTruthy()
    expect(screen.getByTestId('password-input')).toBeTruthy()
    expect(screen.getByTestId('login-btn')).toBeTruthy()
  })

  it('blocks submission and alerts when credentials are blank', async () => {
    render(<LoginScreen />, { wrapper })
    fireEvent.press(screen.getByTestId('login-btn'))
    await waitFor(() => expect(alertSpy).toHaveBeenCalled())
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('logs in with the trimmed username and navigates into the app', async () => {
    mockLogin.mockResolvedValue(undefined)
    render(<LoginScreen />, { wrapper })
    fireEvent.changeText(screen.getByTestId('username-input'), '  mario  ')
    fireEvent.changeText(screen.getByTestId('password-input'), 'secret')
    fireEvent.press(screen.getByTestId('login-btn'))
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('mario', 'secret'))
    expect(mockReplace).toHaveBeenCalledWith('/(app)')
  })

  it('shows the backend error message when login is rejected', async () => {
    mockLogin.mockRejectedValue(new Error('Credenziali non valide'))
    render(<LoginScreen />, { wrapper })
    fireEvent.changeText(screen.getByTestId('username-input'), 'mario')
    fireEvent.changeText(screen.getByTestId('password-input'), 'wrong')
    fireEvent.press(screen.getByTestId('login-btn'))
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(expect.any(String), 'Credenziali non valide'))
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
