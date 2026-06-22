/**
 * Task #86 — i18n FULL 5 languages.
 *
 * Guards catalogue parity: every shipped locale must define exactly the same
 * set of message keys as the it-IT source of truth, with no empty values and
 * no ICU placeholder drift. A divergence here means a screen will silently
 * fall back to the default-locale string (or the raw key) at runtime.
 */
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn() }))
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'it-IT' }] }))

import { MESSAGES, DEFAULT_LOCALE, type Locale } from './config'

const SOURCE: Locale = 'it-IT'
const sourceKeys = Object.keys(MESSAGES[SOURCE]).sort()
const locales = Object.keys(MESSAGES) as Locale[]

/** Extract the sorted set of `{placeholder}` tokens from an ICU message string. */
function placeholders(msg: string): string[] {
  return [...msg.matchAll(/\{(\w+)/g)].map(m => m[1]).sort()
}

describe('i18n catalogue parity (5 languages)', () => {
  it('ships exactly five locales with it-IT as default', () => {
    expect(locales.slice().sort()).toEqual(['de-DE', 'en-US', 'es-ES', 'fr-FR', 'it-IT'])
    expect(DEFAULT_LOCALE).toBe('it-IT')
  })

  for (const locale of locales) {
    describe(locale, () => {
      const keys = Object.keys(MESSAGES[locale]).sort()

      it('has the same key set as the it-IT source', () => {
        expect(keys).toEqual(sourceKeys)
      })

      it('has no empty values', () => {
        const empty = keys.filter(k => !MESSAGES[locale][k]?.trim())
        expect(empty).toEqual([])
      })

      it('preserves the ICU placeholders of every message', () => {
        const drift = sourceKeys.filter(
          k => placeholders(MESSAGES[SOURCE][k]).join(',') !== placeholders(MESSAGES[locale][k] ?? '').join(','),
        )
        expect(drift).toEqual([])
      })
    })
  }
})
