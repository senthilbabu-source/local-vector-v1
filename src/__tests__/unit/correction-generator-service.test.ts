// ---------------------------------------------------------------------------
// correction-generator-service.test.ts — Unit tests for pure correction generator
//
// Sprint 75: 30 tests — no mocks needed, pure functions only.
//
// Run:
//   npx vitest run src/__tests__/unit/correction-generator-service.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  generateCorrectionPackage,
  formatHoursForCorrection,
  type CorrectionInput,
} from '@/lib/services/correction-generator.service';
import { MOCK_CORRECTION_INPUT } from '@/src/__fixtures__/golden-tenant';
import type { HoursData } from '@/lib/types/ground-truth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a CorrectionInput with overrides for the hallucination fields. */
function makeInput(overrides: Partial<CorrectionInput['hallucination']> = {}, locOverrides: Partial<CorrectionInput['location']> = {}): CorrectionInput {
  return {
    hallucination: {
      id: 'h-uuid-001',
      claim_text: 'Test claim text',
      expected_truth: 'Test expected truth',
      category: 'closed',
      severity: 'high',
      model_provider: 'openai-gpt4o',
      ...overrides,
    },
    location: {
      business_name: 'Charcoal N Chill',
      address_line1: '11950 Jones Bridge Road Ste 103',
      city: 'Alpharetta',
      state: 'GA',
      zip: '30005',
      phone: '(470) 546-4866',
      website_url: 'https://charcoalnchill.com',
      hours_data: {
        monday: 'closed',
        tuesday: { open: '17:00', close: '01:00' },
        wednesday: { open: '17:00', close: '01:00' },
        thursday: { open: '17:00', close: '01:00' },
        friday: { open: '17:00', close: '02:00' },
        saturday: { open: '17:00', close: '02:00' },
        sunday: { open: '17:00', close: '01:00' },
      },
      amenities: {
        has_outdoor_seating: true,
        serves_alcohol: true,
        has_hookah: true,
        is_kid_friendly: false,
        takes_reservations: true,
        has_live_music: true,
        has_dj: true,
        has_private_rooms: true,
      },
      categories: ['Hookah Bar', 'Indian Restaurant', 'Fusion Restaurant', 'Lounge'],
      operational_status: 'OPERATIONAL',
      ...locOverrides,
    },
  };
}

// ---------------------------------------------------------------------------
// Category-specific corrections
// ---------------------------------------------------------------------------

describe('generateCorrectionPackage', () => {
  it('1. generates GBP post for "closed" hallucination with business hours', () => {
    const input = makeInput({ category: 'closed', claim_text: 'Charcoal N Chill is permanently closed.' });
    const result = generateCorrectionPackage(input);
    expect(result.content.gbpPost).toBeTruthy();
    expect(result.content.gbpPost).toContain('OPEN');
    expect(result.content.gbpPost).toContain('Charcoal N Chill');
  });

  it('2. generates website snippet for "closed" hallucination with address', () => {
    const input = makeInput({ category: 'closed' });
    const result = generateCorrectionPackage(input);
    expect(result.content.websiteSnippet).toBeTruthy();
    expect(result.content.websiteSnippet).toContain('OPEN');
    expect(result.content.websiteSnippet).toContain('11950 Jones Bridge Road');
  });

  it('3. generates llms.txt entry for "closed" hallucination with OPERATIONAL status', () => {
    const input = makeInput({ category: 'closed' });
    const result = generateCorrectionPackage(input);
    expect(result.content.llmsTxtEntry).toContain('CORRECTION');
    expect(result.content.llmsTxtEntry).toContain('NOT permanently closed');
    expect(result.content.llmsTxtEntry).toContain('OPERATIONAL');
  });

  it('4. generates corrections for "hours" hallucination with formatted hours', () => {
    const input = makeInput({ category: 'hours', claim_text: 'Charcoal N Chill closes at 10pm.' });
    const result = generateCorrectionPackage(input);
    expect(result.diagnosis).toContain('incorrect hours');
    expect(result.content.gbpPost).toContain('hours');
    expect(result.content.llmsTxtEntry).toContain('CORRECTION');
  });

  it('5. generates corrections for "address" hallucination with verified address', () => {
    const input = makeInput({ category: 'address', claim_text: 'Located at 123 Wrong St.' });
    const result = generateCorrectionPackage(input);
    expect(result.diagnosis).toContain('wrong address');
    expect(result.content.gbpPost).toContain('11950 Jones Bridge Road');
    expect(result.content.llmsTxtEntry).toContain('11950 Jones Bridge Road');
  });

  it('6. generates corrections for "phone" hallucination with verified phone', () => {
    const input = makeInput({ category: 'phone', claim_text: 'Call (555) 000-0000.' });
    const result = generateCorrectionPackage(input);
    expect(result.diagnosis).toContain('wrong phone');
    expect(result.content.gbpPost).toContain('(470) 546-4866');
    expect(result.content.llmsTxtEntry).toContain('(470) 546-4866');
  });

  it('7. generates corrections for "menu" hallucination with website URL', () => {
    const input = makeInput({ category: 'menu', claim_text: 'They serve sushi.' });
    const result = generateCorrectionPackage(input);
    expect(result.diagnosis).toContain('incorrect menu');
    expect(result.content.gbpPost).toContain('charcoalnchill.com');
    expect(result.content.llmsTxtEntry).toContain('charcoalnchill.com');
  });

  it('8. generates corrections for "amenity" hallucination', () => {
    const input = makeInput({ category: 'amenity', claim_text: 'No outdoor seating available.' });
    const result = generateCorrectionPackage(input);
    expect(result.diagnosis).toContain('incorrect amenity');
    expect(result.content.llmsTxtEntry).toContain('CORRECTION');
  });

  it('9. generates generic corrections for unknown category', () => {
    const input = makeInput({ category: 'something_unknown' });
    const result = generateCorrectionPackage(input);
    expect(result.diagnosis).toContain('inaccurate information');
    expect(result.content.gbpPost).toBeTruthy();
    expect(result.content.llmsTxtEntry).toContain('CORRECTION');
  });

  // ── Diagnosis ────────────────────────────────────────────────────────

  it('10. includes model_provider name in diagnosis', () => {
    const input = makeInput({ model_provider: 'openai-gpt4o' });
    const result = generateCorrectionPackage(input);
    expect(result.diagnosis).toContain('ChatGPT');
  });

  it('11. includes the hallucinated claim in diagnosis for context', () => {
    const input = makeInput({ category: null, claim_text: 'Some false claim about business' });
    const result = generateCorrectionPackage(input);
    expect(result.diagnosis).toContain('Some false claim about business');
  });

  it('12. includes verified ground truth in diagnosis', () => {
    const input = makeInput({ category: 'closed' });
    const result = generateCorrectionPackage(input);
    expect(result.diagnosis).toContain('actively operating');
    expect(result.diagnosis).toContain('11950 Jones Bridge Road');
  });

  // ── Actions ranking ──────────────────────────────────────────────────

  it('13. ranks actions by impact (high → medium → low)', () => {
    const input = makeInput({ category: 'closed' });
    const result = generateCorrectionPackage(input);
    const impacts = result.actions.map((a) => a.impact);
    const impactOrder = { high: 0, medium: 1, low: 2 };
    for (let i = 1; i < impacts.length; i++) {
      expect(impactOrder[impacts[i]]).toBeGreaterThanOrEqual(impactOrder[impacts[i - 1]]);
    }
  });

  it('14. includes GBP update as high-impact action for closed hallucination', () => {
    const input = makeInput({ category: 'closed' });
    const result = generateCorrectionPackage(input);
    const gbpAction = result.actions.find((a) => a.platform === 'gbp');
    expect(gbpAction).toBeDefined();
    expect(gbpAction!.impact).toBe('high');
  });

  it('15. includes website update as medium-impact action', () => {
    const input = makeInput({ category: 'closed' });
    const result = generateCorrectionPackage(input);
    const websiteAction = result.actions.find((a) => a.platform === 'website');
    expect(websiteAction).toBeDefined();
    expect(websiteAction!.impact).toBe('medium');
  });

  it('16. includes llms.txt update in all correction packages', () => {
    const categories = ['closed', 'hours', 'address', 'phone', 'menu', 'amenity', null];
    for (const cat of categories) {
      const input = makeInput({ category: cat });
      const result = generateCorrectionPackage(input);
      const llmsAction = result.actions.find((a) => a.platform === 'llms_txt');
      expect(llmsAction).toBeDefined();
    }
  });

  // ── Content quality ──────────────────────────────────────────────────

  it('17. GBP post does NOT include the hallucinated claim (no amplification)', () => {
    const input = makeInput({
      category: 'closed',
      claim_text: 'Charcoal N Chill is permanently closed.',
    });
    const result = generateCorrectionPackage(input);
    expect(result.content.gbpPost).not.toContain('permanently closed');
  });

  it('18. GBP post includes business name, address, and current hours', () => {
    const input = makeInput({ category: 'closed' });
    const result = generateCorrectionPackage(input);
    expect(result.content.gbpPost).toContain('Charcoal N Chill');
    expect(result.content.gbpPost).toContain('Alpharetta');
  });

  it('19. llms.txt entry includes both the correction and the false claim (labeled)', () => {
    const input = makeInput({
      category: 'closed',
      claim_text: 'Charcoal N Chill appears to be permanently closed.',
    });
    const result = generateCorrectionPackage(input);
    expect(result.content.llmsTxtEntry).toContain('CORRECTION');
    expect(result.content.llmsTxtEntry).toContain('Charcoal N Chill appears to be permanently closed.');
    expect(result.content.llmsTxtEntry).toContain('incorrect');
  });

  it('20. website snippet is concise (< 200 chars)', () => {
    const input = makeInput({ category: 'closed' });
    const result = generateCorrectionPackage(input);
    expect(result.content.websiteSnippet).toBeTruthy();
    expect(result.content.websiteSnippet!.length).toBeLessThanOrEqual(200);
  });

  it('21. social post is under 280 chars (tweet-length)', () => {
    const input = makeInput({ category: 'closed' });
    const result = generateCorrectionPackage(input);
    expect(result.content.socialPost).toBeTruthy();
    expect(result.content.socialPost!.length).toBeLessThanOrEqual(280);
  });

  // ── Edge cases ───────────────────────────────────────────────────────

  it('22. handles null hours_data (omits hours from content)', () => {
    const input = makeInput({ category: 'closed' }, { hours_data: null });
    const result = generateCorrectionPackage(input);
    expect(result.content.gbpPost).toBeTruthy();
    expect(result.content.gbpPost).toContain('OPEN');
    // Should still generate content without crashing
    expect(result.content.llmsTxtEntry).toContain('CORRECTION');
  });

  it('23. handles null phone (omits phone from content)', () => {
    const input = makeInput({ category: 'phone' }, { phone: null });
    const result = generateCorrectionPackage(input);
    expect(result.content.gbpPost).toBeNull();
    expect(result.content.llmsTxtEntry).toContain('CORRECTION');
  });

  it('24. handles null website_url (omits URL from content)', () => {
    const input = makeInput({ category: 'menu' }, { website_url: null });
    const result = generateCorrectionPackage(input);
    // GBP post should still be generated, just without URL
    expect(result.content.gbpPost).toBeTruthy();
    expect(result.content.gbpPost).not.toContain('charcoalnchill.com');
    expect(result.content.llmsTxtEntry).toContain('CORRECTION');
  });

  it('25. handles null expected_truth (uses generic correction)', () => {
    const input = makeInput({ category: null, expected_truth: null, claim_text: 'Some wrong claim' });
    const result = generateCorrectionPackage(input);
    expect(result.diagnosis).toContain('inaccurate information');
    expect(result.content.llmsTxtEntry).toContain('CORRECTION');
  });

  it('26. uses MOCK_CORRECTION_INPUT from golden-tenant and produces valid package', () => {
    const result = generateCorrectionPackage(MOCK_CORRECTION_INPUT);
    expect(result.diagnosis).toBeTruthy();
    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.content.gbpPost).toBeTruthy();
    expect(result.content.llmsTxtEntry).toBeTruthy();
    expect(result.content.llmsTxtEntry).toContain('CORRECTION');
    expect(result.content.llmsTxtEntry).toContain('Charcoal N Chill');
  });
});

// ---------------------------------------------------------------------------
// formatHoursForCorrection
// ---------------------------------------------------------------------------

describe('formatHoursForCorrection', () => {
  it('27. formats standard hours: groups consecutive days with same hours', () => {
    const hours: HoursData = {
      tuesday: { open: '17:00', close: '01:00' },
      wednesday: { open: '17:00', close: '01:00' },
      thursday: { open: '17:00', close: '01:00' },
      friday: { open: '17:00', close: '02:00' },
      saturday: { open: '17:00', close: '02:00' },
      sunday: { open: '17:00', close: '01:00' },
    };
    const result = formatHoursForCorrection(hours);
    expect(result).toContain('Tue');
    expect(result).toContain('Thu');
    expect(result).toContain('5pm');
    expect(result).toContain('1am');
    expect(result).toContain('2am');
  });

  it('28. handles "closed" day literal correctly', () => {
    const hours: HoursData = {
      monday: 'closed',
      tuesday: { open: '17:00', close: '01:00' },
    };
    const result = formatHoursForCorrection(hours);
    expect(result).toContain('Mon closed');
    expect(result).toContain('Tue');
  });

  it('29. handles missing day keys (omits from output)', () => {
    const hours: HoursData = {
      friday: { open: '18:00', close: '23:00' },
    };
    const result = formatHoursForCorrection(hours);
    expect(result).toBe('Fri 6pm–11pm');
    expect(result).not.toContain('Mon');
    expect(result).not.toContain('Tue');
  });

  it('30. handles single-day business (only one day open)', () => {
    const hours: HoursData = {
      saturday: { open: '10:00', close: '14:00' },
    };
    const result = formatHoursForCorrection(hours);
    expect(result).toBe('Sat 10am–2pm');
  });
});
