/**
 * FU-51: Coverage for the small leaf modules — the biometric public-API
 * barrel, the design-token + typography constants, the Holy-IOT hardware
 * constants, and the I18nProvider wrapper.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'

// ── biometric barrel ─────────────────────────────────────────────────────────

describe('biometric public-API barrel', () => {
  it('re-exports the gate + lockout + persistence surface', () => {
    const api = require('../auth/biometric')
    for (const name of [
      'setBiometricGetter', 'getBiometricEnrolled',
      'recordSuccess', 'recordFailedAttempt', 'isLocked', 'remainingSeconds',
      'DEFAULT_LOCKOUT_CONFIG',
      'readEnrollment', 'writeEnrollment', 'wipeEnrollment',
      'hashPin', 'verifyPin', 'storageKeyFor', 'DEFAULT_ENROLLMENT',
    ]) {
      expect(api[name]).toBeDefined()
    }
  })

  it('does NOT leak internal-only helpers', () => {
    const api = require('../auth/biometric')
    expect(api.migrateRaw).toBeUndefined()
    expect(api._resetBiometricGate).toBeUndefined()
  })
})

// ── design tokens ────────────────────────────────────────────────────────────

describe('theme/defaults/tokens', () => {
  it('exposes spacing / radius / shadow scales', () => {
    const { spacing, radius, shadows } = require('../theme/defaults/tokens')
    expect(spacing.s4).toBe(16)
    expect(radius.full).toBe(999)
    expect(shadows.md.elevation).toBe(3)
  })

  it('exposes the white-label brand-token fallback structure (I4)', () => {
    const { TOKENS } = require('../theme/defaults/tokens')
    // The hex values are runtime-overridden by BrandingContext per I4 — we
    // only assert the *shape* here, never hardcode brand hex in a test.
    expect(TOKENS.colors.brand).toHaveProperty('primary')
    expect(TOKENS.colors.brand).toHaveProperty('accent')
    expect(TOKENS.colors.neutral).toHaveProperty('white')
    expect(TOKENS.colors.semantic).toHaveProperty('danger')
  })
})

// ── typography ───────────────────────────────────────────────────────────────

describe('theme/typography', () => {
  it('exposes a consistent type scale', () => {
    const { typography } = require('../theme/typography')
    expect(typography.displayXl.fontSize).toBe(32)
    expect(typography.bodyM.fontSize).toBe(14)
    expect(typography.tag.textTransform).toBe('uppercase')
  })
})

// ── Holy-IOT constants ───────────────────────────────────────────────────────

describe('constants/holyIot', () => {
  it('exposes the factory password + label', () => {
    const { DEFAULT_HOLYIOT_PASSWORD, DEFAULT_HOLYIOT_PASSWORD_LABEL } = require('../constants/holyIot')
    expect(typeof DEFAULT_HOLYIOT_PASSWORD).toBe('string')
    expect(DEFAULT_HOLYIOT_PASSWORD.length).toBeGreaterThan(0)
    expect(DEFAULT_HOLYIOT_PASSWORD_LABEL).toContain('Holy-IOT')
  })
})

// ── I18nProvider ─────────────────────────────────────────────────────────────

jest.mock('../i18n/config', () => {
  const actual = jest.requireActual('../i18n/config')
  return { ...actual, resolveLocale: jest.fn() }
})
import { resolveLocale } from '../i18n/config'
import { I18nProvider } from '../i18n/I18nProvider'

const mockResolveLocale = resolveLocale as jest.Mock

describe('I18nProvider', () => {
  beforeEach(() => mockResolveLocale.mockReset())

  it('renders nothing until the locale resolves', () => {
    mockResolveLocale.mockReturnValue(new Promise(() => {}))
    const { toJSON } = render(
      <I18nProvider><Text>child</Text></I18nProvider>,
    )
    expect(toJSON()).toBeNull()
  })

  it('renders children inside an IntlProvider once the locale resolves', async () => {
    mockResolveLocale.mockResolvedValue('it-IT')
    render(<I18nProvider><Text>ciao</Text></I18nProvider>)
    expect(await screen.findByText('ciao')).toBeTruthy()
  })

  it('falls back to the default locale when resolution rejects', async () => {
    mockResolveLocale.mockRejectedValue(new Error('boom'))
    render(<I18nProvider><Text>fallback-child</Text></I18nProvider>)
    expect(await screen.findByText('fallback-child')).toBeTruthy()
  })

  it('passes the tenant locale hint through to resolveLocale', async () => {
    mockResolveLocale.mockResolvedValue('en-US')
    render(<I18nProvider tenantLocaleHint="en-US"><Text>x</Text></I18nProvider>)
    await waitFor(() => expect(mockResolveLocale).toHaveBeenCalledWith('en-US'))
  })
})
