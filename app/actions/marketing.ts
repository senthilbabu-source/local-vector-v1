'use server';
// Server Action — runFreeScan (Sprint 34+35: real AI-presence audit + issue categories)
//
// Powers the free AI Audit on the public marketing landing page.
// Calls the Perplexity Sonar API with a JSON-mode system prompt to audit how
// AI models describe the given business (closed status, mentions volume, sentiment).
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
// Graceful degradation (AI_RULES §24 — never fabricate scan results):
//   • Missing PERPLEXITY_API_KEY → { status: 'unavailable', reason: 'no_api_key' }.
//   • Non-OK HTTP response       → { status: 'unavailable', reason: 'api_error' }.
//   • JSON parse / Zod failure   → text-detection fallback (keyword match → 'fail').
//   • No keyword match           → { status: 'unavailable', reason: 'api_error' }.
//   • Any uncaught error         → { status: 'unavailable', reason: 'api_error' }.

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
      /** Real AI-presence fields from Perplexity audit (Sprint 34) */
      mentions_volume: 'none' | 'low' | 'medium' | 'high';
      sentiment: 'positive' | 'neutral' | 'negative';
      accuracy_issues: string[];
      /** Sprint 35: parallel category per accuracy_issue (hours|address|menu|phone|other) */
      accuracy_issue_categories: Array<'hours' | 'address' | 'menu' | 'phone' | 'other'>;
    }
  | {
      /** No hallucination found — AI correctly describes the business. */
      status: 'pass';
      engine: string;
      business_name: string;
      /** Real AI-presence fields from Perplexity audit (Sprint 34) */
      mentions_volume: 'none' | 'low' | 'medium' | 'high';
      sentiment: 'positive' | 'neutral' | 'negative';
      accuracy_issues: string[];
      /** Sprint 35: parallel category per accuracy_issue (hours|address|menu|phone|other) */
      accuracy_issue_categories: Array<'hours' | 'address' | 'menu' | 'phone' | 'other'>;
    }
  | {
      /**
       * Business exists but Perplexity has no AI-model coverage for it.
       * May indicate very low AI visibility (not indexed by LLMs).
       */
      status: 'not_found';
      engine: string;
      business_name: string;
    }
  | {
      status: 'rate_limited';
      retryAfterSeconds: number;
    }
  | {
      /**
       * Scan could not be completed: API key absent or upstream error.
       * NOT a hallucination result — shows a neutral "Scan Unavailable" card.
       * See AI_RULES §24.
       */
      status:  'unavailable';
      reason:  'no_api_key' | 'api_error';
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
  is_closed:       z.boolean(),
  /** true when Perplexity cannot find AI-model coverage for this business */
  is_unknown:      z.boolean().default(false),
  claim_text:      z.string(),
  expected_truth:  z.string(),
  // Lowercase per AI_RULES and the PostgreSQL hallucination_severity ENUM.
  severity:        z.enum(['critical', 'high', 'medium']).default('critical'),
  // Sprint 34: real AI-presence fields — Zod defaults absorb backwards-compat responses.
  mentions_volume: z.enum(['none', 'low', 'medium', 'high']).default('low'),
  sentiment:       z.enum(['positive', 'neutral', 'negative']).default('neutral'),
  accuracy_issues: z.array(z.string().max(120)).max(3).default([]),
  // Sprint 35: parallel category per accuracy_issue — Zod default absorbs old responses.
  accuracy_issue_categories: z.array(
    z.enum(['hours', 'address', 'menu', 'phone', 'other'])
  ).max(3).default([]),
});

// ---------------------------------------------------------------------------
// Test-only — demo result for exercising the fail-path UI in unit tests
// ---------------------------------------------------------------------------

/**
 * @internal NOT called in production. Only for unit tests that need to exercise
 * the hallucination-card UI path without a real Perplexity response.
 * See AI_RULES §24 — production error paths return `{ status: 'unavailable' }`.
 */
export async function _demoFallbackForTesting(businessName: string): Promise<ScanResult> {
  return {
    status:          'fail',
    engine:          'ChatGPT',
    severity:        'critical',
    claim_text:      'Permanently Closed',
    expected_truth:  'Open',
    business_name:   businessName,
    mentions_volume:           'low',
    sentiment:                 'negative',
    accuracy_issues:           [],
    accuracy_issue_categories: [],
  };
}

// ---------------------------------------------------------------------------
// runFreeScan
// ---------------------------------------------------------------------------

export async function runFreeScan(formData: FormData): Promise<ScanResult> {
  const businessName =
    (formData.get('businessName') as string | null)?.trim() || 'Your Business';
  const city    = (formData.get('city')    as string | null)?.trim() || '';
  /** Verified address from Places autocomplete selection (optional) */
  const address = (formData.get('address') as string | null)?.trim() || '';
  /** Website URL from URL-mode Smart Search (optional) */
  const url     = (formData.get('url')     as string | null)?.trim() || '';

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

  // No key present → honest unavailable state (AI_RULES §24 — no fabricated results).
  if (!apiKey) {
    return { status: 'unavailable', reason: 'no_api_key' };
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
              'You are a business AI-presence auditor.',
              'Respond ONLY with a valid JSON object — no markdown, no explanation.',
              'Schema: { "is_closed": boolean, "is_unknown": boolean, "claim_text": string, "expected_truth": string, "severity": "critical"|"high"|"medium", "mentions_volume": "none"|"low"|"medium"|"high", "sentiment": "positive"|"neutral"|"negative", "accuracy_issues": [string], "accuracy_issue_categories": [string] }',
              'is_unknown=true if you cannot find any AI-model coverage for this business at all.',
              'If AI models report this business as permanently closed: is_closed=true, claim_text="Permanently Closed", expected_truth="Open".',
              'If AI models report it as open (correctly): is_closed=false, claim_text="Open", expected_truth="Open".',
              'mentions_volume: "none"=no AI data about this business, "low"=brief mentions only, "medium"=moderate detail, "high"=prominently described with rich context.',
              'sentiment: "positive"=AI describes the business favorably/premium, "neutral"=factual/no strong tone, "negative"=AI describes it unfavorably/budget.',
              'accuracy_issues: Up to 3 short strings (max 80 chars each) describing specific inaccuracies AI states about this business (e.g. "AI reports Monday hours as 9am-5pm"). Empty array [] if none.',
              'accuracy_issue_categories: A parallel array of the SAME LENGTH as accuracy_issues. Each entry is one of: "hours", "address", "menu", "phone", or "other". Classifies the type of inaccuracy described by the corresponding accuracy_issues entry.',
              'Severity MUST be lowercase: critical, high, or medium.',
            ].join(' '),
          },
          {
            role: 'user',
            content: (() => {
              const urlCtx = url ? ` (website: ${url})` : '';
              return address
                ? `Does ChatGPT or other AI models incorrectly report "${businessName}" located at "${address}"${urlCtx} as permanently closed?`
                : `Does ChatGPT or other AI models incorrectly report "${businessName}"${city ? ` in ${city}` : ''}${urlCtx} as permanently closed?`;
            })(),
          },
        ],
      }),
    });

    if (!response.ok) {
      return { status: 'unavailable', reason: 'api_error' };
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
        // Branch on every parsed field — AI_RULES §21: never ignore a parsed boolean.
        if (parsed.data.is_unknown) {
          // not_found has no AI coverage by definition — new fields are not applicable
          return {
            status:        'not_found',
            engine:        'ChatGPT',
            business_name: businessName,
          };
        }
        if (!parsed.data.is_closed) {
          return {
            status:                    'pass',
            engine:                    'ChatGPT',
            business_name:             businessName,
            mentions_volume:           parsed.data.mentions_volume,
            sentiment:                 parsed.data.sentiment,
            accuracy_issues:           parsed.data.accuracy_issues,
            accuracy_issue_categories: parsed.data.accuracy_issue_categories,
          };
        }
        return {
          status:                    'fail',
          engine:                    'ChatGPT',
          severity:                  parsed.data.severity,
          claim_text:                parsed.data.claim_text,
          expected_truth:            parsed.data.expected_truth,
          business_name:             businessName,
          mentions_volume:           parsed.data.mentions_volume,
          sentiment:                 parsed.data.sentiment,
          accuracy_issues:           parsed.data.accuracy_issues,
          accuracy_issue_categories: parsed.data.accuracy_issue_categories,
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
      // Hard-code new fields on text-detection path — no structured data available
      return {
        status:                    'fail',
        engine:                    'ChatGPT',
        severity:                  'critical',
        claim_text:                'Permanently Closed',
        expected_truth:            'Open',
        business_name:             businessName,
        mentions_volume:           'low',
        sentiment:                 'negative',
        accuracy_issues:           [],
        accuracy_issue_categories: [],
      };
    }

    // No keyword match and JSON parse failed → service returned unusable data
    return { status: 'unavailable', reason: 'api_error' };
  } catch {
    // Network failure or other uncaught error
    return { status: 'unavailable', reason: 'api_error' };
  }
}
