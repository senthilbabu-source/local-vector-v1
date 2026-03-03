# LocalVector.ai — P3 + P4 + P5 Sprint Prompts
## Data Pipeline, Content Engine & Infrastructure Hardening
**Sprint Block:** P3-FIX-13 through P5-FIX-24
**Priority:** P3 = Core data flows | P4 = Content pages | P5 = Infrastructure reliability
**Execution Environment:** VS Code + Claude Code
**Repo:** https://github.com/senthilbabu-source/local-vector-v1
**Prerequisite:** All P0, P1, P2 sprints complete and smoke-tested

---

## Sprint Map

```
P3 — Data Integrity & Real Data Pipeline
  P3-FIX-13  Sample Data → Real Data Transition (scan surfacing)
  P3-FIX-14  Credits System — Deduction, Tracking & Accurate Display
  P3-FIX-15  Billing / Plan Upgrade-Downgrade Flow (complete the page)
  P3-FIX-16  Core Dashboard Data Pages (AI Mentions, Position, AI Says)

P4 — Content & Recommendations Engine
  P4-FIX-17  Content Recommendations Display & User Interaction
  P4-FIX-18  AI Mistakes Page — Real Data + Correction Actions
  P4-FIX-19  Voice Search & Site Visitors Pages
  P4-FIX-20  Your Reputation & Your Sources Pages (AI Shield)

P5 — Infrastructure & Reliability
  P5-FIX-21  Transactional Email — Scan Complete + Weekly Digest
  P5-FIX-22  API Rate Limiting — Systematic Coverage Across All Routes
  P5-FIX-23  Error Boundaries — App-Wide Graceful Failure Handling
  P5-FIX-24  Performance — Core Web Vitals, Bundle Optimization, Caching
```

**Critical ordering notes:**
- P3-FIX-13 must run before P3-FIX-16 (real data pipeline must exist before pages use it)
- P3-FIX-14 must run before P3-FIX-15 (credits must be accurate before billing shows them)
- P4-FIX-17 must run before P4-FIX-18/19/20 (shared recommendation primitives)
- P5 sprints are largely independent and can run in parallel

---

---

# P3-FIX-13 — Sample Data → Real Data Transition

## Background

Every new user sees a sample-data banner: *"Your real AI visibility data will appear
here after your first scan (runs every Sunday)."* The transition from sample to real
data is the most critical UX moment in the product — it's when LocalVector delivers
its first actual value. Currently this transition is unverified end-to-end:

- The `is_sample_data` flag may never clear after a real scan runs
- Real scan data may not correctly populate the dashboard charts
- There is no mechanism to show a user that their first scan completed
- Sample data may coexist with real data in ambiguous ways

This sprint hardens the entire sample → real data pipeline.

## Pre-Flight Checklist

```bash
# 1. Find the is_sample_data flag location
grep -rn "is_sample_data\|sample_data\|isSampleData" --include="*.ts" --include="*.tsx" . \
  | grep -v node_modules | head -20

# 2. Find the sample data seeding logic
grep -rn "seed\|sample.*insert\|insert.*sample" --include="*.ts" . \
  | grep -v node_modules | head -10

# 3. Find the dashboard banner component
grep -rn "viewing sample data\|sample data" --include="*.tsx" . \
  | grep -v node_modules

# 4. Find scan result storage logic
grep -rn "scan_results\|scanResults\|visibility_score\|sov_score" \
  --include="*.ts" . | grep -v node_modules | head -15

# 5. Check current data fetching on dashboard
grep -rn "is_sample_data\|sample" app/dashboard/page.tsx 2>/dev/null | head -10

# 6. Baseline tests
pnpm test --passWithNoTests 2>&1 | tail -5
```

## Files This Sprint Will Create/Touch

```
CREATE:  lib/data/scan-data-resolver.ts         ← decides sample vs real data
CREATE:  lib/data/sample-data-seeder.ts         ← idempotent sample data ops
MODIFY:  app/api/webhooks/scan-complete/route.ts ← or wherever scan finishes
MODIFY:  components/dashboard/SampleDataBanner.tsx
MODIFY:  app/dashboard/page.tsx                  ← use resolver
CREATE:  __tests__/lib/data/scan-data-resolver.test.ts
CREATE:  __tests__/lib/data/sample-data-seeder.test.ts
```

---

### PROMPT — P3-FIX-13

```
You are a senior fullstack engineer on LocalVector.ai (Next.js 14, Supabase,
TypeScript). Your task is P3-FIX-13: harden the transition from sample data to
real scan data so users reliably see their real AI visibility results after their
first scan completes, with zero data ambiguity.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — DATABASE: DATA SOURCE TRACKING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create migration: supabase/migrations/[ts]_data_source_tracking.sql

Check if profiles has these columns. Add any that are missing:

  -- Single authoritative flag: has user ever had a real scan complete?
  IF NOT EXISTS (...column 'has_real_scan_data' on profiles...) THEN
    ALTER TABLE profiles
      ADD COLUMN has_real_scan_data BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN first_scan_completed_at TIMESTAMPTZ,
      ADD COLUMN last_scan_completed_at TIMESTAMPTZ;
  END IF;

  -- Mark existing sample data rows clearly
  -- Check if scan_results / visibility_data tables have a data_source column
  -- If not, add: data_source TEXT NOT NULL DEFAULT 'sample' CHECK (data_source IN ('sample','real'))
  -- Apply to: scan_results, sov_scores, ai_mentions, position_rankings
  --   (add to each table that the dashboard reads from)
  -- Note: only add if column does not already exist — use the DO $$ BEGIN pattern

  -- Index for fast real-data lookups
  CREATE INDEX IF NOT EXISTS idx_profiles_has_real_scan
    ON profiles(id) WHERE has_real_scan_data = true;

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — SAMPLE DATA SEEDER (IDEMPOTENT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: lib/data/sample-data-seeder.ts

  This module ensures sample data seeding is safe, idempotent, and reversible.

  export async function ensureSampleDataExists(params: {
    supabase: SupabaseClient   // service-role
    userId: string
  }): Promise<{ seeded: boolean; alreadyExists: boolean }> {
    // Check if sample data already exists for this user
    const { count } = await supabase
      .from('scan_results')       // adjust to actual table name
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('data_source', 'sample')

    if ((count ?? 0) > 0) {
      return { seeded: false, alreadyExists: true }
    }

    // Insert sample data rows with data_source='sample'
    // Use realistic but clearly fake values:
    //   - SOV scores between 15-45% (plausible for a new business)
    //   - 2-5 AI mentions per major AI engine
    //   - Position ranking between 8-25
    //   - Date: set to past 4 Sundays to simulate scan history

    // Sample data must be tagged data_source='sample' on EVERY row
    // so it can be cleanly removed without touching real data

    await supabase.from('scan_results').insert([
      { user_id: userId, data_source: 'sample', /* ... realistic fields */ },
      // ... multiple sample rows
    ])

    console.log(`[sample-seeder] seeded userId=${userId}`)
    return { seeded: true, alreadyExists: false }
  }

  export async function clearSampleData(params: {
    supabase: SupabaseClient
    userId: string
  }): Promise<{ cleared: number }> {
    // Delete ALL sample data rows for this user across ALL data tables
    // This must be atomic — use a DB transaction via RPC if available
    // Tables to clear: scan_results, sov_scores, ai_mentions, position_rankings
    //   (and any other dashboard data tables — find them all)

    // After clearing, verify no sample rows remain
    // Return count of deleted rows
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — SCAN DATA RESOLVER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: lib/data/scan-data-resolver.ts

  This is the single function every dashboard data fetch goes through.
  It decides whether to return real or sample data, and which rows to show.

  export type DataMode = 'sample' | 'real'

  export interface DataResolverResult {
    mode: DataMode
    userId: string
    // Metadata for the banner component
    firstScanCompletedAt: string | null
    lastScanCompletedAt: string | null
    nextScheduledScanAt: string | null  // next Sunday at midnight UTC
  }

  export async function resolveDataMode(params: {
    supabase: SupabaseClient
    userId: string
  }): Promise<DataResolverResult> {
    const { data: profile } = await supabase
      .from('profiles')
      .select('has_real_scan_data, first_scan_completed_at, last_scan_completed_at')
      .eq('id', userId)
      .single()

    const mode: DataMode = profile?.has_real_scan_data ? 'real' : 'sample'

    // Calculate next Sunday
    const now = new Date()
    const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7
    const nextSunday = new Date(now)
    nextSunday.setUTCDate(now.getUTCDate() + daysUntilSunday)
    nextSunday.setUTCHours(0, 0, 0, 0)

    return {
      mode,
      userId,
      firstScanCompletedAt: profile?.first_scan_completed_at ?? null,
      lastScanCompletedAt: profile?.last_scan_completed_at ?? null,
      nextScheduledScanAt: nextSunday.toISOString(),
    }
  }

  // Helper: builds a Supabase query filter for the correct data source
  export function dataSourceFilter(mode: DataMode): { data_source: DataMode } {
    return { data_source: mode }
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — SCAN COMPLETION HANDLER: FLIP THE FLAG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the scan completion handler (Inngest job callback or webhook).

After scan results are successfully written to all data tables:

  // 1. Tag all newly written rows with data_source='real'
  //    (this should already be the case if insert uses data_source='real')
  //    Verify: ensure the scan writer sets data_source='real' on every insert

  // 2. Flip the profile flag
  await supabaseAdmin
    .from('profiles')
    .update({
      has_real_scan_data: true,
      last_scan_completed_at: new Date().toISOString(),
      first_scan_completed_at: profile.first_scan_completed_at
        ?? new Date().toISOString(),  // only set if null
    })
    .eq('id', userId)

  // 3. Clear sample data (now that real data exists)
  const { cleared } = await clearSampleData({ supabase: supabaseAdmin, userId })
  console.log(`[scan-complete] cleared ${cleared} sample rows for userId=${userId}`)

  // 4. Mark Getting Started step 2 complete (from P0-FIX-04)
  await markStepComplete({ supabase: supabaseAdmin, userId, stepKey: 'run_first_scan' })

  // If any step fails, log the error but DO NOT fail the scan job
  // Real scan data is more important than cleanup

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — SAMPLE DATA BANNER COMPONENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Update: components/dashboard/SampleDataBanner.tsx

  Props:
    dataResolverResult: DataResolverResult

  Behavior:
    If mode === 'sample':
      Show banner:
        "📊 You're viewing sample data."
        "Your real AI visibility data will appear after your first scan."
        "Next scan: [nextScheduledScanAt formatted as 'Sunday, March 9']"
        [Dismiss button — dismissal saved to localStorage only, banner returns
         on hard refresh until mode is 'real']

    If mode === 'real':
      Do NOT render the banner at all
      (Component returns null — no flicker)

    If mode === 'real' AND it just transitioned (lastScanCompletedAt < 24h ago):
      Briefly show a SUCCESS banner:
        "✅ Your first AI visibility scan is complete!"
        "Real data is now showing across your dashboard."
        [auto-dismiss after 8 seconds]

  The banner must be a client component ('use client') since it uses localStorage.
  Pass DataResolverResult from the server dashboard page.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — DASHBOARD PAGE: USE RESOLVER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Update: app/dashboard/page.tsx

  // Run resolver alongside other parallel fetches
  const [profile, completedSteps, dataResolverResult] = await Promise.all([
    fetchProfile(userId),
    getCompletedSteps({ supabase, userId }),
    resolveDataMode({ supabase, userId }),
  ])

  // All data fetch components now receive dataMode so they filter correctly:
  <SOVChart dataMode={dataResolverResult.mode} userId={userId} />
  <SampleDataBanner dataResolverResult={dataResolverResult} />

  // Dashboard data components must accept a dataMode prop and use
  // dataSourceFilter(dataMode) in their Supabase queries

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 7 — WRITE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE: __tests__/lib/data/scan-data-resolver.test.ts

  describe('resolveDataMode', () => {
    it('returns mode=sample when has_real_scan_data=false')
    it('returns mode=real when has_real_scan_data=true')
    it('returns mode=sample for new user with no profile row')
    it('calculates nextScheduledScanAt as next Sunday midnight UTC')
    it('nextScheduledScanAt is always in the future')
    it('nextScheduledScanAt is never more than 7 days away')
    it('returns firstScanCompletedAt from profile')
    it('returns null timestamps when no scans have run')
    it('does not throw on DB error — returns sample mode as safe default')
  })

CREATE: __tests__/lib/data/sample-data-seeder.test.ts

  describe('ensureSampleDataExists', () => {
    it('inserts sample rows with data_source=sample')
    it('returns alreadyExists=true if sample rows already exist (idempotent)')
    it('does not insert duplicate sample rows on second call')
    it('all inserted rows have data_source=sample (no real data tagged as sample)')
    it('returns seeded=true on first call, alreadyExists=true on subsequent calls')
  })

  describe('clearSampleData', () => {
    it('deletes all data_source=sample rows for the user')
    it('does NOT delete data_source=real rows')
    it('does NOT affect other users sample data')
    it('returns count of deleted rows')
    it('returns 0 when no sample data exists (idempotent)')
    it('does not throw on empty result')
  })

  describe('scan completion integration', () => {
    it('sets has_real_scan_data=true after first scan')
    it('sets first_scan_completed_at on first scan (not overwritten on subsequent)')
    it('updates last_scan_completed_at on every scan')
    it('clears sample data after scan completes')
    it('marks run_first_scan onboarding step complete')
    it('continues even if clearSampleData fails (logs, does not throw)')
  })

CREATE: __tests__/components/SampleDataBanner.test.tsx

  describe('SampleDataBanner', () => {
    it('renders banner when mode=sample')
    it('renders null when mode=real')
    it('shows next scan date in human-readable format')
    it('dismiss button hides the banner')
    it('shows success banner when scan completed < 24h ago')
    it('auto-dismisses success banner after 8 seconds')
    it('does not flash between sample and real states')
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P3-FIX-13
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] Migration adds data_source column to all dashboard data tables
  [ ] All existing sample data rows have data_source='sample'
  [ ] scan-data-resolver.ts returns correct mode per user state
  [ ] sample-data-seeder.ts is fully idempotent (safe to call N times)
  [ ] Scan completion handler: tags real data, flips flag, clears sample data
  [ ] Dashboard banner disappears permanently after first real scan
  [ ] Success banner shows on first real scan (auto-dismisses)
  [ ] All data fetch components filter by dataMode
  [ ] All tests pass | 0 regressions | pnpm tsc --noEmit: 0 errors
  [ ] Manual: simulate scan completion → banner disappears → real data shown
  [ ] Manual: new user → sample data visible → banner shows next scan date
```

---

---

# P3-FIX-14 — Credits System: Deduction, Tracking & Accurate Display

## Background

The credits counter shows `498/500` but there is no verified mechanism ensuring:
- Credits are actually deducted when a scan runs
- Credits are deducted for the correct operations (scan ≠ same cost as API call)
- The display refreshes after deduction without a full page reload
- Users can see a breakdown of what consumed their credits
- When credits reach 0, the right operations are blocked (not crashed)

This sprint makes the credits system correct, observable, and trustworthy.

## Pre-Flight Checklist

```bash
# 1. Find current credits tracking table/logic
grep -rn "usage_limits\|credits\|credit_usage\|deduct" --include="*.ts" . \
  | grep -v node_modules | head -20

# 2. Find where credits are currently deducted
grep -rn "used_credits\|credits_used\|decrement" --include="*.ts" . \
  | grep -v node_modules | head -10

# 3. Find the credits display component
grep -rn "credits\|498\|500" --include="*.tsx" . | grep -v node_modules | head -10

# 4. Check existing usage_limits schema
grep -A 10 "usage_limits" supabase/schema.sql supabase/migrations/*.sql 2>/dev/null | head -20

# 5. Baseline
pnpm test --passWithNoTests 2>&1 | tail -5
```

## Files This Sprint Will Create/Touch

```
CREATE:  supabase/migrations/[ts]_credits_tracking.sql
CREATE:  lib/credits/credits-service.ts       ← all credits operations
CREATE:  app/api/credits/history/route.ts     ← GET: usage history
MODIFY:  components/layout/CreditsDisplay.tsx ← live-updating counter
MODIFY:  [scan job handler]                   ← deduct credits on scan
CREATE:  __tests__/lib/credits/credits-service.test.ts
CREATE:  __tests__/api/credits/history.test.ts
CREATE:  __tests__/components/CreditsDisplay.test.tsx
```

---

### PROMPT — P3-FIX-14

```
You are a senior fullstack engineer on LocalVector.ai (Next.js 14, Supabase,
TypeScript). Your task is P3-FIX-14: build a correct, verifiable credits system
with accurate deduction, a usage history log, and a live-updating display.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — DATABASE: CREDITS TABLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create migration: supabase/migrations/[ts]_credits_system.sql

  -- Ensure usage_limits has correct schema
  DO $$ BEGIN
    IF NOT EXISTS (...'max_credits' on usage_limits...) THEN
      ALTER TABLE usage_limits ADD COLUMN max_credits INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (...'used_credits' on usage_limits...) THEN
      ALTER TABLE usage_limits ADD COLUMN used_credits INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (...'reset_at' on usage_limits...) THEN
      -- Credits reset on billing cycle renewal
      ALTER TABLE usage_limits ADD COLUMN reset_at TIMESTAMPTZ;
    END IF;
  END $$;

  -- Constraint: used_credits cannot exceed max_credits
  ALTER TABLE usage_limits DROP CONSTRAINT IF EXISTS credits_not_exceeded;
  ALTER TABLE usage_limits ADD CONSTRAINT credits_not_exceeded
    CHECK (used_credits <= max_credits);

  -- Constraint: no negative credits
  ALTER TABLE usage_limits ADD CONSTRAINT used_credits_non_negative
    CHECK (used_credits >= 0);

  -- Credits usage audit log (immutable append-only)
  CREATE TABLE IF NOT EXISTS credits_usage_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    operation     TEXT NOT NULL,
      -- 'scan', 'api_call', 'content_recommendation', 'manual_trigger'
    credits_used  INTEGER NOT NULL CHECK (credits_used > 0),
    credits_before INTEGER NOT NULL,
    credits_after  INTEGER NOT NULL,
    reference_id  UUID,       -- scan_id, recommendation_id, etc.
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- RLS: users read own log only
  ALTER TABLE credits_usage_log ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "users_read_own_credits_log"
    ON credits_usage_log FOR SELECT
    USING (auth.uid() = user_id);

  -- Index for history queries
  CREATE INDEX IF NOT EXISTS idx_credits_log_user_created
    ON credits_usage_log(user_id, created_at DESC);

  -- DB function: atomic credit deduction (prevents race conditions)
  CREATE OR REPLACE FUNCTION deduct_credits(
    p_user_id     UUID,
    p_amount      INTEGER,
    p_operation   TEXT,
    p_reference_id UUID DEFAULT NULL
  ) RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER   -- runs as owner, bypasses RLS
  AS $$
  DECLARE
    v_before INTEGER;
    v_after  INTEGER;
    v_max    INTEGER;
  BEGIN
    -- Lock the row for update (prevents concurrent deductions)
    SELECT used_credits, max_credits
    INTO v_before, v_max
    FROM usage_limits
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_usage_limits_row');
    END IF;

    IF v_before + p_amount > v_max THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'insufficient_credits',
        'available', v_max - v_before,
        'requested', p_amount
      );
    END IF;

    v_after := v_before + p_amount;

    -- Deduct
    UPDATE usage_limits
    SET used_credits = v_after, updated_at = now()
    WHERE user_id = p_user_id;

    -- Log
    INSERT INTO credits_usage_log
      (user_id, operation, credits_used, credits_before, credits_after, reference_id)
    VALUES
      (p_user_id, p_operation, p_amount, v_before, v_after, p_reference_id);

    RETURN jsonb_build_object(
      'success', true,
      'credits_before', v_before,
      'credits_after', v_after,
      'credits_remaining', v_max - v_after
    );
  END;
  $$;

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — CREDITS SERVICE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: lib/credits/credits-service.ts

  Define credit costs per operation:
  export const CREDIT_COSTS: Record<string, number> = {
    scan:                    10,   // full AI visibility scan
    manual_scan:             10,   // same cost as scheduled scan
    content_recommendation:   2,   // per recommendation generated
    api_call:                 1,   // generic API usage
  }

  export async function deductCredits(params: {
    supabase: SupabaseClient   // service-role
    userId: string
    operation: keyof typeof CREDIT_COSTS
    referenceId?: string
  }): Promise<{
    success: boolean
    creditsRemaining?: number
    error?: 'insufficient_credits' | 'no_usage_limits_row' | 'unknown'
  }> {
    const amount = CREDIT_COSTS[params.operation]
    const { data, error } = await supabase.rpc('deduct_credits', {
      p_user_id:      params.userId,
      p_amount:       amount,
      p_operation:    params.operation,
      p_reference_id: params.referenceId ?? null,
    })
    if (error) {
      console.error('[credits] deductCredits RPC error:', error.message)
      return { success: false, error: 'unknown' }
    }
    if (!data.success) {
      return { success: false, error: data.error }
    }
    return { success: true, creditsRemaining: data.credits_remaining }
  }

  export async function getCreditBalance(params: {
    supabase: SupabaseClient
    userId: string
  }): Promise<{ used: number; max: number; remaining: number } | null> {
    const { data } = await supabase
      .from('usage_limits')
      .select('used_credits, max_credits')
      .eq('user_id', params.userId)
      .single()
    if (!data) return null
    return {
      used:      data.used_credits,
      max:       data.max_credits,
      remaining: data.max_credits - data.used_credits,
    }
  }

  export async function resetCredits(params: {
    supabase: SupabaseClient
    userId: string
  }): Promise<void> {
    // Called by Stripe billing cycle renewal webhook
    await supabase
      .from('usage_limits')
      .update({ used_credits: 0, reset_at: new Date().toISOString() })
      .eq('user_id', params.userId)
    console.log(`[credits] reset for userId=${params.userId}`)
  }

  export async function getCreditHistory(params: {
    supabase: SupabaseClient
    userId: string
    limit?: number
  }): Promise<Array<{
    operation: string
    creditsUsed: number
    creditsAfter: number
    referenceId: string | null
    createdAt: string
  }>> {
    const { data } = await supabase
      .from('credits_usage_log')
      .select('operation, credits_used, credits_after, reference_id, created_at')
      .eq('user_id', params.userId)
      .order('created_at', { ascending: false })
      .limit(params.limit ?? 50)
    return (data ?? []).map(row => ({
      operation:    row.operation,
      creditsUsed:  row.credits_used,
      creditsAfter: row.credits_after,
      referenceId:  row.reference_id,
      createdAt:    row.created_at,
    }))
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — DEDUCT CREDITS IN SCAN JOB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the scan Inngest job handler. Before the scan starts processing:

  // Pre-flight: check credits
  const balance = await getCreditBalance({ supabase: supabaseAdmin, userId })
  const cost = CREDIT_COSTS['scan']

  if (!balance || balance.remaining < cost) {
    // Update scan record to failed with reason
    await supabaseAdmin.from('scans').update({
      status: 'failed',
      error_message: 'Insufficient credits',
      completed_at: new Date().toISOString(),
    }).eq('id', scanId)

    console.warn(`[scan-job] insufficient credits userId=${userId} remaining=${balance?.remaining ?? 0}`)
    return   // do NOT retry — this is not a transient error
  }

  // Deduct credits at scan start (not completion — prevents running free scans)
  const deductResult = await deductCredits({
    supabase: supabaseAdmin,
    userId,
    operation: 'scan',
    referenceId: scanId,
  })

  if (!deductResult.success) {
    // Same handling as above — fail gracefully
    return
  }

  // Proceed with scan...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — CREDITS DISPLAY COMPONENT (LIVE-UPDATING)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Update: components/layout/CreditsDisplay.tsx

  Convert to a client component that subscribes to real-time changes
  on usage_limits for the current user via Supabase Realtime.

  'use client'

  Props:
    initialUsed: number
    initialMax: number
    userId: string

  State:
    used: number (starts from initialUsed)
    max: number (starts from initialMax)

  Real-time subscription:
    useEffect(() => {
      const channel = supabase
        .channel('credits-display')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'usage_limits',
          filter: `user_id=eq.${userId}`,
        }, (payload) => {
          setUsed(payload.new.used_credits)
          setMax(payload.new.max_credits)
        })
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    }, [userId])

  Display:
    "[used] / [max]" with label "CREDITS"
    Progress bar or arc showing percentage used:
      0–70%: green
      71–90%: amber
      91–100%: red
    When credits hit 0: show a "Credits exhausted" warning with upgrade CTA

  Pass initialUsed/initialMax from the server component (dashboard layout)
  so there is no loading flash on first render.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — CREDITS HISTORY API + BILLING PAGE WIDGET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: app/api/credits/history/route.ts
  GET handler: returns paginated getCreditHistory results
  Auth required: 401 if not authenticated
  Query params: limit (default 20, max 100), offset

In app/dashboard/billing/page.tsx (or wherever billing lives):
  Add a "Credits Usage" section showing the last 10 log entries:
    Date | Operation | Credits Used | Remaining After
  Link to full history: "View all credit usage →"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — WRITE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE: __tests__/lib/credits/credits-service.test.ts

  describe('deductCredits', () => {
    it('deducts correct amount for each operation type')
    it('uses atomic DB function to prevent race conditions')
    it('returns success=false when insufficient credits')
    it('returns error=insufficient_credits with available amount')
    it('returns success=false when usage_limits row missing')
    it('does not deduct credits on failure')
    it('logs deduction to credits_usage_log')
    it('returns creditsRemaining after deduction')
    it('does not throw on RPC error — returns success:false')
  })

  describe('getCreditBalance', () => {
    it('returns used, max, remaining fields')
    it('returns null when no usage_limits row exists')
    it('remaining = max - used')
  })

  describe('resetCredits', () => {
    it('sets used_credits to 0')
    it('updates reset_at timestamp')
    it('does not affect max_credits')
  })

  describe('deduct_credits DB function (unit via RPC mock)', () => {
    it('blocks concurrent deductions (row-level lock)')
    it('rejects deduction when used + amount > max')
    it('succeeds when used + amount = max (exact limit)')
    it('inserts correct row into credits_usage_log')
    it('credits_before + credits_used = credits_after in log')
  })

  describe('scan job integration', () => {
    it('deducts 10 credits before scan processing starts')
    it('fails scan with insufficient_credits when balance < 10')
    it('scan record updated to failed when credits insufficient')
    it('does not retry on insufficient_credits (transient=false)')
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P3-FIX-14
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] deduct_credits DB function created (atomic, race-condition safe)
  [ ] credits_usage_log table created with RLS
  [ ] CREDIT_COSTS constants defined for all operations
  [ ] Scan job deducts credits before processing (not after)
  [ ] Scan job fails gracefully when credits exhausted
  [ ] CreditsDisplay subscribes to real-time updates (no refresh needed)
  [ ] Credits counter color changes at 70% and 90% thresholds
  [ ] Credits history API returns paginated log
  [ ] Billing page shows last 10 credit events
  [ ] All tests pass | 0 regressions | 0 TS errors | 0 lint errors
  [ ] Manual: trigger scan → credits drop from 500 to 490 in real time
  [ ] Manual: credits at 0 → scan fails with clear message, not crash
```

---

---

# P3-FIX-15 — Billing / Plan Upgrade-Downgrade Flow

## Background

The billing page is "partially built." Users need to:
- See their current plan clearly
- Upgrade to a higher plan (with Stripe Checkout)
- Downgrade to a lower plan (with immediate or end-of-period effect)
- See their next billing date and amount
- Cancel their subscription

Without this working, Growth users can't self-serve upgrade to AI Shield, and
the entire revenue model is blocked.

## Pre-Flight Checklist

```bash
# 1. Find existing billing page
ls app/dashboard/billing/ 2>/dev/null || find app/ -name "*.tsx" | xargs grep -l "billing\|Billing" | head -5

# 2. Find existing Stripe session creation
grep -rn "createCheckoutSession\|checkout.*session\|stripe.*checkout" --include="*.ts" . | head -10

# 3. Find existing Stripe portal session
grep -rn "billingPortal\|customer.*portal\|portal.*session" --include="*.ts" . | head -5

# 4. Find Stripe customer ID storage
grep -rn "stripe_customer_id\|stripeCustomerId" --include="*.ts" . | head -5

# 5. Confirm STRIPE_PRICE_* env vars are set
grep "STRIPE_PRICE" .env.local

# 6. Baseline
pnpm test --passWithNoTests 2>&1 | tail -5
```

---

### PROMPT — P3-FIX-15

```
You are a senior fullstack engineer on LocalVector.ai (Next.js 14, Stripe,
Supabase, TypeScript). Your task is P3-FIX-15: complete the billing page so
users can view their plan, upgrade, downgrade, and cancel — all self-serve.

DEPENDS ON: P3-FIX-14 (credits display uses balance from usage_limits),
            P0-FIX-01 (plan_tier must be authoritative for upgrade detection)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — PLAN COMPARISON TABLE DATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: lib/billing/plan-catalog.ts

  import { PLAN_FEATURES, PLAN_DISPLAY_NAMES } from '@/lib/plan-features'
  import type { PlanTier } from '@/lib/stripe/plan-sync'

  export interface PlanCatalogItem {
    tier:          PlanTier
    displayName:   string
    monthlyPrice:  number       // in dollars
    annualPrice:   number       // in dollars (per month equivalent)
    stripePriceId: string       // from env — for checkout
    highlight:     boolean      // true for recommended plan
    features:      string[]     // human-readable feature bullets
    ctaLabel:      string       // "Get Started" | "Upgrade" | "Current Plan" | "Downgrade"
  }

  export function buildPlanCatalog(currentPlan: PlanTier): PlanCatalogItem[] {
    const PLAN_RANK = { free: 0, starter: 1, growth: 2, ai_shield: 3 }
    return [
      {
        tier: 'free',
        displayName: 'Free',
        monthlyPrice: 0,
        annualPrice: 0,
        stripePriceId: '',
        highlight: false,
        features: [
          'Sample data preview',
          'AI visibility snapshot',
          'Basic dashboard access',
        ],
        ctaLabel: currentPlan === 'free' ? 'Current Plan'
                : PLAN_RANK[currentPlan] > 0 ? 'Downgrade' : 'Get Started',
      },
      {
        tier: 'starter',
        displayName: 'Starter',
        monthlyPrice: 29,
        annualPrice: 24,
        stripePriceId: process.env.STRIPE_PRICE_STARTER!,
        highlight: false,
        features: [
          '100 credits / month',
          'Weekly AI visibility scans',
          'AI Mentions tracking',
          'Position ranking',
        ],
        ctaLabel: currentPlan === 'starter' ? 'Current Plan'
                : PLAN_RANK[currentPlan] < 1 ? 'Upgrade' : 'Downgrade',
      },
      {
        tier: 'growth',
        displayName: 'Growth',
        monthlyPrice: 79,
        annualPrice: 65,
        stripePriceId: process.env.STRIPE_PRICE_GROWTH!,
        highlight: true,  // recommended
        features: [
          '250 credits / month',
          'Manual scan trigger',
          'AI Mistakes detection',
          'Voice Search optimization',
          'Site Visitors analytics',
        ],
        ctaLabel: currentPlan === 'growth' ? 'Current Plan'
                : PLAN_RANK[currentPlan] < 2 ? 'Upgrade' : 'Downgrade',
      },
      {
        tier: 'ai_shield',
        displayName: 'AI Shield',
        monthlyPrice: 199,
        annualPrice: 165,
        stripePriceId: process.env.STRIPE_PRICE_AI_SHIELD!,
        highlight: false,
        features: [
          '500 credits / month',
          'Everything in Growth',
          'Custom domain',
          'Team management',
          'Your Reputation monitoring',
          'Your Sources intelligence',
          'Priority support',
        ],
        ctaLabel: currentPlan === 'ai_shield' ? 'Current Plan' : 'Upgrade',
      },
    ]
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — STRIPE API ROUTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create/update the following routes (find existing ones and extend, not replace):

  app/api/billing/checkout/route.ts  (POST)
    - Auth required
    - Body: { priceId: string, billingInterval: 'monthly' | 'annual' }
    - Validate priceId is one of the known STRIPE_PRICE_* values (whitelist)
    - Create Stripe Checkout Session:
        mode: 'subscription'
        customer: profile.stripe_customer_id (or create new customer)
        line_items: [{ price: priceId, quantity: 1 }]
        success_url: [app_url]/dashboard/billing?session_id={CHECKOUT_SESSION_ID}
        cancel_url: [app_url]/dashboard/billing?canceled=true
        metadata: { userId: session.user.id }
    - Return { checkoutUrl }

  app/api/billing/portal/route.ts  (POST)
    - Auth required
    - Create Stripe Customer Portal session for the user
    - return_url: [app_url]/dashboard/billing
    - Return { portalUrl }
    - Use for: manage payment method, view invoices, cancel subscription

  app/api/billing/subscription/route.ts  (GET)
    - Auth required
    - Return current subscription details from Stripe (not just DB):
        { planTier, status, currentPeriodEnd, cancelAtPeriodEnd, nextInvoiceAmount }
    - Cache for 60 seconds (Stripe API call is slow — use Next.js fetch cache)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — BILLING PAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Build/complete: app/dashboard/billing/page.tsx

  Server component. Fetches:
    1. profile.plan_tier (from Supabase)
    2. credit balance (from usage_limits)
    3. subscription details (from /api/billing/subscription — cached)

  Renders these sections:

  Section A — Current Plan Summary:
    Plan name + badge | Credits used/max | Next billing date | Amount
    "Manage billing →" button → POST /api/billing/portal → redirect to Stripe Portal

  Section B — Plan Comparison Table (from buildPlanCatalog):
    4 plan cards side by side (responsive grid)
    Current plan has "Current Plan" label and highlighted border
    Upgrade/Downgrade buttons trigger checkout
    Free tier "Downgrade" opens a confirmation modal before proceeding

  Section C — Credits Usage (from P3-FIX-14):
    Last 10 credit events table
    "View full history →" link

  Section D — Danger Zone:
    "Cancel subscription" → POST /api/billing/portal → Stripe Portal (cancel there)
    Show: "Your plan will downgrade to Free at period end" warning text

  Upgrade flow:
    On "Upgrade" button click → POST /api/billing/checkout → redirect to Stripe Checkout
    On return from Stripe Checkout (success_url): show success toast
    On canceled: show "Upgrade canceled" message

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — WRITE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE: __tests__/lib/billing/plan-catalog.test.ts

  describe('buildPlanCatalog', () => {
    it('returns 4 plans')
    it('current plan shows ctaLabel=Current Plan')
    it('lower plans show ctaLabel=Downgrade for ai_shield user')
    it('higher plans show ctaLabel=Upgrade for free user')
    it('growth plan is highlighted=true')
    it('no duplicate tier values')
    it('all stripePriceId values are non-empty for paid plans')
  })

CREATE: __tests__/api/billing/checkout.test.ts

  describe('POST /api/billing/checkout', () => {
    it('returns 401 when unauthenticated')
    it('returns 400 when priceId not in whitelist (prevents arbitrary Stripe prices)')
    it('creates Stripe Checkout session with correct priceId')
    it('includes userId in session metadata')
    it('returns checkoutUrl')
    it('creates new Stripe customer when stripe_customer_id is null')
    it('reuses existing stripe_customer_id when present')
  })

  describe('POST /api/billing/portal', () => {
    it('returns 401 when unauthenticated')
    it('returns 400 when user has no stripe_customer_id')
    it('creates portal session with correct return_url')
    it('returns portalUrl')
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P3-FIX-15
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] plan-catalog.ts generates correct CTAs per current plan
  [ ] POST /api/billing/checkout returns valid Stripe Checkout URL
  [ ] POST /api/billing/portal returns valid Stripe Portal URL
  [ ] priceId whitelist prevents arbitrary Stripe price injection
  [ ] Billing page renders all 4 sections with real data
  [ ] Upgrade flow: click → Stripe Checkout → return → badge updates
  [ ] Cancel via Stripe Portal correctly triggers webhook → plan → free
  [ ] Credits usage section shows last 10 events
  [ ] All tests pass | 0 regressions | 0 TS errors | 0 lint errors
  [ ] Manual: free user clicks Upgrade → Stripe Checkout → complete → AI Shield badge
```

---

---

# P3-FIX-16 — Core Dashboard Data Pages

## Background

Three dashboard pages show data that every plan tier can access: AI Mentions,
Your Position, and AI Says. These pages exist but their data pipelines, empty
states, sample-vs-real switching, and error handling are unverified. This sprint
makes all three production-ready.

---

### PROMPT — P3-FIX-16

```
You are a senior fullstack engineer on LocalVector.ai. Your task is P3-FIX-16:
make the core dashboard data pages (AI Mentions, Your Position, AI Says)
production-ready with correct data pipelines, proper empty states, sample/real
data switching, and error handling.

DEPENDS ON: P3-FIX-13 (scan-data-resolver must exist)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FOR EACH OF THE THREE PAGES, IMPLEMENT THE FOLLOWING PATTERN:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Page structure (server component):
    1. Auth check + redirect to /login if no session
    2. resolveDataMode({ supabase, userId })  ← from P3-FIX-13
    3. Fetch page-specific data filtered by dataMode
    4. Pass data + dataMode to client components

  Each page must handle 4 states:
    STATE 1: sample data (dataMode='sample', data exists)
      → Show sample data with "Sample" watermark badge on each chart
    STATE 2: real data (dataMode='real', data exists)
      → Show real data, no watermark
    STATE 3: real mode but data still loading/processing
      → Show skeleton (from P2-FIX-09) + "Scan in progress" notice
    STATE 4: error fetching data
      → Show error card with retry button (not blank page, not crash)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI MENTIONS PAGE (/dashboard/ai-mentions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Data model: ai_mentions table (find actual column names in schema)
  Expected columns: engine (ChatGPT/Perplexity/Gemini/Claude), query_text,
                    mentioned (bool), mention_context, scan_date, data_source

Page sections:
  1. Summary bar: "Mentioned in X of Y AI engines" with engine logos
  2. Per-engine breakdown cards:
       ChatGPT    | ✅ Mentioned  | "Best Italian restaurant in Atlanta"
       Perplexity | ❌ Not found  | (no mention context)
       Gemini     | ✅ Mentioned  | "Top hookah lounges near Alpharetta"
       Claude     | ⚠️ Partial    | (ambiguous or category mention only)
  3. Mention context quotes (most recent 5, truncated at 150 chars each)
  4. Trend chart: mentions over last 4 scan dates (line chart)

Filters: date range selector (Last 4 scans / Last 8 scans / All time)

Empty state (STATE 3 or no data):
  Illustration + "Your first scan hasn't run yet."
  Show next scheduled scan date.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR POSITION PAGE (/dashboard/position)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Data model: position_rankings table
  Expected columns: engine, category, rank_position, total_competitors,
                    rank_change (vs previous scan), scan_date, data_source

Page sections:
  1. Overall rank card: "You rank #X in your category on AI search"
  2. Per-engine rank table:
       Engine | Category | Rank | Change | vs. Last Scan
       With green ▲ / red ▼ / gray — for rank change
  3. Share of Voice (SOV) donut chart:
       Your business slice vs. competitors aggregate
  4. Competitive landscape bar chart (top 5 ranked in your category)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AI SAYS PAGE (/dashboard/ai-says)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Data model: ai_descriptions table (or similar — find actual name)
  Expected columns: engine, description_text, sentiment (positive/neutral/negative),
                    accuracy_score, scan_date, data_source

Page sections:
  1. What each AI engine says about your business:
       Expandable card per engine with the actual AI-generated description
  2. Sentiment analysis badges: Positive / Neutral / Negative per engine
  3. Accuracy score (if available): how correct is the AI's information
  4. Key themes extracted from descriptions (tag cloud or list)
  5. "How to improve this" CTA → links to content recommendations

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WRITE TESTS (FOR ALL THREE PAGES)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For each page, create: __tests__/app/dashboard/[page-name].test.ts

  describe('[Page] page', () => {
    describe('authentication', () => {
      it('redirects to /login when unauthenticated')
    })
    describe('sample data mode', () => {
      it('renders sample data with watermark badge')
      it('does not show real data when mode=sample')
    })
    describe('real data mode', () => {
      it('renders real data without sample watermark')
      it('renders correct metric values from DB')
    })
    describe('empty/loading state', () => {
      it('shows skeleton when data is loading')
      it('shows empty state when no scan data exists yet')
      it('empty state shows next scan date')
    })
    describe('error state', () => {
      it('shows error card (not blank page) when DB fetch fails')
      it('error card has retry mechanism')
    })
    describe('data filtering', () => {
      it('only fetches rows matching current dataMode')
      it('does not mix sample and real data in the same render')
    })
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P3-FIX-16
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] All 3 pages handle all 4 data states (sample/real/loading/error)
  [ ] Sample data shows "Sample" watermark badge — never ambiguous
  [ ] Empty state shows next scan date, not blank page
  [ ] Error state shows actionable card, not crash
  [ ] Data filtered by dataMode — no mixing
  [ ] All tests pass | 0 regressions | 0 TS errors
  [ ] Manual: all 3 pages load for free user with sample data visible
```

---

---

# P4-FIX-17 — Content Recommendations Display & User Interaction

## Background

Content recommendations are the core output of LocalVector — they're what users
act on to improve their AI visibility. The Getting Started step 3 ("Review your
first content recommendation") auto-completes when a recommendation is generated,
but the recommendations page itself needs to be fully functional.

---

### PROMPT — P4-FIX-17

```
You are a senior fullstack engineer on LocalVector.ai. Your task is P4-FIX-17:
build a production-ready Content Recommendations page where users can view,
filter, act on, and dismiss AI-generated content recommendations.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — DATA MODEL AUDIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the existing content_recommendations table. Verify it has:
  id, user_id, title, content_type, priority ('high'|'medium'|'low'),
  status ('pending'|'in_progress'|'done'|'dismissed'),
  recommendation_text, rationale, estimated_impact,
  target_engines (array or JSON), created_at, updated_at, data_source

Create migration to add missing columns:
  status      TEXT NOT NULL DEFAULT 'pending'
  priority    TEXT NOT NULL DEFAULT 'medium'
  dismissed_at TIMESTAMPTZ

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — API ROUTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  PATCH /api/recommendations/[id]/status
    - Auth required; verify recommendation belongs to user (prevent IDOR)
    - Body: { status: 'pending'|'in_progress'|'done'|'dismissed' }
    - Update status + dismissed_at if status=dismissed
    - If transitioning to 'done': mark review_recommendation step complete (FIX-04)
    - Return updated recommendation

  GET /api/recommendations
    - Auth required
    - Query: status (filter), priority (filter), limit, offset
    - Returns paginated recommendations for user, most recent first
    - Exclude dismissed unless ?include_dismissed=true

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — RECOMMENDATIONS PAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Page: app/dashboard/recommendations/page.tsx
  (or find existing page — do not create duplicate route)

  Layout:
    Header: "Content Recommendations" | total pending count badge
    Filter tabs: All | High Priority | In Progress | Done
    Recommendation cards (one per item):

  Recommendation Card:
    Priority badge (red=high, amber=medium, gray=low)
    Title (bold)
    Rationale: "ChatGPT doesn't mention you when asked about [category]"
    Recommendation: the actual content advice (collapsible if long)
    Target engines: chip list (ChatGPT / Perplexity / etc.)
    Estimated impact: "High impact" with explanation
    Action buttons:
      "Mark In Progress" | "Mark Done" | "Dismiss"
    Status transitions are optimistic (update UI immediately, sync in background)

  Empty state per filter:
    All + no recommendations: "No recommendations yet — run your first scan"
    Done filter + empty: "No completed recommendations. Keep working! 🎯"
    Dismissed filter: "You haven't dismissed any recommendations"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — WRITE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('PATCH /api/recommendations/[id]/status', () => {
    it('returns 401 when unauthenticated')
    it('returns 404 when recommendation not found')
    it('returns 403 when recommendation belongs to different user (IDOR)')
    it('updates status correctly for each valid transition')
    it('sets dismissed_at when status=dismissed')
    it('marks review_recommendation onboarding step complete on first done')
    it('returns 400 for invalid status values')
  })

  describe('Recommendations page', () => {
    it('renders recommendation cards for all statuses')
    it('filter tabs correctly filter the list')
    it('optimistic update shows new status before API responds')
    it('reverts optimistic update on API error')
    it('empty state shown when no recommendations exist')
    it('sample data watermark shown in sample mode')
    it('mark done triggers onboarding step completion')
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P4-FIX-17
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] Recommendations page loads and shows real/sample data
  [ ] Status transitions work (pending → in_progress → done | dismissed)
  [ ] Optimistic UI updates immediately on action
  [ ] IDOR prevented: users cannot update other users' recommendations
  [ ] Marking first recommendation done advances Getting Started step 3
  [ ] All empty states render (no blank pages)
  [ ] All tests pass | 0 regressions | 0 TS errors
```

---

---

# P4-FIX-18 through P4-FIX-20 — Gated Data Pages

## Background

These three sprints follow the identical pattern established in P3-FIX-16 but for
plan-gated pages. Each needs: server-side plan gate, real/sample data resolution,
empty/loading/error states, and full test coverage.

---

### PROMPT — P4-FIX-18, 19, 20

```
You are a senior fullstack engineer on LocalVector.ai. Your task covers three
plan-gated dashboard pages. Implement each following the same pattern as P3-FIX-16.

DEPENDS ON: P0-FIX-01 (plan_tier), P1-FIX-07 (requirePlan), P3-FIX-13 (resolveDataMode)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
P4-FIX-18: AI MISTAKES (/dashboard/ai-mistakes) — Growth+
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Plan gate: requirePlan(plan_tier, 'growth')

Data model: ai_mistakes table (or find actual name)
  Fields: engine, mistake_type ('wrong_hours'|'wrong_address'|'wrong_description'|
          'missing_info'|'competitor_confusion'), mistake_text,
          correct_value, severity ('critical'|'moderate'|'minor'),
          status ('open'|'acknowledged'|'fixed'), scan_date, data_source

Page sections:
  1. Mistake severity summary: X critical, Y moderate, Z minor
  2. Mistakes list with severity badges and affected engine chips
  3. Each mistake shows:
       What AI said (wrong): [mistake_text]
       What it should say:   [correct_value]
       Action: "Acknowledge" | "Mark Fixed" | "Report to AI engine" (link if available)
  4. Fixed mistakes history (collapsible)

API routes needed:
  PATCH /api/mistakes/[id]/status
    - Auth + plan check (growth+) + ownership check
    - Update status field
    - Return updated mistake

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
P4-FIX-19: VOICE SEARCH + SITE VISITORS — Growth+
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Plan gate: requirePlan(plan_tier, 'growth') for both

VOICE SEARCH (/dashboard/voice-search):
  Data: voice_search_results table
  Shows:
    - Voice query coverage: "Your business answers X% of relevant voice queries"
    - Top voice queries where you appear (and where you don't)
    - Voice search optimization tips: specific schema markup, FAQ content
    - Query intent categories: navigational / informational / transactional

SITE VISITORS (/dashboard/site-visitors):
  Data: site_visitors table (or referral_traffic from AI sources)
  Shows:
    - AI-referred visitor count over time (line chart by week)
    - Breakdown by source: ChatGPT referrals / Perplexity referrals / etc.
    - Top landing pages from AI referrals
    - Conversion note: "Connect Google Analytics for deeper insights"
      (if no integration — show stub with connect CTA, not empty page)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
P4-FIX-20: YOUR REPUTATION + YOUR SOURCES — AI Shield only
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Plan gate: requirePlan(plan_tier, 'ai_shield') for both

YOUR REPUTATION (/dashboard/reputation):
  Data: reputation_signals table
  Shows:
    - Overall reputation score (0-100) calculated from AI engine signals
    - Sentiment breakdown: % positive / neutral / negative mentions
    - Most recent reputation-affecting events (review mentions, news, etc.)
    - Reputation trend line over time
    - AI engine-specific reputation notes
    - "Reputation improvement actions" CTA → links to recommendations

YOUR SOURCES (/dashboard/sources):
  Data: citation_sources table
  Shows:
    - Which sources AI engines cite when mentioning your business
    - Source authority score (domain authority equivalent)
    - Source table: Domain | Times Cited | Last Seen | Your Control (yes/no)
    - Sources YOU control: your website, Google Business Profile
    - Sources you DON'T control: Yelp, TripAdvisor, news sites
    - "Optimize these sources" action items

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TESTS FOR ALL P4 PAGES (18, 19, 20)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For each page, create __tests__/app/dashboard/[page].test.ts covering:

  describe('[Page] — plan gating', () => {
    it('redirects free user to /dashboard (not 404)')
    it('redirects starter user (for growth+ pages)')
    it('redirects growth user (for ai_shield pages)')
    it('renders for correct minimum plan')
    it('renders for higher plans too')
  })

  describe('[Page] — data states', () => {
    it('shows sample data with watermark')
    it('shows real data without watermark')
    it('shows empty state when no data (next scan date visible)')
    it('shows error card when DB fetch fails')
  })

  describe('[Page] — interactions (for pages with status updates)', () => {
    it('status update returns 401 when unauthenticated')
    it('status update returns 403 for other users records (IDOR)')
    it('status updates optimistically')
    it('reverts on error')
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P4-FIX-18, 19, 20
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] All 5 pages (AI Mistakes, Voice Search, Site Visitors, Reputation, Sources)
      have working plan gates (redirect not 404 for wrong plan)
  [ ] All pages handle all 4 data states
  [ ] All status-update APIs have IDOR protection
  [ ] All pages have correct metadata (title tags)
  [ ] All tests pass | 0 regressions | 0 TS errors | 0 lint errors
  [ ] Manual: AI Shield user visits all 5 pages without error
  [ ] Manual: Growth user visits Reputation → redirected (not 404)
```

---

---

# P5-FIX-21 — Transactional Email: Scan Complete + Weekly Digest

## Background

Users have no awareness when their scan completes. There is no email confirming
the scan ran, no digest of what changed, and no nudge to take action on
recommendations. Email is the #1 retention mechanic for a data product.

---

### PROMPT — P5-FIX-21

```
You are a senior fullstack engineer on LocalVector.ai. Your task is P5-FIX-21:
implement transactional emails for scan completion and a weekly digest.

Find existing email infrastructure (Resend, SendGrid, Postmark, or similar).
If none exists, use Resend — it has a React email template system.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — EMAIL INFRASTRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If using Resend:
  pnpm add resend @react-email/components

Create: lib/email/email-client.ts
  Export a singleton Resend client initialized from RESEND_API_KEY env var.
  Export async sendEmail({ to, subject, react }) wrapper that:
    - Logs every send attempt
    - Returns { success, messageId } on success
    - Returns { success: false, error } on failure (never throws)
    - In development: logs email to console instead of sending (check NODE_ENV)

Create: emails/ directory for React Email templates

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — EMAIL TEMPLATES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: emails/ScanCompleteEmail.tsx
  Props:
    businessName: string
    planTier: PlanTier
    mentionsCount: number
    topEngineResult: { engine: string; mentioned: boolean }
    recommendationsCount: number
    dashboardUrl: string
    unsubscribeUrl: string
  Content:
    Subject: "Your AI visibility scan is complete, [businessName]"
    Body:
      - "[businessName] scan results are ready"
      - "You were mentioned in X AI engines"
      - "We found N new content recommendations"
      - [View Full Results] CTA button → dashboardUrl
      - Plain, on-brand dark theme matching the app

Create: emails/WeeklyDigestEmail.tsx
  Props:
    businessName: string
    weekOf: string
    mentionsDelta: number   // change vs last week (+/-)
    positionDelta: number
    openRecommendations: number
    topRecommendation: { title: string; priority: string } | null
    dashboardUrl: string
    unsubscribeUrl: string
  Content:
    Subject: "Your AI visibility week in review — [weekOf]"
    Body:
      - Week summary metrics with delta indicators (↑↓)
      - Top recommendation to act on
      - [View Dashboard] CTA

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — SEND TRIGGERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

In the scan completion handler (same file as P3-FIX-13 Step 4):
  After all data is saved and flags are updated:
  await sendScanCompleteEmail({ userId, scanId })
  // fire-and-forget — email failure must NOT fail the scan

Create: lib/email/send-scan-complete.ts
  Fetches scan summary data from DB, constructs email props, calls sendEmail.
  Checks user email preferences (if email_notifications_enabled column exists).
  Logs success/failure.

Create: Inngest weekly digest job (or cron):
  Schedule: every Monday at 9am per user's timezone (or UTC if timezone unknown)
  For each active user (has_real_scan_data = true):
    - Build digest from last 7 days of scan data
    - Send WeeklyDigestEmail
  Batch process (not one job per user — use pagination)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — EMAIL PREFERENCES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add to profiles (migration):
  email_scan_notifications  BOOLEAN NOT NULL DEFAULT true
  email_weekly_digest       BOOLEAN NOT NULL DEFAULT true

Add Email Preferences section to /dashboard/settings/profile:
  Two toggles: "Scan complete notifications" | "Weekly digest"
  Saved via existing PATCH /api/profile/update route

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — WRITE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('sendEmail', () => {
    it('calls Resend API with correct params')
    it('returns success:false (not throw) on Resend error')
    it('logs email to console in development mode (does not call Resend)')
    it('returns messageId on success')
  })

  describe('ScanCompleteEmail', () => {
    it('renders without crashing with all props')
    it('includes business name in subject')
    it('includes mention count in body')
    it('includes dashboard URL as CTA href')
    it('includes unsubscribe URL')
  })

  describe('sendScanCompleteEmail', () => {
    it('sends email when email_scan_notifications=true')
    it('does NOT send when email_scan_notifications=false')
    it('scan completion succeeds even if email send fails')
    it('fetches correct summary data for the scan')
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P5-FIX-21
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] Email client initialized and tested (Resend or existing provider)
  [ ] ScanCompleteEmail template renders correctly
  [ ] WeeklyDigestEmail template renders correctly
  [ ] Scan completion triggers scan complete email (fire-and-forget)
  [ ] Weekly digest Inngest job created and scheduled
  [ ] Email preferences toggles saved to profiles
  [ ] Respects opt-out (does not send when disabled)
  [ ] Development mode: logs to console (no real sends in dev)
  [ ] All tests pass | 0 regressions | 0 TS errors
```

---

---

# P5-FIX-22 — API Rate Limiting: Systematic Coverage

### PROMPT — P5-FIX-22

```
You are a senior backend engineer on LocalVector.ai. Your task is P5-FIX-22:
apply consistent, appropriate rate limiting to every API route in the application.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — RATE LIMITER UTILITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find existing rate limiting implementation.
If using Upstash Redis, use @upstash/ratelimit.
If none exists, implement using a simple in-memory sliding window
(acceptable for single-instance — note this in comments with TODO for Redis).

Create: lib/rate-limit/rate-limiter.ts

  export type RateLimitTier =
    | 'strict'       // 5 req/min — auth endpoints, billing
    | 'standard'     // 20 req/min — most API routes
    | 'relaxed'      // 60 req/min — read-only, low-risk endpoints
    | 'scan_trigger' // 1 req/hour — manual scan trigger (handled in FIX-05 by cooldown)

  export async function rateLimit(params: {
    identifier: string   // userId or IP for unauthenticated routes
    tier: RateLimitTier
  }): Promise<{
    success: boolean
    limit: number
    remaining: number
    reset: number   // Unix timestamp
  }>

  export function rateLimitResponse(reset: number): Response {
    return new Response(
      JSON.stringify({ error: 'Too many requests', retryAfter: reset }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((reset * 1000 - Date.now()) / 1000)),
          'X-RateLimit-Reset': String(reset),
        },
      }
    )
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — APPLY TO ALL ROUTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find all API route files:
  find app/api/ -name "route.ts" | sort

Apply rate limiting to EVERY route using this tier assignment:

  strict (5/min):
    POST /api/webhooks/stripe       ← already has Stripe sig check, add RL per IP
    POST /api/billing/checkout
    POST /api/billing/portal
    POST /api/auth/*                ← any auth routes

  standard (20/min):
    PATCH /api/profile/update
    PATCH /api/recommendations/*/status
    PATCH /api/mistakes/*/status
    POST /api/scans/trigger         ← secondary guard (primary is 1hr cooldown)
    GET /api/credits/history
    GET /api/billing/subscription

  relaxed (60/min):
    GET /api/scans/[scanId]/status  ← polled frequently by useScanStatus hook

Rate limit identifier:
  - For authenticated routes: use session.user.id
  - For unauthenticated routes: use request IP (headers['x-forwarded-for'] or socket.remoteAddress)
  - Never mix user ID and IP for the same route

Add this pattern to the TOP of every route handler:
  const rl = await rateLimit({ identifier: userId, tier: 'standard' })
  if (!rl.success) return rateLimitResponse(rl.reset)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — WRITE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('rateLimit', () => {
    it('allows requests under limit')
    it('blocks requests at limit threshold')
    it('returns correct remaining count')
    it('returns correct reset timestamp')
    it('different identifiers have independent limits')
    it('same identifier shares limit across requests')
    it('strict tier blocks at 5 requests per minute')
    it('relaxed tier allows 60 requests per minute')
  })

  describe('rateLimitResponse', () => {
    it('returns status 429')
    it('includes Retry-After header')
    it('includes X-RateLimit-Reset header')
    it('body has error and retryAfter fields')
  })

  describe('API routes — rate limiting integration', () => {
    // For each major route, verify it returns 429 on excess requests
    it('PATCH /api/profile/update returns 429 on 21st request/min')
    it('POST /api/billing/checkout returns 429 on 6th request/min')
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P5-FIX-22
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] rate-limiter.ts with all 4 tiers implemented
  [ ] Rate limiting applied to every app/api/ route (find all, apply all)
  [ ] Correct tier assigned based on sensitivity of each endpoint
  [ ] 429 response includes Retry-After and X-RateLimit-Reset headers
  [ ] All tests pass | 0 regressions | 0 TS errors
  [ ] Manual: hammer /api/profile/update 25 times → 429 on 21st
```

---

---

# P5-FIX-23 — Error Boundaries: App-Wide Graceful Failure Handling

### PROMPT — P5-FIX-23

```
You are a senior frontend engineer on LocalVector.ai (Next.js 14, React,
TypeScript). Your task is P5-FIX-23: implement app-wide error boundaries and
graceful failure states so users NEVER see an unhandled React crash or a blank
white page.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — GLOBAL ERROR BOUNDARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: app/error.tsx  (Next.js global error page)
  'use client'
  Props: { error: Error, reset: () => void }
  Shows:
    - Friendly message: "Something went wrong. Our team has been notified."
    - Error code (error.message — only in development, hidden in production)
    - [Try again] button → calls reset()
    - [Go to Dashboard] link → /dashboard
    - Consistent with app dark theme

Create: app/dashboard/error.tsx  (dashboard-scoped error page)
  Same as above but with dashboard-appropriate messaging.

Create: components/ui/ErrorCard.tsx  (inline error for data fetch failures)
  Props: { message?: string; onRetry?: () => void; compact?: boolean }
  Used inside pages instead of crashing the whole page when one section fails.
  Shows a card with ⚠️ icon, message, and optional retry button.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — API ERROR HANDLING STANDARDIZATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create: lib/api/api-response.ts

  Standardize all API error responses:

  export function apiError(message: string, status: number, details?: unknown): Response {
    const body: Record<string, unknown> = { error: message }
    if (process.env.NODE_ENV === 'development' && details) {
      body.details = details
    }
    return Response.json(body, { status })
  }

  export function apiSuccess<T>(data: T, status = 200): Response {
    return Response.json(data, { status })
  }

  // Error code constants — use these everywhere (never raw strings)
  export const API_ERRORS = {
    UNAUTHORIZED:         { message: 'Unauthorized',               status: 401 },
    FORBIDDEN:            { message: 'Forbidden',                  status: 403 },
    NOT_FOUND:            { message: 'Not found',                  status: 404 },
    VALIDATION_ERROR:     { message: 'Validation error',           status: 400 },
    RATE_LIMITED:         { message: 'Too many requests',          status: 429 },
    UPGRADE_REQUIRED:     { message: 'Plan upgrade required',      status: 403 },
    INSUFFICIENT_CREDITS: { message: 'Insufficient credits',       status: 402 },
    INTERNAL_ERROR:       { message: 'An unexpected error occurred', status: 500 },
  } as const

Audit every existing API route and replace ad-hoc error strings with
API_ERRORS constants. Never expose raw DB errors or stack traces in
production responses.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — NOT FOUND PAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create/update: app/not-found.tsx
  Shows: friendly 404 message
  For authenticated users (check session): show [Back to Dashboard] button
  For unauthenticated users: show [Go to Login] button
  Dark theme consistent with the app

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — WRAP EACH DASHBOARD SECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For each dashboard data section (SOV chart, mentions, position, etc.):
  Wrap with <Suspense fallback={<Skeleton />}> for loading state.
  The error.tsx at the dashboard level handles section crashes.
  For client-side data fetches: add try/catch that renders <ErrorCard /> on failure.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — WRITE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('ErrorCard', () => {
    it('renders with default message when none provided')
    it('renders custom message when provided')
    it('renders retry button when onRetry is provided')
    it('does not render retry button when onRetry is absent')
    it('calls onRetry when button clicked')
    it('compact variant renders smaller')
  })

  describe('apiError', () => {
    it('returns correct status code')
    it('body contains error field')
    it('hides details in production (NODE_ENV check)')
    it('shows details in development')
  })

  describe('not-found page', () => {
    it('renders without crashing')
    it('does not return 200 status (Next.js 404 page)')
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P5-FIX-23
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] app/error.tsx and app/dashboard/error.tsx created
  [ ] ErrorCard component for inline failures
  [ ] API_ERRORS constants used in all route handlers (no raw strings)
  [ ] Raw DB errors never reach client in production
  [ ] app/not-found.tsx provides helpful navigation (not blank 404)
  [ ] No unhandled promise rejections in any API route
  [ ] All tests pass | 0 regressions | 0 TS errors
  [ ] Manual: throw deliberate error → error.tsx shown (not white screen)
  [ ] Manual: visit /nonexistent-route → not-found.tsx shown
```

---

---

# P5-FIX-24 — Performance: Core Web Vitals, Bundle & Caching

### PROMPT — P5-FIX-24

```
You are a senior performance engineer on LocalVector.ai (Next.js 14). Your task
is P5-FIX-24: measure and improve Core Web Vitals, reduce bundle size, and add
appropriate caching to slow data fetches. Target: LCP < 2.5s, CLS < 0.1, INP < 200ms.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — MEASURE BASELINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  pnpm build && pnpm start
  npx lighthouse http://localhost:3000/dashboard --output json \
    --output-path ./lighthouse-baseline.json --only-categories performance

  # Bundle analysis
  ANALYZE=true pnpm build
  # (requires @next/bundle-analyzer installed and configured in next.config.js)
  pnpm add -D @next/bundle-analyzer

Document baseline scores for: LCP, CLS, INP, FCP, TTFB, bundle size (total JS).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — NEXT.JS FETCH CACHING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Apply Next.js fetch cache strategy to every slow server-side data fetch:

  Subscription data (Stripe API — slow):
    fetch(..., { next: { revalidate: 60 } })  // cache 60 seconds

  Plan features (static config — never changes at runtime):
    Move to a static import (no caching needed — it's just a JS object)

  Profile data (changes rarely):
    fetch(..., { next: { revalidate: 30 } })  // cache 30 seconds
    Invalidate cache on profile update: revalidatePath('/dashboard')

  Scan results (changes once per week):
    fetch(..., { next: { revalidate: 3600 } }) // cache 1 hour
    Invalidate on scan completion: revalidatePath('/dashboard')

  Credits balance (changes on scan trigger — subscribe to real-time instead):
    No fetch cache — use Supabase Realtime (already done in P3-FIX-14)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — BUNDLE SIZE REDUCTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

From bundle analysis, identify and fix:

  1. Heavy chart library (recharts or similar):
     Use dynamic import with ssr:false for all chart components:
       const SOVChart = dynamic(() => import('./SOVChart'), { ssr: false })
     This defers chart JS until client hydration — does not block LCP.

  2. Date formatting library (moment.js = huge):
     If moment.js is used anywhere: replace with date-fns or native Intl.DateTimeFormat

  3. Icon library:
     If importing entire icon set: switch to named imports only:
       import { LayoutDashboard } from 'lucide-react'  ← correct
       import * as Icons from 'lucide-react'           ← wrong, treeshake fails

  4. Any unused dependencies in package.json:
     Run: npx depcheck
     Remove anything not used

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — CLS FIXES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cumulative Layout Shift is caused by:
  - Images without width/height
  - Content that loads after initial render and pushes other content

Fix:
  1. All <img> tags: add explicit width and height (or use Next.js <Image>)
  2. Skeleton loaders (from P2-FIX-09) must have the same dimensions as real content
  3. Font loading: add font-display: swap and preload font declarations
  4. The credits counter: ensure it doesn't resize on real-time update
     (use a fixed-width container)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — NEXT.JS CONFIG OPTIMIZATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Review and update next.config.js:

  const nextConfig = {
    // Image optimization
    images: {
      formats: ['image/avif', 'image/webp'],
      minimumCacheTTL: 86400,
    },
    // Compression
    compress: true,
    // SWC minification (default in Next.js 13+, verify it's not disabled)
    swcMinify: true,
    // Package transpilation (avoid CJS bundles)
    transpilePackages: ['recharts'],  // if recharts causes bundle issues
    // Strict mode
    reactStrictMode: true,
    // Headers for static assets
    async headers() {
      return [
        {
          source: '/_next/static/(.*)',
          headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
        },
      ]
    },
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — VERIFY IMPROVEMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  pnpm build && pnpm start
  npx lighthouse http://localhost:3000/dashboard --output json \
    --output-path ./lighthouse-after.json --only-categories performance

  Compare before/after scores. Document improvements.
  Target: LCP < 2.5s | CLS < 0.1 | INP < 200ms | Performance score > 80

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WRITE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  CREATE: __tests__/performance/bundle-size.test.ts

  import { execSync } from 'child_process'

  describe('Bundle size regression guard', () => {
    it('total JS bundle is under 500KB gzipped', () => {
      // Parse .next/build-manifest.json to sum JS sizes
      // Fail if total exceeds threshold — prevents accidental regressions
      const manifest = require('../../.next/build-manifest.json')
      // ... sum all JS page bundle sizes
      // expect(totalKb).toBeLessThan(500)
    })

    it('dashboard page does not import moment.js', () => {
      const result = execSync(
        `grep -r "import.*moment\\|require.*moment" app/ components/ 2>/dev/null | wc -l`
      ).toString().trim()
      expect(parseInt(result)).toBe(0)
    })

    it('icon imports use named imports (no wildcard)', () => {
      const result = execSync(
        `grep -rn "import \\* as.*lucide\\|import \\* as.*icons" app/ components/ 2>/dev/null | wc -l`
      ).toString().trim()
      expect(parseInt(result)).toBe(0)
    })
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P5-FIX-24
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] Baseline Lighthouse score documented
  [ ] Charts use dynamic import with ssr:false
  [ ] moment.js removed if present; replaced with date-fns or Intl
  [ ] All icon imports are named imports (no wildcard)
  [ ] All slow server fetches have appropriate cache settings
  [ ] revalidatePath called on profile update and scan completion
  [ ] All images have explicit dimensions (no CLS from images)
  [ ] Skeleton loaders match real content dimensions (no CLS)
  [ ] next.config.js updated with compression and cache headers
  [ ] Final Lighthouse: LCP < 2.5s | CLS < 0.1 | Performance > 80
  [ ] Bundle size regression test added and passing
  [ ] All tests pass | 0 regressions | 0 TS errors
```

---

---

# Master Regression Smoke Test — P3 + P4 + P5 Complete

```bash
#!/bin/bash
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "LocalVector P3+P4+P5 — Master Regression Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "1. TypeScript..."
pnpm tsc --noEmit && echo "   ✅ 0 errors"

echo "2. Lint..."
pnpm lint && echo "   ✅ 0 errors"

echo "3. Unit + Integration tests..."
pnpm test 2>&1 | tail -30

echo "4. Bundle size regression..."
pnpm test __tests__/performance/bundle-size.test.ts
echo "   ✅ Bundle within limits"

echo "5. E2E tests (Playwright)..."
pnpm test:e2e
echo "   ✅ All E2E pass"

echo "6. Lighthouse audit..."
pnpm build && pnpm start &
sleep 10
npx lighthouse http://localhost:3000/dashboard \
  --chrome-flags="--headless" \
  --only-categories performance \
  --output json \
  --output-path /tmp/lh.json 2>/dev/null
node -e "
  const r = require('/tmp/lh.json').categories.performance;
  const lcp = require('/tmp/lh.json').audits['largest-contentful-paint'].numericValue;
  const cls = require('/tmp/lh.json').audits['cumulative-layout-shift'].numericValue;
  console.log('   Performance score:', Math.round(r.score * 100));
  console.log('   LCP:', (lcp/1000).toFixed(2) + 's');
  console.log('   CLS:', cls.toFixed(3));
  if (r.score < 0.8) { console.error('   ❌ Performance score below 80'); process.exit(1); }
  if (lcp > 2500) { console.error('   ❌ LCP above 2.5s'); process.exit(1); }
  if (cls > 0.1) { console.error('   ❌ CLS above 0.1'); process.exit(1); }
  console.log('   ✅ Performance targets met');
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Manual Verification Checklist:"
echo ""
echo "  Data Pipeline:"
echo "   [ ] New user: sample data visible with watermark + next scan date"
echo "   [ ] After scan: banner gone, real data shown, success toast appears"
echo "   [ ] Credits deduct 10 on scan trigger, live counter updates"
echo "   [ ] Credits at 0: scan fails gracefully with clear message"
echo ""
echo "  Billing:"
echo "   [ ] Free user: upgrade to Growth via Stripe Checkout → badge updates"
echo "   [ ] Stripe webhook: plan_tier updates immediately after checkout"
echo "   [ ] Billing page shows current plan, credit balance, history"
echo "   [ ] Stripe Portal opens for cancel/manage payment"
echo ""
echo "  Content Pages:"
echo "   [ ] AI Mentions: shows per-engine mention status"
echo "   [ ] Your Position: shows rank + SOV chart"
echo "   [ ] AI Says: shows AI descriptions with sentiment badges"
echo "   [ ] Recommendations: status transitions work (pending→done)"
echo "   [ ] AI Mistakes: severity summary + acknowledge action"
echo ""
echo "  Infrastructure:"
echo "   [ ] Scan complete email received after scan finishes"
echo "   [ ] API returns 429 after rate limit exceeded"
echo "   [ ] Deliberate component crash → error.tsx shown (not white screen)"
echo "   [ ] /nonexistent-route → not-found.tsx shown with navigation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

---

# Complete Sprint Summary — All Blocks

| Block | ID | Sprint | Effort |
|-------|-----|--------|--------|
| **P0** | FIX-01 | Stripe webhook plan sync | 2h |
| | FIX-02 | Profile settings page | 3h |
| | FIX-03 | Getting Started plan gating | 1h |
| | FIX-04 | Onboarding completion tracking | 2h |
| **P1** | FIX-05 | Manual scan trigger | 8h |
| | FIX-06 | Sidebar plan gating + modals | 6h |
| | FIX-07 | Domain + Team settings pages | 5h |
| | FIX-08 | Stale plan field audit | 4h |
| **P2** | FIX-09 | Skeleton loaders | 4h |
| | FIX-10 | Upgrade modals everywhere | 5h |
| | FIX-11 | Route audit — zero 404s | 3h |
| | FIX-12 | E2E Playwright suite | 8h |
| **P3** | FIX-13 | Sample → real data transition | 6h |
| | FIX-14 | Credits deduction + tracking | 8h |
| | FIX-15 | Billing upgrade/downgrade flow | 8h |
| | FIX-16 | Core dashboard data pages | 8h |
| **P4** | FIX-17 | Recommendations display | 6h |
| | FIX-18 | AI Mistakes page | 5h |
| | FIX-19 | Voice Search + Site Visitors | 6h |
| | FIX-20 | Reputation + Sources pages | 6h |
| **P5** | FIX-21 | Transactional email | 6h |
| | FIX-22 | API rate limiting | 4h |
| | FIX-23 | Error boundaries | 4h |
| | FIX-24 | Performance + Core Web Vitals | 6h |
| | | **Total** | **~134h** |

---

*LocalVector.ai P3 + P4 + P5 Sprint Prompts — End*
*Generated: March 3, 2026 | SDET Audit Mode*
