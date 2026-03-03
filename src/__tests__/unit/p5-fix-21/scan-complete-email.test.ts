// ---------------------------------------------------------------------------
// src/__tests__/unit/p5-fix-21/scan-complete-email.test.ts — P5-FIX-21
//
// Tests for sendScanCompleteEmail transactional email function.
// Validates: no-op without API key, subject lines, first-scan vs repeat,
// citation rate calculation, HTML content, Resend API calls.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Resend
// ---------------------------------------------------------------------------

const mockSend = vi.fn().mockResolvedValue({ data: { id: 'msg-1' }, error: null });

vi.mock('resend', () => ({
  Resend: function MockResend() {
    return { emails: { send: mockSend } };
  },
}));

// Mock digest deps to prevent import side-effects
vi.mock('@/emails/WeeklyDigest', () => ({
  default: vi.fn(),
  formatWeekOf: vi.fn(() => 'Mar 3'),
}));
vi.mock('@/lib/digest/types', () => ({}));
vi.mock('@/lib/digest/send-gate', () => ({
  shouldSendDigest: vi.fn(() => ({ should_send: false })),
}));
vi.mock('@/emails/InvitationEmail', () => ({
  default: vi.fn(),
}));
vi.mock('@/lib/invitations/invitation-email', () => ({}));

// Import after mocks
import { sendScanCompleteEmail, type ScanCompletePayload } from '@/lib/email';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePayload(overrides: Partial<ScanCompletePayload> = {}): ScanCompletePayload {
  return {
    to: 'owner@restaurant.com',
    businessName: 'Taco Palace',
    shareOfVoice: 42,
    queriesRun: 20,
    queriesCited: 8,
    isFirstScan: false,
    dashboardUrl: 'https://app.localvector.ai/dashboard',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sendScanCompleteEmail', () => {
  const originalEnv = process.env.RESEND_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = 'test-key';
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.RESEND_API_KEY = originalEnv;
    } else {
      delete process.env.RESEND_API_KEY;
    }
  });

  it('no-ops when RESEND_API_KEY is absent', async () => {
    delete process.env.RESEND_API_KEY;
    await sendScanCompleteEmail(makePayload());
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('sends email when RESEND_API_KEY is present', async () => {
    await sendScanCompleteEmail(makePayload());
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('uses first-scan subject when isFirstScan=true', async () => {
    await sendScanCompleteEmail(makePayload({ isFirstScan: true }));
    const call = mockSend.mock.calls[0][0];
    expect(call.subject).toContain('first AI visibility scan');
    expect(call.subject).toContain('Taco Palace');
  });

  it('uses weekly subject when isFirstScan=false', async () => {
    await sendScanCompleteEmail(makePayload({ isFirstScan: false }));
    const call = mockSend.mock.calls[0][0];
    expect(call.subject).toContain('Weekly scan complete');
    expect(call.subject).toContain('Taco Palace');
  });

  it('sends to correct recipient', async () => {
    await sendScanCompleteEmail(makePayload({ to: 'chef@pasta.com' }));
    const call = mockSend.mock.calls[0][0];
    expect(call.to).toBe('chef@pasta.com');
  });

  it('sends from localvector.ai domain', async () => {
    await sendScanCompleteEmail(makePayload());
    const call = mockSend.mock.calls[0][0];
    expect(call.from).toContain('localvector.ai');
  });

  it('includes share of voice in HTML', async () => {
    await sendScanCompleteEmail(makePayload({ shareOfVoice: 65 }));
    const call = mockSend.mock.calls[0][0];
    expect(call.html).toContain('65%');
  });

  it('includes queries run count in HTML', async () => {
    await sendScanCompleteEmail(makePayload({ queriesRun: 30 }));
    const call = mockSend.mock.calls[0][0];
    expect(call.html).toContain('30');
  });

  it('calculates citation rate correctly', async () => {
    // 8 cited out of 20 queries = 40%
    await sendScanCompleteEmail(makePayload({ queriesRun: 20, queriesCited: 8 }));
    const call = mockSend.mock.calls[0][0];
    expect(call.html).toContain('40%');
  });

  it('citation rate is 0% when no queries run', async () => {
    await sendScanCompleteEmail(makePayload({ queriesRun: 0, queriesCited: 0 }));
    const call = mockSend.mock.calls[0][0];
    expect(call.html).toContain('0%');
  });

  it('includes onboarding guidance for first scan', async () => {
    await sendScanCompleteEmail(makePayload({ isFirstScan: true }));
    const call = mockSend.mock.calls[0][0];
    expect(call.html).toContain('real data');
    expect(call.html).toContain('AI Mentions');
  });

  it('omits onboarding guidance for repeat scans', async () => {
    await sendScanCompleteEmail(makePayload({ isFirstScan: false }));
    const call = mockSend.mock.calls[0][0];
    expect(call.html).not.toContain('real data');
  });

  it('includes dashboard link', async () => {
    await sendScanCompleteEmail(makePayload({
      dashboardUrl: 'https://app.localvector.ai/dashboard/custom',
    }));
    const call = mockSend.mock.calls[0][0];
    expect(call.html).toContain('https://app.localvector.ai/dashboard/custom');
    expect(call.html).toContain('View Dashboard');
  });

  it('handles 100% citation rate', async () => {
    await sendScanCompleteEmail(makePayload({ queriesRun: 10, queriesCited: 10 }));
    const call = mockSend.mock.calls[0][0];
    expect(call.html).toContain('100%');
  });
});

// ---------------------------------------------------------------------------
// Citation rate computation (isolated)
// ---------------------------------------------------------------------------

describe('citation rate computation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = 'test-key';
  });

  it('rounds to nearest integer', async () => {
    // 1/3 = 33.33... → 33%
    await sendScanCompleteEmail(makePayload({ queriesRun: 3, queriesCited: 1 }));
    const call = mockSend.mock.calls[0][0];
    expect(call.html).toContain('33%');
  });
});
