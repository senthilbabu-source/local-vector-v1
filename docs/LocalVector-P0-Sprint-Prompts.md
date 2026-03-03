# LocalVector.ai — P0 Sprint Prompts
## Plan Integrity + Core Routing Fix
**Sprint Block:** P0-FIX-01 through P0-FIX-04  
**Priority:** CRITICAL — Must complete before any user reaches production  
**Execution Environment:** VS Code + Claude Code  
**Repo:** https://github.com/senthilbabu-source/local-vector-v1

---

## How to Use These Sprints

Each sprint is a **self-contained Claude Code prompt**. Paste the full block under
the `### PROMPT` heading into Claude Code. Do not skip the pre-flight steps — they
prevent you from breaking working code.

**Execution order is mandatory:**
```
P0-FIX-01  →  P0-FIX-02  →  P0-FIX-03  →  P0-FIX-04
(webhook)      (profile pg)  (gate items)  (completion)
```

Each sprint ends with a **Regression Smoke Test** — run it before moving to the next.

---

---

# P0-FIX-01 — Stripe Webhook: Sync `profiles.plan_tier` on Every Plan Change

## Background

The plan badge in the app header reads from `profiles.plan` (stale).  
The credits counter reads from `subscriptions` / `usage_limits` (correct).  
When a user upgrades/downgrades via Stripe, the Stripe webhook updates the
`subscriptions` table but does **not** write back to `profiles.plan_tier`.

This single gap causes the plan badge, sidebar gating, middleware checks, and
feature entitlements to all operate on stale data — cascading into every other bug.

**This sprint must be completed first. Every other sprint depends on it.**

## Pre-Flight Checklist (Do Before Running Prompt)

```bash
# 1. Verify current state of profiles table
supabase db pull   # ensure local schema is current

# 2. Check existing webhook handler location
find . -type f -name "*.ts" | xargs grep -l "stripe" | grep -i webhook

# 3. Check what plan fields exist on profiles
grep -r "plan" supabase/migrations/ | grep -i "alter\|add column"

# 4. Confirm Stripe env vars present
grep "STRIPE" .env.local

# 5. Run existing tests to establish baseline
pnpm test --passWithNoTests 2>&1 | tail -20
```

## Files This Sprint Will Touch

```
MODIFY:  app/api/webhooks/stripe/route.ts          ← core webhook handler
MODIFY:  lib/stripe/plan-sync.ts                   ← new helper (create if absent)
MODIFY:  supabase/migrations/YYYYMMDD_plan_tier_sync.sql  ← migration
CREATE:  __tests__/api/webhooks/stripe.test.ts     ← new test file
CREATE:  __tests__/lib/plan-sync.test.ts           ← unit tests for helper
MODIFY:  types/database.ts                         ← ensure plan_tier typed
```

---

### PROMPT — P0-FIX-01

```
You are a senior fullstack engineer working on LocalVector.ai (Next.js 14 App Router,
Supabase, Stripe, TypeScript). Your task is P0-FIX-01: ensure that every Stripe
subscription lifecycle event correctly syncs plan data back to the `profiles` table
so the app has a single source of truth for plan tier.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current broken state:
- Stripe webhook at app/api/webhooks/stripe/route.ts handles events and updates
  the `subscriptions` table but does NOT update `profiles.plan_tier`.
- `profiles` has a `plan` column that holds stale plan data after upgrades.
- The UI header badge, middleware, and all plan gates read from `profiles`.
- Result: Users who upgraded to AI Shield still see "Growth" badge; plan
  gating, feature access, and Getting Started items are all wrong.

Plan tier mapping (Stripe price ID → internal tier string):
  Free tier:      no subscription or status=canceled → 'free'
  Starter:        price_id matches STARTER price     → 'starter'
  Growth:         price_id matches GROWTH price      → 'growth'
  AI Shield:      price_id matches AI_SHIELD price   → 'ai_shield'

These price IDs come from env vars:
  STRIPE_PRICE_STARTER, STRIPE_PRICE_GROWTH, STRIPE_PRICE_AI_SHIELD

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — DATABASE MIGRATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: supabase/migrations/[timestamp]_add_plan_tier_to_profiles.sql

Contents:
  -- Ensure plan_tier column exists with correct type and default
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='profiles' AND column_name='plan_tier'
    ) THEN
      ALTER TABLE profiles ADD COLUMN plan_tier TEXT NOT NULL DEFAULT 'free';
    END IF;
  END $$;

  -- Backfill plan_tier from existing plan column (one-time sync)
  UPDATE profiles
  SET plan_tier = CASE
    WHEN plan IN ('ai_shield', 'ai-shield', 'AI Shield') THEN 'ai_shield'
    WHEN plan IN ('growth', 'Growth') THEN 'growth'
    WHEN plan IN ('starter', 'Starter') THEN 'starter'
    ELSE 'free'
  END
  WHERE plan_tier = 'free' AND plan IS NOT NULL AND plan != '';

  -- Add updated_at trigger if not present
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS set_profiles_updated_at ON profiles;
  CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  -- Add index for fast plan_tier lookups
  CREATE INDEX IF NOT EXISTS idx_profiles_plan_tier ON profiles(plan_tier);

  -- Add RLS policy allowing service_role to update plan_tier
  -- (service_role already bypasses RLS, but document the intent)
  COMMENT ON COLUMN profiles.plan_tier IS
    'Authoritative plan tier. Always synced from Stripe via webhook. Values: free | starter | growth | ai_shield';

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — PLAN SYNC HELPER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: lib/stripe/plan-sync.ts

This module must:

1. Export type PlanTier = 'free' | 'starter' | 'growth' | 'ai_shield'

2. Export function resolvePlanTierFromPriceId(priceId: string | null | undefined): PlanTier
   - Reads STRIPE_PRICE_STARTER, STRIPE_PRICE_GROWTH, STRIPE_PRICE_AI_SHIELD from env
   - Returns the matching tier string or 'free' if no match
   - Must be pure / no side effects (easy to unit test)

3. Export async function syncPlanTierToProfile(params: {
     supabase: SupabaseClient,   // service-role client
     userId: string,
     priceId: string | null | undefined,
     subscriptionStatus: string,
   }): Promise<{ success: boolean; planTier: PlanTier; error?: string }>
   - Calls resolvePlanTierFromPriceId
   - If subscriptionStatus is 'canceled' or 'unpaid', set planTier = 'free'
   - Updates profiles SET plan_tier = planTier, plan = planTier, updated_at = now()
     WHERE id = userId
   - Updates usage_limits SET max_credits = PLAN_CREDIT_LIMITS[planTier]
     WHERE user_id = userId
   - Returns { success: true, planTier } on success
   - Returns { success: false, error: string } on failure — NEVER throws
   - Logs: console.log(`[plan-sync] userId=${userId} tier=${planTier}`)

4. Export const PLAN_CREDIT_LIMITS: Record<PlanTier, number> = {
     free: 0,
     starter: 100,
     growth: 250,
     ai_shield: 500,
   }

5. Export const PLAN_DISPLAY_NAMES: Record<PlanTier, string> = {
     free: 'Free',
     starter: 'Starter',
     growth: 'Growth',
     ai_shield: 'AI Shield',
   }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — WEBHOOK HANDLER UPDATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Open: app/api/webhooks/stripe/route.ts

Preserve ALL existing logic. Add syncPlanTierToProfile call after the
subscriptions table write for EVERY subscription lifecycle event.

Target events (add sync to EACH — do not skip any):
  - customer.subscription.created
  - customer.subscription.updated
  - customer.subscription.deleted
  - invoice.payment_succeeded  (confirms active subscription)
  - invoice.payment_failed     (may need to downgrade to free)

For each event handler:
  1. After existing `subscriptions` upsert logic runs successfully
  2. Resolve userId from the subscription's metadata or customer lookup
     (check existing code for how userId is currently resolved — replicate
      the same lookup, do not change it)
  3. Call: const syncResult = await syncPlanTierToProfile({
       supabase: supabaseAdmin,
       userId,
       priceId: subscription.items.data[0]?.price.id ?? null,
       subscriptionStatus: subscription.status,
     })
  4. If syncResult.success === false:
       console.error(`[webhook] plan-sync failed for userId=${userId}:`, syncResult.error)
       // Do NOT return error response — Stripe retries cause duplicate processing
       // Log and continue; a manual reconciliation job will fix stragglers

For customer.subscription.deleted or status=canceled:
  - Pass priceId: null and subscriptionStatus: 'canceled'
  - This sets the user back to 'free'

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — TYPE DEFINITIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

In types/database.ts (or wherever the Supabase DB types live):
  - Ensure profiles row type includes: plan_tier: 'free' | 'starter' | 'growth' | 'ai_shield'
  - If using generated types (supabase gen types typescript), add a manual
    override or re-generate after migration is applied
  - Export PlanTier from lib/stripe/plan-sync.ts as the canonical type

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — UPDATE ALL PLAN READS ACROSS THE APP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Search the entire codebase for any reads of profiles.plan that feed into UI:
  grep -r "profiles.plan\b\|user\.plan\b\|profile\.plan\b" --include="*.ts" --include="*.tsx" .

For each match:
  - If it reads the plan for DISPLAY (badge, header): replace with .plan_tier
  - If it reads the plan for GATING (middleware, feature checks): replace with .plan_tier
  - Do NOT change any Stripe API calls or subscription creation code
  - Do NOT change any existing DB writes that are working correctly

Update the header/badge component specifically:
  - Find the component that renders the plan badge ("Growth", "AI Shield", etc.)
  - Change the data source to read profile.plan_tier
  - Use PLAN_DISPLAY_NAMES[profile.plan_tier] for the display string
  - Test that 'ai_shield' renders "AI Shield" (space, capital S)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — WRITE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE FILE: __tests__/lib/plan-sync.test.ts

Use vitest or jest (match existing test runner in package.json).

Test suite must cover:

  describe('resolvePlanTierFromPriceId', () => {
    // Set env vars in beforeAll
    process.env.STRIPE_PRICE_STARTER = 'price_starter_test'
    process.env.STRIPE_PRICE_GROWTH = 'price_growth_test'
    process.env.STRIPE_PRICE_AI_SHIELD = 'price_aishield_test'

    it('returns starter for starter price id')
    it('returns growth for growth price id')
    it('returns ai_shield for ai_shield price id')
    it('returns free for null price id')
    it('returns free for undefined price id')
    it('returns free for unknown price id')
    it('returns free for empty string price id')
  })

  describe('syncPlanTierToProfile', () => {
    let mockSupabase: any

    beforeEach(() => {
      mockSupabase = {
        from: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      }
    })

    it('updates profiles with correct plan_tier for growth')
    it('updates profiles with correct plan_tier for ai_shield')
    it('sets plan_tier to free when status is canceled')
    it('sets plan_tier to free when status is unpaid')
    it('updates usage_limits max_credits correctly for each tier')
    it('returns success:true on successful update')
    it('returns success:false (does not throw) when DB update fails')
    it('returns success:false (does not throw) when DB is unreachable')
    it('logs plan-sync message with userId and tier on success')
    it('logs error message on failure without throwing')
  })

CREATE FILE: __tests__/api/webhooks/stripe.test.ts

  Use msw or direct mocking of Stripe SDK and Supabase admin client.

  describe('POST /api/webhooks/stripe', () => {
    describe('customer.subscription.created', () => {
      it('calls syncPlanTierToProfile with correct userId and priceId')
      it('returns 200 even if syncPlanTierToProfile fails')
      it('updates subscriptions table as before (regression)')
    })

    describe('customer.subscription.updated', () => {
      it('calls syncPlanTierToProfile on plan upgrade (starter→growth)')
      it('calls syncPlanTierToProfile on plan downgrade (ai_shield→starter)')
      it('sets plan_tier=free when subscription status becomes canceled')
      it('preserves existing subscriptions table upsert logic (regression)')
    })

    describe('customer.subscription.deleted', () => {
      it('calls syncPlanTierToProfile with priceId=null, status=canceled')
      it('results in plan_tier=free for the user')
    })

    describe('invoice.payment_succeeded', () => {
      it('calls syncPlanTierToProfile to confirm active plan')
    })

    describe('invoice.payment_failed', () => {
      it('calls syncPlanTierToProfile with appropriate status')
    })

    describe('signature verification', () => {
      it('returns 400 for invalid Stripe signature (regression — do not break)')
      it('returns 400 for missing signature header (regression)')
    })

    describe('unhandled events', () => {
      it('returns 200 for unrecognised event types without error (regression)')
    })
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 7 — REGRESSION GUARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DO NOT modify any of the following — they must remain exactly as they are:
  - Stripe signature verification logic
  - Any existing subscriptions table upsert logic
  - Customer metadata lookup logic
  - Any invoice or payment processing logic
  - The 200 response on success / 400 on bad signature
  - Any existing usage_limits reads (only write max_credits)

Run regression check after implementation:
  pnpm test __tests__/api/webhooks/stripe.test.ts
  pnpm test __tests__/lib/plan-sync.test.ts
  pnpm test   # full suite — 0 regressions allowed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P0-FIX-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] Migration file created and applied (supabase db push)
  [ ] profiles.plan_tier column exists with correct values for all existing users
  [ ] lib/stripe/plan-sync.ts created with all exports
  [ ] Webhook handler updated — syncPlanTierToProfile called for all 5 event types
  [ ] Plan badge component reads from plan_tier (not legacy plan field)
  [ ] PLAN_DISPLAY_NAMES used for display strings
  [ ] All __tests__/lib/plan-sync.test.ts tests pass
  [ ] All __tests__/api/webhooks/stripe.test.ts tests pass
  [ ] Full test suite passes with 0 regressions
  [ ] TypeScript compiles with 0 errors: pnpm tsc --noEmit
  [ ] Lint passes: pnpm lint
  [ ] Manual verify: in Supabase Studio, dev@localvector.ai shows plan_tier='ai_shield'
  [ ] Manual verify: header badge now shows "AI Shield" not "Growth"
```

---

---

# P0-FIX-02 — Create Business Profile Settings Page (`/dashboard/settings/profile`)

## Background

The Getting Started checklist's first item — "Complete your business profile" — links
to a settings page that returns 404. The route does not exist. Business profile data
is captured during onboarding signup but is never surfaced in an edit form. This means
no user can complete step 1 of Getting Started, making the entire onboarding funnel
permanently stuck at 0/5.

## Pre-Flight Checklist

```bash
# 1. Find the onboarding form to understand what fields exist
find . -name "*.tsx" | xargs grep -l "business_name\|business_type\|location" 2>/dev/null

# 2. Inspect profiles table columns
supabase db pull && grep -A 30 "create table profiles" supabase/schema.sql

# 3. Check what the Getting Started link href actually is
grep -r "Set up profile\|setup.*profile\|profile.*setup" --include="*.tsx" .

# 4. Check if a settings layout already exists
ls app/dashboard/settings/ 2>/dev/null || echo "directory does not exist"

# 5. Find existing form components to reuse
find . -name "*.tsx" | xargs grep -l "useForm\|react-hook-form\|zod" 2>/dev/null | head -5

# 6. Run existing tests baseline
pnpm test --passWithNoTests 2>&1 | tail -5
```

## Files This Sprint Will Create/Touch

```
CREATE:  app/dashboard/settings/profile/page.tsx          ← the missing page
CREATE:  app/dashboard/settings/layout.tsx                ← settings shell (if absent)
CREATE:  components/settings/BusinessProfileForm.tsx       ← form component
CREATE:  app/api/profile/update/route.ts                  ← PATCH API route
CREATE:  lib/validations/profile.ts                       ← Zod schemas
CREATE:  __tests__/components/BusinessProfileForm.test.tsx
CREATE:  __tests__/api/profile/update.test.ts
MODIFY:  components/onboarding/GettingStarted.tsx          ← fix the href
```

---

### PROMPT — P0-FIX-02

```
You are a senior fullstack engineer on LocalVector.ai (Next.js 14 App Router,
Supabase, TypeScript, Tailwind CSS, react-hook-form, zod). Your task is P0-FIX-02:
build the Business Profile settings page at /dashboard/settings/profile.

This page must:
  - Let users view and edit their business profile (name, category, address,
    phone, website, description)
  - Save changes to the `profiles` table in Supabase
  - Be accessible to ALL plan tiers (Free, Starter, Growth, AI Shield)
  - Match the existing dark-themed UI of the dashboard exactly
  - NOT break any existing pages, routes, or components

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — ZOD VALIDATION SCHEMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: lib/validations/profile.ts

  import { z } from 'zod'

  export const businessProfileSchema = z.object({
    business_name: z.string()
      .min(2, 'Business name must be at least 2 characters')
      .max(100, 'Business name must be 100 characters or fewer')
      .trim(),

    business_category: z.string()
      .min(1, 'Please select a business category')
      .max(100),

    address_street: z.string()
      .max(200)
      .optional()
      .transform(v => v?.trim() || ''),

    address_city: z.string()
      .max(100)
      .optional()
      .transform(v => v?.trim() || ''),

    address_state: z.string()
      .max(50)
      .optional()
      .transform(v => v?.trim() || ''),

    address_zip: z.string()
      .regex(/^\d{5}(-\d{4})?$/, 'Enter a valid ZIP code')
      .optional()
      .or(z.literal('')),

    phone: z.string()
      .regex(/^(\+1)?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/, 'Enter a valid US phone number')
      .optional()
      .or(z.literal('')),

    website: z.string()
      .url('Enter a valid URL including https://')
      .optional()
      .or(z.literal('')),

    description: z.string()
      .max(500, 'Description must be 500 characters or fewer')
      .optional()
      .transform(v => v?.trim() || ''),
  })

  export type BusinessProfileFormValues = z.infer<typeof businessProfileSchema>

  // Business categories for the dropdown
  export const BUSINESS_CATEGORIES = [
    'Restaurant & Food Service',
    'Bar & Nightlife',
    'Hookah Lounge',
    'Retail',
    'Health & Wellness',
    'Beauty & Personal Care',
    'Professional Services',
    'Healthcare',
    'Real Estate',
    'Automotive',
    'Entertainment',
    'Fitness & Recreation',
    'Education',
    'Technology',
    'Home Services',
    'Other',
  ] as const

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — API ROUTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: app/api/profile/update/route.ts

  This must be a PATCH handler (not PUT — partial updates only).

  Logic:
    1. Get session from Supabase auth (use existing auth pattern from codebase)
    2. Return 401 if no session
    3. Parse request body as JSON
    4. Validate against businessProfileSchema using safeParse
    5. Return 400 with { error, details } if validation fails
    6. Update profiles table:
         SET business_name, business_category, address_street, address_city,
             address_state, address_zip, phone, website, description,
             profile_completed = true,   ← IMPORTANT: mark profile as done
             updated_at = now()
         WHERE id = session.user.id
    7. Return 200 with { success: true, profile: updatedProfile }
    8. Return 500 with { error: 'Failed to update profile' } on DB error
       (do not leak raw Supabase errors to client)

  Rate limiting: apply the existing rate-limit utility if present in the codebase.
  Do not invent a new rate limiter — find and reuse the existing one.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — FORM COMPONENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: components/settings/BusinessProfileForm.tsx

  'use client'

  Props interface:
    initialValues: Partial<BusinessProfileFormValues>
    onSuccess?: (values: BusinessProfileFormValues) => void

  Implementation:
    - Use react-hook-form with zodResolver(businessProfileSchema)
    - defaultValues from initialValues prop
    - Local state: isSaving (bool), saveError (string|null), saveSuccess (bool)

  Fields to render (match existing dashboard input styling — dark bg, border):
    1. Business Name (text input, required, autofocus)
    2. Business Category (select dropdown, options from BUSINESS_CATEGORIES)
    3. Street Address (text input, optional)
    4. City (text input, optional)
    5. State (text input, optional, maxLength=2 for abbreviation)
    6. ZIP Code (text input, optional)
    7. Phone Number (text input, optional, placeholder: (555) 123-4567)
    8. Website URL (text input, optional, placeholder: https://yoursite.com)
    9. Business Description (textarea, optional, 500 char max, show char count)

  On submit:
    1. Set isSaving=true, clear saveError
    2. PATCH /api/profile/update with form values
    3. On success:
         - Set saveSuccess=true (show green toast/banner: "Profile saved!")
         - Call onSuccess(values) if provided
         - Auto-clear success message after 3 seconds
    4. On error:
         - Set saveError to response error message
         - Do not reset form
    5. Always: set isSaving=false

  Accessibility:
    - All inputs have htmlFor/id pairs
    - Required fields marked with aria-required
    - Error messages use role="alert"
    - Submit button shows spinner when isSaving
    - Success/error banners are keyboard reachable

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — THE PAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: app/dashboard/settings/profile/page.tsx

  This is a server component (no 'use client').

  Logic:
    1. Get session/user using existing server-side auth helper
    2. Redirect to /login if no session (use existing redirect pattern)
    3. Fetch profile from Supabase:
         SELECT business_name, business_category, address_street, address_city,
                address_state, address_zip, phone, website, description
         FROM profiles WHERE id = user.id LIMIT 1
    4. Render page layout matching existing dashboard pages:
         - Page title: "Business Profile"
         - Subtitle: "Keep your business details accurate — AI search engines
                      use this information to find and recommend you."
         - <BusinessProfileForm initialValues={profile} />

  Add metadata export:
    export const metadata = {
      title: 'Business Profile | LocalVector',
      description: 'Manage your business profile for AI visibility',
    }

Create file: app/dashboard/settings/layout.tsx  (if it doesn't exist)

  Renders settings navigation sidebar with links:
    - Profile            → /dashboard/settings/profile
    - Custom Domain      → /dashboard/settings/domain   (link only, page TBD)
    - Team               → /dashboard/settings/team     (link only, page TBD)
    - Billing            → /dashboard/billing           (existing page)

  Mark domain/team links as disabled with a "Coming soon" badge if those
  pages don't exist yet — do NOT link them to 404s.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — FIX THE GETTING STARTED LINK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find: components/onboarding/GettingStarted.tsx (or wherever "Set up profile →" link lives)

Change the href for step 1 to: /dashboard/settings/profile

Verify:
  - The link uses Next.js <Link> component (not <a>)
  - It navigates correctly without full page reload

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — DATABASE MIGRATION (if needed)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Check if profiles table has these columns. If any are missing, add them:

  Create: supabase/migrations/[timestamp]_profiles_business_fields.sql

  DO $$ BEGIN
    -- address fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='address_street') THEN
      ALTER TABLE profiles ADD COLUMN address_street TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='address_city') THEN
      ALTER TABLE profiles ADD COLUMN address_city TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='address_state') THEN
      ALTER TABLE profiles ADD COLUMN address_state TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='address_zip') THEN
      ALTER TABLE profiles ADD COLUMN address_zip TEXT;
    END IF;
    -- profile completion flag
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='profile_completed') THEN
      ALTER TABLE profiles ADD COLUMN profile_completed BOOLEAN NOT NULL DEFAULT false;
    END IF;
  END $$;

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 7 — WRITE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE: __tests__/lib/validations/profile.test.ts

  describe('businessProfileSchema', () => {
    describe('business_name', () => {
      it('accepts valid name')
      it('rejects empty string')
      it('rejects name shorter than 2 characters')
      it('rejects name longer than 100 characters')
      it('trims whitespace')
    })

    describe('phone', () => {
      it('accepts (555) 123-4567')
      it('accepts 555-123-4567')
      it('accepts +1 555 123 4567')
      it('accepts empty string (optional)')
      it('rejects non-phone string')
      it('rejects partial numbers')
    })

    describe('website', () => {
      it('accepts https://example.com')
      it('accepts https://sub.domain.co.uk/path')
      it('rejects http (no https) — depending on business rule')
      it('accepts empty string (optional)')
      it('rejects plain text without protocol')
    })

    describe('address_zip', () => {
      it('accepts 5-digit ZIP')
      it('accepts ZIP+4 format (30022-1234)')
      it('accepts empty string (optional)')
      it('rejects letters')
    })
  })

CREATE: __tests__/api/profile/update.test.ts

  describe('PATCH /api/profile/update', () => {
    describe('authentication', () => {
      it('returns 401 when no session')
      it('returns 401 when session is expired')
    })

    describe('validation', () => {
      it('returns 400 when business_name is missing')
      it('returns 400 when business_name is too short')
      it('returns 400 when phone is invalid format')
      it('returns 400 when website is not a valid URL')
      it('returns 400 when description exceeds 500 chars')
    })

    describe('success', () => {
      it('returns 200 with updated profile on valid input')
      it('sets profile_completed=true on successful save')
      it('saves all fields to profiles table')
      it('only updates the authenticated user\'s own profile (not other users)')
      it('returns sanitized profile — no sensitive fields exposed')
    })

    describe('errors', () => {
      it('returns 500 (not raw DB error) when Supabase fails')
      it('does not leak Supabase error details to client')
    })

    describe('idempotency', () => {
      it('can be called multiple times with same data without error')
      it('updates updated_at on every call')
    })
  })

CREATE: __tests__/components/BusinessProfileForm.test.tsx

  Use @testing-library/react + vitest.

  describe('BusinessProfileForm', () => {
    describe('rendering', () => {
      it('renders all 9 form fields')
      it('pre-fills values from initialValues prop')
      it('shows character count for description field')
      it('renders submit button as enabled by default')
    })

    describe('validation', () => {
      it('shows error when business_name is cleared and form submitted')
      it('shows error when invalid phone is entered')
      it('shows error when invalid website URL is entered')
      it('clears error when field is corrected')
    })

    describe('submission', () => {
      it('disables submit button and shows spinner while saving')
      it('calls PATCH /api/profile/update with correct payload')
      it('shows success banner on 200 response')
      it('calls onSuccess callback with form values on 200 response')
      it('shows error banner on non-200 response')
      it('does not reset form on error')
      it('auto-clears success banner after 3 seconds')
    })

    describe('accessibility', () => {
      it('all inputs have associated labels')
      it('error messages have role=alert')
      it('submit button has accessible loading state label')
    })
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRESSION GUARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Do NOT change:
  - Any existing /dashboard/* page routes
  - Any existing auth middleware logic
  - The onboarding signup flow
  - Any existing Supabase query patterns outside this sprint's files
  - The profiles table RLS policies

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P0-FIX-02
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] /dashboard/settings/profile returns 200 (no 404)
  [ ] Page loads correct existing profile data for authenticated user
  [ ] All 9 fields render and are editable
  [ ] Form saves successfully — Supabase row is updated
  [ ] profile_completed=true is set after save
  [ ] Getting Started "Set up profile →" link navigates to this page
  [ ] settings/layout.tsx renders — domain/team links marked "Coming soon"
  [ ] All validation tests pass
  [ ] All API route tests pass
  [ ] All form component tests pass
  [ ] Full test suite: 0 regressions
  [ ] pnpm tsc --noEmit: 0 errors
  [ ] pnpm lint: 0 errors
  [ ] Manual: visiting /dashboard/settings/profile no longer 404s
  [ ] Manual: saving profile shows success banner
```

---

---

# P0-FIX-03 — Getting Started: Plan-Gate Checklist Items

## Background

The Getting Started checklist shows 5 items for ALL users regardless of plan:
  1. Complete your business profile  ← all plans
  2. Run your first AI visibility scan  ← all plans
  3. Review your first content recommendation  ← all plans
  4. Invite a teammate  ← AI Shield ONLY
  5. Connect your custom domain  ← AI Shield ONLY

Items 4 and 5 must be hidden for Free, Starter, and Growth plans. Showing them creates
false expectations, dead links, and plan confusion. For AI Shield users, these items
must appear but link to working pages (or be marked "Coming soon" if pages aren't ready).

## Pre-Flight Checklist

```bash
# 1. Find the Getting Started component
grep -r "Getting Started\|GettingStarted\|getting.started" --include="*.tsx" -l .

# 2. Find how plan tier is currently read in components
grep -r "plan_tier\|userPlan\|planTier" --include="*.tsx" . | head -20

# 3. Confirm P0-FIX-01 is complete (plan_tier must be reliable first)
# This sprint DEPENDS on FIX-01 being done.

# 4. Check what user/profile data is passed to dashboard layout
grep -r "profile\|session" app/dashboard/layout.tsx 2>/dev/null | head -10

# 5. Baseline test run
pnpm test --passWithNoTests 2>&1 | tail -5
```

## Files This Sprint Will Touch

```
MODIFY:  components/onboarding/GettingStarted.tsx   ← core change
CREATE:  lib/plan-features.ts                       ← plan feature config
CREATE:  __tests__/components/GettingStarted.test.tsx
CREATE:  __tests__/lib/plan-features.test.ts
```

---

### PROMPT — P0-FIX-03

```
You are a senior fullstack engineer on LocalVector.ai (Next.js 14 App Router,
TypeScript, Supabase). Your task is P0-FIX-03: make the Getting Started
checklist respect the user's plan tier so only plan-appropriate steps are shown.

IMPORTANT: P0-FIX-01 must be complete before this sprint. This sprint reads
plan_tier from profiles — that field must be authoritative by now.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — PLAN FEATURES CONFIG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: lib/plan-features.ts

  import type { PlanTier } from './stripe/plan-sync'

  export interface PlanFeatures {
    canInviteTeam: boolean
    canUseCustomDomain: boolean
    canTriggerManualScan: boolean
    canAccessVoiceSearch: boolean
    canAccessReputation: boolean
    canAccessSources: boolean
    canAccessAIMistakes: boolean
    maxCredits: number
    gettingStartedSteps: GettingStartedStepKey[]
  }

  export type GettingStartedStepKey =
    | 'complete_profile'
    | 'run_first_scan'
    | 'review_recommendation'
    | 'invite_teammate'
    | 'connect_domain'

  export const PLAN_FEATURES: Record<PlanTier, PlanFeatures> = {
    free: {
      canInviteTeam: false,
      canUseCustomDomain: false,
      canTriggerManualScan: false,
      canAccessVoiceSearch: false,
      canAccessReputation: false,
      canAccessSources: false,
      canAccessAIMistakes: false,
      maxCredits: 0,
      gettingStartedSteps: [
        'complete_profile',
        'run_first_scan',
        'review_recommendation',
      ],
    },
    starter: {
      canInviteTeam: false,
      canUseCustomDomain: false,
      canTriggerManualScan: false,
      canAccessVoiceSearch: false,
      canAccessReputation: false,
      canAccessSources: false,
      canAccessAIMistakes: false,
      maxCredits: 100,
      gettingStartedSteps: [
        'complete_profile',
        'run_first_scan',
        'review_recommendation',
      ],
    },
    growth: {
      canInviteTeam: false,
      canUseCustomDomain: false,
      canTriggerManualScan: true,
      canAccessVoiceSearch: true,
      canAccessReputation: false,
      canAccessSources: false,
      canAccessAIMistakes: true,
      maxCredits: 250,
      gettingStartedSteps: [
        'complete_profile',
        'run_first_scan',
        'review_recommendation',
      ],
    },
    ai_shield: {
      canInviteTeam: true,
      canUseCustomDomain: true,
      canTriggerManualScan: true,
      canAccessVoiceSearch: true,
      canAccessReputation: true,
      canAccessSources: true,
      canAccessAIMistakes: true,
      maxCredits: 500,
      gettingStartedSteps: [
        'complete_profile',
        'run_first_scan',
        'review_recommendation',
        'invite_teammate',
        'connect_domain',
      ],
    },
  }

  export function getPlanFeatures(planTier: PlanTier): PlanFeatures {
    return PLAN_FEATURES[planTier] ?? PLAN_FEATURES['free']
  }

  // Type-safe feature check helper
  export function hasFeature(
    planTier: PlanTier,
    feature: keyof Omit<PlanFeatures, 'maxCredits' | 'gettingStartedSteps'>
  ): boolean {
    return PLAN_FEATURES[planTier]?.[feature] ?? false
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — GETTING STARTED STEP DEFINITIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

In the GettingStarted component (or a shared constants file), define ALL
possible steps in a map — NOT a hardcoded array:

  const STEP_DEFINITIONS: Record<GettingStartedStepKey, {
    label: string
    description?: string
    actionLabel: string
    actionHref: string
    actionType: 'link' | 'auto'  // 'auto' = completes without user action
  }> = {
    complete_profile: {
      label: 'Complete your business profile',
      actionLabel: 'Set up profile',
      actionHref: '/dashboard/settings/profile',
      actionType: 'link',
    },
    run_first_scan: {
      label: 'Run your first AI visibility scan',
      actionLabel: 'Scan runs every Sunday',
      actionHref: '',
      actionType: 'auto',
    },
    review_recommendation: {
      label: 'Review your first content recommendation',
      actionLabel: 'Will complete automatically',
      actionHref: '',
      actionType: 'auto',
    },
    invite_teammate: {
      label: 'Invite a teammate',
      actionLabel: 'Invite team',
      actionHref: '/dashboard/settings/team',
      actionType: 'link',
    },
    connect_domain: {
      label: 'Connect your custom domain',
      actionLabel: 'Set up domain',
      actionHref: '/dashboard/settings/domain',
      actionType: 'link',
    },
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — REFACTOR GETTING STARTED COMPONENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Open: components/onboarding/GettingStarted.tsx (or locate the correct file)

PRESERVE all existing visual styling, animation, dismiss logic, and layout.
Only change the step rendering logic.

New Props (add to existing interface, do not remove existing props):
  planTier: PlanTier
  completedSteps: GettingStartedStepKey[]

New rendering logic:
  1. Import getPlanFeatures and STEP_DEFINITIONS
  2. const features = getPlanFeatures(planTier)
  3. const visibleSteps = features.gettingStartedSteps
  4. const totalSteps = visibleSteps.length
  5. const completedCount = visibleSteps.filter(k => completedSteps.includes(k)).length
  6. Render header as: "Getting Started ({completedCount}/{totalSteps})"
  7. For each stepKey in visibleSteps:
       const step = STEP_DEFINITIONS[stepKey]
       const isDone = completedSteps.includes(stepKey)
       Render the step with:
         - Checkbox icon: filled if isDone, empty circle if not
         - Label text (strike-through if isDone)
         - Action: if step.actionType === 'link' AND !isDone:
             <Link href={step.actionHref}>{step.actionLabel} →</Link>
           if step.actionType === 'auto':
             <span className="text-muted">{step.actionLabel}</span>
           if isDone:
             render nothing (or a ✓ checkmark)

  8. If completedCount === totalSteps: hide the Getting Started card entirely
     OR show a "You're all set! 🎉" completion state — match existing design intent

Where planTier and completedSteps come from:
  - The parent dashboard page/layout passes these as props
  - Find where GettingStarted is rendered (likely app/dashboard/page.tsx)
  - Pass profile.plan_tier as planTier
  - Pass the completedSteps array (from DB — see FIX-04 for how this is populated)
  - For NOW (before FIX-04 is done), pass completedSteps={[]} as a placeholder
    that FIX-04 will populate

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — DASHBOARD PAGE UPDATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Open: app/dashboard/page.tsx (the server component)

Ensure it:
  1. Fetches profile including plan_tier
  2. Passes plan_tier to GettingStarted
  3. Passes completedSteps={[]} for now (FIX-04 will replace this)

Do NOT change any other data fetching in this file.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — WRITE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE: __tests__/lib/plan-features.test.ts

  describe('PLAN_FEATURES', () => {
    describe('free tier', () => {
      it('shows only 3 getting started steps')
      it('does not include invite_teammate step')
      it('does not include connect_domain step')
      it('canInviteTeam is false')
      it('canUseCustomDomain is false')
      it('maxCredits is 0')
    })

    describe('starter tier', () => {
      it('shows only 3 getting started steps')
      it('does not include invite_teammate step')
      it('does not include connect_domain step')
      it('maxCredits is 100')
    })

    describe('growth tier', () => {
      it('shows only 3 getting started steps')
      it('does not include invite_teammate step')
      it('does not include connect_domain step')
      it('canTriggerManualScan is true')
      it('canAccessVoiceSearch is true')
      it('canInviteTeam is false')
      it('canUseCustomDomain is false')
      it('maxCredits is 250')
    })

    describe('ai_shield tier', () => {
      it('shows all 5 getting started steps')
      it('includes invite_teammate step')
      it('includes connect_domain step')
      it('canInviteTeam is true')
      it('canUseCustomDomain is true')
      it('maxCredits is 500')
    })
  })

  describe('getPlanFeatures', () => {
    it('returns free features for unknown/undefined tier (safe default)')
    it('returns correct features for each valid tier')
  })

  describe('hasFeature', () => {
    it('returns false for growth.canInviteTeam')
    it('returns true for ai_shield.canInviteTeam')
    it('returns false for free.canAccessVoiceSearch')
    it('returns true for growth.canAccessVoiceSearch')
  })

CREATE: __tests__/components/GettingStarted.test.tsx

  Render the component with different planTier props and assert correct steps.

  describe('GettingStarted — plan gating', () => {
    describe('Free plan user', () => {
      it('renders exactly 3 steps')
      it('does NOT render "Invite a teammate"')
      it('does NOT render "Connect your custom domain"')
      it('shows counter as (0/3)')
      it('"Set up profile" links to /dashboard/settings/profile')
    })

    describe('Growth plan user', () => {
      it('renders exactly 3 steps')
      it('does NOT render "Invite a teammate"')
      it('does NOT render "Connect your custom domain"')
      it('shows counter as (0/3)')
    })

    describe('AI Shield plan user', () => {
      it('renders exactly 5 steps')
      it('renders "Invite a teammate"')
      it('renders "Connect your custom domain"')
      it('shows counter as (0/5)')
    })

    describe('Completion state', () => {
      it('shows completed step with visual indicator when in completedSteps')
      it('updates counter when some steps are completed')
      it('counter shows (2/3) when 2 of 3 steps done on Growth plan')
      it('hides action link for completed steps')
    })

    describe('Regression — existing behavior', () => {
      it('dismiss button still works after refactor')
      it('card is not rendered when all steps completed')
      it('maintains existing dark UI styling')
    })
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P0-FIX-03
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] Free users see 3 steps (no invite, no domain)
  [ ] Starter users see 3 steps (no invite, no domain)
  [ ] Growth users see 3 steps (no invite, no domain)
  [ ] AI Shield users see all 5 steps
  [ ] Counter matches visible step count (e.g., 0/3 not 0/5 for Growth)
  [ ] Step 1 "Set up profile" links to /dashboard/settings/profile
  [ ] lib/plan-features.ts created with all exports
  [ ] All __tests__/lib/plan-features.test.ts pass
  [ ] All __tests__/components/GettingStarted.test.tsx pass
  [ ] Full test suite: 0 regressions
  [ ] pnpm tsc --noEmit: 0 errors
  [ ] pnpm lint: 0 errors
  [ ] Manual verify: logged in as dev@localvector.ai (AI Shield) → all 5 steps visible
  [ ] Manual verify: create a test Growth user → only 3 steps visible
```

---

---

# P0-FIX-04 — Getting Started: Completion Tracking (DB-Driven State)

## Background

The Getting Started counter is stuck at `(0/5)` or `(0/3)` because completion state
is not persisted per user. Steps 2 and 3 claim to "complete automatically" but never
do. Step 1 now has a working page (from FIX-02) but saving the profile doesn't mark
step 1 as complete. This sprint wires all completion events to a DB table and ensures
the counter reflects real state on every page load.

## Pre-Flight Checklist

```bash
# 1. Confirm FIX-01, FIX-02, FIX-03 are complete
# FIX-02 is required: profile_completed=true must be set when profile saves

# 2. Check if onboarding_steps table exists
supabase db pull
grep -i "onboarding_steps\|onboarding_checklist" supabase/schema.sql supabase/migrations/*.sql

# 3. Check existing scan completion events
grep -r "scan.*complete\|scan.*done\|scanFinished" --include="*.ts" . | head -10

# 4. Check existing recommendation generation events
grep -r "recommendation\|content.*brief\|content.*reco" --include="*.ts" . | head -10

# 5. Baseline
pnpm test --passWithNoTests 2>&1 | tail -5
```

## Files This Sprint Will Touch

```
CREATE:  supabase/migrations/[ts]_onboarding_steps.sql
CREATE:  lib/onboarding/completion.ts
MODIFY:  app/api/profile/update/route.ts          ← mark step 1 complete on save
MODIFY:  [scan completion handler]                 ← mark step 2 complete
MODIFY:  [recommendation generation handler]       ← mark step 3 complete
MODIFY:  app/dashboard/page.tsx                    ← fetch and pass completedSteps
MODIFY:  components/onboarding/GettingStarted.tsx  ← replace completedSteps={[]}
CREATE:  __tests__/lib/onboarding/completion.test.ts
CREATE:  __tests__/api/onboarding/complete-step.test.ts
```

---

### PROMPT — P0-FIX-04

```
You are a senior fullstack engineer on LocalVector.ai (Next.js 14 App Router,
Supabase, TypeScript). Your task is P0-FIX-04: implement persistent, DB-driven
Getting Started completion tracking. Every step must update the DB when it
completes, and the dashboard must load real completion state on every visit.

DEPENDS ON: P0-FIX-01 (plan_tier), P0-FIX-02 (profile page + profile_completed),
            P0-FIX-03 (plan-gated steps)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — DATABASE MIGRATION: onboarding_steps TABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: supabase/migrations/[timestamp]_create_onboarding_steps.sql

  -- Drop and recreate cleanly (this is a new table, no existing data)
  CREATE TABLE IF NOT EXISTS onboarding_steps (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    step_key    TEXT NOT NULL,
    completed   BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, step_key)
  );

  -- Index for fast per-user lookups
  CREATE INDEX IF NOT EXISTS idx_onboarding_steps_user_id ON onboarding_steps(user_id);
  CREATE INDEX IF NOT EXISTS idx_onboarding_steps_user_step ON onboarding_steps(user_id, step_key);

  -- Trigger for updated_at
  DROP TRIGGER IF EXISTS set_onboarding_steps_updated_at ON onboarding_steps;
  CREATE TRIGGER set_onboarding_steps_updated_at
    BEFORE UPDATE ON onboarding_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

  -- RLS: users can only read their own steps; only service_role can write
  ALTER TABLE onboarding_steps ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "users_read_own_onboarding_steps"
    ON onboarding_steps FOR SELECT
    USING (auth.uid() = user_id);

  -- Service role bypasses RLS for writes (webhook handlers, server actions)
  -- Add explicit policy for authenticated INSERT for self-initiated actions
  CREATE POLICY "users_insert_own_onboarding_steps"
    ON onboarding_steps FOR INSERT
    WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "users_update_own_onboarding_steps"
    ON onboarding_steps FOR UPDATE
    USING (auth.uid() = user_id);

  -- valid step_key values constraint
  ALTER TABLE onboarding_steps ADD CONSTRAINT onboarding_steps_step_key_valid
    CHECK (step_key IN (
      'complete_profile',
      'run_first_scan',
      'review_recommendation',
      'invite_teammate',
      'connect_domain'
    ));

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — COMPLETION HELPER MODULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: lib/onboarding/completion.ts

  import type { SupabaseClient } from '@supabase/supabase-js'
  import type { GettingStartedStepKey } from '@/lib/plan-features'

  /**
   * Mark a single onboarding step as complete for a user.
   * Idempotent — safe to call multiple times; already-completed steps
   * are not updated again (preserves original completed_at timestamp).
   */
  export async function markStepComplete(params: {
    supabase: SupabaseClient
    userId: string
    stepKey: GettingStartedStepKey
  }): Promise<{ success: boolean; alreadyDone: boolean; error?: string }> {
    const { supabase, userId, stepKey } = params

    try {
      // Check if already marked complete
      const { data: existing } = await supabase
        .from('onboarding_steps')
        .select('completed')
        .eq('user_id', userId)
        .eq('step_key', stepKey)
        .single()

      if (existing?.completed) {
        return { success: true, alreadyDone: true }
      }

      // Upsert: insert or update
      const { error } = await supabase
        .from('onboarding_steps')
        .upsert({
          user_id: userId,
          step_key: stepKey,
          completed: true,
          completed_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,step_key',
          ignoreDuplicates: false,
        })

      if (error) {
        console.error(`[onboarding] markStepComplete failed userId=${userId} step=${stepKey}:`, error.message)
        return { success: false, alreadyDone: false, error: error.message }
      }

      console.log(`[onboarding] step complete userId=${userId} step=${stepKey}`)
      return { success: true, alreadyDone: false }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[onboarding] unexpected error userId=${userId} step=${stepKey}:`, msg)
      return { success: false, alreadyDone: false, error: msg }
    }
  }

  /**
   * Fetch all completed step keys for a user.
   * Used by the dashboard page to pass completedSteps to GettingStarted.
   */
  export async function getCompletedSteps(params: {
    supabase: SupabaseClient
    userId: string
  }): Promise<GettingStartedStepKey[]> {
    const { supabase, userId } = params

    const { data, error } = await supabase
      .from('onboarding_steps')
      .select('step_key')
      .eq('user_id', userId)
      .eq('completed', true)

    if (error) {
      console.error(`[onboarding] getCompletedSteps failed userId=${userId}:`, error.message)
      return []   // fail open — show uncompleted rather than crash
    }

    return (data ?? []).map(row => row.step_key as GettingStartedStepKey)
  }

  /**
   * Backfill: check profile_completed flag and mark step 1 if appropriate.
   * Call this once per session on dashboard load as a safety net.
   */
  export async function syncProfileCompletionStep(params: {
    supabase: SupabaseClient
    userId: string
  }): Promise<void> {
    const { supabase, userId } = params

    const { data: profile } = await supabase
      .from('profiles')
      .select('profile_completed')
      .eq('id', userId)
      .single()

    if (profile?.profile_completed) {
      await markStepComplete({ supabase, userId, stepKey: 'complete_profile' })
    }
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — HOOK STEP 1 COMPLETION INTO PROFILE SAVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Open: app/api/profile/update/route.ts  (created in FIX-02)

After the successful profile UPDATE:
  // Mark step 1 complete
  await markStepComplete({
    supabase: supabaseAdmin,  // use admin/service-role client for reliability
    userId: session.user.id,
    stepKey: 'complete_profile',
  })
  // This is fire-and-forget — do not fail the profile save if this fails

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — HOOK STEP 2 COMPLETION INTO SCAN COMPLETION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the existing scan completion handler. Search:
  grep -r "scan.*status.*complete\|scan.*finished\|scanStatus.*done" --include="*.ts" -l .

In that handler, after a scan successfully finishes for a user:
  await markStepComplete({
    supabase: supabaseAdmin,
    userId: [user_id from scan record],
    stepKey: 'run_first_scan',
  })

If using Inngest for scan jobs, find the job completion callback and add the
markStepComplete call there. Do not change job retry logic or error handling.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — HOOK STEP 3 COMPLETION INTO RECOMMENDATION GENERATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the recommendation/content brief generation handler. Search:
  grep -r "recommendation.*creat\|content.*brief.*insert\|content_recommendations" --include="*.ts" -l .

After the first recommendation is successfully written to the DB for a user:
  await markStepComplete({
    supabase: supabaseAdmin,
    userId,
    stepKey: 'review_recommendation',
  })

Important: only mark complete when the FIRST recommendation is created.
Check if any existing recommendations exist before marking:
  const existing = await supabase
    .from('onboarding_steps')
    .select('completed')
    .eq('user_id', userId)
    .eq('step_key', 'review_recommendation')
    .single()
  // markStepComplete is idempotent so this is handled inside it,
  // but be explicit to avoid unnecessary DB calls in hot paths.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — DASHBOARD PAGE: LOAD REAL COMPLETION STATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Open: app/dashboard/page.tsx

Replace the placeholder completedSteps={[]} with a real DB fetch:

  // Add this fetch alongside existing data fetches (parallel with Promise.all)
  const [profile, completedSteps] = await Promise.all([
    // ... existing profile fetch
    getCompletedSteps({ supabase, userId: user.id }),
  ])

  // Safety net: sync profile_completed flag to step table
  await syncProfileCompletionStep({ supabase, userId: user.id })

  // Pass to GettingStarted
  <GettingStarted
    planTier={profile.plan_tier}
    completedSteps={completedSteps}
    // ... other existing props preserved
  />

Note: syncProfileCompletionStep is a one-time backfill for existing users
who already have profile_completed=true but no onboarding_steps row.
It's idempotent and fast — safe to run on every dashboard load.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 7 — WRITE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE: __tests__/lib/onboarding/completion.test.ts

  Use vitest + Supabase mock (mock the from().upsert().eq() chain).

  describe('markStepComplete', () => {
    it('upserts a row with completed=true and completed_at set')
    it('is idempotent — returns alreadyDone:true when called twice')
    it('does not overwrite completed_at on second call')
    it('returns success:false (not throw) when DB upsert fails')
    it('returns success:false (not throw) on network error')
    it('logs success message with userId and stepKey')
    it('logs error message without throwing')
    it('rejects invalid step_key values via type system (compile-time check)')

    describe('for each step key', () => {
      const steps = [
        'complete_profile',
        'run_first_scan',
        'review_recommendation',
        'invite_teammate',
        'connect_domain',
      ]
      steps.forEach(stepKey => {
        it(`marks ${stepKey} complete successfully`)
      })
    })
  })

  describe('getCompletedSteps', () => {
    it('returns array of completed step keys for user')
    it('returns empty array when user has no steps')
    it('returns only completed=true steps (not incomplete rows)')
    it('returns empty array (not throw) when DB fails')
    it('returns correct type: GettingStartedStepKey[]')
  })

  describe('syncProfileCompletionStep', () => {
    it('calls markStepComplete with complete_profile when profile_completed=true')
    it('does not call markStepComplete when profile_completed=false')
    it('does not throw when profile fetch fails')
  })

CREATE: __tests__/api/profile/update.test.ts — ADD these cases to existing file

  describe('step completion side effect', () => {
    it('calls markStepComplete with complete_profile on successful profile save')
    it('still returns 200 even if markStepComplete fails')
    it('does not call markStepComplete when profile save fails (DB error)')
  })

CREATE: __tests__/api/onboarding/complete-step.test.ts

  If you create a standalone API route for step completion (optional),
  test all CRUD operations and authorization.

  // If no standalone route created, this file can test the integration
  // by verifying step completion happens as side effects of other actions.

  describe('Step completion integration', () => {
    it('complete_profile step is marked when profile is saved via API')
    it('run_first_scan step is marked when scan completes')
    it('review_recommendation step is marked when first recommendation is generated')
    it('steps do not bleed between users (user A completion does not affect user B)')
    it('each user has independent step tracking')
  })

  describe('Dashboard completion state loading', () => {
    it('dashboard page fetches completedSteps from DB on every load')
    it('completed steps are reflected in GettingStarted counter')
    it('profile_completed=true users see complete_profile as checked on first load')
    it('getCompletedSteps and profile fetch are parallel (not sequential)')
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRESSION GUARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Do NOT modify:
  - Scan job logic beyond adding the markStepComplete call
  - Recommendation generation logic beyond adding the markStepComplete call
  - Inngest job definitions, retry policies, or error handlers
  - Any existing DB queries in the dashboard page (add parallel, don't replace)
  - RLS policies on any existing tables

Performance guard:
  - getCompletedSteps must run in parallel with existing dashboard fetches
    (use Promise.all — do NOT add it sequentially)
  - markStepComplete in hot paths (scan/recommendation handlers) is fire-and-forget
    (await it but do not make the parent operation fail if it fails)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P0-FIX-04
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] onboarding_steps table created with correct schema, constraints, RLS
  [ ] lib/onboarding/completion.ts created with all 3 exports
  [ ] profile/update API marks complete_profile step on every successful save
  [ ] Scan completion handler marks run_first_scan step
  [ ] Recommendation generation marks review_recommendation step
  [ ] Dashboard page fetches completedSteps in parallel with profile
  [ ] GettingStarted renders real completion state (not hardcoded [])
  [ ] Counter shows correct count: (1/3) after profile saved, etc.
  [ ] markStepComplete is idempotent (tested)
  [ ] syncProfileCompletionStep backfills existing users correctly
  [ ] All __tests__/lib/onboarding/completion.test.ts pass
  [ ] All integration tests pass
  [ ] Full test suite: 0 regressions
  [ ] pnpm tsc --noEmit: 0 errors
  [ ] pnpm lint: 0 errors
  [ ] Manual verify: save profile → counter advances to (1/3) on next load
  [ ] Manual verify: run scan → counter advances to (2/3)
  [ ] Manual verify: check is persistent across page refreshes and re-logins
```

---

---

# Final Regression Smoke Test (Run After All 4 Sprints)

Copy-paste and run this full block after P0-FIX-04 is complete:

```bash
#!/bin/bash
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "LocalVector P0 — Final Regression Smoke Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "1. TypeScript compilation..."
pnpm tsc --noEmit
echo "   ✅ 0 type errors"

echo ""
echo "2. ESLint..."
pnpm lint
echo "   ✅ 0 lint errors"

echo ""
echo "3. Full test suite..."
pnpm test --reporter=verbose 2>&1 | tail -30
echo "   ✅ All tests pass, 0 regressions"

echo ""
echo "4. DB Migration verification..."
# Verify tables exist
supabase db diff --local

echo ""
echo "5. Manual Checklist:"
echo "   [ ] dev@localvector.ai → header badge shows 'AI Shield' (not 'Growth')"
echo "   [ ] dev@localvector.ai → credits show 498/500"
echo "   [ ] dev@localvector.ai → Getting Started shows 5 steps"
echo "   [ ] dev@localvector.ai → 'Set up profile →' loads the profile page"
echo "   [ ] Growth test user → Getting Started shows only 3 steps"
echo "   [ ] Free test user  → Getting Started shows only 3 steps"
echo "   [ ] Save profile → counter advances and persists on refresh"
echo "   [ ] /dashboard still loads (no regression)"
echo "   [ ] Stripe webhook: simulate upgrade in Stripe CLI → badge updates"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Smoke test complete. Review checklist above."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

---

# Stripe CLI — Simulate Plan Change (Test FIX-01 End-to-End)

```bash
# Forward Stripe events to local webhook
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# In another terminal — simulate an upgrade to AI Shield
stripe trigger customer.subscription.updated \
  --override subscription:items:data:0:price:id=$STRIPE_PRICE_AI_SHIELD \
  --override subscription:status=active

# Then verify in Supabase Studio:
# SELECT plan_tier FROM profiles WHERE email = 'dev@localvector.ai';
# Expected: 'ai_shield'
```

---

# P1 Sprint Queue (After P0 is Complete and Verified)

These are next in line but do NOT begin until all 4 P0 sprints have a clean smoke test:

| Sprint | Fix | Depends On |
|--------|-----|------------|
| P1-FIX-05 | Manual scan trigger UI for Growth + AI Shield | P0-FIX-01 |
| P1-FIX-06 | Sidebar nav plan gating + upgrade modals | P0-FIX-01, P0-FIX-03 |
| P1-FIX-07 | Build /settings/domain + /settings/team or stub cleanly | P0-FIX-02 |
| P1-FIX-08 | Full codebase grep for stale profiles.plan reads | P0-FIX-01 |

---

*LocalVector.ai P0 Sprint Prompts — End*  
*Generated: March 3, 2026 | SDET Audit Mode*
