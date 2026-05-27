/**
 * ADR-020 Sprint ε.3 — PII scrub regression test suite.
 *
 * Verifies the dormant sentry scaffold's PII filters work as documented.
 * These tests do NOT require Sentry init nor a DSN — they exercise the
 * scrub helpers directly on synthetic payloads.
 *
 * Synthetic data only — no real PII used. Patterns match security review
 * #1/#2 mitigations.
 */


import {
  redactValueShapes,
  scrubUrl,
  scrubHeaders,
  scrubPii,
  scrubBreadcrumb,
} from '../sentry';

describe('ADR-020 — redactValueShapes (value-shape regex)', () => {
  it('redacts email addresses', () => {
    expect(redactValueShapes('user mario.rossi@example.com failed')).toBe(
      'user [REDACTED:email] failed',
    );
  });

  it('redacts JWT tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    expect(redactValueShapes(`auth: ${jwt}`)).toBe('auth: [REDACTED:jwt]');
  });

  it('redacts Italian codice fiscale', () => {
    expect(redactValueShapes('CF: RSSMRA85L01H501Z record')).toBe(
      'CF: [REDACTED:cf] record',
    );
  });

  it('redacts IBAN', () => {
    expect(redactValueShapes('iban IT60X0542811101000000123456')).toBe(
      'iban [REDACTED:iban]',
    );
  });

  it('redacts UUID v4 lowercase', () => {
    expect(redactValueShapes('tenant 550e8400-e29b-41d4-a716-446655440000 ok')).toBe(
      'tenant [REDACTED:uuid] ok',
    );
  });

  it('redacts UUID uppercase', () => {
    expect(redactValueShapes('UUID 550E8400-E29B-41D4-A716-446655440000')).toBe(
      'UUID [REDACTED:uuid]',
    );
  });

  it('redacts PAN (13-19 digit numeric)', () => {
    expect(redactValueShapes('card 4242424242424242 visa')).toBe(
      'card [REDACTED:pan] visa',
    );
  });

  it('preserves short numerics (not PAN)', () => {
    expect(redactValueShapes('count 42 items 1234567')).toBe(
      'count 42 items 1234567',
    );
  });

  it('handles multiple PII in one string', () => {
    const input = 'user mario.rossi@x.it cf RSSMRA85L01H501Z uuid 550e8400-e29b-41d4-a716-446655440000';
    const out = redactValueShapes(input);
    expect(out).toContain('[REDACTED:email]');
    expect(out).toContain('[REDACTED:cf]');
    expect(out).toContain('[REDACTED:uuid]');
  });

  it('returns non-string inputs unchanged', () => {
    expect(redactValueShapes(42 as unknown as string)).toBe(42);
    expect(redactValueShapes(null as unknown as string)).toBe(null);
  });
});

describe('ADR-020 — scrubUrl (path + query + userinfo)', () => {
  it('redacts sensitive query params (case-insensitive)', () => {
    expect(scrubUrl('https://api.terrio.it/v1/x?token=abc123&foo=bar')).toBe(
      'https://api.terrio.it/v1/x?token=%5BREDACTED%5D&foo=bar',
    );
  });

  it('redacts OAuth/PKCE-specific keys', () => {
    const url = 'https://api/x?code=auth123&id_token=eyJ.foo.bar&client_secret=hidden';
    const out = scrubUrl(url) ?? '';
    expect(out).toContain('code=%5BREDACTED%5D');
    expect(out).toContain('id_token=%5BREDACTED%5D');
    expect(out).toContain('client_secret=%5BREDACTED%5D');
  });

  it('strips userinfo from URL', () => {
    expect(scrubUrl('https://user:pass@api.terrio.it/v1/me')).toBe(
      'https://api.terrio.it/v1/me',
    );
  });

  it('redacts UUID path segments', () => {
    const out = scrubUrl('https://api/tenant/550e8400-e29b-41d4-a716-446655440000/info');
    expect(out).toContain('/tenant/[uuid]/info');
  });

  it('redacts email-shaped path segments', () => {
    const out = scrubUrl('https://api/user/mario.rossi@example.com/details');
    expect(out).toContain('/[email]/');
  });

  it('redacts long numeric path IDs', () => {
    const out = scrubUrl('https://api/order/12345678901234/status');
    expect(out).toContain('/order/[id]/status');
  });

  it('handles malformed URL without throwing', () => {
    // Fallback base `http://placeholder.local` makes any string parseable;
    // the function returns the normalised relative form. Asserts no throw.
    expect(() => scrubUrl('not a url')).not.toThrow();
    expect(typeof scrubUrl('not a url')).toBe('string');
  });

  it('returns undefined for empty input', () => {
    expect(scrubUrl(undefined)).toBe(undefined);
  });
});

describe('ADR-020 — scrubHeaders (URL-bearing + PII keys)', () => {
  it('redacts PII keys', () => {
    expect(scrubHeaders({ authorization: 'Bearer abc', other: 'ok' })).toEqual({
      authorization: '[REDACTED]',
      other: 'ok',
    });
  });

  it('routes URL-bearing headers through scrubUrl', () => {
    const out = scrubHeaders({
      referer: 'https://terrio.it/page?token=secret',
      origin: 'https://app.terrio.it',
    }) as Record<string, string>;
    expect(out.referer).toContain('token=%5BREDACTED%5D');
    // URL normalises by appending trailing slash to root paths
    expect(out.origin).toContain('https://app.terrio.it');
  });

  it('redacts case-insensitive header names', () => {
    expect(scrubHeaders({ Authorization: 'x', COOKIE: 'y' })).toEqual({
      Authorization: '[REDACTED]',
      COOKIE: '[REDACTED]',
    });
  });

  it('returns non-object unchanged', () => {
    expect(scrubHeaders(null)).toBe(null);
    expect(scrubHeaders('str')).toBe('str');
  });
});

describe('ADR-020 — scrubPii (recursive)', () => {
  it('redacts PII keys in objects', () => {
    expect(scrubPii({ email: 'x@y.it', name: 'Mario' })).toEqual({
      email: '[REDACTED]',
      name: 'Mario',
    });
  });

  it('recurses into nested objects', () => {
    expect(scrubPii({ user: { password: 'p', name: 'X' } })).toEqual({
      user: { password: '[REDACTED]', name: 'X' },
    });
  });

  it('recurses into arrays', () => {
    expect(scrubPii([{ token: 'a' }, { token: 'b' }])).toEqual([
      { token: '[REDACTED]' },
      { token: '[REDACTED]' },
    ]);
  });

  it('applies value-shape regex on strings (defense in depth)', () => {
    expect(scrubPii({ note: 'CF: RSSMRA85L01H501Z' })).toEqual({
      note: 'CF: [REDACTED:cf]',
    });
  });

  it('handles null/undefined gracefully', () => {
    expect(scrubPii(null)).toBe(null);
    expect(scrubPii(undefined)).toBe(undefined);
  });

  it('handles primitives unchanged (numbers/booleans)', () => {
    expect(scrubPii(42)).toBe(42);
    expect(scrubPii(true)).toBe(true);
  });
});

describe('ADR-020 — scrubBreadcrumb (UI input drop + recursive scrub)', () => {
  it('drops ui.input category entirely', () => {
    expect(scrubBreadcrumb({ category: 'ui.input', message: 'typed' })).toBe(null);
  });

  it('drops ui.click on password/token elements', () => {
    expect(
      scrubBreadcrumb({ category: 'ui.click', message: 'tap password field' }),
    ).toBe(null);
  });

  it('drops ui.click on [data-sensitive] elements', () => {
    expect(
      scrubBreadcrumb({ category: 'ui.click', message: 'input [data-sensitive]' }),
    ).toBe(null);
  });

  it('redacts breadcrumb message value shapes', () => {
    const out = scrubBreadcrumb({
      category: 'navigation',
      message: 'visit mario.rossi@example.com',
    });
    expect(out?.message).toBe('visit [REDACTED:email]');
  });

  it('scrubs URL in breadcrumb.data.url', () => {
    const out = scrubBreadcrumb({
      category: 'navigation',
      data: { url: 'https://api/x?token=secret' },
    });
    const url = (out?.data as { url?: string } | undefined)?.url ?? '';
    expect(url).toContain('token=%5BREDACTED%5D');
  });

  it('scrubs URL in breadcrumb.data.http.url + target', () => {
    const out = scrubBreadcrumb({
      category: 'http',
      data: {
        http: {
          url: 'https://api/v1/x?token=t',
          target: 'https://api/y?jwt=eyJ.foo.bar',
        },
      },
    });
    const http = (out?.data as { http?: { url?: string; target?: string } } | undefined)
      ?.http;
    expect(http?.url ?? '').toContain('token=%5BREDACTED%5D');
    expect(http?.target ?? '').toContain('jwt=%5BREDACTED%5D');
  });

  it('preserves non-ui breadcrumbs', () => {
    const out = scrubBreadcrumb({ category: 'navigation', message: 'route change' });
    expect(out).not.toBeNull();
    expect(out?.category).toBe('navigation');
  });
});
