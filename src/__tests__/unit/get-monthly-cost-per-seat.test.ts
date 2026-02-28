// ---------------------------------------------------------------------------
// get-monthly-cost-per-seat.test.ts — Unit tests for Stripe price fetch
//
// Sprint C (H6): Tests getMonthlyCostPerSeat() utility.
// Mocks Stripe — no real Stripe API calls.
//
// Run:
//   npx vitest run src/__tests__/unit/get-monthly-cost-per-seat.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoist mocks ───────────────────────────────────────────────────────────

const mockRetrieve = vi.fn();

vi.mock('stripe', () => {
  return {
    default: function MockStripe() {
      return { prices: { retrieve: mockRetrieve } };
    },
  };
});

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// ── Import subjects ───────────────────────────────────────────────────────

import { getMonthlyCostPerSeat } from '@/lib/stripe/get-monthly-cost-per-seat';
import * as Sentry from '@sentry/nextjs';

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
});

afterEach(() => {
  delete process.env.STRIPE_SECRET_KEY;
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('getMonthlyCostPerSeat', () => {
  it('returns null when stripePriceId is null', async () => {
    const result = await getMonthlyCostPerSeat(null);
    expect(result).toBeNull();
    expect(mockRetrieve).not.toHaveBeenCalled();
  });

  it('returns null when STRIPE_SECRET_KEY env var is not set', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const result = await getMonthlyCostPerSeat('price_123');
    expect(result).toBeNull();
  });

  it('calls stripe.prices.retrieve with the correct price ID', async () => {
    mockRetrieve.mockResolvedValue({
      unit_amount: 2900,
      recurring: { interval: 'month' },
    });
    await getMonthlyCostPerSeat('price_abc123');
    expect(mockRetrieve).toHaveBeenCalledWith('price_abc123');
  });

  it('converts Stripe cents to dollars: unit_amount=2900 → returns 29', async () => {
    mockRetrieve.mockResolvedValue({
      unit_amount: 2900,
      recurring: { interval: 'month' },
    });
    const result = await getMonthlyCostPerSeat('price_123');
    expect(result).toBe(29);
  });

  it('handles annual price: unit_amount=34800 (annual) → returns 29 monthly', async () => {
    mockRetrieve.mockResolvedValue({
      unit_amount: 34800,
      recurring: { interval: 'year' },
    });
    const result = await getMonthlyCostPerSeat('price_annual');
    expect(result).toBe(29);
  });

  it('returns null when unit_amount is null (metered pricing)', async () => {
    mockRetrieve.mockResolvedValue({
      unit_amount: null,
      recurring: { interval: 'month' },
    });
    const result = await getMonthlyCostPerSeat('price_metered');
    expect(result).toBeNull();
  });

  it('returns null when unit_amount is 0', async () => {
    mockRetrieve.mockResolvedValue({
      unit_amount: 0,
      recurring: { interval: 'month' },
    });
    const result = await getMonthlyCostPerSeat('price_free');
    expect(result).toBeNull();
  });

  it('when Stripe API throws, captures to Sentry and returns null', async () => {
    const error = new Error('Stripe API error');
    mockRetrieve.mockRejectedValue(error);
    const result = await getMonthlyCostPerSeat('price_bad');
    expect(result).toBeNull();
    expect(Sentry.captureException).toHaveBeenCalledWith(error, expect.objectContaining({
      tags: { function: 'getMonthlyCostPerSeat', sprint: 'C' },
    }));
  });

  it('does NOT propagate the error to the caller', async () => {
    mockRetrieve.mockRejectedValue(new Error('network error'));
    await expect(getMonthlyCostPerSeat('price_bad')).resolves.toBeNull();
  });

  it('handles monthly price with odd cents correctly', async () => {
    mockRetrieve.mockResolvedValue({
      unit_amount: 1999,
      recurring: { interval: 'month' },
    });
    const result = await getMonthlyCostPerSeat('price_odd');
    expect(result).toBe(19.99);
  });

  it('handles annual price rounding correctly', async () => {
    // 35000 cents / 12 = 2916.67 cents → round → 2917 → /100 = 29
    mockRetrieve.mockResolvedValue({
      unit_amount: 35000,
      recurring: { interval: 'year' },
    });
    const result = await getMonthlyCostPerSeat('price_annual_odd');
    expect(result).toBe(29); // Math.round(35000/12/100)
  });
});
