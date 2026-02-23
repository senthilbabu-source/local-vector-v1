// ---------------------------------------------------------------------------
// hallucination-classifier.test.ts — Unit tests for auditLocation()
//
// Tests lib/services/ai-audit.service.ts: auditLocation()
//
// Strategy:
//   • global.fetch is replaced with vi.fn() — no real OpenAI calls.
//   • OPENAI_API_KEY is set/deleted per describe block.
//   • The demo fallback path (no API key) is tested in isolation.
//   • The real-API path mocks fetch to return deterministic responses.
//
// Run:
//   npx vitest run src/__tests__/unit/hallucination-classifier.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  auditLocation,
  type LocationAuditInput,
} from '@/lib/services/ai-audit.service';

// ── Fixture ────────────────────────────────────────────────────────────────

const LOCATION: LocationAuditInput = {
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
  business_name: 'Charcoal N Chill',
  city: 'Alpharetta',
  state: 'GA',
  address_line1: '123 Main St',
  hours_data: null,
  amenities: null,
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Builds a mock fetch response that returns valid JSON with hallucinations. */
function makeFetchOk(hallucinations: unknown[] = []) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({ hallucinations }),
          },
        },
      ],
    }),
  });
}

/** Builds a mock fetch response that returns a non-OK HTTP status. */
function makeFetchError(status = 500, statusText = 'Internal Server Error') {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText,
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('auditLocation — demo fallback (no API key)', () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a single DEMO_HALLUCINATION when OPENAI_API_KEY is absent', async () => {
    const results = await auditLocation(LOCATION);
    expect(results).toHaveLength(1);
    expect(results[0].model_provider).toBe('openai-gpt4o');
    expect(results[0].category).toBe('status');
  });

  it('demo result has valid enum values for severity and category', async () => {
    const results = await auditLocation(LOCATION);
    const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low'];
    const VALID_CATEGORIES = ['status', 'hours', 'amenity', 'menu', 'address', 'phone'];

    expect(VALID_SEVERITIES).toContain(results[0].severity);
    expect(VALID_CATEGORIES).toContain(results[0].category);
  });
});

describe('auditLocation — with OPENAI_API_KEY present', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-test-mock-key';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    vi.restoreAllMocks();
  });

  it('calls fetch with a POST request to the OpenAI completions endpoint', async () => {
    const mockFetch = makeFetchOk([]);
    vi.stubGlobal('fetch', mockFetch);

    await auditLocation(LOCATION);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect((options as RequestInit).method).toBe('POST');
  });

  it('parses a single hallucination from the OpenAI JSON response', async () => {
    const fakeHallucination = {
      model_provider: 'openai-gpt4o',
      severity: 'high',
      category: 'status',
      claim_text: 'This restaurant is permanently closed.',
      expected_truth: 'Restaurant is open Tuesday–Sunday 11 AM–10 PM.',
    };
    vi.stubGlobal('fetch', makeFetchOk([fakeHallucination]));

    const results = await auditLocation(LOCATION);

    expect(results).toHaveLength(1);
    expect(results[0].model_provider).toBe('openai-gpt4o');
    expect(results[0].severity).toBe('high');
    expect(results[0].category).toBe('status');
    expect(results[0].claim_text).toBe('This restaurant is permanently closed.');
  });

  it('returns empty array when hallucinations:[] in response', async () => {
    vi.stubGlobal('fetch', makeFetchOk([]));

    const results = await auditLocation(LOCATION);

    expect(results).toHaveLength(0);
    expect(Array.isArray(results)).toBe(true);
  });

  it('handles multiple hallucinations in a single response', async () => {
    const fakeHallucinations = [
      {
        model_provider: 'openai-gpt4o',
        severity: 'critical',
        category: 'status',
        claim_text: 'Permanently closed.',
        expected_truth: 'Open',
      },
      {
        model_provider: 'openai-gpt4o',
        severity: 'high',
        category: 'amenity',
        claim_text: 'Does not serve alcohol.',
        expected_truth: 'Serves alcohol.',
      },
    ];
    vi.stubGlobal('fetch', makeFetchOk(fakeHallucinations));

    const results = await auditLocation(LOCATION);

    expect(results).toHaveLength(2);
    expect(results[0].severity).toBe('critical');
    expect(results[1].severity).toBe('high');
  });

  it('throws when OpenAI returns a non-OK HTTP status', async () => {
    vi.stubGlobal('fetch', makeFetchError(429, 'Too Many Requests'));

    await expect(auditLocation(LOCATION)).rejects.toThrow('OpenAI API error: 429');
  });

  it('returns empty array when API content has no choices', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [] }),
    }));

    const results = await auditLocation(LOCATION);
    // content is undefined → parsed.hallucinations is not an array → returns []
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(0);
  });
});
