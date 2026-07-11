/**
 * «La Piazza» — componenti condivisi sales-agent-mobile (redesign 2026-07).
 *
 * Port del kit tenant-mobile adattato ai token di questo repo:
 * - spazio/raggi: export `spacing`/`radius` di src/theme/defaults/tokens.ts;
 * - superfici/ink Piazza platform-level da TOKENS.colors.surface;
 * - font: famiglie preloadate in src/theme/fonts.ts (incl. JetBrains Mono);
 * - colori brand da TOKENS.colors.brand (DS-003: sales-agent è app
 *   platform-level, nessun BrandingContext runtime — vedi banner in tokens.ts).
 *
 * ponytail: un solo modulo per tutti i primitivi finché il set resta piccolo;
 * split per-file quando un componente cresce.
 */
import React from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Easing, AccessibilityInfo,
  type ViewStyle, type StyleProp,
} from 'react-native'
import { TOKENS, spacing, radius } from '../../theme/defaults/tokens'

const P = TOKENS.colors.surface
const B = TOKENS.colors.brand.primary

// Famiglie caricate in src/theme/fonts.ts (getAppFontMap).
const F = {
  display: 'BricolageGrotesque_700Bold',
  body: 'HankenGrotesk_400Regular',
  bodySemiBold: 'HankenGrotesk_600SemiBold',
  mono: 'JetBrainsMono_400Regular',
} as const

/** Tinta soft brand + alpha (no hex soft hardcodato). */
export function brandSoft(primary: string = B): string {
  return `${primary}1F` // ~12% alpha; regge #RRGGBB runtime
}

// ── Card ────────────────────────────────────────────────────────────────────
export function Card({ children, onPress, testID, style }: {
  children: React.ReactNode
  onPress?: () => void
  testID?: string
  style?: StyleProp<ViewStyle>
}) {
  const body = <View style={[s.card, style]}>{children}</View>
  if (!onPress) return body
  return (
    <TouchableOpacity onPress={onPress} testID={testID} accessibilityRole="button">
      {body}
    </TouchableOpacity>
  )
}

// ── Tag (enum/stati — voce mono di sistema) ────────────────────────────────
// `tone` (bg/fg espliciti, es. semantic *Soft per stati) vince su `variant`.
// Maiuscolo via style textTransform (non .toUpperCase()): jest/Maestro
// asseriscono i children raw (es. label filtri "PENDING" già raw).
export function Tag({ label, variant = 'neutral', tone, testID }: {
  label: string
  variant?: 'neutral' | 'brand'
  tone?: { bg: string; fg: string }
  testID?: string
}) {
  const v = tone
    ? { backgroundColor: tone.bg, color: tone.fg }
    : variant === 'brand'
      ? { backgroundColor: brandSoft(B), color: B }
      : { backgroundColor: P.sunk, color: P.inkSoft }
  return (
    <View style={[s.tag, { backgroundColor: v.backgroundColor }]}>
      <Text style={[s.tagText, { color: v.color }]} testID={testID}>{label}</Text>
    </View>
  )
}

// ── ScreenHeader (canvas terra: titolo display + slot destro) ───────────────
export function ScreenHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={s.hdr}>
      <Text style={[s.hdrTitle, { color: B }]} numberOfLines={1}>{title}</Text>
      {right}
    </View>
  )
}

// ── BeaconRipple (signature Piazza — statico: niente motion non richiesta) ─
export function BeaconRipple() {
  const ring = (inset: number, opacity: number) => (
    <View style={[s.ring, { borderColor: B, opacity, top: inset, bottom: inset, left: inset, right: inset }]} />
  )
  return (
    <View style={s.ripple} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {ring(0, 0.18)}{ring(12, 0.34)}{ring(24, 0.6)}
    </View>
  )
}

// ── BeaconRadar (login — pattern fleet 2026-07-10: ping animato) ────────────
// 3 anelli in espansione sfalsati di 1,2s + dot centrale. Niente sweep conico
// in RN (richiederebbe una dipendenza gradient).
// Reduced motion → fallback statico (BeaconRipple).
export function BeaconRadar({ size = 280 }: { size?: number }) {
  const [reduceMotion, setReduceMotion] = React.useState(false)
  const rings = React.useRef([0, 1, 2].map(() => new Animated.Value(0))).current

  React.useEffect(() => {
    let mounted = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then(v => { if (mounted) setReduceMotion(!!v) })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  React.useEffect(() => {
    if (reduceMotion) return
    const timers: ReturnType<typeof setTimeout>[] = []
    const loops = rings.map(v =>
      Animated.loop(Animated.timing(v, {
        toValue: 1, duration: 3600, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      })),
    )
    loops.forEach((loop, i) => { timers.push(setTimeout(() => loop.start(), i * 1200)) })
    return () => { timers.forEach(clearTimeout); loops.forEach(l => l.stop()) }
  }, [reduceMotion, rings])

  if (reduceMotion) return <BeaconRipple />

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      testID="beacon-radar"
    >
      {rings.map((v, i) => (
        <Animated.View
          key={i}
          style={[s.radarRing, {
            borderColor: B,
            opacity: v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.34, 0.1, 0] }),
            transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.12, 1] }) }],
          }]}
        />
      ))}
      <View style={[s.radarDot, { backgroundColor: B }]} />
    </View>
  )
}

// ── Field (form: label mono + slot + help/error) ───────────────────────────
export function Field({ label, required, help, error, errorTestID, children }: {
  label: string
  required?: boolean
  help?: string
  error?: string | null
  errorTestID?: string
  children: React.ReactNode
}) {
  return (
    <View style={s.fieldBox}>
      <Text style={s.fieldLabel}>
        {label.toUpperCase()}
        {required ? <Text style={{ color: B }}> *</Text> : null}
      </Text>
      {children}
      {help ? <Text style={s.fieldHelp}>{help}</Text> : null}
      {error ? <Text style={s.fieldError} testID={errorTestID}>{error}</Text> : null}
    </View>
  )
}

// ── Stati ───────────────────────────────────────────────────────────────────
export function EmptyState({ title, body, ripple = true, titleTestID }: {
  title: string; body?: string; ripple?: boolean; titleTestID?: string
}) {
  return (
    <View style={s.stateBox}>
      {ripple && <BeaconRipple />}
      <Text style={s.stateTitle} testID={titleTestID}>{title}</Text>
      {body ? <Text style={s.stateBody}>{body}</Text> : null}
    </View>
  )
}

export function ErrorState({ title, body, retryLabel, onRetry, titleTestID }: {
  title: string; body?: string; retryLabel?: string; onRetry?: () => void; titleTestID?: string
}) {
  return (
    <View style={s.stateBox}>
      <Text style={[s.stateTitle, s.stateTitleError]} testID={titleTestID}>{title}</Text>
      {body ? <Text style={s.stateBody}>{body}</Text> : null}
      {onRetry ? (
        <TouchableOpacity style={s.btnSecondary} onPress={onRetry} accessibilityRole="button">
          <Text style={s.btnSecondaryText}>{retryLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

// ── Metric (KPI/dashboard: valore mono tabular + label) ────────────────────
export function Metric({ label, value, testID }: {
  label: string
  value: number | string
  testID?: string
}) {
  const isNull = value === '—'
  return (
    <View style={s.metricCard}>
      <Text style={[s.metricValue, { color: isNull ? TOKENS.colors.neutral.gray500 : B }]} testID={testID}>
        {value}
      </Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  )
}

/** Skeleton riga-card per liste in loading. */
export function SkeletonCard() {
  return (
    <View style={s.card} testID="skeleton-card">
      <View style={[s.skel, { width: '60%' }]} />
      <View style={[s.skel, { width: '35%', marginTop: spacing.s2 }]} />
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.line,
    borderRadius: radius.xl,
    padding: spacing.s4,
  },
  tag: {
    borderRadius: radius.s,
    paddingHorizontal: spacing.s2,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  tagText: {
    fontFamily: F.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  hdr: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.s5,
    paddingTop: spacing.s3,
    paddingBottom: spacing.s1,
  },
  hdrTitle: {
    fontFamily: F.display,
    fontSize: 24,
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  ripple: { width: 72, height: 72, marginBottom: spacing.s2 },
  ring: { position: 'absolute', borderWidth: 1.5, borderRadius: radius.full },
  radarRing: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderWidth: 1.5, borderRadius: radius.full },
  radarDot: { position: 'absolute', left: '50%', top: '50%', width: 8, height: 8, marginLeft: -4, marginTop: -4, borderRadius: 4, opacity: 0.55 },
  fieldBox: { marginTop: spacing.s3 },
  fieldLabel: { fontFamily: F.mono, fontSize: 10, letterSpacing: 0.8, color: P.inkSoft, marginBottom: spacing.s1, marginLeft: 2 },
  fieldHelp: { fontFamily: F.body, fontSize: 12, lineHeight: 16, color: P.inkSoft, marginTop: 5, marginLeft: 2 },
  fieldError: { fontFamily: F.body, fontSize: 12, color: TOKENS.colors.semantic.danger, marginTop: 5, marginLeft: 2 },
  stateBox: { alignItems: 'center', padding: spacing.s6, gap: spacing.s2 },
  stateTitle: {
    fontFamily: F.display,
    fontSize: 18,
    color: P.ink,
    textAlign: 'center',
  },
  stateTitleError: { color: TOKENS.colors.semantic.danger },
  stateBody: {
    fontFamily: F.body,
    fontSize: 14,
    color: P.inkSoft,
    textAlign: 'center',
    lineHeight: 20,
  },
  btnSecondary: {
    marginTop: spacing.s2,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.line,
    borderRadius: radius.m,
    paddingVertical: spacing.s3,
    paddingHorizontal: spacing.s5,
    minHeight: 44,
    justifyContent: 'center',
  },
  btnSecondaryText: {
    fontFamily: F.bodySemiBold,
    fontSize: 14,
    color: P.ink,
  },
  skel: { height: 14, borderRadius: radius.m, backgroundColor: P.sunk },
  metricCard: {
    flexGrow: 1, minWidth: 140,
    backgroundColor: P.surface, borderWidth: 1, borderColor: P.line,
    borderRadius: radius.xl, padding: spacing.s4,
  },
  metricValue: {
    fontFamily: F.mono, fontSize: 22,
    fontVariant: ['tabular-nums'],
  },
  metricLabel: { fontFamily: F.body, fontSize: 12, color: P.inkSoft, marginTop: spacing.s1 },
})
