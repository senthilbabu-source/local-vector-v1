// ---------------------------------------------------------------------------
// admin-auth-guard.test.ts — Sprint D (L1): Admin layout auth guard tests
//
// 7 tests: admin email gate, redirect logic, case-insensitive matching.
//
// Run:
//   npx vitest run src/__tests__/unit/admin-auth-guard.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be set up before module imports
// ---------------------------------------------------------------------------

const mockRedirect = vi.fn();
const mockGetUser = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args);
    throw new Error('NEXT_REDIRECT'); // redirect() throws in Next.js
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
    }),
}));

// Track original env
const originalEnv = process.env.ADMIN_EMAILS;

// ---------------------------------------------------------------------------
// Helper — dynamic import to pick up fresh env each time
// ---------------------------------------------------------------------------

async function renderAdminLayout() {
  // Clear module cache so each test re-reads process.env
  vi.resetModules();

  // Re-apply mocks after resetModules
  vi.doMock('next/navigation', () => ({
    redirect: (...args: unknown[]) => {
      mockRedirect(...args);
      throw new Error('NEXT_REDIRECT');
    },
  }));
  vi.doMock('@/lib/supabase/server', () => ({
    createClient: () =>
      Promise.resolve({
        auth: { getUser: mockGetUser },
      }),
  }));

  // We also need to mock the AdminNav component since it's a client component
  vi.doMock('@/app/admin/_components/AdminNav', () => ({
    default: ({ email }: { email: string }) => `AdminNav(${email})`,
  }));

  const mod = await import('@/app/admin/layout');
  return mod.default;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Admin Layout Auth Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_EMAILS = originalEnv;
  });

  it('1. redirects to /login when no user is authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    process.env.ADMIN_EMAILS = 'admin@localvector.ai';

    const AdminLayout = await renderAdminLayout();
    await expect(AdminLayout({ children: null })).rejects.toThrow('NEXT_REDIRECT');

    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });

  it('2. redirects to /dashboard when user email is not in ADMIN_EMAILS', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: 'user@example.com' } },
    });
    process.env.ADMIN_EMAILS = 'admin@localvector.ai';

    const AdminLayout = await renderAdminLayout();
    await expect(AdminLayout({ children: null })).rejects.toThrow('NEXT_REDIRECT');

    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });

  it('3. allows access when user email matches ADMIN_EMAILS', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: 'admin@localvector.ai' } },
    });
    process.env.ADMIN_EMAILS = 'admin@localvector.ai';

    const AdminLayout = await renderAdminLayout();
    // Should NOT throw (no redirect)
    const result = await AdminLayout({ children: 'Hello' });
    expect(result).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('4. matching is case-insensitive', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: 'Admin@LocalVector.AI' } },
    });
    process.env.ADMIN_EMAILS = 'admin@localvector.ai';

    const AdminLayout = await renderAdminLayout();
    const result = await AdminLayout({ children: 'Hello' });
    expect(result).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('5. supports comma-separated list of admin emails', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: 'second@example.com' } },
    });
    process.env.ADMIN_EMAILS = 'first@example.com, second@example.com, third@example.com';

    const AdminLayout = await renderAdminLayout();
    const result = await AdminLayout({ children: 'Hello' });
    expect(result).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('6. trims whitespace around emails in ADMIN_EMAILS', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: 'admin@localvector.ai' } },
    });
    process.env.ADMIN_EMAILS = '  admin@localvector.ai  ,  other@example.com  ';

    const AdminLayout = await renderAdminLayout();
    const result = await AdminLayout({ children: 'Hello' });
    expect(result).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('7. redirects to /dashboard when ADMIN_EMAILS is empty or unset', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: 'admin@localvector.ai' } },
    });
    process.env.ADMIN_EMAILS = '';

    const AdminLayout = await renderAdminLayout();
    await expect(AdminLayout({ children: null })).rejects.toThrow('NEXT_REDIRECT');

    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });
});
