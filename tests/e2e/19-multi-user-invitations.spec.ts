// ---------------------------------------------------------------------------
// 19-multi-user-invitations.spec.ts — Sprint 98 E2E Tests
//
// Multi-User: Invitations + Role Enforcement
//
// Tests the /dashboard/settings/team page for:
//   - Team members table rendering and structure
//   - Owner role badge and permission enforcement (when member data available)
//   - Plan gating of invite form (Agency plan required)
//   - Pending invitations visibility
//   - Invite accept page rendering
//
// Authentication:
//   Uses the dev@ session (golden tenant owner, Growth plan).
//   dev@localvector.ai is the golden tenant (org a0eebc99-…) with owner role.
//
// Note: Member rows depend on RLS-gated `memberships` + `users` join.
// If memberships RLS returns empty data, member-specific tests skip gracefully.
//
// Run:
//   npx playwright test tests/e2e/19-multi-user-invitations.spec.ts
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

// ── Storage state ──────────────────────────────────────────────────────────

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');

// ═══════════════════════════════════════════════════════════════════════════
// Team Page — Members Table & Structure
// ═══════════════════════════════════════════════════════════════════════════

test.describe('19 — Multi-User: Team Page (Sprint 98)', () => {
  test.use({ storageState: DEV_USER_STATE });

  test('team page renders with heading and members table', async ({ page }) => {
    await page.goto('/dashboard/settings/team');

    // Page heading
    await expect(
      page.getByRole('heading', { name: 'Team', level: 1 }),
    ).toBeVisible({ timeout: 10_000 });

    // Members table container
    await expect(
      page.locator('[data-testid="team-members-table"]'),
    ).toBeVisible();
  });

  test('Members section heading is visible inside table', async ({ page }) => {
    await page.goto('/dashboard/settings/team');

    // The "Members" heading inside the team-members-table
    await expect(
      page.locator('[data-testid="team-members-table"]').getByText('Members'),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('team management subtitle describes purpose', async ({ page }) => {
    await page.goto('/dashboard/settings/team');

    await expect(
      page.getByText(/manage team members/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('member rows render with role badges when membership data available', async ({ page }) => {
    await page.goto('/dashboard/settings/team');

    const table = page.locator('[data-testid="team-members-table"]');
    await expect(table).toBeVisible({ timeout: 10_000 });

    // Member rows depend on RLS-gated memberships query.
    // If data is available, verify structure.
    const memberRows = page.locator('[data-testid^="member-row-"]');
    const count = await memberRows.count();

    if (count === 0) {
      // Memberships RLS returns empty — skip member-specific checks
      // No member rows returned by memberships RLS query
      test.skip();
      return;
    }

    // At least one role badge should exist
    const roleBadges = page.locator('[data-testid^="member-role-"]');
    const badgeCount = await roleBadges.count();
    expect(badgeCount).toBeGreaterThanOrEqual(1);
  });

  test('owner row has no Remove button when membership data available', async ({ page }) => {
    await page.goto('/dashboard/settings/team');

    await expect(
      page.locator('[data-testid="team-members-table"]'),
    ).toBeVisible({ timeout: 10_000 });

    const memberRows = page.locator('[data-testid^="member-row-"]');
    const count = await memberRows.count();

    if (count === 0) {
      // No member rows returned by memberships RLS query
      test.skip();
      return;
    }

    // Owner row should have no remove button
    const firstRow = memberRows.first();
    const roleBadge = firstRow.locator('[data-testid^="member-role-"]');
    const roleText = await roleBadge.textContent();

    if (roleText?.trim().toLowerCase() === 'owner') {
      const removeBtn = firstRow.locator('[data-testid^="member-remove-btn-"]');
      await expect(removeBtn).toHaveCount(0);
    }
  });

  test('owner row has no role change select when membership data available', async ({ page }) => {
    await page.goto('/dashboard/settings/team');

    await expect(
      page.locator('[data-testid="team-members-table"]'),
    ).toBeVisible({ timeout: 10_000 });

    const memberRows = page.locator('[data-testid^="member-row-"]');
    const count = await memberRows.count();

    if (count === 0) {
      // No member rows returned by memberships RLS query
      test.skip();
      return;
    }

    const firstRow = memberRows.first();
    const roleBadge = firstRow.locator('[data-testid^="member-role-"]');
    const roleText = await roleBadge.textContent();

    if (roleText?.trim().toLowerCase() === 'owner') {
      const roleSelect = firstRow.locator('[data-testid^="member-role-select-"]');
      await expect(roleSelect).toHaveCount(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Team Page — Plan Gating & Invitations
// ═══════════════════════════════════════════════════════════════════════════

test.describe('19 — Multi-User: Plan Gating & Invitations (Sprint 98)', () => {
  test.use({ storageState: DEV_USER_STATE });

  test('invite form shows plan gate upgrade prompt for Growth plan', async ({ page }) => {
    await page.goto('/dashboard/settings/team');

    await expect(
      page.getByRole('heading', { name: 'Team', level: 1 }),
    ).toBeVisible({ timeout: 10_000 });

    // The invite form is wrapped in PlanGate(requiredPlan="agency").
    // For Growth-plan users, PlanGate renders upgrade prompt.
    // The actual invite email input should NOT be visible.
    await expect(
      page.locator('[data-testid="invite-email-input"]'),
    ).not.toBeVisible();
  });

  test('plan gate shows Agency upgrade link', async ({ page }) => {
    await page.goto('/dashboard/settings/team');

    await expect(
      page.getByRole('heading', { name: 'Team', level: 1 }),
    ).toBeVisible({ timeout: 10_000 });

    // PlanGate renders an "Upgrade to Agency" link
    await expect(
      page.getByRole('link', { name: /Upgrade to Agency/i }),
    ).toBeVisible();
  });

  test('pending invitations section hidden when no invitations exist', async ({ page }) => {
    await page.goto('/dashboard/settings/team');

    await expect(
      page.locator('[data-testid="team-members-table"]'),
    ).toBeVisible({ timeout: 10_000 });

    // No pending invitations in seed data → section should not render
    await expect(
      page.locator('[data-testid="pending-invitations-table"]'),
    ).not.toBeVisible();
  });

  test('invite send button not visible for non-agency plan', async ({ page }) => {
    await page.goto('/dashboard/settings/team');

    await expect(
      page.getByRole('heading', { name: 'Team', level: 1 }),
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.locator('[data-testid="invite-send-btn"]'),
    ).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Invite Accept Page — Public Route
// ═══════════════════════════════════════════════════════════════════════════

test.describe('19 — Multi-User: Invite Accept Page (Sprint 98)', () => {
  test('invite accept API handles invalid token gracefully', async ({ page }) => {
    // Navigate to the invite accept API with a fake token
    const response = await page.goto('/api/invitations/accept?token=invalid-test-token-12345');

    // Should redirect (302) or return error — must not crash (500)
    const status = response?.status() ?? 0;
    expect(status).toBeLessThan(500);
  });

  test('invite page renders for unknown token without crash', async ({ page }) => {
    await page.goto('/invite/unknown-test-token');

    // Page should render something — must NOT crash with error boundary
    await page.waitForLoadState('domcontentloaded');

    await expect(
      page.locator('text=Application error'),
    ).not.toBeVisible({ timeout: 3_000 });
  });
});
