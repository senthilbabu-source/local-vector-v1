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

---

## 3. Product Expansion & Naming Strategy

**Status:** Parked (2026-03-06)

**Context:** LocalVector is currently restaurant-focused. The question arose whether to brand it as "LocalVector — Restaurant Edition" as we expand to other verticals.

**Decision:** Keep the platform name as plain "LocalVector". Use taglines on marketing copy only, not in the product itself.

- **Now:** Tagline = "AI Visibility for Restaurants"
- **Next vertical:** Swap tagline to "AI Visibility for Local Businesses"
- **Never:** Bake "Restaurant Edition" into the domain, product nav, or database schema

**What needs abstracting when we expand beyond restaurants:**

| Area | Current (restaurant) | Future (generic) |
|------|---------------------|-----------------|
| Menu/food concepts | `menu_items`, Magic Menus, food categories | "catalog" or "offerings" |
| `industry_type` enum | restaurant-centric values | add: retail, salon, clinic, etc. |
| SOV seed queries | dining/cuisine prompts | industry-specific query templates |
| Coaching hero content | food/revenue framing | configurable per vertical |
| `lib/industries/industry-config.ts` | 2 active (restaurant, medical_dental) | extend here first |

**Target markets in order:**
1. Restaurants (current — USA)
2. Medical/Dental (stub already built — Sprint E, `lib/industries/`)
3. Other local services: salons, gyms, retail, auto
4. International expansion (English-first markets: UK, Canada, Australia)

**Engineering impact:** Low — the multi-vertical abstraction layer (`lib/industries/`) already exists. Main work is SOV seed query templates and coaching content per vertical.
