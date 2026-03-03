// ---------------------------------------------------------------------------
// src/__tests__/unit/p5-fix-24/performance-config.test.ts — P5-FIX-24
//
// Tests validating performance optimizations:
// - next.config.ts settings
// - Loading state files
// - Sentry browser tracing
// - Font optimization
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT_DIR = path.resolve(__dirname, '../../../..');

function readFile(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(ROOT_DIR, relativePath));
}

// ---------------------------------------------------------------------------
// next.config.ts optimizations
// ---------------------------------------------------------------------------

describe('next.config.ts performance settings', () => {
  const config = readFile('next.config.ts');

  it('has optimizePackageImports for lucide-react', () => {
    expect(config).toContain('lucide-react');
    expect(config).toContain('optimizePackageImports');
  });

  it('has optimizePackageImports for recharts', () => {
    expect(config).toContain('recharts');
  });

  it('has optimizePackageImports for date-fns', () => {
    expect(config).toContain('date-fns');
  });

  it('has compress enabled', () => {
    expect(config).toContain('compress: true');
  });

  it('has reactStrictMode enabled', () => {
    expect(config).toContain('reactStrictMode: true');
  });

  it('disables x-powered-by header', () => {
    expect(config).toContain('poweredByHeader: false');
  });
});

// ---------------------------------------------------------------------------
// Sentry browser tracing
// ---------------------------------------------------------------------------

describe('Sentry browser tracing (Core Web Vitals)', () => {
  const clientConfig = readFile('instrumentation-client.ts');

  it('includes browserTracingIntegration', () => {
    expect(clientConfig).toContain('browserTracingIntegration');
  });

  it('has tracesSampleRate configured', () => {
    expect(clientConfig).toContain('tracesSampleRate');
  });

  it('has replay integration', () => {
    expect(clientConfig).toContain('replayIntegration');
  });

  it('captures router transitions', () => {
    expect(clientConfig).toContain('onRouterTransitionStart');
  });
});

// ---------------------------------------------------------------------------
// Font optimization
// ---------------------------------------------------------------------------

describe('font optimization', () => {
  const layout = readFile('app/layout.tsx');

  it('uses font-display swap', () => {
    expect(layout).toContain("display: 'swap'");
  });

  it('uses CSS variable fonts', () => {
    expect(layout).toContain('--font-outfit');
  });
});

// ---------------------------------------------------------------------------
// Loading states
// ---------------------------------------------------------------------------

describe('loading states', () => {
  it('dashboard loading.tsx exists', () => {
    expect(fileExists('app/dashboard/loading.tsx')).toBe(true);
  });

  it('dashboard loading uses animate-pulse', () => {
    const loading = readFile('app/dashboard/loading.tsx');
    expect(loading).toContain('animate-pulse');
  });

  it('dashboard loading has data-testid', () => {
    const loading = readFile('app/dashboard/loading.tsx');
    expect(loading).toContain('data-testid="dashboard-loading"');
  });
});

// ---------------------------------------------------------------------------
// ISR / Caching patterns
// ---------------------------------------------------------------------------

describe('caching patterns', () => {
  it('public menu page uses ISR revalidation', () => {
    // app/m/[slug]/page.tsx should have revalidate export
    if (fileExists('app/m/[slug]/page.tsx')) {
      const menuPage = readFile('app/m/[slug]/page.tsx');
      expect(menuPage).toContain('revalidate');
    }
  });

  it('revalidation route exists for on-demand cache purge', () => {
    expect(fileExists('app/api/revalidate/route.ts')).toBe(true);
  });
});
