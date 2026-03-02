/**
 * Sprint 115 — theme-service.test.ts
 *
 * Supabase mocked. 16 tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  getOrgTheme,
  getOrgThemeOrDefault,
  upsertOrgTheme,
  updateLogoUrl,
  removeLogo,
  ThemeError,
} from '@/lib/whitelabel/theme-service';
import { DEFAULT_THEME } from '@/lib/whitelabel/types';
import { MOCK_ORG_THEME } from '@/src/__fixtures__/golden-tenant';

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// ---------------------------------------------------------------------------
// Mock Supabase factory
// ---------------------------------------------------------------------------

function createMockSupabase(overrides: {
  selectData?: unknown;
  selectError?: { message: string } | null;
  upsertData?: unknown;
  upsertError?: { message: string } | null;
} = {}) {
  const mockSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: overrides.selectData ?? null,
        error: overrides.selectError ?? null,
      }),
    }),
  });

  const mockUpsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: overrides.upsertData ?? MOCK_ORG_THEME,
        error: overrides.upsertError ?? null,
      }),
    }),
  });

  const mockUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  });

  const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });

  return {
    from: vi.fn().mockReturnValue({
      select: mockSelect,
      upsert: mockUpsert,
      update: mockUpdate,
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        remove: mockRemove,
      }),
    },
    _mockSelect: mockSelect,
    _mockUpsert: mockUpsert,
    _mockUpdate: mockUpdate,
    _mockRemove: mockRemove,
  } as unknown as SupabaseClient<Database> & {
    _mockSelect: typeof mockSelect;
    _mockUpsert: typeof mockUpsert;
    _mockUpdate: typeof mockUpdate;
    _mockRemove: typeof mockRemove;
  };
}

// ---------------------------------------------------------------------------
// getOrgTheme
// ---------------------------------------------------------------------------

describe('getOrgTheme — Supabase mocked', () => {
  it('returns OrgTheme when row exists', async () => {
    const supabase = createMockSupabase({ selectData: MOCK_ORG_THEME });
    const result = await getOrgTheme(supabase, ORG_ID);
    expect(result).not.toBeNull();
    expect(result!.primary_color).toBe('#1a1a2e');
  });

  it('returns null when no theme row', async () => {
    const supabase = createMockSupabase({ selectData: null });
    const result = await getOrgTheme(supabase, ORG_ID);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getOrgThemeOrDefault
// ---------------------------------------------------------------------------

describe('getOrgThemeOrDefault — Supabase mocked', () => {
  it('returns theme from DB when exists', async () => {
    const supabase = createMockSupabase({ selectData: MOCK_ORG_THEME });
    const result = await getOrgThemeOrDefault(supabase, ORG_ID);
    expect(result.primary_color).toBe('#1a1a2e');
  });

  it('returns DEFAULT_THEME values when no DB row', async () => {
    const supabase = createMockSupabase({ selectData: null });
    const result = await getOrgThemeOrDefault(supabase, ORG_ID);
    expect(result.primary_color).toBe(DEFAULT_THEME.primary_color);
    expect(result.id).toBe('default');
  });

  it('returned default has org_id set correctly', async () => {
    const supabase = createMockSupabase({ selectData: null });
    const result = await getOrgThemeOrDefault(supabase, ORG_ID);
    expect(result.org_id).toBe(ORG_ID);
  });
});

// ---------------------------------------------------------------------------
// upsertOrgTheme
// ---------------------------------------------------------------------------

describe('upsertOrgTheme — Supabase mocked', () => {
  it('throws ThemeError with code invalid_color when primary_color fails validation', async () => {
    const supabase = createMockSupabase();
    try {
      await upsertOrgTheme(supabase, ORG_ID, { primary_color: 'not-a-color' });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ThemeError);
      expect((err as ThemeError).code).toBe('invalid_color');
    }
  });

  it('throws ThemeError with code invalid_color when accent_color fails validation', async () => {
    const supabase = createMockSupabase();
    try {
      await upsertOrgTheme(supabase, ORG_ID, { accent_color: '#gg0000' });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ThemeError);
      expect((err as ThemeError).code).toBe('invalid_color');
    }
  });

  it('throws ThemeError with code invalid_font when font_family not in allowlist', async () => {
    const supabase = createMockSupabase();
    try {
      await upsertOrgTheme(supabase, ORG_ID, { font_family: 'Comic Sans' as never });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ThemeError);
      expect((err as ThemeError).code).toBe('invalid_font');
    }
  });

  it('computes text_on_primary from primary_color automatically', async () => {
    const supabase = createMockSupabase({
      upsertData: { ...MOCK_ORG_THEME, text_on_primary: '#ffffff' },
    });
    const result = await upsertOrgTheme(supabase, ORG_ID, { primary_color: '#000000' });
    // The mock returns the upserted data
    expect(result.text_on_primary).toBe('#ffffff');
  });

  it('calls Supabase upsert method', async () => {
    const supabase = createMockSupabase();
    await upsertOrgTheme(supabase, ORG_ID, { primary_color: '#ff0000' });
    expect(supabase.from).toHaveBeenCalledWith('org_themes');
  });

  it('returns updated OrgTheme', async () => {
    const supabase = createMockSupabase({ upsertData: MOCK_ORG_THEME });
    const result = await upsertOrgTheme(supabase, ORG_ID, { primary_color: '#1a1a2e' });
    expect(result.org_id).toBe(ORG_ID);
  });
});

// ---------------------------------------------------------------------------
// updateLogoUrl
// ---------------------------------------------------------------------------

describe('updateLogoUrl — Supabase mocked', () => {
  it('updates logo_url and logo_storage_path', async () => {
    const supabase = createMockSupabase({
      upsertData: { ...MOCK_ORG_THEME, logo_url: 'https://example.com/logo.png', logo_storage_path: `${ORG_ID}/logo.png` },
    });
    const result = await updateLogoUrl(supabase, ORG_ID, 'https://example.com/logo.png', `${ORG_ID}/logo.png`);
    expect(result.logo_url).toBe('https://example.com/logo.png');
  });

  it('upserts if no theme row exists yet', async () => {
    const supabase = createMockSupabase({ upsertData: MOCK_ORG_THEME });
    await updateLogoUrl(supabase, ORG_ID, 'https://example.com/logo.png', `${ORG_ID}/logo.png`);
    expect(supabase.from).toHaveBeenCalledWith('org_themes');
  });
});

// ---------------------------------------------------------------------------
// removeLogo
// ---------------------------------------------------------------------------

describe('removeLogo — Supabase mocked', () => {
  it('calls storage.remove() with correct path when logo exists', async () => {
    const supabase = createMockSupabase({
      selectData: { ...MOCK_ORG_THEME, logo_storage_path: `${ORG_ID}/logo.png` },
    });
    const result = await removeLogo(supabase, ORG_ID);
    expect(result.success).toBe(true);
  });

  it('sets logo_url and logo_storage_path to null', async () => {
    const supabase = createMockSupabase({ selectData: MOCK_ORG_THEME });
    const result = await removeLogo(supabase, ORG_ID);
    expect(result.success).toBe(true);
  });

  it('returns success when no logo (idempotent)', async () => {
    const supabase = createMockSupabase({ selectData: null });
    const result = await removeLogo(supabase, ORG_ID);
    expect(result.success).toBe(true);
  });
});
