/**
 * FU-51: Unit tests for the i18n config module (ADR-0008 Phase 1).
 *
 * Covers the 4-tier locale resolution priority, the SecureStore-backed
 * user preference, isSupported(), and the t() fallback chain.
 */
const mockGetItem = jest.fn()
const mockSetItem = jest.fn()
jest.mock('expo-secure-store', () => ({
  getItemAsync: (...a: unknown[]) => mockGetItem(...a),
  setItemAsync: (...a: unknown[]) => mockSetItem(...a),
}))

const mockGetLocales = jest.fn()
jest.mock('expo-localization', () => ({
  getLocales: () => mockGetLocales(),
}))

import {
  resolveLocale,
  setUserLocale,
  isSupported,
  t,
  DEFAULT_LOCALE,
  MESSAGES,
} from './config'

beforeEach(() => {
  mockGetItem.mockReset().mockResolvedValue(null)
  mockSetItem.mockReset().mockResolvedValue(undefined)
  mockGetLocales.mockReset().mockReturnValue([{ languageTag: 'en-US' }])
})

describe('isSupported', () => {
  it('accepts the five shipped locales', () => {
    expect(isSupported('it-IT')).toBe(true)
    expect(isSupported('en-US')).toBe(true)
    expect(isSupported('es-ES')).toBe(true)
    expect(isSupported('fr-FR')).toBe(true)
    expect(isSupported('de-DE')).toBe(true)
  })
  it('rejects an unknown locale tag', () => {
    expect(isSupported('ja-JP')).toBe(false)
    expect(isSupported('')).toBe(false)
  })
})

describe('resolveLocale priority', () => {
  it('1. a supported tenant hint wins over everything else', async () => {
    mockGetItem.mockResolvedValue('en-US')
    mockGetLocales.mockReturnValue([{ languageTag: 'en-US' }])
    await expect(resolveLocale('it-IT')).resolves.toBe('it-IT')
  })

  it('1b. an unsupported tenant hint is ignored', async () => {
    mockGetItem.mockResolvedValue('en-US')
    await expect(resolveLocale('ja-JP')).resolves.toBe('en-US')
  })

  it('2. user SecureStore preference wins when no tenant hint', async () => {
    mockGetItem.mockResolvedValue('en-US')
    mockGetLocales.mockReturnValue([{ languageTag: 'it-IT' }])
    await expect(resolveLocale()).resolves.toBe('en-US')
  })

  it('2b. an unsupported stored preference is skipped', async () => {
    mockGetItem.mockResolvedValue('zz-ZZ')
    mockGetLocales.mockReturnValue([{ languageTag: 'it-IT' }])
    await expect(resolveLocale()).resolves.toBe('it-IT')
  })

  it('2c. a SecureStore read failure does not break resolution', async () => {
    mockGetItem.mockRejectedValue(new Error('keychain locked'))
    mockGetLocales.mockReturnValue([{ languageTag: 'en-US' }])
    await expect(resolveLocale()).resolves.toBe('en-US')
  })

  it('3. device locale wins when no hint + no preference', async () => {
    mockGetItem.mockResolvedValue(null)
    mockGetLocales.mockReturnValue([{ languageTag: 'en-US' }])
    await expect(resolveLocale()).resolves.toBe('en-US')
  })

  it('4. falls back to DEFAULT_LOCALE when nothing matches', async () => {
    mockGetItem.mockResolvedValue(null)
    mockGetLocales.mockReturnValue([{ languageTag: 'ja-JP' }])
    await expect(resolveLocale()).resolves.toBe(DEFAULT_LOCALE)
  })

  it('4b. handles an empty device-locale list', async () => {
    mockGetItem.mockResolvedValue(null)
    mockGetLocales.mockReturnValue([])
    await expect(resolveLocale()).resolves.toBe(DEFAULT_LOCALE)
  })
})

describe('setUserLocale', () => {
  it('persists the locale under the dedicated SecureStore key', async () => {
    await setUserLocale('en-US')
    expect(mockSetItem).toHaveBeenCalledWith('ble_user_locale_pref', 'en-US')
  })
})

describe('t (pre-IntlProvider lookup)', () => {
  it('returns the message from the requested locale catalogue', () => {
    const key = Object.keys(MESSAGES['it-IT'])[0]
    expect(t('it-IT', key)).toBe(MESSAGES['it-IT'][key])
  })

  it('falls back to the default-locale catalogue for an unknown locale', () => {
    const key = Object.keys(MESSAGES[DEFAULT_LOCALE])[0]
    // @ts-expect-error — deliberately passing an unsupported locale
    expect(t('xx-XX', key)).toBe(MESSAGES[DEFAULT_LOCALE][key])
  })

  it('uses the provided fallback string for an unknown key', () => {
    expect(t('en-US', 'no.such.key', 'Fallback text')).toBe('Fallback text')
  })

  it('echoes the key itself when neither catalogue nor fallback has it', () => {
    expect(t('en-US', 'totally.missing.key')).toBe('totally.missing.key')
  })
})
