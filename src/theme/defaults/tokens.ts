export const spacing = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s8: 32, s10: 40, s12: 48 };
export const radius  = { xs: 3, s: 6, m: 8, l: 12, xl: 14, xxl: 16, xxxl: 24, full: 999 };
export const shadows = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.10, shadowRadius: 20, elevation: 5 },
};

// DS-003: brand color tokens.
//
// STATIC platform-level values — NOT runtime-overridden. sales-agent is an
// internal ops app, not white-label per-tenant: there is no BrandingContext
// or ThemeProvider in this repo. These 4 hex values are the permanent Terrio
// brand colors, applied as-is at build time.
//
// The Semgrep rule terrio-i4-hardcoded-brand-hex fires on these 4 lines by
// design (I4 white-label invariant applies to the tenant-facing apps —
// consumer/merchant/tenant-mobile — not to this platform-level app).
export const TOKENS = {
  colors: {
    brand: {
      // nosemgrep: terrio-i4-hardcoded-brand-hex — fallback default, see banner above
      primary:     '#5E30C9',
      // nosemgrep: terrio-i4-hardcoded-brand-hex — fallback default, see banner above
      primaryDeep: '#3A1A7E',
      // nosemgrep: terrio-i4-hardcoded-brand-hex — fallback default, see banner above
      primarySoft: '#EEE6FF',
      // nosemgrep: terrio-i4-hardcoded-brand-hex — fallback default, see banner above
      accent:      '#FFD83D',
    },
    neutral: {
      black:     '#0B0B12',
      ink:       '#0F172A',
      gray900:   '#111827',
      gray700:   '#374151',
      gray500:   '#6B7280',
      gray300:   '#D1D5DB',
      gray200:   '#E5E7EB',
      gray100:   '#F3F4F6',
      gray50:    '#F9FAFB',
      white:     '#FFFFFF',
    },
    semantic: {
      danger:  '#EF4444',
      success: '#10B981',
      warning: '#F59E0B',
      info:    '#3B82F6',
    },
    // Semantici soft — tint di sfondo per banner/badge. v2 2026-07-09.
    // Fonte: terrio-platform-docs/design_handoff/tokens/piazza-tokens.ts.
    semanticSoft: {
      dangerSoft:  '#FEE2E2',
      successSoft: '#DCFCE7',
      warningSoft: '#FEF3C7',
      infoSoft:    '#DBEAFE',
    },
    // «La Piazza» superfici / inchiostro — platform-level (sales-agent non è
    // white-label per-tenant, nessun BrandingContext runtime). Fonte:
    // terrio-platform-docs/design_handoff/tokens/piazza-tokens.ts.
    surface: {
      base:      '#FBFAF7',
      surface:   '#FFFFFF',
      sunk:      '#F3F0FA',
      ink:       '#241645',
      inkSoft:   '#5B5170',
      line:      '#E7E1F2',
      rewardInk: '#6B5200',
      // Testo/icone su fill brand (bottoni pieni, header colorati). v2 2026-07-09.
      onBrand:   '#FFFFFF',
    },
  },
};
