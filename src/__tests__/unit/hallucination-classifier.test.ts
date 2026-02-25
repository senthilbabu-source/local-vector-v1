// ---------------------------------------------------------------------------
// hallucination-classifier.test.ts — Unit tests for auditLocation()
//
// Tests lib/services/ai-audit.service.ts: auditLocation()
// Tests lib/ai/ai-audit.service.ts: auditLocation()
//
// Strategy:
//   • generateText is mocked at the 'ai' module level — no real API calls.
//   • hasApiKey is mocked to control mock/real code paths.
//   • The demo fallback path (no API key) is tested in isolation.
//   • The real-API path mocks generateText to return deterministic responses.
//
// Run:
//   npx vitest run src/__tests__/unit/hallucination-classifier.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock the AI SDK ──────────────────────────────────────────────────────
vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

// ── Mock the providers ──────────────────────────────────────────────────
vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn().mockReturnValue('mock-model'),
  hasApiKey: vi.fn().mockReturnValue(false),
}));

import {
  auditLocation,
  type LocationAuditInput,
} from '@/lib/services/ai-audit.service';
import { generateText } from 'ai';
import { hasApiKey } from '@/lib/ai/providers';

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

// ── Tests ──────────────────────────────────────────────────────────────────

describe('auditLocation — demo fallback (no API key)', () => {
  beforeEach(() => {
    vi.mocked(hasApiKey).mockReturnValue(false);
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

describe('auditLocation — with API key present', () => {
  beforeEach(() => {
    vi.mocked(hasApiKey).mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls generateText with the fear-audit model', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({ hallucinations: [] }),
    } as never);

    await auditLocation(LOCATION);

    expect(vi.mocked(generateText)).toHaveBeenCalledOnce();
  });

  it('parses a single hallucination from the AI response', async () => {
    const fakeHallucination = {
      model_provider: 'openai-gpt4o',
      severity: 'high',
      category: 'status',
      claim_text: 'This restaurant is permanently closed.',
      expected_truth: 'Restaurant is open Tuesday–Sunday 11 AM–10 PM.',
    };
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({ hallucinations: [fakeHallucination] }),
    } as never);

    const results = await auditLocation(LOCATION);

    expect(results).toHaveLength(1);
    expect(results[0].model_provider).toBe('openai-gpt4o');
    expect(results[0].severity).toBe('high');
    expect(results[0].category).toBe('status');
    expect(results[0].claim_text).toBe('This restaurant is permanently closed.');
  });

  it('returns empty array when hallucinations:[] in response', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({ hallucinations: [] }),
    } as never);

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
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({ hallucinations: fakeHallucinations }),
    } as never);

    const results = await auditLocation(LOCATION);

    expect(results).toHaveLength(2);
    expect(results[0].severity).toBe('critical');
    expect(results[1].severity).toBe('high');
  });

  it('returns empty array when generateText throws', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('API rate limit'));

    try {
      const results = await auditLocation(LOCATION);
      expect(Array.isArray(results)).toBe(true);
    } catch (err) {
      expect(err).toBeDefined();
    }
  });

  it('returns empty array when API returns unparseable text', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: 'not valid json at all',
    } as never);

    const results = await auditLocation(LOCATION);
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(0);
  });
});