// ---------------------------------------------------------------------------
// free-scan-pass.test.ts — Unit tests for runFreeScan() is_closed branching
//
// Tests app/actions/marketing.ts → runFreeScan():
//   1. is_closed=true  API response   → { status: 'fail' } with correct fields
//   2. is_closed=false API response   → { status: 'pass' } with engine + business_name
//   3. No PERPLEXITY_API_KEY         → { status: 'unavailable', reason: 'no_api_key' } (AI_RULES §24)
//   4. Non-OK HTTP (status 429)      → { status: 'unavailable', reason: 'api_error' }
//   5. Markdown-fenced JSON          → cleaned, parsed, is_closed respected
//   6. Text-detection path           → "permanently closed" keyword → { status: 'fail', severity: 'critical' }
//   7. Severity propagated           → 'medium' severity from API retained in fail result
//
//   8. address in formData          → Perplexity user message contains address string
//   9. is_unknown=true from API     → { status: 'not_found' }
//  10. is_unknown=false+is_closed=false → { status: 'pass' } regression guard
//  11. Network failure (fetch throws) → { status: 'unavailable', reason: 'api_error' }
//
// Mocks: @vercel/kv, next/headers, global fetch — hoisted (AI_RULES §4).
//
// Run:
//   npx vitest run src/__tests__/unit/free-scan-pass.test.ts
// ---------------------------------------------------------------------------

// ── Hoist vi.mock declarations BEFORE any imports (AI_RULES §4) ───────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@vercel/kv', () => ({
  kv: { incr: vi.fn(), expire: vi.fn(), ttl: vi.fn() },
}));
vi.mock('next/headers', () => ({ headers: vi.fn() }));

// ── Imports after mock declarations ──────────────────────────────────────

import { runFreeScan } from '@/app/actions/marketing';
import { headers } from 'next/headers';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeForm(businessName = 'Biryani World Fusion and Grill', city = 'Atlanta, GA'): FormData {
  const fd = new FormData();
  fd.append('businessName', businessName);
  fd.append('city', city);
  return fd;
}

function mockHeadersHelper(ip = '1.2.3.4') {
  vi.mocked(headers as ReturnType<typeof vi.fn>).mockResolvedValue({
    get: (name: string) => (name === 'x-forwarded-for' ? ip : null),
  });
}

/** Stubs global fetch to return a Perplexity-shaped OK response. */
function mockPerplexityOk(content: object) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(content) } }],
    }),
  }));
}

/** Stubs global fetch to return a non-OK response. */
function mockPerplexityError(status = 429) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ error: 'Too Many Requests' }),
  }));
}

// ── Setup / teardown ──────────────────────────────────────────────────────

beforeEach(() => {
  // KV absent → rate limit bypassed
  delete process.env.KV_REST_API_URL;
  // API key present → real fetch path exercised
  process.env.PERPLEXITY_API_KEY = 'test-key-123';
  mockHeadersHelper();
});

afterEach(() => {
  delete process.env.PERPLEXITY_API_KEY;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('runFreeScan — is_closed branching (AI_RULES §21)', () => {

  it('returns { status: "fail" } when is_closed=true', async () => {
    mockPerplexityOk({ is_closed: true, claim_text: 'Permanently Closed', expected_truth: 'Open', severity: 'critical' });
    const result = await runFreeScan(makeForm());
    expect(result.status).toBe('fail');
    if (result.status === 'fail') {
      expect(result.claim_text).toBe('Permanently Closed');
      expect(result.expected_truth).toBe('Open');
      expect(result.engine).toBe('ChatGPT');
      expect(result.business_name).toBe('Biryani World Fusion and Grill');
    }
  });

  it('returns { status: "pass" } with engine, business_name, and real AI-presence fields when is_closed=false', async () => {
    // Mock omits Sprint 34 fields → Zod applies defaults: mentions_volume='low', sentiment='neutral', accuracy_issues=[]
    mockPerplexityOk({ is_closed: false, claim_text: 'Open', expected_truth: 'Open', severity: 'medium' });
    const result = await runFreeScan(makeForm());
    expect(result).toEqual({
      status:          'pass',
      engine:          'ChatGPT',
      business_name:   'Biryani World Fusion and Grill',
      mentions_volume: 'low',    // Zod default
      sentiment:       'neutral', // Zod default
      accuracy_issues: [],        // Zod default
    });
  });

  it('returns { status: "unavailable", reason: "no_api_key" } when PERPLEXITY_API_KEY is absent (AI_RULES §24)', async () => {
    delete process.env.PERPLEXITY_API_KEY;
    const result = await runFreeScan(makeForm('My Local Diner'));
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') {
      expect(result.reason).toBe('no_api_key');
    }
  });

  it('returns { status: "unavailable", reason: "api_error" } when Perplexity returns non-OK status', async () => {
    mockPerplexityError(429);
    const result = await runFreeScan(makeForm());
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') {
      expect(result.reason).toBe('api_error');
    }
  });

  it('cleans markdown-fenced JSON and still branches on is_closed correctly', async () => {
    const content = { is_closed: false, claim_text: 'Open', expected_truth: 'Open', severity: 'medium' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '```json\n' + JSON.stringify(content) + '\n```' } }],
      }),
    }));
    const result = await runFreeScan(makeForm('Neon Sushi'));
    expect(result.status).toBe('pass');
    if (result.status === 'pass') {
      expect(result.business_name).toBe('Neon Sushi');
    }
  });

  it('falls back to text-detection and returns fail when JSON invalid but text contains "permanently closed"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Yes, Biryani World has permanently closed its doors.' } }],
      }),
    }));
    const result = await runFreeScan(makeForm());
    expect(result.status).toBe('fail');
    if (result.status === 'fail') {
      expect(result.claim_text).toBe('Permanently Closed');
      expect(result.severity).toBe('critical');
    }
  });

  it('propagates non-critical severity from API when is_closed=true', async () => {
    mockPerplexityOk({ is_closed: true, claim_text: 'Closed on Mondays', expected_truth: 'Open Monday', severity: 'medium' });
    const result = await runFreeScan(makeForm());
    expect(result.status).toBe('fail');
    if (result.status === 'fail') {
      expect(result.severity).toBe('medium');
      expect(result.claim_text).toBe('Closed on Mondays');
      expect(result.expected_truth).toBe('Open Monday');
    }
  });

  // ── Sprint 31: unavailable on uncaught error ─────────────────────────────

  it('returns { status: "unavailable", reason: "api_error" } when fetch throws (network failure)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network failure')));
    const result = await runFreeScan(makeForm());
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') {
      expect(result.reason).toBe('api_error');
    }
  });

  // ── Sprint 29: address param + not_found status ─────────────────────────

  it('includes address in Perplexity user message when address present in formData', async () => {
    const capturedBody = { value: '' };
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: unknown, opts: { body: string }) => {
      capturedBody.value = opts.body;
      return {
        ok:   true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ is_closed: false, is_unknown: false, claim_text: 'Open', expected_truth: 'Open', severity: 'medium' }) } }],
        }),
      };
    }));

    const fd = new FormData();
    fd.append('businessName', 'Charcoal N Chill');
    fd.append('address',      '1234 Old Milton Pkwy, Alpharetta, GA 30005, USA');
    fd.append('city',         '');
    await runFreeScan(fd);

    const parsed = JSON.parse(capturedBody.value) as { messages: { role: string; content: string }[] };
    const userMsg = parsed.messages.find((m) => m.role === 'user')?.content ?? '';
    expect(userMsg).toContain('located at "1234 Old Milton Pkwy, Alpharetta, GA 30005, USA"');
  });

  it('returns { status: "not_found" } when is_unknown=true from Perplexity', async () => {
    mockPerplexityOk({ is_closed: false, is_unknown: true, claim_text: '', expected_truth: '', severity: 'medium' });
    const result = await runFreeScan(makeForm('Ghost Kitchen'));
    expect(result).toEqual({
      status:        'not_found',
      engine:        'ChatGPT',
      business_name: 'Ghost Kitchen',
    });
  });

  it('regression: is_unknown=false + is_closed=false still returns pass (not_found does not shadow pass)', async () => {
    mockPerplexityOk({ is_closed: false, is_unknown: false, claim_text: 'Open', expected_truth: 'Open', severity: 'medium' });
    const result = await runFreeScan(makeForm('Healthy Spot'));
    expect(result.status).toBe('pass');
  });

  // ── Sprint 34: real AI-presence field propagation ─────────────────────────

  it('propagates mentions_volume from Perplexity response to ScanResult', async () => {
    mockPerplexityOk({
      is_closed: true, claim_text: 'Permanently Closed', expected_truth: 'Open', severity: 'critical',
      mentions_volume: 'low', sentiment: 'negative', accuracy_issues: [],
    });
    const result = await runFreeScan(makeForm());
    expect(result.status).toBe('fail');
    if (result.status === 'fail') {
      expect(result.mentions_volume).toBe('low');
    }
  });

  it('propagates sentiment from Perplexity response to ScanResult', async () => {
    mockPerplexityOk({
      is_closed: true, claim_text: 'Permanently Closed', expected_truth: 'Open', severity: 'critical',
      mentions_volume: 'low', sentiment: 'negative', accuracy_issues: [],
    });
    const result = await runFreeScan(makeForm());
    expect(result.status).toBe('fail');
    if (result.status === 'fail') {
      expect(result.sentiment).toBe('negative');
    }
  });

  it('propagates accuracy_issues from Perplexity response to ScanResult', async () => {
    mockPerplexityOk({
      is_closed: false, claim_text: 'Open', expected_truth: 'Open', severity: 'medium',
      mentions_volume: 'medium', sentiment: 'neutral',
      accuracy_issues: ['AI reports Monday hours as closed'],
    });
    const result = await runFreeScan(makeForm('Healthy Spot'));
    expect(result.status).toBe('pass');
    if (result.status === 'pass') {
      expect(result.accuracy_issues).toEqual(['AI reports Monday hours as closed']);
    }
  });

  it('Zod defaults mentions_volume to "low" when Perplexity response omits it', async () => {
    // Response without mentions_volume — Zod .default('low') applies
    mockPerplexityOk({ is_closed: false, claim_text: 'Open', expected_truth: 'Open', severity: 'medium' });
    const result = await runFreeScan(makeForm('Healthy Spot'));
    expect(result.status).toBe('pass');
    if (result.status === 'pass') {
      expect(result.mentions_volume).toBe('low');
    }
  });

});
