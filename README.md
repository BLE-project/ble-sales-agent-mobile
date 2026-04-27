# ble-sales-agent-mobile

Field-sales mobile app for Terrio sales agents — merchant onboarding,
contract collection, in-territory beacon provisioning workflows.

## Tech stack

- Expo SDK + React Native
- TypeScript
- React Navigation
- EAS Build for iOS / Android binaries
- @expo-google-fonts (Inter, JetBrains Mono, Space Grotesk)
- Jest for unit tests

## Local dev

```bash
npm install
npm start                # expo dev server (Metro bundler)
npm run android          # build + run on Android device/emulator
npm run ios              # build + run on iOS simulator (macOS only)
npm run web              # web preview (debug only)
npm run lint             # eslint .
npm run typecheck        # tsc --noEmit
npm test                 # jest --passWithNoTests
```

## EAS profiles

```bash
npx eas build --profile development --platform android
npx eas build --profile preview --platform ios
npx eas build --profile production --platform all
```

Profiles configured in `eas.json`. EAS credentials managed via
`expo login` against the BLE-project Expo organisation.

## Dependencies

- **Spec**: `terrio-platform-spec`
- **Gateway BFF**: `terrio-api-gateway-bff`
- **Architecture**: ADR-000 Foundations in `terrio-platform-docs/01_architecture/`
- **BLE consent**: ADR-004 BLE SDK consent in `terrio-platform-docs/01_architecture/`

## CI

| Workflow | Purpose |
|----------|---------|
| CI | typecheck + lint + jest |
| CodeQL | security static analysis (JS/TS) |
| Trivy filesystem scan | filesystem CVE scan |
| Terrio invariants (Semgrep) | Terrio I3 (BLE consent) + I4-I8 |

## Brand tokens

NEVER hardcode brand hex. Always read from the `useBranding()`
context. Invariant `I4` blocks hardcoded brand hex at CI time.
