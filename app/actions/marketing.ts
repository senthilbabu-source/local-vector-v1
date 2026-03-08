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
//   Uses @upstash/redis via lib/redis.ts. Reads UPSTASH_REDIS_REST_URL (preferred)
//   or KV_REST_API_URL (Vercel legacy fallback). Env vars are identical.
//
// Graceful degradation (AI_RULES §24 — never fabricate scan results):
//   • Missing PERPLEXITY_API_KEY → { status: 'unavailable', reason: 'no_api_key' }.
//   • Non-OK HTTP / fetch timeout → { status: 'unavailable', reason: 'api_error' }.
//   • Empty response              → { status: 'not_found' } (no AI coverage).
//   • JSON parse / Zod failure    → text-detection fallback (keywords → 'fail' or 'pass').
//   • No keyword match            → { status: 'unavailable', reason: 'api_error' }.
//   • Any uncaught error          → { status: 'unavailable', reason: 'api_error' }.
//
// Sprint 36c hardening:
//   • preprocessScanResponse() coerces string booleans + lowercases enums before Zod.
//   • extractJson() uses balanced-brace parsing (picks last valid object).
//   • AbortController caps fetch at 15 seconds.
//   • Text-detection covers both "closed" and "open" keyword families.
//
// Sprint 36d — best-of-2 parallel strategy:
//   Perplexity Sonar is non-deterministic (live search + LLM). Consecutive scans of the
//   same business can return not_found then pass-with-rich-data. To mitigate:
//   • Fire 2 Perplexity calls in parallel via Promise.allSettled.
//   • Rank results: pass/fail with data > not_found > unavailable.
//   • Return the richest result. If both fail, return the first error.
//   • Cost: ~2x API usage but both calls run within the same 15s window.

import { headers } from 'next/headers';
import { getRedis } from '@/lib/redis';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';
import { createServiceRoleClient } from '@/lib/supabase/server';

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
// captureLeadEmail — Sprint P2-7b: viral scanner email capture
//
// Inserts an email + business name + scan status into scan_leads via service role.
// Service role bypasses RLS so this works even though the table has no policies.
// Returns { ok: true } on success, { ok: false } on validation failure or DB error.
// Never throws — all errors are captured via Sentry.
// ---------------------------------------------------------------------------

const VALID_SCAN_STATUSES = ['fail', 'pass', 'not_found'] as const;

export async function captureLeadEmail(
  formData: FormData
): Promise<{ ok: boolean; reportId?: string }> {
  const email        = (formData.get('email')        as string | null)?.trim().toLowerCase() ?? '';
  const businessName = (formData.get('businessName') as string | null)?.trim() ?? '';
  const scanStatus   = (formData.get('scanStatus')   as string | null)?.trim() ?? '';

  // Basic validation — never insert junk rows
  if (!email || !email.includes('@') || email.length > 254) return { ok: false };
  if (!(VALID_SCAN_STATUSES as readonly string[]).includes(scanStatus))  return { ok: false };
  if (!businessName)                                                      return { ok: false };

  try {
    const supabase = createServiceRoleClient();
    // Sprint A: select id so we can return a shareable report URL
    const { data, error } = await (
      supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>
    )('scan_leads').insert({
      email,
      business_name: businessName,
      scan_status:   scanStatus,
    }).select('id').single();

    if (error) {
      Sentry.captureException(error, { tags: { file: 'marketing.ts', action: 'captureLeadEmail' } });
      return { ok: false };
    }
    const row = data as { id: string } | null;
    return { ok: true, reportId: row?.id };
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'marketing.ts', action: 'captureLeadEmail' } });
    return { ok: false };
  }
}

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
  const count = await getRedis().incr(key);
  if (count === 1) await getRedis().expire(key, RATE_LIMIT_WINDOW); // set TTL on first hit only

  if (count > RATE_LIMIT_MAX) {
    const ttl = await getRedis().ttl(key);
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
  // Sprint 36c: truncate instead of reject — verbose Perplexity responses should
  // not cause the entire parse to fail just because an issue string is 150 chars.
  accuracy_issues: z.array(
    z.string().transform((s) => s.slice(0, 120)),
  ).transform((arr) => arr.slice(0, 3)).default([]),
  // Sprint 35: parallel category per accuracy_issue — Zod default absorbs old responses.
  // Sprint 36c: slice to 3 instead of rejecting on overflow.
  accuracy_issue_categories: z.array(
    z.enum(['hours', 'address', 'menu', 'phone', 'other'])
  ).transform((arr) => arr.slice(0, 3)).default([]),
});

// ---------------------------------------------------------------------------
// Internal — preprocessing for near-valid AI responses (Sprint 36c)
// ---------------------------------------------------------------------------

/**
 * Normalize near-valid AI responses before Zod validation.
 * Coerces string booleans → real booleans, lowercases enum fields, and
 * trims whitespace from object keys so that malformed responses like
 * `{ " accuracy_issue_categories": [] }` still match the Zod schema.
 */
function preprocessScanResponse(obj: Record<string, unknown>): Record<string, unknown> {
  // Trim whitespace from all keys — Perplexity occasionally injects stray
  // spaces in key names (e.g. `" accuracy_issue_categories"`).
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    out[key.trim()] = value;
  }

  // Coerce string booleans → real booleans
  if (typeof out.is_closed  === 'string') out.is_closed  = out.is_closed  === 'true';
  if (typeof out.is_unknown === 'string') out.is_unknown = out.is_unknown === 'true';

  // Lowercase enum fields
  if (typeof out.severity        === 'string') out.severity        = out.severity.toLowerCase();
  if (typeof out.mentions_volume === 'string') out.mentions_volume = out.mentions_volume.toLowerCase();
  if (typeof out.sentiment       === 'string') out.sentiment       = out.sentiment.toLowerCase();

  // Normalize category array entries
  if (Array.isArray(out.accuracy_issue_categories)) {
    out.accuracy_issue_categories = out.accuracy_issue_categories.map(
      (c: unknown) => (typeof c === 'string' ? c.toLowerCase() : c),
    );
  }

  return out;
}

// ---------------------------------------------------------------------------
// Internal — balanced-brace JSON extractor (Sprint 36c)
// ---------------------------------------------------------------------------

/**
 * Extract the last balanced `{...}` substring from text. Handles nested braces.
 * Returns the last complete object so that self-correcting LLM responses
 * (e.g. "First attempt: {...} Corrected: {...}") resolve to the final answer.
 */
function extractJson(text: string): string | null {
  let depth = 0;
  let start = -1;
  let lastValid: string | null = null;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        lastValid = text.slice(start, i + 1);
      }
    }
  }
  return lastValid;
}

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
    engine:          'Perplexity Sonar',
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
// Internal — issue synthesis from claim_text (empty accuracy_issues fix)
// ---------------------------------------------------------------------------

/**
 * When the AI returns a `fail` result (is_closed=true) but leaves
 * `accuracy_issues` empty, synthesize an issue + category from the
 * claim_text / expected_truth so the UI always has something to show.
 */
function _inferCategoryFromText(text: string): 'hours' | 'address' | 'menu' | 'phone' | 'other' {
  const lower = text.toLowerCase();
  if (/\b(hour|hours|open|close|closed|am|pm|mon|tue|wed|thu|fri|sat|sun)\b/.test(lower)) return 'hours';
  if (/\b(address|street|st|ave|road|rd|unit|suite|ste|location|located)\b/.test(lower)) return 'address';
  if (/\b(menu|dish|food|cuisine|price|item|pizza|burger|sushi|vegan)\b/.test(lower)) return 'menu';
  if (/\b(phone|call|number|tel|contact)\b/.test(lower)) return 'phone';
  return 'other';
}

/**
 * Ensure a fail result always has at least one accuracy_issue.
 * If the AI returned empty accuracy_issues, synthesize from claim_text.
 */
function _ensureIssuesForFail(
  claimText: string,
  expectedTruth: string,
  issues: string[],
  categories: Array<'hours' | 'address' | 'menu' | 'phone' | 'other'>,
): { issues: string[]; categories: Array<'hours' | 'address' | 'menu' | 'phone' | 'other'> } {
  if (issues.length > 0) return { issues, categories };

  // Synthesize from claim_text — this is the primary inaccuracy the AI found
  const synthesized = claimText
    ? `AI states: "${claimText.slice(0, 80)}"${expectedTruth ? ` — should be: "${expectedTruth.slice(0, 40)}"` : ''}`
    : 'AI contains inaccurate information about this business';
  const category = _inferCategoryFromText(claimText + ' ' + expectedTruth);

  return {
    issues: [synthesized.slice(0, 120)],
    categories: [category],
  };
}

// ---------------------------------------------------------------------------
// Internal — extract issues from raw text fallback (text-detection path)
// ---------------------------------------------------------------------------

/**
 * When JSON parsing fails and we fall through to text-detection,
 * attempt to extract meaningful issue strings from the raw LLM prose.
 */
function _extractIssuesFromText(raw: string): { issues: string[]; categories: Array<'hours' | 'address' | 'menu' | 'phone' | 'other'> } {
  const issues: string[] = [];

  // Look for common patterns in Perplexity prose responses
  const patterns = [
    /(?:hours?|schedule)\s+(?:listed?|shown?|stated?|appear)\s+as\s+[^.]{5,80}/gi,
    /(?:address|location)\s+(?:listed?|shown?|stated?|appear)\s+as\s+[^.]{5,80}/gi,
    /(?:phone|number|contact)\s+(?:listed?|shown?|stated?|appear)\s+as\s+[^.]{5,80}/gi,
    /(?:wrong|incorrect|inaccurate|outdated)\s+[^.]{5,80}/gi,
    /(?:permanently\s+closed|has\s+closed|shut\s+down|no\s+longer\s+open)[^.]{0,60}/gi,
    /(?:not\s+(?:found|listed|appearing|visible))\s+(?:in|on|at)\s+[^.]{5,60}/gi,
  ];

  for (const pattern of patterns) {
    const matches = raw.match(pattern);
    if (matches) {
      for (const match of matches.slice(0, 3 - issues.length)) {
        const cleaned = match.trim().slice(0, 120);
        if (cleaned.length >= 10 && !issues.includes(cleaned)) {
          issues.push(cleaned);
        }
      }
    }
    if (issues.length >= 3) break;
  }

  const cats = issues.map(issue => _inferCategoryFromText(issue));
  return { issues, categories: cats };
}

// ---------------------------------------------------------------------------
// Internal — single Perplexity API call + response parsing (Sprint 36d)
// ---------------------------------------------------------------------------

interface SingleCallParams {
  businessName: string;
  city: string;
  address: string;
  url: string;
  apiKey: string;
}

/**
 * Fires a single Perplexity Sonar API call and parses the response.
 * Pure function (no rate-limiting, no form parsing) — extracted so
 * runFreeScan() can invoke it in parallel for best-of-2.
 */
async function _singlePerplexityCall(params: SingleCallParams): Promise<ScanResult> {
  const { businessName, city, address, url, apiKey } = params;

  // ── Perplexity API call ──────────────────────────────────────────────────
  // URL must exactly match the MSW handler so Playwright tests intercept.
  // Sprint 36c: 15s timeout via AbortController — caps wall-clock wait so the
  // user gets a clean "Scan Unavailable" rather than a cryptic Next.js timeout.
  const controller = new AbortController();
  const fetchTimeout = setTimeout(() => controller.abort(), 15_000);

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method:  'POST',
    signal:  controller.signal,
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
            'You are a restaurant AI-presence auditor.',
            'Respond ONLY with a valid JSON object — no markdown, no explanation.',
            'Schema: { "is_closed": boolean, "is_unknown": boolean, "claim_text": string, "expected_truth": string, "severity": "critical"|"high"|"medium", "mentions_volume": "none"|"low"|"medium"|"high", "sentiment": "positive"|"neutral"|"negative", "accuracy_issues": [string], "accuracy_issue_categories": [string] }',
            'is_unknown=true ONLY if you find no information about this restaurant in any AI model or search result.',
            'is_closed=true if AI models state ANY inaccurate fact about this restaurant: wrong hours, wrong address, wrong phone number, wrong cuisine type, marked as permanently closed, or not appearing in local AI recommendations at all.',
            'is_closed=false ONLY if all AI-stated information about this restaurant is accurate and it appears in relevant local searches.',
            'claim_text: the single most impactful wrong fact AI is stating (e.g. "Hours listed as Mon-Fri 9am-5pm", "Address shown as 123 Old St", "Listed as permanently closed", "Not found in local restaurant searches").',
            'expected_truth: the correct fact, or "Verify current information on website" if you cannot confirm the exact correct value.',
            'mentions_volume: "none"=no AI data about this restaurant, "low"=sparse/brief mentions, "medium"=moderate coverage across platforms, "high"=prominently featured with rich detail.',
            'sentiment: overall tone of how AI describes this restaurant — "positive"=favorable/recommended, "neutral"=factual only, "negative"=unfavorable or avoid.',
            'accuracy_issues: Up to 3 specific inaccuracies AI states (max 80 chars each). E.g. ["AI lists hours as Mon-Fri 9am-5pm", "AI shows outdated address on Main St", "Not recommended for pizza searches in city"]. Empty [] if all facts are accurate.',
            'accuracy_issue_categories: Parallel array SAME LENGTH as accuracy_issues. Each entry: "hours", "address", "menu", "phone", or "other".',
            'severity: "critical"=wrong address or phone (customer cannot find or reach restaurant), "high"=wrong hours (customer arrives when closed or misses the window), "medium"=wrong cuisine type, menu inaccuracy, or missing from local recommendations.',
            'Severity MUST be lowercase: critical, high, or medium.',
          ].join(' '),
        },
        {
          role: 'user',
          content: (() => {
            const urlCtx = url ? ` Website: ${url}.` : '';
            const locationCtx = address
              ? `located at "${address}"`
              : city ? `in ${city}` : '';
            return `Audit the AI presence of restaurant "${businessName}" ${locationCtx}.${urlCtx} Search for what AI models (ChatGPT, Google, Perplexity) currently say about this restaurant. Check: (1) what hours are listed — are they correct? (2) what address appears — is it current? (3) is the phone number correct? (4) is the cuisine type accurate? (5) does it appear in AI recommendations when someone searches for restaurants in the area? Report any factual inaccuracies or visibility gaps you find.`;
          })(),
        },
      ],
    }),
  });

  clearTimeout(fetchTimeout);

  if (!response.ok) {
    if (process.env.NODE_ENV === 'development') {
      const errBody = await response.text().catch(() => '(no body)');
      console.error(`[runFreeScan] Perplexity HTTP ${response.status}:`, errBody.slice(0, 500));
    }
    return { status: 'unavailable', reason: 'api_error' };
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = (data.choices?.[0]?.message?.content ?? '').trim();

  // ── Sprint 36c: empty response = no AI coverage ──────────────────────────
  if (!raw) {
    return { status: 'not_found', engine: 'Perplexity Sonar', business_name: businessName };
  }

  // ── JSON parse path (production + MSW mock) ──────────────────────────────
  // Strip optional markdown fences defensively even when the model is
  // instructed not to include them.
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/```\s*$/,      '')
    .trim();

  // Sprint 36c: balanced-brace extraction picks the last complete {...} object.
  // Handles prose-wrapped JSON and self-correcting LLM responses with multiple objects.
  const extracted = extractJson(cleaned) ?? cleaned;

  // Repair Perplexity's stray/doubled-quote key malformation BEFORE JSON.parse.
  // Three observed variants around `accuracy_issue_categories`:
  //   v1: ," accuracy_issue_categories"  → valid JSON, handled by key-trim post-parse
  //   v2: ," "accuracy_issue_categories" → space splits key, breaks JSON.parse
  //   v3: ,""accuracy_issue_categories"  → doubled quote, breaks JSON.parse
  // Regex: collapse ,"\s*" → ," ONLY when followed by a key-name char [a-z_].
  const jsonStr = extracted.replace(/,"\s*"(?=[a-z_])/gi, ',"');

  try {
    // Sprint 36c: preprocessor coerces string booleans + lowercases enums
    // so near-valid responses (e.g. severity:"Critical") pass Zod validation.
    const rawObj = JSON.parse(jsonStr) as Record<string, unknown>;
    const parsed = PerplexityScanSchema.safeParse(preprocessScanResponse(rawObj));
    if (!parsed.success && process.env.NODE_ENV === 'development') {
      console.error('[runFreeScan] Zod validation failed:', parsed.error.issues);
    }
    if (parsed.success) {
      // Branch on every parsed field — AI_RULES §21: never ignore a parsed boolean.
      if (parsed.data.is_unknown) {
        // not_found has no AI coverage by definition — new fields are not applicable
        return {
          status:        'not_found',
          engine:        'Perplexity Sonar',
          business_name: businessName,
        };
      }
      // Fail if is_closed=true OR the model found accuracy issues even without flagging is_closed.
      // Perplexity sometimes returns is_closed=false but still populates accuracy_issues — treat
      // any non-empty accuracy_issues as a fail so real problems (wrong hours, wrong address) are
      // never silently swallowed into a misleading "pass" result.
      const hasIssues = parsed.data.is_closed || parsed.data.accuracy_issues.length > 0;
      if (!hasIssues) {
        return {
          status:                    'pass',
          engine:                    'Perplexity Sonar',
          business_name:             businessName,
          mentions_volume:           parsed.data.mentions_volume,
          sentiment:                 parsed.data.sentiment,
          accuracy_issues:           parsed.data.accuracy_issues,
          accuracy_issue_categories: parsed.data.accuracy_issue_categories,
        };
      }

      // Ensure fail results always have at least one accuracy_issue for the UI.
      // The AI sometimes sets is_closed=true but leaves accuracy_issues empty.
      const ensured = _ensureIssuesForFail(
        parsed.data.claim_text,
        parsed.data.expected_truth,
        parsed.data.accuracy_issues,
        parsed.data.accuracy_issue_categories,
      );

      return {
        status:                    'fail',
        engine:                    'Perplexity Sonar',
        severity:                  parsed.data.severity,
        // When is_closed=true the model sets a meaningful claim_text.
        // When accuracy_issues drove the fail (is_closed=false), use the first issue as the headline.
        claim_text:                parsed.data.is_closed
                                     ? parsed.data.claim_text
                                     : ensured.issues[0],
        expected_truth:            parsed.data.expected_truth,
        business_name:             businessName,
        mentions_volume:           parsed.data.mentions_volume,
        sentiment:                 parsed.data.sentiment,
        accuracy_issues:           ensured.issues,
        accuracy_issue_categories: ensured.categories,
      };
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'marketing.ts', sprint: 'A' } });
    // Not valid JSON — fall through to text-detection.
    if (process.env.NODE_ENV === 'development') {
      console.error('[runFreeScan] JSON parse failed. Raw response:', raw.slice(0, 500));
    }
  }

  // ── Text-detection fallback (unexpected natural-language response) ────────
  const lower = raw.toLowerCase();
  if (
    lower.includes('permanently closed') ||
    lower.includes('has closed')         ||
    lower.includes('no longer open')     ||
    lower.includes('shut down')
  ) {
    // Extract any additional issues from the prose, with a guaranteed fallback
    const extracted = _extractIssuesFromText(raw);
    const fallbackIssues = extracted.issues.length > 0
      ? extracted.issues
      : ['AI states this business is permanently closed'];
    const fallbackCats = extracted.issues.length > 0
      ? extracted.categories
      : ['other' as const];
    return {
      status:                    'fail',
      engine:                    'Perplexity Sonar',
      severity:                  'critical',
      claim_text:                'Permanently Closed',
      expected_truth:            'Open',
      business_name:             businessName,
      mentions_volume:           'low',
      sentiment:                 'negative',
      accuracy_issues:           fallbackIssues,
      accuracy_issue_categories: fallbackCats,
    };
  }

  // ── Text-detection for businesses with inaccuracies (not closed, but issues found) ──
  // Catch prose that mentions wrong/incorrect/inaccurate information
  if (
    lower.includes('incorrect')  ||
    lower.includes('inaccurate') ||
    lower.includes('wrong ')     ||
    lower.includes('outdated')
  ) {
    const extracted = _extractIssuesFromText(raw);
    const fallbackIssues = extracted.issues.length > 0
      ? extracted.issues
      : ['AI contains inaccurate information about this business'];
    const fallbackCats = extracted.issues.length > 0
      ? extracted.categories
      : ['other' as const];
    return {
      status:                    'fail',
      engine:                    'Perplexity Sonar',
      severity:                  'medium',
      claim_text:                fallbackIssues[0],
      expected_truth:            'Verify current information on website',
      business_name:             businessName,
      mentions_volume:           'low',
      sentiment:                 'neutral',
      accuracy_issues:           fallbackIssues,
      accuracy_issue_categories: fallbackCats,
    };
  }

  // ── Sprint 36c: text-detection for open businesses ──────────────────────
  // Mirrors the "closed" fallback above but for the pass path.
  // Conservative defaults (low/neutral) since we lack structured data.
  if (
    lower.includes('is open')              ||
    lower.includes('currently operating')  ||
    lower.includes('still open')           ||
    lower.includes('actively operating')
  ) {
    return {
      status:                    'pass',
      engine:                    'Perplexity Sonar',
      business_name:             businessName,
      mentions_volume:           'low',
      sentiment:                 'neutral',
      accuracy_issues:           [],
      accuracy_issue_categories: [],
    };
  }

  // No keyword match and JSON parse failed → service returned unusable data
  if (process.env.NODE_ENV === 'development') {
    console.error('[runFreeScan] All parse paths failed. Raw response:', raw.slice(0, 500));
  }
  return { status: 'unavailable', reason: 'api_error' };
}

// ---------------------------------------------------------------------------
// Internal — result ranking for best-of-2 (Sprint 36d)
// ---------------------------------------------------------------------------

const MENTIONS_RANK: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3 };

/**
 * Score a ScanResult for comparison. Higher = richer / more useful.
 * pass/fail with data beat not_found which beats unavailable/rate_limited.
 * Among equal statuses, results with more accuracy_issues win, then
 * higher mentions_volume breaks ties.
 */
function _scoreScanResult(r: ScanResult): number {
  switch (r.status) {
    case 'pass':
    case 'fail':
      // Base 100 + accuracy_issues count (0–30) + mentions richness (0–3)
      // This ensures results with actual issue data always rank higher
      return 100 + (r.accuracy_issues.length * 10) + (MENTIONS_RANK[r.mentions_volume] ?? 0);
    case 'not_found':
      return 10;
    case 'unavailable':
    case 'rate_limited':
      return 0;
  }
}

// ---------------------------------------------------------------------------
// runFreeScan — public Server Action (Sprint 36d: best-of-2 parallel)
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
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'marketing.ts', sprint: 'A' } });
    // KV unreachable — allow the scan
  }

  const apiKey = process.env.PERPLEXITY_API_KEY;

  // No key present → honest unavailable state (AI_RULES §24 — no fabricated results).
  if (!apiKey) {
    return { status: 'unavailable', reason: 'no_api_key' };
  }

  // ── Best-of-2 parallel calls (Sprint 36d) ────────────────────────────────
  // Perplexity Sonar is non-deterministic: the same business can return not_found
  // on one call and pass-with-rich-data on the next. Fire 2 concurrent calls and
  // keep the richest result. Both run within the same 15s AbortController window.
  const callParams: SingleCallParams = { businessName, city, address, url, apiKey };

  try {
    const [r1, r2] = await Promise.allSettled([
      _singlePerplexityCall(callParams),
      _singlePerplexityCall(callParams),
    ]);

    // Extract resolved values (rejected = unavailable)
    const result1: ScanResult = r1.status === 'fulfilled'
      ? r1.value
      : { status: 'unavailable', reason: 'api_error' };
    const result2: ScanResult = r2.status === 'fulfilled'
      ? r2.value
      : { status: 'unavailable', reason: 'api_error' };

    // Pick the richer result
    const score1 = _scoreScanResult(result1);
    const score2 = _scoreScanResult(result2);

    return score2 > score1 ? result2 : result1;
  } catch (err) {
    // Shouldn't happen (allSettled never rejects) but guard defensively
    if (process.env.NODE_ENV === 'development') {
      console.error('[runFreeScan] Uncaught error:', err);
    }
    return { status: 'unavailable', reason: 'api_error' };
  }
}
