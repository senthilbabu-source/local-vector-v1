import { describe, it, expect } from 'vitest';
import { countItemMentions } from '@/lib/menu-intelligence/demand-analyzer';

describe('S24: Menu Intelligence Demand Signals', () => {
  describe('countItemMentions', () => {
    it('counts case-insensitive mentions', () => {
      const responses = ['Try the BBQ Brisket at this place', 'Their bbq brisket is great'];
      expect(countItemMentions('BBQ Brisket', responses)).toBe(2);
    });

    it('skips items shorter than 3 chars', () => {
      expect(countItemMentions('Ab', ['Ab is mentioned'])).toBe(0);
    });

    it('returns 0 when no matches', () => {
      expect(countItemMentions('Lobster', ['Great steak and ribs'])).toBe(0);
    });

    it('counts all occurrences in same response', () => {
      const responses = ['BBQ Brisket is good. BBQ Brisket is the best.'];
      // Counts each occurrence
      expect(countItemMentions('BBQ Brisket', responses)).toBe(2);
    });

    it('handles empty responses array', () => {
      expect(countItemMentions('Test', [])).toBe(0);
    });

    it('matches partial word (substring)', () => {
      // "Pulled Pork" inside "Pulled Pork Sandwich"
      expect(countItemMentions('Pulled Pork', ['Try the Pulled Pork Sandwich'])).toBe(1);
    });

    it('handles exactly 3 chars item name', () => {
      expect(countItemMentions('Pie', ['Apple Pie is great'])).toBe(1);
    });
  });
});
