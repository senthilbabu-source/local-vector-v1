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
  sendSOVReport,
  sendWeeklyDigest,
  type HallucinationAlertPayload,
  type SOVReportPayload,
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

const SOV_PAYLOAD: SOVReportPayload = {
  to: GOLDEN_TENANT.user.email,
  businessName: GOLDEN_TENANT.location.business_name,
  shareOfVoice: 33,
  queriesRun: 12,
  queriesCited: 4,
  firstMoverCount: 2,
  dashboardUrl: 'https://app.localvector.ai/dashboard/share-of-voice',
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
// sendSOVReport
// ---------------------------------------------------------------------------

describe('sendSOVReport', () => {
  it('no-ops silently when RESEND_API_KEY is absent', async () => {
    delete process.env.RESEND_API_KEY;
    await sendSOVReport(SOV_PAYLOAD);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('calls emails.send with correct fields when key is present', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    await sendSOVReport(SOV_PAYLOAD);

    expect(mockSend).toHaveBeenCalledOnce();
    const args = mockSend.mock.calls[0][0];
    expect(args.to).toBe(GOLDEN_TENANT.user.email);
    expect(args.subject).toContain(GOLDEN_TENANT.location.business_name);
    expect(args.html).toBeDefined();
  });

  it('includes First Mover section when firstMoverCount > 0', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    await sendSOVReport({ ...SOV_PAYLOAD, firstMoverCount: 3 });

    const args = mockSend.mock.calls[0][0];
    expect(args.html).toContain('First Mover');
  });

  it('omits First Mover section when firstMoverCount === 0', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    await sendSOVReport({ ...SOV_PAYLOAD, firstMoverCount: 0 });

    const args = mockSend.mock.calls[0][0];
    expect(args.html).not.toContain('First Mover');
  });

  it('uses reports@localvector.ai as from address', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    await sendSOVReport(SOV_PAYLOAD);

    const args = mockSend.mock.calls[0][0];
    expect(args.from).toBe('LocalVector Reports <reports@localvector.ai>');
  });
});

// ---------------------------------------------------------------------------
// sendWeeklyDigest
// ---------------------------------------------------------------------------

describe('sendWeeklyDigest', () => {
  it('no-ops silently when RESEND_API_KEY is absent', async () => {
    delete process.env.RESEND_API_KEY;
    await sendWeeklyDigest(DIGEST_PAYLOAD);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('passes react: property (not html:) to emails.send', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    await sendWeeklyDigest(DIGEST_PAYLOAD);

    expect(mockSend).toHaveBeenCalledOnce();
    const args = mockSend.mock.calls[0][0];
    expect(args.react).toBeDefined();
    expect(args.html).toBeUndefined();
  });

  it('uses reports@localvector.ai as from address', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    await sendWeeklyDigest(DIGEST_PAYLOAD);

    const args = mockSend.mock.calls[0][0];
    expect(args.from).toBe('LocalVector Reports <reports@localvector.ai>');
  });
});
