// ---------------------------------------------------------------------------
// next.config.ts — Sprint 26A: wrapped with withSentryConfig
// P6-FIX-25: Security headers + CSP
// ---------------------------------------------------------------------------

import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import { buildCSP, getCSPHeaderName } from './lib/security/csp';

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  { key: getCSPHeaderName(), value: buildCSP() },
];

const nextConfig: NextConfig = {
  // P5-FIX-24: Performance optimizations
  experimental: {
    // Tree-shake barrel exports for smaller bundles
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-popover',
      '@radix-ui/react-dialog',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-tabs',
      '@radix-ui/react-select',
      'recharts',
      'date-fns',
    ],
  },
  // Compress responses (enabled by default in production on Vercel)
  compress: true,
  // Strict mode for catching accidental side effects
  reactStrictMode: true,
  // Disable x-powered-by header (minor security + bandwidth)
  poweredByHeader: false,
  // P6-FIX-25: Security headers on every response
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default withSentryConfig(nextConfig, {
  // Silences the Sentry CLI output during build.
  silent: true,

  // Sentry org/project for source map uploads (set in Vercel env).
  org:     process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Disable Sentry telemetry during CI/CD.
  telemetry: false,

  // Only upload source maps when SENTRY_AUTH_TOKEN is present.
  // This prevents build failures in local dev / preview when the token is absent.
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
