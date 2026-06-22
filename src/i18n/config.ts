/**
 * v8.0.0-SNAPSHOT session 6 — i18n Phase 1 scaffold (ADR-0008).
 *
 * Provides:
 *   - Message catalogue loader per locale
 *   - Locale resolution: tenant branding → user pref → device locale
 *   - Fallback chain: current → en-US → literal default
 *
 * Not yet wired in App.tsx root — complete Phase 1 integration when
 * react-intl dep is installed and `ensureLocale()` is called at startup.
 */
import * as Localization from 'expo-localization'
import * as SecureStore from 'expo-secure-store'

// Statically imported message catalogues.
// Adding a locale = drop a new JSON file under ./messages/ + add import here.
import itIT from './messages/it-IT.json'
import enUS from './messages/en-US.json'
import esES from './messages/es-ES.json'
import frFR from './messages/fr-FR.json'
import deDE from './messages/de-DE.json'

export type Locale = 'it-IT' | 'en-US' | 'es-ES' | 'fr-FR' | 'de-DE'

export const DEFAULT_LOCALE: Locale = 'it-IT'
const SECURE_STORE_KEY = 'ble_user_locale_pref'

export const MESSAGES: Record<Locale, Record<string, string>> = {
  'it-IT': itIT,
  'en-US': enUS,
  'es-ES': esES,
  'fr-FR': frFR,
  'de-DE': deDE,
}

/**
 * Resolve the active locale in this priority:
 *   1. Tenant branding override (passed in from BrandingContext)
 *   2. User preference in SecureStore
 *   3. Device locale (expo-localization)
 *   4. DEFAULT_LOCALE hardcoded
 *
 * Unknown locale values fall back to DEFAULT_LOCALE silently.
 */
export async function resolveLocale(tenantLocaleHint?: string | null): Promise<Locale> {
  // 1. Tenant branding override wins
  if (tenantLocaleHint && isSupported(tenantLocaleHint)) {
    return tenantLocaleHint as Locale
  }

  // 2. User-saved preference
  try {
    const saved = await SecureStore.getItemAsync(SECURE_STORE_KEY)
    if (saved && isSupported(saved)) return saved as Locale
  } catch { /* best-effort */ }

  // 3. Device locale
  const deviceLocale = Localization.getLocales()[0]?.languageTag
  if (deviceLocale && isSupported(deviceLocale)) return deviceLocale as Locale

  // 4. Fallback
  return DEFAULT_LOCALE
}

export async function setUserLocale(locale: Locale): Promise<void> {
  await SecureStore.setItemAsync(SECURE_STORE_KEY, locale)
  _activeLocale = locale
}

// Cached active locale, populated by ensureLocale() at startup so synchronous
// callers (splash, error boundaries, the t() helper) can read it without an
// await. Defaults to DEFAULT_LOCALE until the first resolution completes.
let _activeLocale: Locale = DEFAULT_LOCALE

/**
 * Startup entry point — resolve the active locale once and cache it.
 * Call from the root layout before first paint (the IntlProvider does its
 * own async resolution, but ensureLocale() warms the cache for pre-mount
 * lookups and lets callers know which catalogue is live).
 */
export async function ensureLocale(tenantLocaleHint?: string | null): Promise<Locale> {
  _activeLocale = await resolveLocale(tenantLocaleHint)
  return _activeLocale
}

export function getActiveLocale(): Locale {
  return _activeLocale
}

export function isSupported(tag: string): boolean {
  return (Object.keys(MESSAGES) as Locale[]).includes(tag as Locale)
}

/**
 * Simple message lookup — for use BEFORE react-intl IntlProvider is mounted
 * (e.g. splash screen, error boundaries). Once IntlProvider is installed,
 * prefer <FormattedMessage id="..." /> everywhere else.
 */
export function t(locale: Locale, key: string, fallback?: string): string {
  const catalogue = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE]
  return catalogue[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? fallback ?? key
}
