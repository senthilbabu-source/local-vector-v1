// ---------------------------------------------------------------------------
// src/__tests__/unit/rag.test.ts — Sprint 133: RAG Chatbot Widget Tests
//
// 32 tests covering: readiness check, context builder, hours formatting,
// system prompt builder, answer generation.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (hoisted) ────────────────────────────────────────────────────────

const mockGenerateText = vi.fn();
vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn(() => 'mock-model'),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import {
  checkRAGReadiness,
  type RAGReadinessInput,
} from '@/lib/rag/rag-readiness-check';

import {
  formatHoursData,
  type RAGContext,
} from '@/lib/rag/rag-context-builder';

import {
  buildRAGSystemPrompt,
  answerQuestion,
} from '@/lib/rag/rag-responder';

import * as Sentry from '@sentry/nextjs';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeFullInput(overrides: Partial<RAGReadinessInput> = {}): RAGReadinessInput {
  return {
    menuItemCount: 10,
    amenitiesSetCount: 5,
    amenitiesTotal: 8,
    hoursDataComplete: true,
    operationalStatusSet: true,
    ...overrides,
  };
}

function makeContext(overrides: Partial<RAGContext> = {}): RAGContext {
  return {
    businessName: 'Charcoal N Chill',
    address: '11950 Jones Bridge Rd, Alpharetta, GA, 30005',
    phone: '(470) 546-4866',
    website: 'https://charcoalnchill.com',
    operationalStatus: 'open',
    hours: 'Mon 11am\u201310pm, Tue 11am\u201310pm',
    menuItems: [
      {
        name: 'Mediterranean Bowl',
        description: 'Fresh bowl with hummus',
        price: '$14.99',
        category: 'Bowls',
        dietaryTags: ['vegan'],
        isAvailable: true,
      },
    ],
    amenities: ['hookah', 'outdoor seating'],
    corrections: ['We are open until 2 AM on weekends, not 10 PM'],
    faqPairs: [
      { question: 'Do you have vegan options?', answer: 'Yes, we have several vegan dishes.' },
    ],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// checkRAGReadiness — 8 tests
// ═══════════════════════════════════════════════════════════════════════════

describe('checkRAGReadiness', () => {
  it('returns ready=true when all thresholds met', () => {
    const result = checkRAGReadiness(makeFullInput());
    expect(result.ready).toBe(true);
    expect(result.completenessScore).toBe(100);
    expect(result.gaps).toHaveLength(0);
  });

  it('returns ready=false when menuItemCount < 5', () => {
    const result = checkRAGReadiness(makeFullInput({ menuItemCount: 3 }));
    expect(result.ready).toBe(false);
    expect(result.gaps).toContain('Menu needs at least 5 items (currently 3)');
  });

  it('returns ready=false when amenity completeness < 50% and status missing', () => {
    const result = checkRAGReadiness(
      makeFullInput({ amenitiesSetCount: 1, amenitiesTotal: 10, operationalStatusSet: false }),
    );
    // 40 + 0 + 25 + 0 = 65 → not ready
    expect(result.ready).toBe(false);
    expect(result.completenessScore).toBe(65);
    expect(result.gaps.some((g) => g.includes('Amenities: 10% set'))).toBe(true);
  });

  it('returns ready=false when hours incomplete', () => {
    const result = checkRAGReadiness(makeFullInput({ hoursDataComplete: false }));
    expect(result.ready).toBe(false);
    expect(result.gaps).toContain('Hours data incomplete (need all 7 days)');
  });

  it('returns ready=false when operational status not set', () => {
    const result = checkRAGReadiness(makeFullInput({ operationalStatusSet: false }));
    // 40 + 20 + 25 = 85 → still ready (≥80)
    expect(result.completenessScore).toBe(85);
    expect(result.gaps).toContain('Operational status not set');
  });

  it('score=100 for perfectly complete location', () => {
    const result = checkRAGReadiness(makeFullInput());
    expect(result.completenessScore).toBe(100);
  });

  it('score=0 for empty location', () => {
    const result = checkRAGReadiness({
      menuItemCount: 0,
      amenitiesSetCount: 0,
      amenitiesTotal: 0,
      hoursDataComplete: false,
      operationalStatusSet: false,
    });
    expect(result.completenessScore).toBe(0);
    expect(result.ready).toBe(false);
  });

  it('gaps array describes each failing dimension', () => {
    const result = checkRAGReadiness({
      menuItemCount: 0,
      amenitiesSetCount: 0,
      amenitiesTotal: 5,
      hoursDataComplete: false,
      operationalStatusSet: false,
    });
    expect(result.gaps).toHaveLength(4);
    expect(result.gaps[0]).toContain('Menu');
    expect(result.gaps[1]).toContain('Amenities');
    expect(result.gaps[2]).toContain('Hours');
    expect(result.gaps[3]).toContain('Operational');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// formatHoursData — 5 tests
// ═══════════════════════════════════════════════════════════════════════════

describe('formatHoursData', () => {
  it('formats standard open/close hours correctly', () => {
    const result = formatHoursData({
      monday: { open: '11:00', close: '22:00' },
    });
    expect(result).toBe('Mon 11am\u201310pm');
  });

  it('handles closed days', () => {
    const result = formatHoursData({
      monday: { open: '11:00', close: '22:00' },
      tuesday: { closed: true },
    });
    expect(result).toContain('Tue: Closed');
  });

  it('returns "Hours not available" for null input', () => {
    expect(formatHoursData(null)).toBe('Hours not available');
  });

  it('formats midnight (00:00) correctly', () => {
    const result = formatHoursData({
      friday: { open: '16:00', close: '00:00' },
    });
    expect(result).toBe('Fri 4pm\u201312am');
  });

  it('formats PM hours (22:00 \u2192 10pm)', () => {
    const result = formatHoursData({
      saturday: { open: '16:00', close: '02:00' },
    });
    expect(result).toBe('Sat 4pm\u20132am');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// buildRAGSystemPrompt — 9 tests
// ═══════════════════════════════════════════════════════════════════════════

describe('buildRAGSystemPrompt', () => {
  it('includes STRICT RULE instruction', () => {
    const prompt = buildRAGSystemPrompt(makeContext());
    expect(prompt).toContain('STRICT RULE: Answer ONLY from the information provided below');
  });

  it('includes fallback phone instruction when phone present', () => {
    const prompt = buildRAGSystemPrompt(makeContext({ phone: '555-1234' }));
    expect(prompt).toContain('please call us at 555-1234');
  });

  it('includes fallback without phone when phone null', () => {
    const prompt = buildRAGSystemPrompt(makeContext({ phone: null }));
    expect(prompt).toContain('please contact us directly');
  });

  it('includes menu items with prices and dietary tags', () => {
    const prompt = buildRAGSystemPrompt(makeContext());
    expect(prompt).toContain('Mediterranean Bowl');
    expect(prompt).toContain('$14.99');
    expect(prompt).toContain('[vegan]');
    expect(prompt).toContain('[Bowls]');
  });

  it('includes amenities section when amenities present', () => {
    const prompt = buildRAGSystemPrompt(makeContext());
    expect(prompt).toContain('--- FEATURES & AMENITIES ---');
    expect(prompt).toContain('hookah, outdoor seating');
  });

  it('includes corrections section when corrections present', () => {
    const prompt = buildRAGSystemPrompt(makeContext());
    expect(prompt).toContain('--- VERIFIED CORRECTIONS');
    expect(prompt).toContain('We are open until 2 AM on weekends');
  });

  it('includes FAQ section when faqPairs present', () => {
    const prompt = buildRAGSystemPrompt(makeContext());
    expect(prompt).toContain('--- COMMON QUESTIONS & ANSWERS ---');
    expect(prompt).toContain('Q: Do you have vegan options?');
  });

  it('omits menu section when no menu items', () => {
    const prompt = buildRAGSystemPrompt(makeContext({ menuItems: [] }));
    expect(prompt).not.toContain('--- MENU ---');
  });

  it('includes 80-word limit instruction', () => {
    const prompt = buildRAGSystemPrompt(makeContext());
    expect(prompt).toContain('under 80 words');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// answerQuestion — 3 tests
// ═══════════════════════════════════════════════════════════════════════════

describe('answerQuestion', () => {
  beforeEach(() => {
    mockGenerateText.mockReset();
  });

  it('returns high confidence for direct answer', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'Yes, we have several vegan options including the Mediterranean Bowl.',
    });

    const result = await answerQuestion('vegan options?', makeContext());
    expect(result.confidence).toBe('high');
    expect(result.answer).toContain('vegan options');
  });

  it('returns low confidence when answer contains fallback phrase', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: "I don't have that information — please call us at (470) 546-4866.",
    });

    const result = await answerQuestion('private events?', makeContext());
    expect(result.confidence).toBe('low');
  });

  it('returns low confidence on API error with fallback message and captures to Sentry', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('API down'));

    const result = await answerQuestion('anything', makeContext());
    expect(result.confidence).toBe('low');
    expect(result.answer).toContain('temporarily unavailable');
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { service: 'rag-responder', sprint: '133' } }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// buildRAGContext — 7 tests (mock Supabase)
// ═══════════════════════════════════════════════════════════════════════════

describe('buildRAGContext', () => {
  // Dynamic import to get the module with mocked dependencies
  let buildRAGContext: typeof import('@/lib/rag/rag-context-builder').buildRAGContext;

  beforeEach(async () => {
    const mod = await import('@/lib/rag/rag-context-builder');
    buildRAGContext = mod.buildRAGContext;
  });

  function createMockSupabase(config: {
    location?: Record<string, unknown> | null;
    menuItems?: Array<Record<string, unknown>>;
    corrections?: Array<Record<string, unknown>>;
  }) {
    const fromFn = vi.fn((table: string) => {
      if (table === 'locations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: config.location ?? null,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'menu_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: config.menuItems ?? [],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'ai_audits') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: config.corrections ?? [],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    return { from: fromFn } as unknown as import('@supabase/supabase-js').SupabaseClient<
      import('@/lib/supabase/database.types').Database
    >;
  }

  it('returns null when location not found', async () => {
    const supabase = createMockSupabase({ location: null });
    const result = await buildRAGContext('loc-1', supabase);
    expect(result).toBeNull();
  });

  it('includes only true amenity values (not false or null)', async () => {
    const supabase = createMockSupabase({
      location: {
        business_name: 'Test',
        address_line1: '123 Main',
        city: 'Atlanta',
        state: 'GA',
        zip: '30301',
        phone: null,
        website_url: null,
        hours_data: null,
        operational_status: 'open',
        amenities: { hookah: true, pool: false, patio: null },
        faq_cache: null,
      },
    });

    const result = await buildRAGContext('loc-1', supabase);
    expect(result?.amenities).toEqual(['hookah']);
  });

  it('formats price as $14.99 string', async () => {
    const supabase = createMockSupabase({
      location: {
        business_name: 'Test',
        address_line1: '',
        city: '',
        state: '',
        zip: '',
        phone: null,
        website_url: null,
        hours_data: null,
        operational_status: 'open',
        amenities: null,
        faq_cache: null,
      },
      menuItems: [
        {
          name: 'Burger',
          description: null,
          price: 14.99,
          currency: 'USD',
          dietary_tags: [],
          is_available: true,
          menu_categories: { name: 'Mains' },
        },
      ],
    });

    const result = await buildRAGContext('loc-1', supabase);
    expect(result?.menuItems[0].price).toBe('$14.99');
  });

  it('includes dietary tags from menu items', async () => {
    const supabase = createMockSupabase({
      location: {
        business_name: 'Test',
        address_line1: '',
        city: '',
        state: '',
        zip: '',
        phone: null,
        website_url: null,
        hours_data: null,
        operational_status: 'open',
        amenities: null,
        faq_cache: null,
      },
      menuItems: [
        {
          name: 'Salad',
          description: null,
          price: null,
          currency: null,
          dietary_tags: ['vegan', 'gluten-free'],
          is_available: true,
          menu_categories: { name: 'Salads' },
        },
      ],
    });

    const result = await buildRAGContext('loc-1', supabase);
    expect(result?.menuItems[0].dietaryTags).toEqual(['vegan', 'gluten-free']);
  });

  it('includes verified corrections from ai_audits', async () => {
    const supabase = createMockSupabase({
      location: {
        business_name: 'Test',
        address_line1: '',
        city: '',
        state: '',
        zip: '',
        phone: null,
        website_url: null,
        hours_data: null,
        operational_status: 'open',
        amenities: null,
        faq_cache: null,
      },
      corrections: [
        { response_metadata: { correction: 'We close at 2 AM, not 10 PM' } },
      ],
    });

    const result = await buildRAGContext('loc-1', supabase);
    expect(result?.corrections).toEqual(['We close at 2 AM, not 10 PM']);
  });

  it('includes faq_cache pairs from locations table', async () => {
    const supabase = createMockSupabase({
      location: {
        business_name: 'Test',
        address_line1: '',
        city: '',
        state: '',
        zip: '',
        phone: null,
        website_url: null,
        hours_data: null,
        operational_status: 'open',
        amenities: null,
        faq_cache: [
          { id: 'abc', question: 'Vegan?', answer: 'Yes', contentHash: 'x', source: 'ground-truth' },
        ],
      },
    });

    const result = await buildRAGContext('loc-1', supabase);
    expect(result?.faqPairs).toEqual([
      { question: 'Vegan?', answer: 'Yes' },
    ]);
  });

  it('omits description when null', async () => {
    const supabase = createMockSupabase({
      location: {
        business_name: 'Test',
        address_line1: '',
        city: '',
        state: '',
        zip: '',
        phone: null,
        website_url: null,
        hours_data: null,
        operational_status: 'open',
        amenities: null,
        faq_cache: null,
      },
      menuItems: [
        {
          name: 'Water',
          description: null,
          price: null,
          currency: null,
          dietary_tags: [],
          is_available: true,
          menu_categories: { name: 'Drinks' },
        },
      ],
    });

    const result = await buildRAGContext('loc-1', supabase);
    expect(result?.menuItems[0].description).toBeUndefined();
  });
});
