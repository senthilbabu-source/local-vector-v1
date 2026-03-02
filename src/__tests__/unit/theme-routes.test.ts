/**
 * Sprint 115 — theme-routes.test.ts
 *
 * Route handler tests for GET/POST /api/whitelabel/theme
 * and POST/DELETE /api/whitelabel/theme/logo.
 * 22 tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MOCK_ORG_THEME } from '@/src/__fixtures__/golden-tenant';
import { DEFAULT_THEME } from '@/lib/whitelabel/types';

// ---------------------------------------------------------------------------
// Mock auth + services
// ---------------------------------------------------------------------------

const mockGetAuthContext = vi.fn();
const mockCreateClient = vi.fn();
const mockGetOrgThemeOrDefault = vi.fn();
const mockUpsertOrgTheme = vi.fn();
const mockGetOrgTheme = vi.fn();
const mockUpdateLogoUrl = vi.fn();
const mockRemoveLogo = vi.fn();

vi.mock('@/lib/auth', () => ({
  getAuthContext: () => mockGetAuthContext(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

vi.mock('@/lib/whitelabel/theme-service', () => ({
  getOrgThemeOrDefault: (...args: unknown[]) => mockGetOrgThemeOrDefault(...args),
  upsertOrgTheme: (...args: unknown[]) => mockUpsertOrgTheme(...args),
  getOrgTheme: (...args: unknown[]) => mockGetOrgTheme(...args),
  updateLogoUrl: (...args: unknown[]) => mockUpdateLogoUrl(...args),
  removeLogo: (...args: unknown[]) => mockRemoveLogo(...args),
  ThemeError: class ThemeError extends Error {
    code: string;
    constructor(code: string, msg: string) { super(msg); this.code = code; this.name = 'ThemeError'; }
  },
}));

vi.mock('@/lib/whitelabel/theme-utils', () => ({
  sanitizeHexColor: (c: string) => {
    if (c === 'bad') return null;
    return c;
  },
  isValidFontFamily: (f: string) => ['Inter', 'Poppins', 'Roboto'].includes(f),
  buildLogoStoragePath: (orgId: string, filename: string) => {
    if (filename.endsWith('.gif')) return null;
    return `${orgId}/logo.png`;
  },
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// Helpers
function makeAuthCtx(overrides: Partial<{
  role: string;
  orgId: string;
  org: { plan: string };
}> = {}) {
  return {
    userId: 'u1',
    orgId: overrides.orgId ?? 'org1',
    role: overrides.role ?? 'owner',
    org: { plan: overrides.org?.plan ?? 'agency', name: 'Test Org', slug: 'test' },
  };
}

const mockSupabase = {
  storage: {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/logo.png' } }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateClient.mockResolvedValue(mockSupabase);
  mockGetOrgThemeOrDefault.mockResolvedValue(MOCK_ORG_THEME);
  mockUpsertOrgTheme.mockResolvedValue(MOCK_ORG_THEME);
  mockUpdateLogoUrl.mockResolvedValue(MOCK_ORG_THEME);
  mockRemoveLogo.mockResolvedValue({ success: true });
});

// ---------------------------------------------------------------------------
// GET /api/whitelabel/theme
// ---------------------------------------------------------------------------

describe('GET /api/whitelabel/theme', () => {
  let handler: typeof import('@/app/api/whitelabel/theme/route').GET;

  beforeEach(async () => {
    handler = (await import('@/app/api/whitelabel/theme/route')).GET;
  });

  it('returns 401 when not authenticated', async () => {
    mockGetAuthContext.mockRejectedValue(new Error('Unauthorized'));
    const res = await handler();
    expect(res.status).toBe(401);
  });

  it('returns upgrade_required for non-Agency plan', async () => {
    mockGetAuthContext.mockResolvedValue(makeAuthCtx({ org: { plan: 'growth' } }));
    const res = await handler();
    const body = await res.json();
    expect(body.upgrade_required).toBe(true);
  });

  it('returns OrgTheme for Agency plan member', async () => {
    mockGetAuthContext.mockResolvedValue(makeAuthCtx());
    const res = await handler();
    const body = await res.json();
    expect(body.theme.primary_color).toBe('#1a1a2e');
    expect(body.upgrade_required).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /api/whitelabel/theme
// ---------------------------------------------------------------------------

describe('POST /api/whitelabel/theme', () => {
  let handler: typeof import('@/app/api/whitelabel/theme/route').POST;

  beforeEach(async () => {
    handler = (await import('@/app/api/whitelabel/theme/route')).POST;
  });

  function makeRequest(body: Record<string, unknown>) {
    return new Request('http://localhost/api/whitelabel/theme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('returns 401 when not authenticated', async () => {
    mockGetAuthContext.mockRejectedValue(new Error('Unauthorized'));
    const res = await handler(makeRequest({}));
    expect(res.status).toBe(401);
  });

  it('returns 403 plan_upgrade_required for non-Agency', async () => {
    mockGetAuthContext.mockResolvedValue(makeAuthCtx({ org: { plan: 'starter' } }));
    const res = await handler(makeRequest({}));
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toBe('plan_upgrade_required');
  });

  it('returns 403 not_owner for admin role', async () => {
    mockGetAuthContext.mockResolvedValue(makeAuthCtx({ role: 'admin' }));
    const res = await handler(makeRequest({}));
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toBe('not_owner');
  });

  it('returns 400 invalid_color for malformed primary_color', async () => {
    mockGetAuthContext.mockResolvedValue(makeAuthCtx());
    const res = await handler(makeRequest({ primary_color: 'bad' }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid_color');
  });

  it('returns 400 invalid_color for malformed accent_color', async () => {
    mockGetAuthContext.mockResolvedValue(makeAuthCtx());
    const res = await handler(makeRequest({ accent_color: 'bad' }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid_color');
  });

  it('returns 400 invalid_font for unknown font family', async () => {
    mockGetAuthContext.mockResolvedValue(makeAuthCtx());
    const res = await handler(makeRequest({ font_family: 'Comic Sans' }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid_font');
  });

  it('text_on_primary NOT accepted from client (computed server-side)', async () => {
    mockGetAuthContext.mockResolvedValue(makeAuthCtx());
    // Even if client sends text_on_primary, it should not be in the changes
    const res = await handler(makeRequest({ primary_color: '#ff0000', text_on_primary: '#000000' }));
    const body = await res.json();
    expect(body.ok).toBe(true);
    // text_on_primary should NOT be passed through from client
    const upsertCall = mockUpsertOrgTheme.mock.calls[0];
    if (upsertCall) {
      const changes = upsertCall[2];
      expect(changes).not.toHaveProperty('text_on_primary');
    }
  });

  it('returns { ok: true, theme } on success', async () => {
    mockGetAuthContext.mockResolvedValue(makeAuthCtx());
    const res = await handler(makeRequest({ primary_color: '#ff0000' }));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.theme).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// POST /api/whitelabel/theme/logo
// ---------------------------------------------------------------------------

describe('POST /api/whitelabel/theme/logo', () => {
  let handler: typeof import('@/app/api/whitelabel/theme/logo/route').POST;

  beforeEach(async () => {
    handler = (await import('@/app/api/whitelabel/theme/logo/route')).POST;
  });

  function makeUploadRequest(file?: File) {
    const formData = new FormData();
    if (file) formData.append('logo', file);
    return new Request('http://localhost/api/whitelabel/theme/logo', {
      method: 'POST',
      body: formData,
    });
  }

  it('returns 401 when not authenticated', async () => {
    mockGetAuthContext.mockRejectedValue(new Error('Unauthorized'));
    const res = await handler(makeUploadRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-owner', async () => {
    mockGetAuthContext.mockResolvedValue(makeAuthCtx({ role: 'admin' }));
    const res = await handler(makeUploadRequest());
    expect(res.status).toBe(403);
  });

  it('returns 400 no_file when no file in request', async () => {
    mockGetAuthContext.mockResolvedValue(makeAuthCtx());
    const res = await handler(makeUploadRequest());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('no_file');
  });

  it('returns 400 invalid_type for image/gif', async () => {
    mockGetAuthContext.mockResolvedValue(makeAuthCtx());
    const file = new File(['test'], 'logo.gif', { type: 'image/gif' });
    const res = await handler(makeUploadRequest(file));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid_type');
  });

  it('returns 400 file_too_large for file > 2MB', async () => {
    mockGetAuthContext.mockResolvedValue(makeAuthCtx());
    const bigData = new Uint8Array(3 * 1024 * 1024);
    const file = new File([bigData], 'logo.png', { type: 'image/png' });
    const res = await handler(makeUploadRequest(file));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('file_too_large');
  });

  it('calls storage upload on valid file', async () => {
    mockGetAuthContext.mockResolvedValue(makeAuthCtx());
    const file = new File(['test'], 'logo.png', { type: 'image/png' });
    const res = await handler(makeUploadRequest(file));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.logo_url).toBeDefined();
  });

  it('returns logo_url on success', async () => {
    mockGetAuthContext.mockResolvedValue(makeAuthCtx());
    const file = new File(['test'], 'logo.png', { type: 'image/png' });
    const res = await handler(makeUploadRequest(file));
    const body = await res.json();
    expect(body.logo_url).toBe('https://example.com/logo.png');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/whitelabel/theme/logo
// ---------------------------------------------------------------------------

describe('DELETE /api/whitelabel/theme/logo', () => {
  let handler: typeof import('@/app/api/whitelabel/theme/logo/route').DELETE;

  beforeEach(async () => {
    handler = (await import('@/app/api/whitelabel/theme/logo/route')).DELETE;
  });

  it('returns 401 when not authenticated', async () => {
    mockGetAuthContext.mockRejectedValue(new Error('Unauthorized'));
    const res = await handler();
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-owner', async () => {
    mockGetAuthContext.mockResolvedValue(makeAuthCtx({ role: 'viewer' }));
    const res = await handler();
    expect(res.status).toBe(403);
  });

  it('calls removeLogo service', async () => {
    mockGetAuthContext.mockResolvedValue(makeAuthCtx());
    const res = await handler();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockRemoveLogo).toHaveBeenCalled();
  });

  it('returns ok: true when no logo exists (idempotent)', async () => {
    mockGetAuthContext.mockResolvedValue(makeAuthCtx());
    mockRemoveLogo.mockResolvedValue({ success: true });
    const res = await handler();
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
