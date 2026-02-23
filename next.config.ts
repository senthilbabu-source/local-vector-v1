// ---------------------------------------------------------------------------
// next.config.ts — Sprint 26A: wrapped with withSentryConfig
// ---------------------------------------------------------------------------

import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  /* config options here */
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
