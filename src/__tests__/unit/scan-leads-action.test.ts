// ---------------------------------------------------------------------------
// scan-leads-action.test.ts — Unit tests for captureLeadEmail server action
//
// Sprint P2-7b: 14 tests covering validation, DB insert, and error handling.
//
// Run:
//   npx vitest run src/__tests__/unit/scan-leads-action.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSingle = vi.fn();
const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
const mockFrom   = vi.fn().mockReturnValue({ insert: mockInsert });

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn().mockReturnValue({ from: mockFrom }),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

const { captureLeadEmail } = await import('@/app/actions/marketing');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fd(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(entries)) form.set(k, v);
  return form;
}

const VALID = {
  email:        'owner@grill.com',
  businessName: 'Charcoal N Chill',
  scanStatus:   'fail',
};

// ---------------------------------------------------------------------------
// Tests — input validation
// ---------------------------------------------------------------------------

describe('captureLeadEmail — validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSingle.mockResolvedValue({ data: { id: 'lead-001' }, error: null });
  });

  it('returns { ok: false } when email is empty', async () => {
    const result = await captureLeadEmail(fd({ ...VALID, email: '' }));
    expect(result).toEqual({ ok: false });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns { ok: false } when email has no @ sign', async () => {
    const result = await captureLeadEmail(fd({ ...VALID, email: 'notanemail' }));
    expect(result).toEqual({ ok: false });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns { ok: false } when email exceeds 254 chars', async () => {
    const longEmail = 'a'.repeat(250) + '@x.co';
    const result = await captureLeadEmail(fd({ ...VALID, email: longEmail }));
    expect(result).toEqual({ ok: false });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns { ok: false } when scanStatus is invalid', async () => {
    const result = await captureLeadEmail(fd({ ...VALID, scanStatus: 'invalid_status' }));
    expect(result).toEqual({ ok: false });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns { ok: false } when businessName is empty', async () => {
    const result = await captureLeadEmail(fd({ ...VALID, businessName: '' }));
    expect(result).toEqual({ ok: false });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('accepts all three valid scan statuses', async () => {
    for (const scanStatus of ['fail', 'pass', 'not_found']) {
      vi.clearAllMocks();
      mockInsert.mockReturnValue({ select: mockSelect });
      mockSingle.mockResolvedValue({ data: { id: 'lead-001' }, error: null });
      const result = await captureLeadEmail(fd({ ...VALID, scanStatus }));
      expect(result).toEqual({ ok: true, reportId: 'lead-001' });
    }
  });

  it('lowercases the email before insert', async () => {
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSingle.mockResolvedValue({ data: { id: 'lead-001' }, error: null });
    await captureLeadEmail(fd({ ...VALID, email: 'Owner@Grill.COM' }));
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'owner@grill.com' })
    );
  });
});

// ---------------------------------------------------------------------------
// Tests — DB insert
// ---------------------------------------------------------------------------

describe('captureLeadEmail — DB insert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSingle.mockResolvedValue({ data: { id: 'lead-001' }, error: null });
  });

  it('returns { ok: true, reportId } on successful insert', async () => {
    const result = await captureLeadEmail(fd(VALID));
    expect(result).toEqual({ ok: true, reportId: 'lead-001' });
  });

  it('inserts correct field values', async () => {
    await captureLeadEmail(fd(VALID));
    expect(mockInsert).toHaveBeenCalledWith({
      email:         'owner@grill.com',
      business_name: 'Charcoal N Chill',
      scan_status:   'fail',
    });
  });

  it('inserts into scan_leads table via service role', async () => {
    await captureLeadEmail(fd(VALID));
    // mockFrom is called with 'scan_leads' via the cast pattern
    expect(mockFrom).toHaveBeenCalledWith('scan_leads');
  });

  it('returns { ok: false } when DB returns an error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } });
    const result = await captureLeadEmail(fd(VALID));
    expect(result).toEqual({ ok: false });
  });

  it('captures Sentry exception on DB error', async () => {
    const { captureException } = await import('@sentry/nextjs');
    mockSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } });
    await captureLeadEmail(fd(VALID));
    expect(captureException).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests — error handling (thrown exceptions)
// ---------------------------------------------------------------------------

describe('captureLeadEmail — exception handling', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns { ok: false } when supabase throws', async () => {
    mockInsert.mockRejectedValue(new Error('network failure'));
    const result = await captureLeadEmail(fd(VALID));
    expect(result).toEqual({ ok: false });
  });

  it('captures Sentry exception on thrown error', async () => {
    const { captureException } = await import('@sentry/nextjs');
    mockInsert.mockRejectedValue(new Error('network failure'));
    await captureLeadEmail(fd(VALID));
    expect(captureException).toHaveBeenCalled();
  });
});
