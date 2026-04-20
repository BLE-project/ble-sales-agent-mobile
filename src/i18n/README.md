# sales-agent-mobile i18n

ADR-0008 Phase 1 (catalogues) + Phase 2 (IntlProvider wrap) — both done
in v8.0.0-SNAPSHOT.2 session 7. Remaining work is **literal replacement**:
grep for `<Text>` hardcoded strings and swap them for `<FormattedMessage>`
at the developer's convenience. The tree already has the intl context,
so no coordination is needed.

## Files

```
i18n/
├── config.ts           ← resolveLocale, setUserLocale, t() helper
├── I18nProvider.tsx    ← async locale resolution + <IntlProvider>
├── messages/
│   ├── it-IT.json      ← default (ships with app)
│   └── en-US.json      ← fallback chain target
└── README.md
```

## Usage

```tsx
import { FormattedMessage, useIntl } from 'react-intl'

// Visible text — prefer <FormattedMessage />
<Text><FormattedMessage id="auth.login.title" /></Text>

// Placeholders / Alert titles — need a plain string
const intl = useIntl()
<TextInput placeholder={intl.formatMessage({ id: 'auth.login.email' })} />

// Parametric
<FormattedMessage id="common.error.generic" values={{ error: errorMsg }} />
```

See `terrio-consumer-mobile/app/login.tsx` for the canonical migration
reference — the same pattern applies here, only the message IDs differ.

## Locale resolution order (config.ts)

1. Tenant branding `default_locale` (if present and supported)
2. User SecureStore preference `ble_user_locale_pref`
3. Device locale via `expo-localization`
4. Hardcoded `DEFAULT_LOCALE = 'it-IT'`

## Adding a locale (Phase 3 — `es-ES`, `pt-PT`, `fr-FR`)

1. Add file `messages/<tag>.json` with translated values
2. Add `import xxYY from './messages/xx-YY.json'` to `config.ts`
3. Add to `MESSAGES` record + update `Locale` union type
4. Done — no other code changes required

## Literal-replacement checklist (remaining)

- [ ] Identify top-5 screens with hardcoded user-facing text
- [ ] Replace each literal with `<FormattedMessage id="…" />`
- [ ] Extend `messages/*.json` with any new keys
- [ ] Run `npx formatjs extract 'src/**/*.{ts,tsx}'` if/when `@formatjs/cli` is added
- [ ] QA both `it-IT` and `en-US` locales on device (flip via
      `SecureStore.setItemAsync('ble_user_locale_pref', 'en-US')`)
