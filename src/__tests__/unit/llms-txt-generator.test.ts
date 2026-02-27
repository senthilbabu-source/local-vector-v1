// ---------------------------------------------------------------------------
// llms-txt-generator.test.ts — Unit tests for dynamic llms.txt generator
//
// Sprint 97 — Gap #62 (Dynamic llms.txt)
// Run: npx vitest run src/__tests__/unit/llms-txt-generator.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateLLMsTxt,
  type LLMsTxtInputData,
} from '@/lib/llms-txt/llms-txt-generator';
import { GOLDEN_TENANT } from '@/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function buildFullInput(): LLMsTxtInputData {
  return {
    org: { name: 'Charcoal N Chill', plan: 'growth' },
    location: {
      name: 'Charcoal N Chill',
      address_line1: '11950 Jones Bridge Road Ste 103',
      city: 'Alpharetta',
      state: 'GA',
      zip: '30005',
      phone: '(470) 546-4866',
      website_url: 'https://charcoalnchill.com',
      categories: ['Hookah Bar', 'Indian Restaurant'],
      hours_data: GOLDEN_TENANT.location.hours_data,
      amenities: GOLDEN_TENANT.location.amenities,
      operational_status: 'OPERATIONAL',
    },
    menuHighlights: [
      { name: 'Signature Hookah', description: 'Premium hookah experience', price: 35.00, category: 'Hookah' },
      { name: 'Butter Chicken', description: 'Creamy tomato-based curry', price: 18.99, category: 'Entrees' },
      { name: 'Mango Lassi', description: null, price: 6.50, category: 'Beverages' },
    ],
    corrections: [
      {
        claim_text: 'Charcoal N Chill appears to be permanently closed.',
        expected_truth: 'Charcoal N Chill is actively operating at 11950 Jones Bridge Road.',
        model_provider: 'openai-gpt4o',
        resolved_at: '2026-02-15T11:00:00.000Z',
      },
    ],
    publicMenuUrl: '/m/dinner-menu-abc123',
  };
}

function buildMinimalInput(): LLMsTxtInputData {
  return {
    org: { name: 'Minimal Bistro', plan: 'starter' },
    location: {
      name: 'Minimal Bistro',
      address_line1: null,
      city: null,
      state: null,
      zip: null,
      phone: null,
      website_url: null,
      categories: null,
      hours_data: null,
      amenities: null,
      operational_status: null,
    },
    menuHighlights: [],
    corrections: [],
    publicMenuUrl: null,
  };
}

// Fix date for deterministic output
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-01T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests — Structure
// ---------------------------------------------------------------------------

describe('generateLLMsTxt — Structure', () => {
  it('1. includes ## Business Identity section', () => {
    const output = generateLLMsTxt(buildFullInput());
    expect(output).toContain('## Business Identity');
  });

  it('2. includes ## Hours of Operation section', () => {
    const output = generateLLMsTxt(buildFullInput());
    expect(output).toContain('## Hours of Operation');
  });

  it('3. includes ## Amenities & Features section', () => {
    const output = generateLLMsTxt(buildFullInput());
    expect(output).toContain('## Amenities & Features');
  });

  it('4. includes ## Menu Highlights section', () => {
    const output = generateLLMsTxt(buildFullInput());
    expect(output).toContain('## Menu Highlights');
  });

  it('5. includes ## Verified Corrections section when corrections exist', () => {
    const output = generateLLMsTxt(buildFullInput());
    expect(output).toContain('## Verified Corrections');
  });

  it('6. omits ## Verified Corrections section when no corrections', () => {
    const input = buildFullInput();
    input.corrections = [];
    const output = generateLLMsTxt(input);
    expect(output).not.toContain('## Verified Corrections');
  });

  it('7. includes ## Public AI-Optimized Menu Page when publicMenuUrl provided', () => {
    const output = generateLLMsTxt(buildFullInput());
    expect(output).toContain('## Public AI-Optimized Menu Page');
    expect(output).toContain('/m/dinner-menu-abc123');
  });

  it('8. omits ## Public AI-Optimized Menu Page when publicMenuUrl is null', () => {
    const input = buildFullInput();
    input.publicMenuUrl = null;
    const output = generateLLMsTxt(input);
    expect(output).not.toContain('## Public AI-Optimized Menu Page');
  });
});

// ---------------------------------------------------------------------------
// Tests — Business Identity
// ---------------------------------------------------------------------------

describe('generateLLMsTxt — Business Identity', () => {
  it('9. outputs exact business name in header', () => {
    const output = generateLLMsTxt(buildFullInput());
    expect(output).toContain('# Charcoal N Chill — AI Visibility File');
  });

  it('10. outputs phone number', () => {
    const output = generateLLMsTxt(buildFullInput());
    expect(output).toContain('- Phone: (470) 546-4866');
  });

  it('11. outputs operational status "Open" for "OPERATIONAL"', () => {
    const output = generateLLMsTxt(buildFullInput());
    expect(output).toContain('- Operational Status: Open');
  });
});

// ---------------------------------------------------------------------------
// Tests — Hours
// ---------------------------------------------------------------------------

describe('generateLLMsTxt — Hours', () => {
  it('12. outputs all 7 days including closed days', () => {
    const output = generateLLMsTxt(buildFullInput());
    expect(output).toContain('- Monday: Closed');
    expect(output).toContain('- Tuesday:');
    expect(output).toContain('- Wednesday:');
    expect(output).toContain('- Thursday:');
    expect(output).toContain('- Friday:');
    expect(output).toContain('- Saturday:');
    expect(output).toContain('- Sunday:');
  });

  it('13. formats hours as HH:MM\u2013HH:MM', () => {
    const output = generateLLMsTxt(buildFullInput());
    expect(output).toContain('17:00\u201301:00');
  });

  it('14. handles null hours_data gracefully (omits hours section)', () => {
    const input = buildMinimalInput();
    const output = generateLLMsTxt(input);
    expect(output).not.toContain('## Hours of Operation');
  });
});

// ---------------------------------------------------------------------------
// Tests — Amenities
// ---------------------------------------------------------------------------

describe('generateLLMsTxt — Amenities', () => {
  it('15. only outputs amenities where value === true', () => {
    const output = generateLLMsTxt(buildFullInput());
    expect(output).toContain('Outdoor Seating: Yes');
    expect(output).toContain('Full Bar / Alcohol Service: Yes');
    expect(output).toContain('Hookah Lounge: Yes');
  });

  it('16. omits false amenities from output', () => {
    const output = generateLLMsTxt(buildFullInput());
    // is_kid_friendly is false in the fixture
    expect(output).not.toContain('Kid-Friendly: Yes');
  });

  it('17. handles null amenities gracefully (omits section)', () => {
    const input = buildMinimalInput();
    const output = generateLLMsTxt(input);
    expect(output).not.toContain('## Amenities & Features');
  });
});

// ---------------------------------------------------------------------------
// Tests — Menu Highlights
// ---------------------------------------------------------------------------

describe('generateLLMsTxt — Menu Highlights', () => {
  it('18. outputs at most 5 menu items', () => {
    const input = buildFullInput();
    input.menuHighlights = Array(8).fill(null).map((_, i) => ({
      name: `Item ${i}`,
      description: 'desc',
      price: 10 + i,
      category: 'Cat',
    }));
    const output = generateLLMsTxt(input);
    const matches = output.match(/### Item \d/g);
    expect(matches?.length).toBe(5);
  });

  it('19. omits price line when price is null', () => {
    const input = buildFullInput();
    input.menuHighlights = [{ name: 'Free Sample', description: 'Taste test', price: null, category: null }];
    const output = generateLLMsTxt(input);
    expect(output).toContain('### Free Sample');
    expect(output).not.toContain('- Price:');
  });

  it('20. omits description line when description is null', () => {
    const input = buildFullInput();
    input.menuHighlights = [{ name: 'Mystery Dish', description: null, price: 12.99, category: null }];
    const output = generateLLMsTxt(input);
    expect(output).toContain('### Mystery Dish');
    expect(output).not.toContain('- Description:');
  });
});

// ---------------------------------------------------------------------------
// Tests — Corrections
// ---------------------------------------------------------------------------

describe('generateLLMsTxt — Corrections', () => {
  it('21. outputs hallucinated value and corrected value per correction', () => {
    const output = generateLLMsTxt(buildFullInput());
    expect(output).toContain('INCORRECT: "Charcoal N Chill appears to be permanently closed."');
    expect(output).toContain('CORRECT: "Charcoal N Chill is actively operating at 11950 Jones Bridge Road."');
  });

  it('22. outputs at most 10 corrections', () => {
    const input = buildFullInput();
    input.corrections = Array(15).fill(null).map((_, i) => ({
      claim_text: `Hallucination ${i}`,
      expected_truth: `Truth ${i}`,
      model_provider: 'test-model',
      resolved_at: '2026-02-15T11:00:00.000Z',
    }));
    const output = generateLLMsTxt(input);
    const matches = output.match(/INCORRECT:/g);
    expect(matches?.length).toBe(10);
  });

  it('23. includes model_provider name in correction entry', () => {
    const output = generateLLMsTxt(buildFullInput());
    expect(output).toContain('openai-gpt4o');
  });
});

// ---------------------------------------------------------------------------
// Tests — Edge Cases
// ---------------------------------------------------------------------------

describe('generateLLMsTxt — Edge Cases', () => {
  it('24. returns valid plain text when all optional fields are null (minimal org)', () => {
    const output = generateLLMsTxt(buildMinimalInput());
    expect(output).toContain('# Minimal Bistro — AI Visibility File');
    expect(output).toContain('## Business Identity');
    expect(output).toContain('## Data Freshness');
    // Should not crash
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(100);
  });
});
