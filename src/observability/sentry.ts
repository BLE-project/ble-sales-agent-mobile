/**
 * ADR-020 — GlitchTip (Sentry-compatible) error tracking init for React Native.
 *
 * Hardened PII scrub mirroring web SPA template (hardening #1 + #2 from
 * security review 2026-05-27):
 *   - Value-shape regex (email/JWT/IBAN/CF/UUID/PAN) recursive
 *   - Query-param denylist lowercased + expanded (PKCE/OAuth)
 *   - URL path segments + userinfo scrubbing
 *   - Recursive breadcrumb scrub, ui.input/touch dropped by default
 *   - URL-bearing headers scrubbed through scrubUrl
 *
 * Status: Proposed (pending Privacy→Legal sign-off — see
 * terrio-platform-docs/06_operations/legal-review-log.md entry 2026-05-27).
 *
 * Activation: gated on EXPO_PUBLIC_SENTRY_DSN env var
 * (unset = init() no-op, no SDK boot, no events emitted, no PII risk).
 */

import * as Sentry from '@sentry/react-native';

const PII_KEYS = new Set([
  'email', 'phone', 'cf', 'codicefiscale', 'codice_fiscale',
  'iban', 'pan', 'cardnumber', 'card_number',
  'consumerid', 'consumer_id', 'merchantid', 'merchant_id',
  'staffid', 'staff_id', 'userid', 'user_id',
  'password', 'token', 'jwt', 'apikey', 'api_key',
  'authorization', 'cookie', 'set-cookie',
]);

const PII_QUERY_PARAMS = new Set([
  'token', 'key', 'apikey', 'api_key', 'jwt', 'access_token',
  'refresh_token', 'authorization', 'code', 'id_token',
  'client_secret', 'assertion', 'password', 'signature', 'sig',
]);

const URL_BEARING_HEADERS = new Set([
  'referer', 'origin', 'host', 'x-forwarded-host',
  'x-original-url', 'location',
]);

const RE_EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const RE_JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const RE_IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g;
const RE_CF = /\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/g;
const RE_PAN = /\b\d{13,19}\b/g;
const RE_UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const RE_LONG_NUMERIC = /\b\d{8,}\b/g;

function redactValueShapes(s: string): string {
  if (typeof s !== 'string') return s;
  return s
    .replace(RE_JWT, '[REDACTED:jwt]')
    .replace(RE_EMAIL, '[REDACTED:email]')
    .replace(RE_IBAN, '[REDACTED:iban]')
    .replace(RE_CF, '[REDACTED:cf]')
    .replace(RE_UUID, '[REDACTED:uuid]')
    .replace(RE_PAN, '[REDACTED:pan]');
}

function scrubUrl(url: string | undefined): string | undefined {
  if (!url || typeof url !== 'string') return url;
  try {
    const u = new URL(url, 'http://placeholder.local');
    u.username = '';
    u.password = '';
    u.searchParams.forEach((_, key) => {
      if (PII_QUERY_PARAMS.has(key.toLowerCase())) {
        u.searchParams.set(key, '[REDACTED]');
      }
    });
    u.pathname = u.pathname
      .split('/')
      .map((seg) => {
        if (!seg) return seg;
        return seg
          .replace(RE_UUID, '[uuid]')
          .replace(RE_EMAIL, '[email]')
          .replace(RE_CF, '[cf]')
          .replace(RE_IBAN, '[iban]')
          .replace(RE_LONG_NUMERIC, '[id]');
      })
      .join('/');
    return u.toString().replace('http://placeholder.local', '');
  } catch {
    return url;
  }
}

function scrubHeaders(headers: unknown): unknown {
  if (!headers || typeof headers !== 'object') return headers;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
    const klow = k.toLowerCase();
    if (PII_KEYS.has(klow)) {
      out[k] = '[REDACTED]';
    } else if (URL_BEARING_HEADERS.has(klow) && typeof v === 'string') {
      out[k] = scrubUrl(v);
    } else {
      out[k] = scrubPii(v);
    }
  }
  return out;
}

function scrubPii(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactValueShapes(value);
  if (Array.isArray(value)) return value.map(scrubPii);
  if (typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (PII_KEYS.has(k.toLowerCase())) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = scrubPii(v);
    }
  }
  return out;
}

function scrubBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
  if (breadcrumb.category === 'ui.input' || breadcrumb.category === 'touch') return null;
  if (breadcrumb.category === 'ui.click') {
    const target = (breadcrumb.message ?? '').toLowerCase();
    if (target.includes('password') || target.includes('token') || target.includes('[data-sensitive]')) {
      return null;
    }
  }
  if (breadcrumb.message) breadcrumb.message = redactValueShapes(breadcrumb.message);
  if (breadcrumb.data) {
    breadcrumb.data = scrubPii(breadcrumb.data) as typeof breadcrumb.data;
    if (breadcrumb.data && typeof breadcrumb.data === 'object') {
      if ('url' in breadcrumb.data && typeof breadcrumb.data.url === 'string') {
        breadcrumb.data.url = scrubUrl(breadcrumb.data.url);
      }
      const http = (breadcrumb.data as Record<string, unknown>).http;
      if (http && typeof http === 'object') {
        const httpObj = http as Record<string, unknown>;
        if (typeof httpObj.url === 'string') httpObj.url = scrubUrl(httpObj.url);
        if (typeof httpObj.target === 'string') httpObj.target = scrubUrl(httpObj.target);
      }
    }
  }
  return breadcrumb;
}

export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    enableNative: true,
    enableAutoSessionTracking: false,
    sendDefaultPii: false,
    tracesSampleRate: 0.05,
    attachStacktrace: true,
    beforeSend(event) {
      if (event.transaction) event.transaction = scrubUrl(event.transaction);
      if (event.message) event.message = redactValueShapes(event.message);
      if (event.request?.url) event.request.url = scrubUrl(event.request.url);
      if (event.request?.headers) event.request.headers = scrubHeaders(event.request.headers) as Record<string, string>;
      if (event.request?.cookies) event.request.cookies = '[REDACTED]' as unknown as typeof event.request.cookies;
      if (event.request?.query_string) event.request.query_string = '[REDACTED]';
      if (event.request?.data) event.request.data = scrubPii(event.request.data);
      if (event.extra) event.extra = scrubPii(event.extra) as Record<string, unknown>;
      if (event.contexts) event.contexts = scrubPii(event.contexts) as typeof event.contexts;
      if (event.user) event.user = undefined;
      if (event.exception?.values) {
        for (const exc of event.exception.values) {
          if (exc.value) exc.value = redactValueShapes(exc.value);
          if (exc.stacktrace?.frames) {
            for (const frame of exc.stacktrace.frames) {
              if (frame.vars) frame.vars = scrubPii(frame.vars) as Record<string, unknown>;
            }
          }
        }
      }
      if (Array.isArray(event.breadcrumbs)) {
        event.breadcrumbs = event.breadcrumbs
          .map((b) => scrubBreadcrumb(b))
          .filter((b): b is Sentry.Breadcrumb => b !== null);
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      return scrubBreadcrumb(breadcrumb);
    },
  });
}

export const SentryErrorBoundary = Sentry.ErrorBoundary;

export function setTenantTag(tenantId: string | null): void {
  if (!process.env.EXPO_PUBLIC_SENTRY_DSN) return;
  Sentry.setTag('tenant_id', tenantId ?? 'anonymous');
}
