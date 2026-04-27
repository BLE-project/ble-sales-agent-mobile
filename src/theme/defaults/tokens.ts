export const spacing = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s8: 32, s10: 40, s12: 48 };
export const radius  = { xs: 3, s: 6, m: 8, l: 12, xl: 14, xxl: 16, xxxl: 24, full: 999 };
export const shadows = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.10, shadowRadius: 20, elevation: 5 },
};

// DS-003: brand color tokens — fallback defaults for all brand hex values.
//
// IMPORTANT — F14/F18/F19 fix: these 4 hex values are RUNTIME-OVERRIDDEN by
// BrandingContext + ThemeProvider via the /v1/brand-config tenant API. They
// are the safe defaults applied when:
//   (a) the tenant has no custom brand_config row in core-registry, OR
//   (b) the runtime fetch fails (offline / backend down) — defensive fallback.
//
// The Semgrep rule terrio-i4-hardcoded-brand-hex therefore fires false-positive
// on these 4 lines. The actual white-label invariant I4 is enforced by
// ThemeProvider reading BrandingContext at component-render time, NOT by
// statically substituting these constants. Runtime override is unit-tested in
// BrandingContext.test.tsx and ThemeProvider.test.tsx.
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
  },
};
