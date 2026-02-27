// ---------------------------------------------------------------------------
// src/__tests__/unit/send-digest-email.test.ts
//
// Sprint 78: Tests for the Resend email sender wrapper.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DigestPayload } from '@/lib/services/weekly-digest.service';

// ---------------------------------------------------------------------------
// Mock Resend
// ---------------------------------------------------------------------------

const mockSend = vi.fn();

vi.mock('resend', () => {
  return {
    Resend: class MockResend {
      emails = { send: mockSend };
    },
  };
});

// Mock React Email component
vi.mock('@/emails/weekly-digest', () => ({
  default: vi.fn().mockReturnValue('mock-react-element'),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { sendDigestEmail } from '@/lib/email/send-digest';

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const payload: DigestPayload = {
  recipientEmail: 'owner@test.com',
  recipientName: 'Test Owner',
  businessName: 'Test Restaurant',
  subject: 'AI Health: 67 (+3) — Test Restaurant Weekly',
  healthScore: { current: 67, delta: 3, trend: 'up' },
  sov: { currentPercent: 19, delta: 2, trend: 'up' },
  issues: [],
  wins: [],
  opportunities: [],
  botSummary: null,
  dashboardUrl: 'https://app.localvector.ai/dashboard',
  unsubscribeUrl: 'https://app.localvector.ai/dashboard/settings',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sendDigestEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null when RESEND_API_KEY is not set', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    // Clear the module-level lazy Resend instance
    const result = await sendDigestEmail(payload);
    expect(result).toBeNull();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('calls resend.emails.send with correct to/from/subject', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    mockSend.mockResolvedValueOnce({ data: { id: 'email-123' }, error: null });

    await sendDigestEmail(payload);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'LocalVector <digest@localvector.ai>',
        to: 'owner@test.com',
        subject: 'AI Health: 67 (+3) — Test Restaurant Weekly',
      }),
    );
  });

  it('renders WeeklyDigestEmail component via react prop', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    mockSend.mockResolvedValueOnce({ data: { id: 'email-123' }, error: null });

    await sendDigestEmail(payload);

    const sendCall = mockSend.mock.calls[0][0];
    expect(sendCall.react).toBeDefined();
  });

  it('throws on Resend error (caller must .catch)', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { message: 'Rate limited', name: 'rate_limit_exceeded' },
    });

    await expect(sendDigestEmail(payload)).rejects.toThrow('Resend send failed');
  });
});
