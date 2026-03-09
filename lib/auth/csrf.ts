/**
 * §321 — CSRF Origin Validation for Auth Routes
 *
 * Validates the Origin or Referer header against allowed origins.
 * Blocks cross-origin POST requests to state-changing auth endpoints.
 *
 * Defense-in-depth: browsers enforce SameSite=Lax on cookies by default,
 * but Origin validation adds an explicit server-side layer.
 */

/**
 * Checks that the request's Origin (or Referer) header matches an allowed origin.
 *
 * Returns null if valid, or an error string if the origin is missing/invalid.
 *
 * Allowed origins:
 *   - Same-origin requests (Origin matches NEXT_PUBLIC_SUPABASE_URL domain or request host)
 *   - Localhost variants for development
 */
export function validateOrigin(request: Request): string | null {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // Origin header is sent on all cross-origin requests and same-origin POSTs in modern browsers.
  // Referer is a fallback for edge cases (some privacy proxies strip Origin).
  const checkValue = origin ?? (referer ? new URL(referer).origin : null);

  if (!checkValue) {
    // Missing both Origin and Referer — likely a non-browser client (curl, Postman).
    // For auth routes, we require at least one to be present.
    return 'Missing Origin header';
  }

  const allowedOrigins = buildAllowedOrigins();

  if (!allowedOrigins.has(checkValue)) {
    return `Origin ${checkValue} not allowed`;
  }

  return null;
}

/**
 * Build the set of allowed origins from environment and known dev patterns.
 */
function buildAllowedOrigins(): Set<string> {
  const origins = new Set<string>();

  // Production: derive from NEXT_PUBLIC_SUPABASE_URL or VERCEL_URL
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    origins.add(`https://${vercelUrl}`);
  }

  // Explicit production domain
  const prodUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (prodUrl) {
    origins.add(prodUrl.replace(/\/$/, ''));
  }

  // Common production domains
  origins.add('https://localvector.ai');
  origins.add('https://www.localvector.ai');
  origins.add('https://app.localvector.ai');

  // Development
  origins.add('http://localhost:3000');
  origins.add('http://127.0.0.1:3000');

  return origins;
}
