/**
 * v8.0.0-SNAPSHOT.2 session 7 — i18n Phase 2 wire-up (ADR-0008).
 *
 * Wraps children in <IntlProvider> with the resolved locale + catalogue.
 * Resolution happens asynchronously (SecureStore + expo-localization) so
 * we render a splash-compatible null while we wait. The parent layout is
 * expected to keep the native splash visible — see app/_layout.tsx.
 *
 * The tenant branding hint is optional; when present, BrandingProvider
 * should pass it in so the tenant's preferred locale wins over the
 * device default.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { IntlProvider } from 'react-intl'

import { DEFAULT_LOCALE, MESSAGES, resolveLocale, type Locale } from './config'

interface Props {
  tenantLocaleHint?: string | null
  children: ReactNode
}

export function I18nProvider({ tenantLocaleHint, children }: Props) {
  const [locale, setLocale] = useState<Locale | null>(null)

  useEffect(() => {
    let cancelled = false
    resolveLocale(tenantLocaleHint)
      .then(resolved => { if (!cancelled) setLocale(resolved) })
      .catch(() => { if (!cancelled) setLocale(DEFAULT_LOCALE) })
    return () => { cancelled = true }
  }, [tenantLocaleHint])

  // Defer rendering children until we resolved a locale. The native
  // splash screen stays up thanks to preventAutoHideAsync in the root
  // layout — no white flash.
  if (!locale) return null

  return (
    <IntlProvider
      locale={locale}
      defaultLocale={DEFAULT_LOCALE}
      messages={MESSAGES[locale]}
      // Missing keys: fall back to defaultMessage, emit no console warn
      // in production (react-intl warns aggressively by default which
      // floods the Metro console with every extraction cycle).
      onError={() => { /* silence MissingTranslationError spam */ }}
    >
      {children}
    </IntlProvider>
  )
}
