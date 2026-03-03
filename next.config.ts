// ---------------------------------------------------------------------------
// next.config.ts — Sprint 26A: wrapped with withSentryConfig
// ---------------------------------------------------------------------------

import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

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
