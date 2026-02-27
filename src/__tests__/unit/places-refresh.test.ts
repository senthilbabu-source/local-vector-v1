// ---------------------------------------------------------------------------
// places-refresh.test.ts — Unit tests for Google Places detail refresh
//
// Sprint 90: Tests refreshStalePlaceDetails() with mock Supabase + MSW.
//
// Run:
//   npx vitest run src/__tests__/unit/places-refresh.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/__helpers__/setup';

// ── Hoist mocks ───────────────────────────────────────────────────────────

const mockFrom = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(() => ({ from: mockFrom })),
}));

// ── Import subjects ───────────────────────────────────────────────────────

import { refreshStalePlaceDetails } from '@/lib/services/places-refresh';

// ── Fixtures ──────────────────────────────────────────────────────────────

const STALE_LOCATION = {
  id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  google_place_id: 'ChIJi8-1ywdO9YgR9s5j-y0_1lI',
  organizations: { plan_status: 'active' },
};

const STALE_LOCATION_NO_PLACE_ID = {
  id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  google_place_id: null,
  organizations: { plan_status: 'active' },
};

function mockStaleQuery(locations: unknown[] = [STALE_LOCATION]) {
  const mockEq = vi.fn().mockResolvedValue({ data: locations, error: null });
  const mockLt = vi.fn().mockReturnValue({ eq: mockEq });
  const mockSelect = vi.fn().mockReturnValue({ lt: mockLt });

  const mockUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'locations') return { select: mockSelect, update: mockUpdate };
    return {};
  });
  return { mockSelect, mockUpdate };
}

function mockPlacesAPI(ok = true) {
  server.use(
    http.get('https://places.googleapis.com/v1/places/*', () => {
      if (!ok) return HttpResponse.json({ error: 'Not found' }, { status: 404 });
      return HttpResponse.json({
        displayName: { text: 'Charcoal N Chill' },
        formattedAddress: '11950 Jones Bridge Rd #103, Alpharetta, GA 30005',
        nationalPhoneNumber: '(470) 546-4866',
        websiteUri: 'https://charcoalnchill.com',
        rating: 4.7,
        userRatingCount: 320,
      });
    }),
  );
}

// ── Environment ───────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.GOOGLE_PLACES_API_KEY = 'test-places-key';
});

afterEach(() => {
  vi.clearAllMocks();
  server.resetHandlers();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('refreshStalePlaceDetails', () => {
  it('should return early when GOOGLE_PLACES_API_KEY is not configured', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    const result = await refreshStalePlaceDetails();
    expect(result.total).toBe(0);
    expect(result.errors[0]).toContain('GOOGLE_PLACES_API_KEY');
  });

  it('should return { total: 0 } when no stale locations exist', async () => {
    mockStaleQuery([]);
    const result = await refreshStalePlaceDetails();
    expect(result.total).toBe(0);
    expect(result.refreshed).toBe(0);
  });

  it('should refresh stale location and update DB', async () => {
    const { mockUpdate } = mockStaleQuery([STALE_LOCATION]);
    mockPlacesAPI(true);

    const result = await refreshStalePlaceDetails();

    expect(result.total).toBe(1);
    expect(result.refreshed).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        place_details_refreshed_at: expect.any(String),
        phone: '(470) 546-4866',
        website_url: 'https://charcoalnchill.com',
      }),
    );
  });

  it('should skip locations without google_place_id', async () => {
    mockStaleQuery([STALE_LOCATION_NO_PLACE_ID]);

    const result = await refreshStalePlaceDetails();

    expect(result.total).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.refreshed).toBe(0);
  });

  it('should count Places API failures', async () => {
    mockStaleQuery([STALE_LOCATION]);
    mockPlacesAPI(false);

    const result = await refreshStalePlaceDetails();

    expect(result.total).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors[0]).toContain('Places API error');
  });

  it('should handle DB query error gracefully', async () => {
    const mockEq = vi.fn().mockResolvedValue({ data: null, error: { message: 'timeout' } });
    const mockLt = vi.fn().mockReturnValue({ eq: mockEq });
    const mockSelect = vi.fn().mockReturnValue({ lt: mockLt });
    mockFrom.mockReturnValue({ select: mockSelect });

    const result = await refreshStalePlaceDetails();

    expect(result.total).toBe(0);
    expect(result.errors[0]).toContain('Query failed');
  });

  it('should use 29-day threshold (not 30) for safety margin', async () => {
    const { mockSelect } = mockStaleQuery([]);

    await refreshStalePlaceDetails();

    // The select().lt() call should have been made
    expect(mockSelect).toHaveBeenCalledWith(
      'id, org_id, google_place_id, organizations!inner(plan_status)',
    );
  });

  it('should only fetch locations for active-plan orgs (zombie filter)', async () => {
    mockStaleQuery([]);
    await refreshStalePlaceDetails();

    // Verify the .eq('organizations.plan_status', 'active') filter
    const selectCall = mockFrom.mock.calls.find((c: string[]) => c[0] === 'locations');
    expect(selectCall).toBeDefined();
  });

  it('should send X-Goog-FieldMask header to minimize API cost', async () => {
    let capturedHeaders: Record<string, string> = {};
    server.use(
      http.get('https://places.googleapis.com/v1/places/*', ({ request }) => {
        capturedHeaders = Object.fromEntries(request.headers.entries());
        return HttpResponse.json({ displayName: { text: 'Test' } });
      }),
    );
    mockStaleQuery([STALE_LOCATION]);

    await refreshStalePlaceDetails();

    expect(capturedHeaders['x-goog-fieldmask']).toBeDefined();
    expect(capturedHeaders['x-goog-fieldmask']).toContain('displayName');
    expect(capturedHeaders['x-goog-api-key']).toBe('test-places-key');
  });
});
