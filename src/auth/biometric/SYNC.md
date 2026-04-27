# Sync notice — biometric/PIN shared module

> 🛑 **DO NOT EDIT IN MIRROR REPOS.**
> This directory is auto-mirrored from `terrio-consumer-mobile` (canonical).

## Canonical source

The 7 files in this directory are owned by `terrio-consumer-mobile`:

- `biometricGate.ts` — I3-pattern sync getter for opt-in state
- `lockoutMachine.ts` — PIN failure escalation state machine (pure TS)
- `enrollmentStorage.ts` — SecureStore + PIN hashing
- `index.ts` — public API barrel
- `biometricGate.test.ts`, `lockoutMachine.test.ts`, `enrollmentStorage.test.ts`

The other 4 mobile repos (`terrio-merchant-mobile`, `terrio-tenant-mobile`,
`terrio-territory-mobile`, `terrio-sales-agent-mobile`) carry verbatim
copies via `scripts/sync-biometric-shared.sh` (in the canonical repo).

## How to update

1. Make changes in `terrio-consumer-mobile/src/auth/biometric/`.
2. Land them via PR (CI must pass).
3. After merge to `main`, run from canonical:
   ```bash
   ./scripts/sync-biometric-shared.sh
   ```
4. Each mirror gets its own follow-up PR with the regenerated files.
   The script prints which mirrors changed.

## What is NOT mirrored

The following per-app integration files stay app-specific because they
hardcode `APP_SLUG` + `REFRESH_KEY` and depend on app-specific auth
context shape:

- `src/auth/useBiometricAuth.tsx`
- `src/auth/PinEntryScreen.tsx`
- `src/auth/BiometricEnrollModal.tsx`
- `src/auth/BiometricGate.tsx`
- `app/_layout.tsx` wiring
- `app.json` permissions

## Why this pattern

Per the Pragmatic-Balance architecture (Phase 4 architect C, see
`feature-specs/biometric-auth.md` in `terrio-platform-docs`):

- The lockout state machine + storage schema are security-critical
  and **must** be a single source of truth — silent drift would mean
  inconsistent wipe-after-10 behavior across apps, which is a real
  security risk.
- Per-app UI + integration is a per-app concern (different theming,
  different auth contexts, different role checks) and lives per-app.
- A bash sync-script + this notice is enough enforcement until the
  next major auth feature, at which point a workspace-package
  migration becomes worth the tooling cost.
