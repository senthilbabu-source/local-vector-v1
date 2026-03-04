// ---------------------------------------------------------------------------
// next.config.ts — Sprint 26A: wrapped with withSentryConfig
// P6-FIX-25: Security headers + CSP
// ---------------------------------------------------------------------------

import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import { buildCSP, getCSPHeaderName } from './lib/security/csp';
import { assertEnvironment } from './lib/env-guard';

// P7-FIX-32: Block production builds with missing env vars or test Stripe keys
// Only enforce on Vercel (CI) — local builds use placeholder env vars
if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
  assertEnvironment();
}

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
    // Menu uploads + AI parsing payloads can exceed the 1 MB default
    serverActions: {
      bodySizeLimit: '10mb',
    },
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

// Sentry config wrapper disabled during build due to known Next.js 16 bug:
// https://github.com/vercel/next.js/issues/86178
// Re-enable when Next.js patches /_global-error prerender.
const sentryEnabled = process.env.SENTRY_AUTH_TOKEN && process.env.NODE_ENV === 'production';

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      silent: true,
      org:     process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      telemetry: false,
      authToken: process.env.SENTRY_AUTH_TOKEN,
    })
  : nextConfig;
