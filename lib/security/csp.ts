// ---------------------------------------------------------------------------
// lib/security/csp.ts — Content Security Policy builder (P6-FIX-25)
//
// Builds a CSP directive string for use in next.config.ts headers().
// In development: uses Content-Security-Policy-Report-Only (violations
// logged, not blocked) so local development is not disrupted.
// ---------------------------------------------------------------------------

const CSP_DIRECTIVES: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'", // Next.js injects inline scripts for hydration
    'https://js.stripe.com',
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Tailwind + CSS-in-JS patterns
    'https://fonts.googleapis.com',
  ],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'img-src': ["'self'", 'data:', 'blob:', 'https://*.supabase.co'],
  'connect-src': [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co', // Supabase Realtime WebSocket
    'https://*.sentry.io', // Sentry error/performance reporting
    'https://api.stripe.com',
  ],
  'frame-src': ['https://js.stripe.com'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'self'"],
  'upgrade-insecure-requests': [],
};

/**
 * Builds a Content-Security-Policy header value from the directive map.
 * Directives with empty value arrays render as bare directives (e.g.
 * `upgrade-insecure-requests`).
 */
export function buildCSP(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([key, values]) => (values.length ? `${key} ${values.join(' ')}` : key))
    .join('; ');
}

/**
 * Returns the appropriate CSP header name based on environment.
 * In development: Report-Only (logs violations without blocking).
 * In production: enforcing CSP.
 */
export function getCSPHeaderName(): string {
  return process.env.NODE_ENV === 'production'
    ? 'Content-Security-Policy'
    : 'Content-Security-Policy-Report-Only';
}
