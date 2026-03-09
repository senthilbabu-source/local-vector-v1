/**
 * Unit Tests — Email Service (Resend)
 *
 * Strategy: the Resend class and WeeklyDigest React Email component are fully
 * mocked at the module level. Each test controls process.env.RESEND_API_KEY
 * to verify both the no-op path (missing key) and the send path (key present).
 *
 * Run:
 *   npx vitest run src/__tests__/unit/email-service.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GOLDEN_TENANT } from '@/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Module-level mocks — replaces resend + emails/WeeklyDigest for all tests
// ---------------------------------------------------------------------------

const mockSend = vi.fn().mockResolvedValue({ id: 'mock-email-id' });

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: mockSend };
  },
}));

vi.mock('@/emails/WeeklyDigest', () => ({
  default: () => 'mock-weekly-digest-element',
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import {
  sendHallucinationAlert,
  sendWeeklyDigest,
  type HallucinationAlertPayload,
  type WeeklyDigestPayload,
} from '@/lib/email';

// ---------------------------------------------------------------------------
// Fixtures (Golden Tenant — AI_RULES §4)
// ---------------------------------------------------------------------------

const HALLUCINATION_PAYLOAD: HallucinationAlertPayload = {
  to: GOLDEN_TENANT.user.email,
  orgName: GOLDEN_TENANT.org.name,
  businessName: GOLDEN_TENANT.location.business_name,
  hallucinationCount: 3,
  dashboardUrl: 'https://app.localvector.ai/dashboard',
};

const DIGEST_PAYLOAD: WeeklyDigestPayload = {
  to: GOLDEN_TENANT.user.email,
  businessName: GOLDEN_TENANT.location.business_name,
  shareOfVoice: 33,
  queriesRun: 12,
  queriesCited: 4,
  firstMoverCount: 2,
  dashboardUrl: 'https://app.localvector.ai/dashboard',
};

// ---------------------------------------------------------------------------
// Env var management
// ---------------------------------------------------------------------------

let savedResendKey: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  mockSend.mockResolvedValue({ id: 'mock-email-id' });
  savedResendKey = process.env.RESEND_API_KEY;
});

afterEach(() => {
  if (savedResendKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = savedResendKey;
});

// ---------------------------------------------------------------------------
// sendHallucinationAlert
// ---------------------------------------------------------------------------

describe('sendHallucinationAlert', () => {
  it('no-ops silently when RESEND_API_KEY is absent', async () => {
    delete process.env.RESEND_API_KEY;
    await sendHallucinationAlert(HALLUCINATION_PAYLOAD);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('calls emails.send with correct from, to, subject, and html when key is present', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    await sendHallucinationAlert(HALLUCINATION_PAYLOAD);

    expect(mockSend).toHaveBeenCalledOnce();
    const args = mockSend.mock.calls[0][0];
    expect(args.from).toBe('LocalVector Alerts <alerts@localvector.ai>');
    expect(args.to).toBe(GOLDEN_TENANT.user.email);
    expect(args.subject).toContain('hallucination');
    expect(args.html).toBeDefined();
  });

  it('uses singular subject for hallucinationCount === 1', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    await sendHallucinationAlert({ ...HALLUCINATION_PAYLOAD, hallucinationCount: 1 });

    const args = mockSend.mock.calls[0][0];
    expect(args.subject).toContain('1 AI hallucination ');
    expect(args.subject).not.toContain('hallucinations');
  });

  it('uses plural subject for hallucinationCount > 1', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    await sendHallucinationAlert({ ...HALLUCINATION_PAYLOAD, hallucinationCount: 5 });

    const args = mockSend.mock.calls[0][0];
    expect(args.subject).toContain('5 AI hallucinations');
  });

  it('includes dashboard URL in HTML body', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    await sendHallucinationAlert(HALLUCINATION_PAYLOAD);

    const args = mockSend.mock.calls[0][0];
    expect(args.html).toContain(HALLUCINATION_PAYLOAD.dashboardUrl);
  });

  it('propagates errors from Resend API (does not swallow)', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockSend.mockRejectedValueOnce(new Error('Resend API error'));

    await expect(sendHallucinationAlert(HALLUCINATION_PAYLOAD)).rejects.toThrow(
      'Resend API error'
    );
  });
});

// ---------------------------------------------------------------------------
// sendWeeklyDigest
// ---------------------------------------------------------------------------

describe('sendWeeklyDigest (deprecated — Sprint 117)', () => {
  it('no-ops silently when RESEND_API_KEY is absent', async () => {
    delete process.env.RESEND_API_KEY;
    await sendWeeklyDigest(DIGEST_PAYLOAD);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('no-ops even when RESEND_API_KEY is present (deprecated)', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    await sendWeeklyDigest(DIGEST_PAYLOAD);

    // Sprint 117: sendWeeklyDigest is deprecated, replaced by sendEnhancedDigest
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns void without throwing', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    // Should not throw even though it's a no-op
    await expect(sendWeeklyDigest(DIGEST_PAYLOAD)).resolves.toBeUndefined();
  });
});
