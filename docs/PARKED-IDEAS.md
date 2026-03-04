# Parked Ideas

Ideas discussed but deferred for later implementation.

---

## 1. Dashboard Simplification — Phase 3

**Status:** Parked (2026-03-04)

Phase 1 (~50 files) and Phase 2 (~25 files) completed — sidebar labels, page titles, stat panels, cron display names, scoring labels all converted to plain English. Phase 3 would cover remaining technical jargon in deeper components, tooltips, and inline help text.

See `docs/DEVLOG.md` for Phase 1/2 details (commits `a169359`, `a26ba92`).

---

## 2. Fresh-User E2E Tests (Signup → Plan → Onboarding → Dashboard)

**Status:** Parked (2026-03-04)

**Problem:** All current Playwright E2E tests use `dev@localvector.ai` golden tenant (pre-seeded, already onboarded). No coverage for fresh signup → plan assignment → first-time onboarding → empty-state dashboard.

**Approach:**

### Strategy 1: Fresh User Per Test
Create user via Supabase Admin API (`auth.admin.createUser`), which triggers `on_auth_user_created` DB trigger chain (auto-creates org + membership). Poll for org creation (up to 10s). Login via browser, walk through onboarding.

### Strategy 2: Simulate Stripe Plan Assignment
Can't run real Stripe checkout in E2E (external redirect, card form). Instead, set plan directly in DB via service role after user creation:
```ts
await supabaseAdmin
  .from('organizations')
  .update({ plan: 'growth' })
  .eq('id', orgId);
```
Then verify growth-tier features are unlocked (Voice Search, AI Actions nav items without lock icon).

### Strategy 3: Save Auth State for Reuse
For multi-test personas, save session to `.playwright/growth-user.json` like existing `dev-user.json` pattern.

### What Can't Be E2E Tested
- Stripe hosted checkout → unit test `plan-tier-resolver.ts` + webhook handler
- Real email delivery → unit test `sendScanCompleteEmail()`
- Google OAuth consent → unit test callback handler
- Real AI API responses → MSW mocks

**Key insight:** Separate "how the plan gets set" (unit test) from "what happens after" (E2E test). Create user via Admin API, set plan via service role, then drive browser through onboarding and dashboard.
