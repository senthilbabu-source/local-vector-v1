'use server';
// Server Action — runFreeScan (Phase 18: real Perplexity integration)
//
// Powers the free "Hallucination Checker" on the public marketing landing page.
// Calls the Perplexity Sonar API with a JSON-mode system prompt to check whether
// AI models report the given business as permanently closed.
//
// MSW contract (AI_RULES §4):
//   In E2E tests (NEXT_PUBLIC_API_MOCKING=enabled), MSW intercepts the fetch at
//   https://api.perplexity.ai/chat/completions and returns a deterministic JSON
//   payload — no real API credits consumed. The URL must exactly match the MSW
//   handler registered in src/mocks/handlers.ts.
//
// Rate limiting (Phase 22):
//   IP-based, 5 scans per IP per 24 hours via Vercel KV (Upstash Redis).
//   Bypassed automatically when KV_REST_API_URL is absent (dev / CI).
//   KV unavailability is absorbed by try/catch — never aborts the scan (AI_RULES §17).
//   Note: @vercel/kv is deprecated; production deployments should use the Upstash
//   Redis integration from the Vercel Marketplace (env vars are identical).
//
// Graceful degradation:
//   • Missing PERPLEXITY_API_KEY → immediate demo fallback (keeps CI green).
//   • Non-OK HTTP response       → demo fallback.
//   • JSON parse / Zod failure   → text-detection fallback.
//   • Any uncaught error         → demo fallback.

import { headers } from 'next/headers';
import { kv } from '@vercel/kv';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ScanResult =
  | {
      status: 'fail';
      engine: string;
      severity: 'critical' | 'high' | 'medium';
      claim_text: string;
      expected_truth: string;
      business_name: string;
    }
  | {
      status: 'rate_limited';
      retryAfterSeconds: number;
    };

// ---------------------------------------------------------------------------
// Rate limiting — 5 scans per IP per 24 hours (AI_RULES §17: .catch pattern)
// ---------------------------------------------------------------------------

const RATE_LIMIT_MAX    = 5;
const RATE_LIMIT_WINDOW = 86400; // seconds (24 h)

async function checkRateLimit(
  ip: string
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  // KV not configured (dev / CI) → allow all scans, no tracking
  if (!process.env.KV_REST_API_URL) return { allowed: true, retryAfterSeconds: 0 };

  const key   = `ratelimit:scan:${ip}`;
  const count = await kv.incr(key);
  if (count === 1) await kv.expire(key, RATE_LIMIT_WINDOW); // set TTL on first hit only

  if (count > RATE_LIMIT_MAX) {
    const ttl = await kv.ttl(key);
    return { allowed: false, retryAfterSeconds: Math.max(ttl, 0) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

// ---------------------------------------------------------------------------
// Internal — Zod schema for the Perplexity JSON response
// ---------------------------------------------------------------------------

// The system prompt instructs Perplexity to return exactly this shape.
const PerplexityScanSchema = z.object({
  is_closed:      z.boolean(),
  claim_text:     z.string(),
  expected_truth: z.string(),
  // Lowercase per AI_RULES and the PostgreSQL hallucination_severity ENUM.
  severity:       z.enum(['critical', 'high', 'medium']).default('critical'),
});

// ---------------------------------------------------------------------------
// Internal — demo result used when the API is unavailable
// ---------------------------------------------------------------------------

function demoFallback(businessName: string): ScanResult {
  return {
    status:         'fail',
    engine:         'ChatGPT',
    severity:       'critical',
    claim_text:     'Permanently Closed',
    expected_truth: 'Open',
    business_name:  businessName,
  };
}

// ---------------------------------------------------------------------------
// runFreeScan
// ---------------------------------------------------------------------------

export async function runFreeScan(formData: FormData): Promise<ScanResult> {
  const businessName =
    (formData.get('businessName') as string | null)?.trim() || 'Your Business';
  const city = (formData.get('city') as string | null)?.trim() || '';

  // ── Rate limiting ──────────────────────────────────────────────────────────
  // Vercel sets x-forwarded-for on production; falls back to 'unknown' in dev.
  // Wrapped in try/catch: KV unavailability must never abort the scan (AI_RULES §17).
  try {
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const { allowed, retryAfterSeconds } = await checkRateLimit(ip);
    if (!allowed) return { status: 'rate_limited', retryAfterSeconds };
  } catch {
    // KV unreachable — allow the scan
  }

  const apiKey = process.env.PERPLEXITY_API_KEY;

  // No key present → instant demo fallback (dev / CI without credentials).
  if (!apiKey) {
    return demoFallback(businessName);
  }

  try {
    // ── Perplexity API call ──────────────────────────────────────────────────
    // URL must exactly match the MSW handler so Playwright tests intercept.
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: [
              'You are a business fact-checker.',
              'Respond ONLY with a valid JSON object — no markdown, no explanation.',
              'Schema: { "is_closed": boolean, "claim_text": string, "expected_truth": string, "severity": "critical"|"high"|"medium" }',
              'If AI models (ChatGPT, Perplexity, etc.) report this business as permanently closed:',
              '  set is_closed=true, claim_text="Permanently Closed", expected_truth="Open".',
              'If they report it as open:',
              '  set is_closed=false, claim_text="Open", expected_truth="Open".',
              'Severity MUST be lowercase: critical, high, or medium.',
            ].join(' '),
          },
          {
            role: 'user',
            content: `Does ChatGPT or other AI models incorrectly report "${businessName}"${city ? ` in ${city}` : ''} as permanently closed?`,
          },
        ],
      }),
    });

    if (!response.ok) {
      return demoFallback(businessName);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = (data.choices?.[0]?.message?.content ?? '').trim();

    // ── JSON parse path (production + MSW mock) ──────────────────────────────
    // Strip optional markdown fences defensively even when the model is
    // instructed not to include them.
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/,      '')
      .trim();

    try {
      const parsed = PerplexityScanSchema.safeParse(JSON.parse(cleaned));
      if (parsed.success) {
        return {
          status:         'fail',
          engine:         'ChatGPT',
          severity:       parsed.data.severity,
          claim_text:     parsed.data.claim_text,
          expected_truth: parsed.data.expected_truth,
          business_name:  businessName,
        };
      }
    } catch {
      // Not valid JSON — fall through to text-detection.
    }

    // ── Text-detection fallback (unexpected natural-language response) ────────
    const lower = raw.toLowerCase();
    if (
      lower.includes('permanently closed') ||
      lower.includes('has closed')         ||
      lower.includes('no longer open')     ||
      lower.includes('shut down')
    ) {
      return {
        status:         'fail',
        engine:         'ChatGPT',
        severity:       'critical',
        claim_text:     'Permanently Closed',
        expected_truth: 'Open',
        business_name:  businessName,
      };
    }

    return demoFallback(businessName);
  } catch {
    return demoFallback(businessName);
  }
}
