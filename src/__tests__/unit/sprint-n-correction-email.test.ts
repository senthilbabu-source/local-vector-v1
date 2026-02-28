// ---------------------------------------------------------------------------
// Sprint N: Correction follow-up email — unit tests
//
// Verifies: sendCorrectionFollowUpAlert function for fixed/recurring results,
// and graceful no-op when RESEND_API_KEY is absent.
//
// Pattern: Constructor mocks must use `function` (not arrows — not
// constructable). See AI_RULES + MEMORY.md Vitest 4.x mock pattern.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn().mockResolvedValue({ id: 'mock-email-id' });

vi.mock('resend', () => {
  return {
    Resend: function Resend() {
      return { emails: { send: mockSend } };
    },
  };
});

// Mock the WeeklyDigest import used in lib/email.ts
vi.mock('@/emails/WeeklyDigest', () => ({
  default: vi.fn(),
}));

describe('Sprint N — Correction Follow-Up Email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = 'test-key';
  });

  it('sends a success email for "fixed" result', async () => {
    const { sendCorrectionFollowUpAlert } = await import('@/lib/email');
    await sendCorrectionFollowUpAlert({
      to: 'owner@test.com',
      businessName: 'Test Hookah Lounge',
      claimText: 'The lounge closes at 9pm',
      result: 'fixed',
      dashboardUrl: 'https://app.localvector.ai/dashboard/hallucinations',
    });

    expect(mockSend).toHaveBeenCalledOnce();
    const call = mockSend.mock.calls[0][0];
    expect(call.to).toBe('owner@test.com');
    expect(call.subject).toContain('Correction confirmed');
    expect(call.html).toContain('Correction Confirmed');
    expect(call.html).toContain('The lounge closes at 9pm');
  });

  it('sends a warning email for "recurring" result', async () => {
    const { sendCorrectionFollowUpAlert } = await import('@/lib/email');
    await sendCorrectionFollowUpAlert({
      to: 'owner@test.com',
      businessName: 'Test Hookah Lounge',
      claimText: 'The lounge closes at 9pm',
      result: 'recurring',
      dashboardUrl: 'https://app.localvector.ai/dashboard/hallucinations',
    });

    expect(mockSend).toHaveBeenCalledOnce();
    const call = mockSend.mock.calls[0][0];
    expect(call.subject).toContain('persists');
    expect(call.html).toContain('Still Present');
  });

  it('no-ops when RESEND_API_KEY is absent', async () => {
    delete process.env.RESEND_API_KEY;

    // Reset modules so lib/email.ts re-evaluates with no env var
    vi.resetModules();
    vi.mock('resend', () => {
      return {
        Resend: function Resend() {
          return { emails: { send: mockSend } };
        },
      };
    });
    vi.mock('@/emails/WeeklyDigest', () => ({
      default: vi.fn(),
    }));

    const { sendCorrectionFollowUpAlert } = await import('@/lib/email');
    await sendCorrectionFollowUpAlert({
      to: 'owner@test.com',
      businessName: 'Test',
      claimText: 'Wrong info',
      result: 'fixed',
      dashboardUrl: 'https://example.com',
    });

    expect(mockSend).not.toHaveBeenCalled();
  });
});
