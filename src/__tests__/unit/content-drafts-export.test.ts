// @vitest-environment node
// ---------------------------------------------------------------------------
// Tests for §205: Content Drafts Copy/Export
//
// Part 1 — buildContentDraftsCSV (pure, 15 cases)
// Part 2 — exportDraftsAction server action (12 cases)
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildContentDraftsCSV,
  escapeCSVValue,
  sanitizeCSVField,
  type ContentDraftExportRow,
} from '@/lib/exports/csv-builder';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDraftRow(overrides: Partial<ContentDraftExportRow> = {}): ContentDraftExportRow {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    draft_title: 'Test Draft Title',
    draft_content: 'This is the draft content for testing.',
    status: 'draft',
    content_type: 'faq_page',
    trigger_type: 'manual',
    aeo_score: 72,
    target_prompt: 'best pizza near me',
    created_at: '2026-03-04T10:00:00Z',
    ...overrides,
  };
}

const CSV_HEADER = 'Title,Content,Status,Type,Trigger,AEO Score,Target Prompt,Created';

// ---------------------------------------------------------------------------
// Part 1: buildContentDraftsCSV — pure function tests
// ---------------------------------------------------------------------------

describe('buildContentDraftsCSV', () => {
  it('returns header-only when rows is empty', () => {
    const csv = buildContentDraftsCSV([]);
    expect(csv).toBe(CSV_HEADER);
    expect(csv).not.toContain('\r\n');
  });

  it('returns header + 1 data line for a single row', () => {
    const row = makeDraftRow();
    const csv = buildContentDraftsCSV([row]);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(CSV_HEADER);
    expect(lines[1]).toContain('Test Draft Title');
  });

  it('renders aeo_score: null as N/A', () => {
    const csv = buildContentDraftsCSV([makeDraftRow({ aeo_score: null })]);
    expect(csv).toContain('N/A');
  });

  it('renders aeo_score numeric as string', () => {
    const csv = buildContentDraftsCSV([makeDraftRow({ aeo_score: 85 })]);
    expect(csv).toContain('85');
  });

  it('renders target_prompt: null as empty string', () => {
    const row = makeDraftRow({ target_prompt: null });
    const csv = buildContentDraftsCSV([row]);
    // target_prompt column should be empty (between two commas)
    expect(csv).toContain(',,');
  });

  it('truncates draft_content at 500 chars (default)', () => {
    const longContent = 'A'.repeat(600);
    const csv = buildContentDraftsCSV([makeDraftRow({ draft_content: longContent })]);
    // Content field should be exactly 500 A's (possibly quoted)
    expect(csv).toContain('A'.repeat(500));
    expect(csv).not.toContain('A'.repeat(501));
  });

  it('respects custom maxContentLength option', () => {
    const longContent = 'B'.repeat(200);
    const csv = buildContentDraftsCSV([makeDraftRow({ draft_content: longContent })], {
      maxContentLength: 100,
    });
    expect(csv).toContain('B'.repeat(100));
    expect(csv).not.toContain('B'.repeat(101));
  });

  it('wraps content with commas in double quotes', () => {
    const csv = buildContentDraftsCSV([makeDraftRow({ draft_content: 'Hello, world' })]);
    expect(csv).toContain('"Hello, world"');
  });

  it('doubles internal double quotes (RFC 4180)', () => {
    const csv = buildContentDraftsCSV([makeDraftRow({ draft_content: 'Say "hello"' })]);
    expect(csv).toContain('"Say ""hello"""');
  });

  it('prevents formula injection with = prefix', () => {
    const csv = buildContentDraftsCSV([makeDraftRow({ draft_title: '=SUM(A1:A10)' })]);
    expect(csv).toContain("'=SUM(A1:A10)");
    expect(csv).not.toContain(',=SUM');
  });

  it('prevents formula injection with + prefix', () => {
    const csv = buildContentDraftsCSV([makeDraftRow({ draft_title: '+malicious' })]);
    expect(csv).toContain("'+malicious");
  });

  it('maps all 5 statuses to correct labels', () => {
    const statuses: [string, string][] = [
      ['draft', 'Draft'],
      ['approved', 'Approved'],
      ['published', 'Published'],
      ['rejected', 'Rejected'],
      ['archived', 'Archived'],
    ];
    for (const [status, label] of statuses) {
      const csv = buildContentDraftsCSV([makeDraftRow({ status })]);
      expect(csv).toContain(label);
    }
  });

  it('maps all 5 content_types to correct labels', () => {
    const types: [string, string][] = [
      ['faq_page', 'FAQ Page'],
      ['occasion_page', 'Occasion Page'],
      ['blog_post', 'Blog Post'],
      ['landing_page', 'Landing Page'],
      ['gbp_post', 'GBP Post'],
    ];
    for (const [content_type, label] of types) {
      const csv = buildContentDraftsCSV([makeDraftRow({ content_type })]);
      expect(csv).toContain(label);
    }
  });

  it('maps all 8 trigger_types to correct labels', () => {
    const triggers: [string, string][] = [
      ['manual', 'Manual'],
      ['occasion', 'Occasion'],
      ['first_mover', 'First Mover'],
      ['prompt_missing', 'Prompt Gap'],
      ['competitor_gap', 'Competitor Gap'],
      ['review_gap', 'Review Gap'],
      ['schema_gap', 'Schema Gap'],
      ['hallucination_correction', 'Hallucination Fix'],
    ];
    for (const [trigger_type, label] of triggers) {
      const csv = buildContentDraftsCSV([makeDraftRow({ trigger_type })]);
      expect(csv).toContain(label);
    }
  });

  it('uses CRLF line endings between rows (RFC 4180)', () => {
    const rows = [makeDraftRow(), makeDraftRow({ id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' })];
    const csv = buildContentDraftsCSV(rows);
    expect(csv).toContain('\r\n');
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(3); // header + 2 data rows
  });

  it('produces correct row count for multiple rows', () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      makeDraftRow({ id: `${'a'.repeat(8)}-aaaa-aaaa-aaaa-aaaaaaaaa${String(i).padStart(3, '0')}` })
    );
    const csv = buildContentDraftsCSV(rows);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(6); // header + 5 rows
  });

  it('passes through unknown status/type values as-is', () => {
    const csv = buildContentDraftsCSV([
      makeDraftRow({ status: 'unknown_status', content_type: 'unknown_type' }),
    ]);
    expect(csv).toContain('unknown_status');
    expect(csv).toContain('unknown_type');
  });
});

// ---------------------------------------------------------------------------
// Part 2: exportDraftsAction server action
// ---------------------------------------------------------------------------

// Hoisted mocks
const mockGetSafeAuthContext = vi.fn();
vi.mock('@/lib/auth', () => ({ getSafeAuthContext: mockGetSafeAuthContext }));

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }));

const mockSentryCapture = vi.fn();
vi.mock('@sentry/nextjs', () => ({ captureException: mockSentryCapture }));

// Chainable Supabase mock builder
function makeSupabaseMock({
  plan = 'growth',
  drafts = [makeDraftRow()],
  orgError = null as Error | null,
  draftsError = null as Error | null,
} = {}) {
  const draftsChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: draftsError ? null : drafts, error: draftsError }),
  };
  // eq is called for both org fetch and drafts fetch; allow chaining with status filter
  const draftsChainWithStatus = {
    ...draftsChain,
    eq: vi.fn().mockReturnThis(),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: orgError ? null : { plan }, error: orgError }),
        };
      }
      // content_drafts
      return draftsChainWithStatus;
    }),
  };
}

const supabaseRef: { current: ReturnType<typeof makeSupabaseMock> } = {
  current: makeSupabaseMock(),
};
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => supabaseRef.current,
  createServiceRoleClient: () => supabaseRef.current,
}));

// Import after mocks
const { exportDraftsAction } = await import('@/app/dashboard/content-drafts/actions');

const ORG_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const USER_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

describe('exportDraftsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseRef.current = makeSupabaseMock();
  });

  it('returns error when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const fd = new FormData();
    const result = await exportDraftsAction(fd);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/unauthorized/i);
  });

  it('returns error for trial plan', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: ORG_ID, userId: USER_ID });
    supabaseRef.current = makeSupabaseMock({ plan: 'trial' });
    const fd = new FormData();
    const result = await exportDraftsAction(fd);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/upgrade/i);
  });

  it('returns error for starter plan', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: ORG_ID, userId: USER_ID });
    supabaseRef.current = makeSupabaseMock({ plan: 'starter' });
    const fd = new FormData();
    const result = await exportDraftsAction(fd);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/upgrade/i);
  });

  it('returns CSV on growth plan (success path)', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: ORG_ID, userId: USER_ID });
    supabaseRef.current = makeSupabaseMock({ plan: 'growth' });
    const fd = new FormData();
    const result = await exportDraftsAction(fd);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.csv).toContain('Title,Content,Status');
      expect(result.count).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns CSV on agency plan', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: ORG_ID, userId: USER_ID });
    supabaseRef.current = makeSupabaseMock({ plan: 'agency' });
    const fd = new FormData();
    const result = await exportDraftsAction(fd);
    expect(result.success).toBe(true);
  });

  it('CSV contains all fetched rows', async () => {
    const mockDrafts = [
      makeDraftRow({ draft_title: 'Draft Alpha' }),
      makeDraftRow({ draft_title: 'Draft Beta', id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' }),
    ];
    mockGetSafeAuthContext.mockResolvedValue({ orgId: ORG_ID, userId: USER_ID });
    supabaseRef.current = makeSupabaseMock({ plan: 'growth', drafts: mockDrafts });
    const fd = new FormData();
    const result = await exportDraftsAction(fd);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.csv).toContain('Draft Alpha');
      expect(result.csv).toContain('Draft Beta');
      expect(result.count).toBe(2);
    }
  });

  it('accepts valid status_filter in formData', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: ORG_ID, userId: USER_ID });
    supabaseRef.current = makeSupabaseMock({
      plan: 'growth',
      drafts: [makeDraftRow({ status: 'approved' })],
    });
    const fd = new FormData();
    fd.set('status_filter', 'approved');
    const result = await exportDraftsAction(fd);
    expect(result.success).toBe(true);
  });

  it('returns validation error for invalid status_filter', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: ORG_ID, userId: USER_ID });
    const fd = new FormData();
    fd.set('status_filter', 'garbage_status');
    const result = await exportDraftsAction(fd);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/invalid status filter/i);
  });

  it('handles DB error → returns error', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: ORG_ID, userId: USER_ID });
    supabaseRef.current = makeSupabaseMock({
      plan: 'growth',
      draftsError: new Error('DB connection lost') as unknown as null,
    });
    const fd = new FormData();
    const result = await exportDraftsAction(fd);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('DB connection lost');
  });

  it('captures exception in Sentry on DB error', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: ORG_ID, userId: USER_ID });
    supabaseRef.current = makeSupabaseMock({
      plan: 'growth',
      draftsError: new Error('timeout') as unknown as null,
    });
    const fd = new FormData();
    await exportDraftsAction(fd);
    expect(mockSentryCapture).toHaveBeenCalledOnce();
  });

  it('returns header-only CSV when no drafts exist (success: true, count: 0)', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: ORG_ID, userId: USER_ID });
    supabaseRef.current = makeSupabaseMock({ plan: 'growth', drafts: [] });
    const fd = new FormData();
    const result = await exportDraftsAction(fd);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.count).toBe(0);
      expect(result.csv).toBe('Title,Content,Status,Type,Trigger,AEO Score,Target Prompt,Created');
    }
  });

  it('does not call revalidatePath (read-only action)', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: ORG_ID, userId: USER_ID });
    supabaseRef.current = makeSupabaseMock({ plan: 'growth' });
    const fd = new FormData();
    await exportDraftsAction(fd);
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
