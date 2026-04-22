export const spacing = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s8: 32, s10: 40, s12: 48 };
export const radius  = { xs: 3, s: 6, m: 8, l: 12, xl: 14, xxl: 16, xxxl: 24, full: 999 };
export const shadows = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.10, shadowRadius: 20, elevation: 5 },
};

// DS-003: brand color tokens — single source of truth for all brand hex values.
// These match design-tokens.json brand section (Terrio defaults / white-label fallbacks).
export const TOKENS = {
  colors: {
    brand: {
      primary:     '#5E30C9',
      primaryDeep: '#3A1A7E',
      primarySoft: '#EEE6FF',
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
