/**
 * Sprint 118 — Revalidate Route Unit Tests (7 tests)
 *
 * Tests the POST /api/revalidate cache revalidation endpoint.
 * Uses vi.hoisted() to avoid module-level variable hoisting issues (FIX-4 pattern).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() — define mocks before vi.mock hoisting (Vitest 4.x pattern)
const {
  mockRevalidateTag,
  mockSingle,
  mockEq,
  mockSelect,
  mockFrom,
} = vi.hoisted(() => {
  const mockRevalidateTag = vi.fn();
  const mockSingle = vi.fn();
  const mockEq = vi.fn(() => ({ single: mockSingle }));
  const mockSelect = vi.fn(() => ({ eq: mockEq }));
  const mockFrom = vi.fn(() => ({ select: mockSelect }));
  return { mockRevalidateTag, mockSingle, mockEq, mockSelect, mockFrom };
});

vi.mock('next/cache', () => ({
  revalidateTag: mockRevalidateTag,
}));

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// Set env var before importing route
const MOCK_SECRET = 'test-revalidate-secret-123';
vi.stubEnv('REVALIDATE_SECRET', MOCK_SECRET);

import { POST } from '@/app/api/revalidate/route';
import { NextRequest } from 'next/server';

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/revalidate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/revalidate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 when secret missing', async () => {
    const res = await POST(makeRequest({ slug: 'test' }));
    expect(res.status).toBe(401);
  });

  it("401 when secret doesn't match REVALIDATE_SECRET", async () => {
    const res = await POST(makeRequest({ slug: 'test', secret: 'wrong-secret' }));
    expect(res.status).toBe(401);
  });

  it('400 when neither slug nor org_id provided', async () => {
    const res = await POST(makeRequest({ secret: MOCK_SECRET }));
    expect(res.status).toBe(400);
  });

  it("calls revalidateTag('menu-{slug}') with correct tag", async () => {
    await POST(makeRequest({ slug: 'charcoal-n-chill', secret: MOCK_SECRET }));
    expect(mockRevalidateTag).toHaveBeenCalledWith('menu-charcoal-n-chill', { expire: 0 });
  });

  it('resolves slug from org_id when only org_id provided', async () => {
    mockSingle.mockResolvedValueOnce({ data: { slug: 'resolved-slug' }, error: null });

    await POST(
      makeRequest({ org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', secret: MOCK_SECRET }),
    );

    expect(mockFrom).toHaveBeenCalledWith('organizations');
    expect(mockRevalidateTag).toHaveBeenCalledWith('menu-resolved-slug', { expire: 0 });
  });

  it('returns { ok: true, revalidated: slug, timestamp }', async () => {
    const res = await POST(makeRequest({ slug: 'my-menu', secret: MOCK_SECRET }));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.revalidated).toBe('my-menu');
    expect(body.timestamp).toBeDefined();
  });

  it('404 when org_id has no matching org', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });

    const res = await POST(
      makeRequest({ org_id: 'nonexistent-org-id', secret: MOCK_SECRET }),
    );
    expect(res.status).toBe(404);
  });
});
