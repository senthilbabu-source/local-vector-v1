# Claude Code Prompt — Safe Package Installation: schema-dts, JSZip, @react-email/components

## Context

You are working on the **LocalVector.ai** codebase at `local-vector-v1/`. This is a Next.js 16.1.6 app with React 19.2.3, Tailwind CSS 4.2.0, Supabase, Stripe, Vercel AI SDK, and Resend. Read `docs/AI_RULES.md` before making any changes.

## Task

Install three zero-risk packages that have NO CSS, Tailwind, or UI dependencies. These packages do not touch the existing build pipeline, design system, or React component tree. They are additive only.

## Step 1 — Install packages

Run these commands from the project root:

```bash
npm install schema-dts
npm install jszip
npm install -D @types/jszip
npm install @react-email/components
```

After installation, verify `package.json` has all three in the correct section:
- `schema-dts` → dependencies
- `jszip` → dependencies
- `@types/jszip` → devDependencies
- `@react-email/components` → dependencies

## Step 2 — Verify build integrity

Run the following in order. Stop and report if any step fails:

```bash
npm run build
npm run test
```

If the build passes and all existing tests pass, the installation is safe. Do NOT proceed to Step 3 if either fails — report the error instead.

## Step 3 — Create scaffold files for future use

These files establish the patterns for how each package will be used. They contain no business logic yet — just typed exports and structure.

### 3a — Schema.org typed helpers

Create `lib/schema/types.ts`:

```typescript
// ---------------------------------------------------------------------------
// lib/schema/types.ts — Schema.org Type Helpers via schema-dts
//
// Provides typed Schema.org interfaces for the One-Click AI-Ready Package
// generator (Killer Feature #3). Uses schema-dts for compile-time safety
// when generating JSON-LD output.
//
// Existing code (lib/utils/generateMenuJsonLd.ts) returns untyped `object`.
// New package generation code should use these typed builders instead.
// Do NOT refactor generateMenuJsonLd.ts — it works and is tested.
//
// AI_RULES §2: Types derived from Schema.org vocabulary via schema-dts.
// ---------------------------------------------------------------------------

import type {
  Restaurant,
  FAQPage,
  LocalBusiness,
  WithContext,
  MenuSection,
  MenuItem,
  Event,
} from 'schema-dts';

// Re-export for convenience across the codebase
export type {
  Restaurant,
  FAQPage,
  LocalBusiness,
  WithContext,
  MenuSection,
  MenuItem,
  Event,
};

/**
 * Typed wrapper for generating a JSON-LD script tag string.
 * Use in new AI-Ready Package features. Existing menu JSON-LD
 * generation in lib/utils/generateMenuJsonLd.ts is unaffected.
 */
export function toJsonLdScript<T>(data: WithContext<T>): string {
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
}
```

### 3b — ZIP bundle utility

Create `lib/utils/zipBundle.ts`:

```typescript
// ---------------------------------------------------------------------------
// lib/utils/zipBundle.ts — ZIP Bundle Generator
//
// Wraps JSZip for the One-Click AI-Ready Package download feature
// (Killer Feature #3). Generates a downloadable ZIP containing:
//   - JSON-LD schema files
//   - llms.txt
//   - robots.txt additions
//   - FAQ content blocks
//   - Entity statement
//
// This file is a scaffold — the actual bundle logic will be built
// when Feature #3 development begins.
//
// AI_RULES §5: No API calls on load. ZIP generation is user-triggered only.
// ---------------------------------------------------------------------------

import JSZip from 'jszip';

export interface BundleFile {
  /** File path inside the ZIP (e.g. "schema/restaurant.json") */
  path: string;
  /** File content as a string */
  content: string;
}

/**
 * Creates a ZIP buffer from an array of files.
 * Returns a Node.js Buffer suitable for streaming as a response body.
 *
 * Usage (in a future API route):
 * ```ts
 * const buffer = await createZipBundle(files);
 * return new Response(buffer, {
 *   headers: {
 *     'Content-Type': 'application/zip',
 *     'Content-Disposition': 'attachment; filename="ai-ready-package.zip"',
 *   },
 * });
 * ```
 */
export async function createZipBundle(files: BundleFile[]): Promise<Buffer> {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.path, file.content);
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return buffer;
}
```

### 3c — Email template directory and first template

Create directory `emails/` at the project root.

Create `emails/WeeklyDigest.tsx`:

```tsx
// ---------------------------------------------------------------------------
// emails/WeeklyDigest.tsx — Weekly Digest Email Template
//
// React Email component for the unified weekly digest (Killer Feature #7).
// Replaces the raw HTML strings in lib/email.ts sendSOVReport().
//
// This is a scaffold — the full template will be built when Feature #7
// development begins. For now it demonstrates the pattern and verifies
// the @react-email/components package works.
//
// Preview locally: npx email dev (from project root)
// Resend integration: pass as `react:` prop instead of `html:` in send().
// ---------------------------------------------------------------------------

import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Preview,
} from '@react-email/components';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface WeeklyDigestProps {
  businessName: string;
  shareOfVoice: number;
  queriesRun: number;
  queriesCited: number;
  firstMoverCount: number;
  dashboardUrl: string;
}

// ---------------------------------------------------------------------------
// Default props for preview
// ---------------------------------------------------------------------------

const defaultProps: WeeklyDigestProps = {
  businessName: 'Charcoal N Chill',
  shareOfVoice: 33,
  queriesRun: 12,
  queriesCited: 4,
  firstMoverCount: 2,
  dashboardUrl: 'https://app.localvector.ai/dashboard',
};

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export default function WeeklyDigest({
  businessName = defaultProps.businessName,
  shareOfVoice = defaultProps.shareOfVoice,
  queriesRun = defaultProps.queriesRun,
  queriesCited = defaultProps.queriesCited,
  firstMoverCount = defaultProps.firstMoverCount,
  dashboardUrl = defaultProps.dashboardUrl,
}: WeeklyDigestProps) {
  const sovColor =
    shareOfVoice >= 50 ? '#16a34a' : shareOfVoice >= 20 ? '#f59e0b' : '#dc2626';

  return (
    <Html>
      <Head />
      <Preview>
        Your AI Visibility Report — {businessName}: {shareOfVoice}% Share of Voice
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Text style={heading}>Weekly AI Visibility Report</Text>
          <Text style={subheading}>
            Here&apos;s how <strong>{businessName}</strong> performed in AI search this week:
          </Text>

          {/* SOV Score */}
          <Section style={scoreSection}>
            <Text style={{ ...scoreNumber, color: sovColor }}>
              {shareOfVoice}%
            </Text>
            <Text style={scoreLabel}>Share of Voice</Text>
          </Section>

          {/* Stats Row */}
          <Section style={statsRow}>
            <Text style={statItem}>
              <strong>{queriesRun}</strong>
              {'\n'}Queries Run
            </Text>
            <Text style={{ ...statItem, color: '#16a34a' }}>
              <strong>{queriesCited}</strong>
              {'\n'}Times Cited
            </Text>
          </Section>

          {/* First Mover Alert */}
          {firstMoverCount > 0 && (
            <Section style={firstMoverBox}>
              <Text style={firstMoverText}>
                🏆 <strong>{firstMoverCount} First Mover Opportunit{firstMoverCount === 1 ? 'y' : 'ies'}</strong>
              </Text>
              <Text style={firstMoverSub}>
                AI isn&apos;t recommending anyone for {firstMoverCount === 1 ? 'this query' : 'these queries'} yet. Be first.
              </Text>
            </Section>
          )}

          <Hr style={divider} />

          {/* CTA */}
          <Button href={dashboardUrl} style={ctaButton}>
            View Full Report →
          </Button>

          {/* Footer */}
          <Text style={footer}>
            This report is generated weekly from LocalVector&apos;s SOV Engine.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// Styles (inline for email client compatibility)
// ---------------------------------------------------------------------------

const main = {
  backgroundColor: '#050A15',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '40px 20px',
};

const heading = {
  color: '#6366f1',
  fontSize: '22px',
  fontWeight: '700' as const,
  margin: '0 0 8px',
};

const subheading = {
  color: '#94A3B8',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '0 0 24px',
};

const scoreSection = {
  textAlign: 'center' as const,
  backgroundColor: '#0A1628',
  borderRadius: '8px',
  padding: '24px',
  margin: '0 0 16px',
};

const scoreNumber = {
  fontSize: '48px',
  fontWeight: '700' as const,
  margin: '0',
  lineHeight: '1',
};

const scoreLabel = {
  color: '#64748B',
  fontSize: '14px',
  margin: '4px 0 0',
};

const statsRow = {
  display: 'flex' as const,
  justifyContent: 'space-around' as const,
  backgroundColor: '#0A1628',
  borderRadius: '8px',
  padding: '16px',
  margin: '0 0 16px',
};

const statItem = {
  textAlign: 'center' as const,
  color: '#F1F5F9',
  fontSize: '14px',
  margin: '0',
  whiteSpace: 'pre-line' as const,
};

const firstMoverBox = {
  backgroundColor: 'rgba(245, 158, 11, 0.08)',
  borderLeft: '4px solid #f59e0b',
  borderRadius: '4px',
  padding: '12px 16px',
  margin: '0 0 16px',
};

const firstMoverText = {
  color: '#F1F5F9',
  fontSize: '14px',
  fontWeight: '600' as const,
  margin: '0',
};

const firstMoverSub = {
  color: '#92400e',
  fontSize: '13px',
  margin: '4px 0 0',
};

const divider = {
  borderColor: 'rgba(255,255,255,0.05)',
  margin: '24px 0',
};

const ctaButton = {
  display: 'inline-block' as const,
  backgroundColor: '#4f46e5',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontWeight: '600' as const,
  fontSize: '14px',
};

const footer = {
  color: '#6b7280',
  fontSize: '12px',
  marginTop: '24px',
};
```

## Step 4 — Create tests for the new scaffold files

Create `src/__tests__/unit/zip-bundle.test.ts`:

```typescript
// ---------------------------------------------------------------------------
// Unit test: ZIP bundle utility
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { createZipBundle, type BundleFile } from '@/lib/utils/zipBundle';
import JSZip from 'jszip';

describe('createZipBundle', () => {
  it('creates a valid ZIP with the given files', async () => {
    const files: BundleFile[] = [
      { path: 'schema/restaurant.json', content: '{"@type":"Restaurant"}' },
      { path: 'llms.txt', content: '# Business Name\nTest data' },
    ];

    const buffer = await createZipBundle(files);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // Verify contents by reading back
    const zip = await JSZip.loadAsync(buffer);
    const schemaFile = await zip.file('schema/restaurant.json')?.async('string');
    const llmsFile = await zip.file('llms.txt')?.async('string');

    expect(schemaFile).toBe('{"@type":"Restaurant"}');
    expect(llmsFile).toBe('# Business Name\nTest data');
  });

  it('returns a valid ZIP for an empty file list', async () => {
    const buffer = await createZipBundle([]);
    expect(buffer).toBeInstanceOf(Buffer);

    const zip = await JSZip.loadAsync(buffer);
    expect(Object.keys(zip.files)).toHaveLength(0);
  });
});
```

Create `src/__tests__/unit/schema-types.test.ts`:

```typescript
// ---------------------------------------------------------------------------
// Unit test: Schema.org type helpers
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { toJsonLdScript } from '@/lib/schema/types';
import type { WithContext, Restaurant } from 'schema-dts';

describe('toJsonLdScript', () => {
  it('wraps a typed Schema.org object in a script tag', () => {
    const data: WithContext<Restaurant> = {
      '@context': 'https://schema.org',
      '@type': 'Restaurant',
      name: 'Charcoal N Chill',
    };

    const result = toJsonLdScript(data);

    expect(result).toContain('<script type="application/ld+json">');
    expect(result).toContain('"@context": "https://schema.org"');
    expect(result).toContain('"@type": "Restaurant"');
    expect(result).toContain('"name": "Charcoal N Chill"');
    expect(result).toContain('</script>');
  });
});
```

## Step 5 — Final verification

Run the full test suite including the new tests:

```bash
npm run build
npm run test
```

All existing tests MUST still pass. The 2 new test files must also pass.

## Step 6 — Commit

Stage and commit all changes with this message:

```
feat: install schema-dts, jszip, @react-email/components

Zero-risk package installation for upcoming killer features:
- schema-dts: typed Schema.org JSON-LD generation (Feature #3)
- jszip: ZIP bundle downloads (Feature #3)
- @react-email/components: React-based email templates (Feature #7)

Includes scaffold files and unit tests. No changes to existing code.
Existing build and test suite verified passing.
```

## Rules

- Do NOT modify any existing files except `package.json` and `package-lock.json`
- Do NOT touch `app/globals.css`
- Do NOT touch any file in `app/dashboard/`
- Do NOT touch `lib/email.ts` (the existing Resend integration stays as-is)
- Do NOT touch `lib/utils/generateMenuJsonLd.ts`
- If `npm run build` or `npm run test` fails after installation, STOP and report the error — do not attempt to fix by modifying existing code
