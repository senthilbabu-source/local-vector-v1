import { describe, it, expect } from 'vitest';
import { buildTurnPrompts, SHOPPER_SCENARIOS } from '@/lib/ai-shopper/shopper-scenarios';
import {
  evaluateTurnAccuracy,
  identifyFailureTurn,
} from '@/lib/ai-shopper/shopper-evaluator';

describe('S25: AI Shopper Simulation', () => {
  describe('SHOPPER_SCENARIOS', () => {
    it('has 4 scenario types', () => {
      expect(Object.keys(SHOPPER_SCENARIOS)).toHaveLength(4);
    });

    it('each scenario has type and turns', () => {
      for (const s of Object.values(SHOPPER_SCENARIOS)) {
        expect(s.type).toBeTruthy();
        expect(s.turns.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('buildTurnPrompts', () => {
    it('returns prompts for discovery scenario', () => {
      const prompts = buildTurnPrompts('discovery', {
        business_name: 'Charcoal & Chill',
        city: 'Atlanta',
        cuisine: 'BBQ',
      });
      expect(prompts.length).toBeGreaterThanOrEqual(2);
      expect(prompts[0]).toContain('BBQ');
    });

    it('returns prompts for hours scenario', () => {
      const prompts = buildTurnPrompts('hours', {
        business_name: 'Test Restaurant',
        city: 'NYC',
        cuisine: 'Italian',
      });
      expect(prompts.length).toBeGreaterThanOrEqual(2);
      expect(prompts[0]).toContain('Test Restaurant');
    });

    it('returns empty for unknown scenario', () => {
      const prompts = buildTurnPrompts('nonexistent', {
        business_name: 'X',
        city: 'Y',
        cuisine: 'Z',
      });
      expect(prompts).toHaveLength(0);
    });

    it('interpolates city placeholder', () => {
      const prompts = buildTurnPrompts('discovery', {
        business_name: 'Test',
        city: 'Chicago',
        cuisine: 'Pizza',
      });
      expect(prompts[0]).toContain('Chicago');
    });
  });

  describe('evaluateTurnAccuracy', () => {
    const groundTruth = {
      business_name: 'Test Place',
      city: 'Atlanta',
      cuisine: 'BBQ',
      phone: '(404) 555-1234',
      address: '123 Main St',
      hours: 'Mon-Fri 11am-9pm',
    };

    it('flags "permanently closed" as failed', () => {
      const result = evaluateTurnAccuracy(
        1,
        'This restaurant is permanently closed.',
        groundTruth,
      );
      expect(result.passed).toBe(false);
      expect(result.accuracy_issues.length).toBeGreaterThan(0);
    });

    it('flags wrong phone as failed', () => {
      const result = evaluateTurnAccuracy(
        1,
        'You can call them at 404-999-9999.',
        groundTruth,
      );
      expect(result.passed).toBe(false);
    });

    it('passes when response has no factual claims about hours/phone/address', () => {
      const result = evaluateTurnAccuracy(
        1,
        'This is a great BBQ restaurant with excellent reviews.',
        groundTruth,
      );
      expect(result.passed).toBe(true);
    });

    it('returns turn number', () => {
      const result = evaluateTurnAccuracy(3, 'Some response', groundTruth);
      expect(result.turn).toBe(3);
    });
  });

  describe('identifyFailureTurn', () => {
    it('returns first failing turn number', () => {
      const evaluations = [
        { turn: 1, passed: true, accuracy_issues: [], confidence: 'low' as const },
        { turn: 2, passed: false, accuracy_issues: ['wrong hours'], confidence: 'high' as const },
        { turn: 3, passed: false, accuracy_issues: ['wrong phone'], confidence: 'high' as const },
      ];
      const result = identifyFailureTurn(evaluations);
      expect(result.failureTurn).toBe(2);
      expect(result.failureReason).toBe('wrong hours');
    });

    it('returns null turn when all pass', () => {
      const evaluations = [
        { turn: 1, passed: true, accuracy_issues: [], confidence: 'low' as const },
        { turn: 2, passed: true, accuracy_issues: [], confidence: 'low' as const },
      ];
      const result = identifyFailureTurn(evaluations);
      expect(result.failureTurn).toBeNull();
      expect(result.failureReason).toBeNull();
    });

    it('returns null turn for empty evaluations', () => {
      const result = identifyFailureTurn([]);
      expect(result.failureTurn).toBeNull();
    });
  });
});
