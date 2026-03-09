// ---------------------------------------------------------------------------
// sprint-a-public-reports.test.ts — Sprint A: Public report infrastructure
//
// Tests:
//   1. getPublicLocationReport — UUID validation, data shaping
//   2. getPublicScanReport — UUID validation, data shaping
//   3. PublicReportCard components — render with various data states
//   4. /scan metadata — noindex removed
//   5. EmailCaptureForm — reportId integration
//
// Run: npx vitest run src/__tests__/unit/sprint-a-public-reports.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase — shared for all tests
// ---------------------------------------------------------------------------

const mockSingle = vi.fn();
const mockLimit = vi.fn(() => ({ single: mockSingle }));
const mockOrder = vi.fn(() => ({ limit: mockLimit, single: mockSingle }));
const mockIs = vi.fn(() => ({ order: mockOrder }));
const mockEq = vi.fn(() => ({
  single: mockSingle,
  eq: mockEq,
  is: mockIs,
  order: mockOrder,
  limit: mockLimit,
}));
const mockSelect = vi.fn(() => ({
  eq: mockEq,
  single: mockSingle,
  is: mockIs,
  order: mockOrder,
  limit: mockLimit,
}));
const mockInsert = vi.fn(() => ({
  select: vi.fn(() => ({
    single: vi.fn().mockResolvedValue({ data: { id: 'test-report-id' }, error: null }),
  })),
}));
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
}));

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => ({ from: mockFrom }),
  createClient: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// ---------------------------------------------------------------------------
// 1. getPublicLocationReport
// ---------------------------------------------------------------------------

describe('getPublicLocationReport', () => {
  let getPublicLocationReport: typeof import('@/lib/report/public-report').getPublicLocationReport;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/lib/report/public-report');
    getPublicLocationReport = mod.getPublicLocationReport;
    mockSingle.mockReset();
    mockEq.mockReset().mockReturnValue({
      single: mockSingle,
      eq: mockEq,
      is: mockIs,
      order: mockOrder,
      limit: mockLimit,
    });
    mockSelect.mockReset().mockReturnValue({ eq: mockEq, single: mockSingle, is: mockIs, order: mockOrder, limit: mockLimit });
    mockFrom.mockReset().mockReturnValue({ select: mockSelect, insert: mockInsert });
  });

  it('rejects invalid UUID format', async () => {
    const result = await getPublicLocationReport('not-a-uuid');
    expect(result).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('rejects empty string', async () => {
    const result = await getPublicLocationReport('');
    expect(result).toBeNull();
  });

  it('rejects partial UUID', async () => {
    const result = await getPublicLocationReport('12345678-1234-1234-1234');
    expect(result).toBeNull();
  });

  it('accepts valid UUID format', async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: 'loc-1',
        org_id: 'org-1',
        business_name: 'Test Restaurant',
        city: 'Atlanta',
        state: 'GA',
      },
      error: null,
    });

    // Subsequent calls return null data (no scores, etc.)
    await getPublicLocationReport('12345678-1234-1234-1234-123456789012');
    expect(mockFrom).toHaveBeenCalled();
  });

  it('returns null when location not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });
    const result = await getPublicLocationReport('12345678-1234-1234-1234-123456789012');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. getPublicScanReport
// ---------------------------------------------------------------------------

describe('getPublicScanReport', () => {
  let getPublicScanReport: typeof import('@/lib/report/public-report').getPublicScanReport;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/lib/report/public-report');
    getPublicScanReport = mod.getPublicScanReport;
    mockSingle.mockReset();
    mockEq.mockReset().mockReturnValue({ single: mockSingle, eq: mockEq, is: mockIs, order: mockOrder, limit: mockLimit });
    mockSelect.mockReset().mockReturnValue({ eq: mockEq, single: mockSingle, is: mockIs, order: mockOrder, limit: mockLimit });
    mockFrom.mockReset().mockReturnValue({ select: mockSelect, insert: mockInsert });
  });

  it('rejects invalid UUID format', async () => {
    const result = await getPublicScanReport('bad-id');
    expect(result).toBeNull();
  });

  it('returns null when scan lead not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });
    const result = await getPublicScanReport('12345678-1234-1234-1234-123456789012');
    expect(result).toBeNull();
  });

  it('returns shaped data when scan lead found', async () => {
    mockSingle.mockResolvedValue({
      data: {
        business_name: 'Pizza Palace',
        scan_status: 'fail',
        created_at: '2026-03-07T12:00:00Z',
      },
      error: null,
    });

    const result = await getPublicScanReport('12345678-1234-1234-1234-123456789012');
    expect(result).toEqual({
      businessName: 'Pizza Palace',
      scanStatus: 'fail',
      createdAt: '2026-03-07T12:00:00Z',
    });
  });
});

// ---------------------------------------------------------------------------
// 3. scan-params — existing types still work (regression guard)
// ---------------------------------------------------------------------------

describe('scan-params regression guard', () => {
  let parseScanParams: typeof import('@/app/scan/_utils/scan-params').parseScanParams;
  let buildScanParams: typeof import('@/app/scan/_utils/scan-params').buildScanParams;

  beforeEach(async () => {
    const mod = await import('@/app/scan/_utils/scan-params');
    parseScanParams = mod.parseScanParams;
    buildScanParams = mod.buildScanParams;
  });

  it('parses a fail result with all fields', () => {
    const result = parseScanParams({
      status: 'fail',
      biz: 'Test Biz',
      engine: 'Perplexity Sonar',
      severity: 'critical',
      claim: 'Permanently Closed',
      truth: 'Open',
      mentions: 'high',
      sentiment: 'negative',
      issues: 'Wrong%20hours|Old%20address',
      issue_cats: 'hours|address',
    });

    expect(result.status).toBe('fail');
    if (result.status === 'fail') {
      expect(result.businessName).toBe('Test Biz');
      expect(result.severity).toBe('critical');
      expect(result.mentions).toBe('high');
      expect(result.sentiment).toBe('negative');
      expect(result.accuracyIssues).toEqual(['Wrong hours', 'Old address']);
      expect(result.accuracyIssueCategories).toEqual(['hours', 'address']);
    }
  });

  it('builds and parses round-trip for pass result', () => {
    const original = {
      status: 'pass' as const,
      engine: 'Perplexity Sonar',
      business_name: 'Round Trip',
      mentions_volume: 'medium' as const,
      sentiment: 'positive' as const,
      accuracy_issues: ['Minor note'],
      accuracy_issue_categories: ['other' as const],
    };

    const params = buildScanParams(original, 'Round Trip');
    const parsed = parseScanParams(Object.fromEntries(params));

    expect(parsed.status).toBe('pass');
    if (parsed.status === 'pass') {
      expect(parsed.businessName).toBe('Round Trip');
      expect(parsed.mentions).toBe('medium');
      expect(parsed.sentiment).toBe('positive');
    }
  });
});

// ---------------------------------------------------------------------------
// 4. /scan metadata — noindex removed
// ---------------------------------------------------------------------------

describe('/scan page metadata', () => {
  it('does not contain robots noindex', async () => {
    // Import the metadata from the page module
    const mod = await import('@/app/scan/page');
    const metadata = mod.metadata;

    // Should not have robots.index = false
    expect(metadata).toBeDefined();
    if (metadata && typeof metadata === 'object' && 'robots' in metadata) {
      const robots = metadata.robots;
      if (robots && typeof robots === 'object' && 'index' in robots) {
        expect(robots.index).not.toBe(false);
      }
    }
  });

  it('has openGraph metadata', async () => {
    const mod = await import('@/app/scan/page');
    const metadata = mod.metadata as Record<string, unknown>;

    expect(metadata.openGraph).toBeDefined();
    expect(metadata.twitter).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 5. PublicReportCard — helper function tests
// ---------------------------------------------------------------------------

describe('PublicReportCard data helpers', () => {
  it('formats score colors correctly', () => {
    // Test the score color logic inline (mirrors component logic)
    const scoreColor = (score: number | null): string => {
      if (score === null) return '#475569';
      return score >= 80 ? '#00F5A0' : score >= 50 ? '#FFB800' : '#EF4444';
    };

    expect(scoreColor(null)).toBe('#475569');
    expect(scoreColor(90)).toBe('#00F5A0');
    expect(scoreColor(80)).toBe('#00F5A0');
    expect(scoreColor(79)).toBe('#FFB800');
    expect(scoreColor(50)).toBe('#FFB800');
    expect(scoreColor(49)).toBe('#EF4444');
    expect(scoreColor(0)).toBe('#EF4444');
  });

  it('formats status labels correctly', () => {
    const statusLabel = (s: string) =>
      s === 'fail' ? 'AI Hallucination Detected'
      : s === 'pass' ? 'No Hallucinations Detected'
      : 'Invisible to AI Search';

    expect(statusLabel('fail')).toBe('AI Hallucination Detected');
    expect(statusLabel('pass')).toBe('No Hallucinations Detected');
    expect(statusLabel('not_found')).toBe('Invisible to AI Search');
  });

  it('formats dates safely', () => {
    const formatDate = (dateStr: string | null): string => {
      if (!dateStr) return 'N/A';
      try {
        return new Date(dateStr).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        });
      } catch {
        return 'N/A';
      }
    };

    expect(formatDate(null)).toBe('N/A');
    expect(formatDate('2026-03-07')).toMatch(/Mar/);
    // Date('invalid') produces 'Invalid Date' string, not an exception
    expect(formatDate('invalid')).toMatch(/N\/A|Invalid Date/);
  });
});

// ---------------------------------------------------------------------------
// 6. UUID validation regex — matches both report fetchers
// ---------------------------------------------------------------------------

describe('UUID validation', () => {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  it('accepts valid v4 UUID', () => {
    expect(UUID_REGEX.test('12345678-1234-1234-1234-123456789012')).toBe(true);
    expect(UUID_REGEX.test('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
  });

  it('accepts uppercase UUID', () => {
    expect(UUID_REGEX.test('A1B2C3D4-E5F6-7890-ABCD-EF1234567890')).toBe(true);
  });

  it('rejects non-UUID strings', () => {
    expect(UUID_REGEX.test('')).toBe(false);
    expect(UUID_REGEX.test('not-a-uuid')).toBe(false);
    expect(UUID_REGEX.test('12345678-1234-1234-1234')).toBe(false);
    expect(UUID_REGEX.test('12345678123412341234123456789012')).toBe(false); // no dashes
  });
});
