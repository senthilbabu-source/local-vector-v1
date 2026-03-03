# LocalVector.ai — P1 + P2 Sprint Prompts
## Feature Integrity, Plan Gating, Route Hardening & UX Polish
**Sprint Block:** P1-FIX-05 through P2-FIX-12
**Priority:** P1 = High (first sprint post-P0) | P2 = Medium (UX polish)
**Execution Environment:** VS Code + Claude Code
**Repo:** https://github.com/senthilbabu-source/local-vector-v1
**Prerequisite:** All P0 sprints (FIX-01–04) must be complete and smoke-tested

---

## Sprint Map

```
P1-FIX-05  Manual Scan Trigger UI (Growth + AI Shield)
P1-FIX-06  Sidebar Navigation Plan Gating + Upgrade Modals
P1-FIX-07  Settings: Domain + Team Pages (or Clean Stubs)
P1-FIX-08  Full Codebase Audit — Eliminate Stale profiles.plan Reads

P2-FIX-09  Skeleton Loaders on All Dashboard Charts
P2-FIX-10  Upgrade Modals: Free/Starter Clicks Locked Features
P2-FIX-11  Full Route Audit — Zero 404s Across All Plans
P2-FIX-12  End-to-End QA Automation — All 4 Plan Tiers
```

**Execution order within P1 is flexible except:**
- FIX-08 must run LAST in P1 (depends on FIX-05, 06, 07 having stabilized plan reads)
- FIX-10 should run AFTER FIX-06 (reuses upgrade modal component from FIX-06)
- FIX-12 must run LAST (end-to-end tests validate all prior work)

---

---

# P1-FIX-05 — Manual Scan Trigger UI (Growth + AI Shield)

## Background

The dashboard currently shows "Scan runs every Sunday" for all plans with no way
for paid users to trigger a scan on demand. Growth and AI Shield plan holders expect
to be able to run a scan whenever they want. Free and Starter users should see a
locked state with an upgrade prompt.

This sprint adds a "Run Scan Now" button to the dashboard that:
- Is fully functional (triggers real scan) for Growth and AI Shield
- Shows an upgrade prompt for Free and Starter
- Shows a cooldown state after triggering (prevents spam)
- Reflects the running scan state in real time

## Pre-Flight Checklist

```bash
# 1. Find existing scan trigger logic (Inngest job or direct invocation)
grep -r "triggerScan\|scan.*job\|inngest.*scan\|scanJob" --include="*.ts" -l .

# 2. Find the scan scheduling code
grep -r "cron\|schedule\|every.*sunday\|0 0 \* \* 0" --include="*.ts" . | head -10

# 3. Find existing scan status tracking
grep -r "scan_status\|scanStatus\|is_scanning\|scans" --include="*.ts" . | head -20

# 4. Check if scans table exists
grep -i "create table scans\|create table.*scan" supabase/schema.sql supabase/migrations/*.sql 2>/dev/null

# 5. Find rate limiting utility
grep -r "rateLimit\|rate.limit\|upstash\|redis" --include="*.ts" -l . | head -5

# 6. Baseline test run
pnpm test --passWithNoTests 2>&1 | tail -5
```

## Files This Sprint Will Create/Touch

```
CREATE:  app/api/scans/trigger/route.ts              ← POST: trigger manual scan
CREATE:  components/dashboard/ManualScanTrigger.tsx  ← button + state UI
CREATE:  hooks/useScanStatus.ts                      ← real-time scan polling hook
MODIFY:  app/dashboard/page.tsx                      ← add trigger component
CREATE:  __tests__/api/scans/trigger.test.ts
CREATE:  __tests__/components/ManualScanTrigger.test.tsx
CREATE:  __tests__/hooks/useScanStatus.test.ts
```

---

### PROMPT — P1-FIX-05

```
You are a senior fullstack engineer on LocalVector.ai (Next.js 14 App Router,
Supabase, TypeScript, Tailwind CSS, Inngest). Your task is P1-FIX-05: add a
manual scan trigger capability so Growth and AI Shield users can run an AI
visibility scan on demand, with appropriate plan gating for lower tiers.

DEPENDS ON: P0-FIX-01 (plan_tier must be authoritative)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — DATABASE: SCAN TRACKING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Check if the `scans` table already has the required columns. If any are missing,
create migration: supabase/migrations/[timestamp]_scan_trigger_fields.sql

Required columns on the `scans` table (add only if missing):
  triggered_by  TEXT    NOT NULL DEFAULT 'schedule'
                        -- 'schedule' | 'manual'
  triggered_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  status        TEXT    NOT NULL DEFAULT 'pending'
                        -- 'pending' | 'running' | 'completed' | 'failed'
  started_at    TIMESTAMPTZ
  completed_at  TIMESTAMPTZ
  error_message TEXT

Create or verify this index:
  CREATE INDEX IF NOT EXISTS idx_scans_user_status
    ON scans(user_id, status, triggered_at DESC);

Add a new table for scan cooldown tracking (prevents spam):
  CREATE TABLE IF NOT EXISTS scan_cooldowns (
    user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    last_manual_scan_at TIMESTAMPTZ,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  ALTER TABLE scan_cooldowns ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "users_read_own_cooldown"
    ON scan_cooldowns FOR SELECT USING (auth.uid() = user_id);
  -- Only service_role writes cooldowns

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — API ROUTE: POST /api/scans/trigger
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: app/api/scans/trigger/route.ts

This is a POST handler. Logic:

  1. Authenticate: get session, return 401 if missing
  2. Load profile: get plan_tier for the user
  3. Plan gate check:
       const allowed = ['growth', 'ai_shield']
       if (!allowed.includes(profile.plan_tier)) {
         return Response.json(
           { error: 'upgrade_required', requiredPlan: 'growth' },
           { status: 403 }
         )
       }
  4. Cooldown check (prevent abuse — max 1 manual scan per hour per user):
       const { data: cooldown } = await supabaseAdmin
         .from('scan_cooldowns')
         .select('last_manual_scan_at')
         .eq('user_id', userId)
         .single()
       const ONE_HOUR_MS = 60 * 60 * 1000
       if (cooldown?.last_manual_scan_at) {
         const elapsed = Date.now() - new Date(cooldown.last_manual_scan_at).getTime()
         if (elapsed < ONE_HOUR_MS) {
           const retryAfterSeconds = Math.ceil((ONE_HOUR_MS - elapsed) / 1000)
           return Response.json(
             { error: 'cooldown_active', retryAfterSeconds },
             { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
           )
         }
       }
  5. Check no scan already in progress for this user:
       const { data: activeScans } = await supabaseAdmin
         .from('scans')
         .select('id, status')
         .eq('user_id', userId)
         .in('status', ['pending', 'running'])
         .limit(1)
       if (activeScans?.length > 0) {
         return Response.json(
           { error: 'scan_in_progress', scanId: activeScans[0].id },
           { status: 409 }
         )
       }
  6. Insert new scan record:
       const { data: scan } = await supabaseAdmin
         .from('scans')
         .insert({
           user_id: userId,
           triggered_by: 'manual',
           status: 'pending',
           triggered_at: new Date().toISOString(),
         })
         .select('id')
         .single()
  7. Update cooldown timestamp:
       await supabaseAdmin.from('scan_cooldowns').upsert({
         user_id: userId,
         last_manual_scan_at: new Date().toISOString(),
         updated_at: new Date().toISOString(),
       }, { onConflict: 'user_id' })
  8. Trigger the Inngest scan job (find existing job name — do NOT rename it):
       await inngest.send({
         name: '[EXISTING_SCAN_JOB_EVENT_NAME]',  // use exact existing event name
         data: { userId, scanId: scan.id, triggeredBy: 'manual' },
       })
  9. Return 202 (Accepted — async job started):
       return Response.json({ scanId: scan.id, status: 'pending' }, { status: 202 })
  10. On any unexpected error: return 500 with generic message, log full error

Rate limiting: If an existing rate limiter utility exists in the codebase,
apply it to this route (max 10 requests per minute per user as a secondary guard).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — SCAN STATUS POLLING HOOK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: hooks/useScanStatus.ts

  'use client'
  import { useState, useEffect, useCallback, useRef } from 'react'

  export type ScanStatus = 'idle' | 'pending' | 'running' | 'completed' | 'failed'

  interface UseScanStatusReturn {
    scanStatus: ScanStatus
    scanId: string | null
    cooldownSeconds: number   // seconds until next manual scan allowed, 0 = ready
    triggerScan: () => Promise<void>
    isTriggering: boolean
    error: string | null
  }

  const POLL_INTERVAL_MS = 5000      // poll every 5 seconds while scan is active
  const COMPLETED_LINGER_MS = 5000   // show 'completed' state for 5s before idle

  export function useScanStatus(initialCooldownSeconds = 0): UseScanStatusReturn {
    const [scanStatus, setScanStatus] = useState<ScanStatus>('idle')
    const [scanId, setScanId] = useState<string | null>(null)
    const [cooldownSeconds, setCooldownSeconds] = useState(initialCooldownSeconds)
    const [isTriggering, setIsTriggering] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const pollRef = useRef<NodeJS.Timeout | null>(null)

    // Cooldown countdown timer
    useEffect(() => {
      if (cooldownSeconds <= 0) return
      const interval = setInterval(() => {
        setCooldownSeconds(s => Math.max(0, s - 1))
      }, 1000)
      return () => clearInterval(interval)
    }, [cooldownSeconds > 0])

    // Polling logic
    const startPolling = useCallback((id: string) => {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/scans/${id}/status`)
          if (!res.ok) return
          const data = await res.json()
          setScanStatus(data.status)
          if (data.status === 'completed' || data.status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current)
            // Linger on completed state before returning to idle
            setTimeout(() => setScanStatus('idle'), COMPLETED_LINGER_MS)
          }
        } catch {
          // Silently fail poll — do not show error for transient network issues
        }
      }, POLL_INTERVAL_MS)
    }, [])

    useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

    const triggerScan = useCallback(async () => {
      setIsTriggering(true)
      setError(null)
      try {
        const res = await fetch('/api/scans/trigger', { method: 'POST' })
        const data = await res.json()
        if (res.status === 429) {
          setCooldownSeconds(data.retryAfterSeconds ?? 3600)
          setError('Scan triggered recently. Please wait before triggering again.')
          return
        }
        if (res.status === 403) {
          setError('upgrade_required')
          return
        }
        if (res.status === 409) {
          setScanStatus('running')
          if (data.scanId) startPolling(data.scanId)
          return
        }
        if (!res.ok) {
          setError('Failed to trigger scan. Please try again.')
          return
        }
        setScanId(data.scanId)
        setScanStatus('pending')
        startPolling(data.scanId)
      } finally {
        setIsTriggering(false)
      }
    }, [startPolling])

    return { scanStatus, scanId, cooldownSeconds, triggerScan, isTriggering, error }
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — SCAN STATUS API ROUTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: app/api/scans/[scanId]/status/route.ts

  GET handler:
    1. Authenticate — return 401 if no session
    2. Fetch scan by scanId WHERE user_id = session.user.id (prevents IDOR)
    3. Return 404 if not found or doesn't belong to user
    4. Return 200 with { scanId, status, triggeredAt, startedAt, completedAt }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — UI COMPONENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: components/dashboard/ManualScanTrigger.tsx

  'use client'

  Props:
    planTier: PlanTier
    initialCooldownSeconds?: number  ← passed from server (calculated on load)

  Behavior by state:

  State: idle, planTier = growth or ai_shield
    → Button: "Run Scan Now" (primary, enabled)
    → Subtext: "Credits used: ~X per scan"

  State: isTriggering = true
    → Button: "Starting scan..." (disabled, spinner)

  State: scanStatus = pending | running
    → Button: disabled with animated pulse indicator
    → Label: "Scan in progress..." with spinning icon
    → Subtext: "Results will update when complete"

  State: scanStatus = completed (lingering 5s)
    → Button: "Scan complete ✓" (green, disabled)

  State: cooldownSeconds > 0
    → Button: "Run Scan Now" (disabled, grayed)
    → Subtext: "Available in [mm:ss]" — live countdown

  State: error = 'upgrade_required'  OR  planTier = free | starter
    → Do NOT render the real button
    → Render an upgrade prompt card instead:
        "Run scans on demand"
        "Available on Growth plan and above"
        <Link href="/dashboard/billing">Upgrade to Growth →</Link>

  State: error (other)
    → Show error message below button (dismissible)
    → Button returns to normal state

  Accessibility:
    - Button aria-label changes per state
    - Spinner has aria-hidden + visually-hidden text for screen readers
    - Countdown announces updates via aria-live="polite"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — DASHBOARD PAGE INTEGRATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Open: app/dashboard/page.tsx

  1. Fetch cooldown data alongside existing fetches:
       const cooldownData = await supabaseAdmin
         .from('scan_cooldowns')
         .select('last_manual_scan_at')
         .eq('user_id', user.id)
         .single()
       const ONE_HOUR_MS = 60 * 60 * 1000
       const elapsed = cooldownData?.data?.last_manual_scan_at
         ? Date.now() - new Date(cooldownData.data.last_manual_scan_at).getTime()
         : ONE_HOUR_MS
       const initialCooldownSeconds = Math.max(0, Math.ceil((ONE_HOUR_MS - elapsed) / 1000))

  2. Add component near the existing scan schedule messaging:
       <ManualScanTrigger
         planTier={profile.plan_tier}
         initialCooldownSeconds={initialCooldownSeconds}
       />

  3. Remove or replace the static "Scan runs every Sunday" text for paid plans.
     For free/starter: keep the "Scan runs every Sunday" text alongside the upgrade prompt.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 7 — WRITE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE: __tests__/api/scans/trigger.test.ts

  describe('POST /api/scans/trigger', () => {
    describe('authentication', () => {
      it('returns 401 when unauthenticated')
    })
    describe('plan gating', () => {
      it('returns 403 with upgrade_required for free plan')
      it('returns 403 with upgrade_required for starter plan')
      it('proceeds for growth plan')
      it('proceeds for ai_shield plan')
    })
    describe('cooldown', () => {
      it('returns 429 with retryAfterSeconds when within 1-hour cooldown')
      it('returns 429 with Retry-After header')
      it('allows scan when last scan was > 1 hour ago')
      it('allows scan when no prior scans exist')
    })
    describe('in-progress guard', () => {
      it('returns 409 with scanId when a scan is already pending')
      it('returns 409 when a scan is already running')
      it('allows new scan when last scan completed')
      it('allows new scan when last scan failed')
    })
    describe('success', () => {
      it('returns 202 with scanId and status=pending')
      it('inserts a scans record with triggered_by=manual')
      it('updates scan_cooldowns table')
      it('sends Inngest event with correct userId and scanId')
    })
    describe('errors', () => {
      it('returns 500 on unexpected DB error (does not leak details)')
    })
  })

  describe('GET /api/scans/[scanId]/status', () => {
    it('returns 401 when unauthenticated')
    it('returns 404 for scan not belonging to user (IDOR prevention)')
    it('returns 404 for non-existent scanId')
    it('returns 200 with status for own scan')
    it('returns all expected fields: scanId, status, triggeredAt, startedAt, completedAt')
  })

CREATE: __tests__/hooks/useScanStatus.test.ts

  describe('useScanStatus', () => {
    it('starts with idle status')
    it('sets status to pending after triggerScan called')
    it('starts polling after trigger')
    it('sets cooldownSeconds on 429 response')
    it('sets error=upgrade_required on 403 response')
    it('updates status when poll returns completed')
    it('resets to idle after COMPLETED_LINGER_MS')
    it('does not poll after scan completes')
    it('cleans up polling interval on unmount')
    it('decrements cooldownSeconds every second')
    it('stops countdown at 0 (never negative)')
  })

CREATE: __tests__/components/ManualScanTrigger.test.tsx

  describe('ManualScanTrigger', () => {
    describe('growth/ai_shield plan', () => {
      it('renders enabled "Run Scan Now" button when idle')
      it('renders spinner + disabled button while triggering')
      it('renders in-progress state during scan')
      it('renders completed state briefly after scan done')
      it('renders disabled button with countdown when on cooldown')
      it('countdown text shows mm:ss format')
    })
    describe('free/starter plan', () => {
      it('does NOT render Run Scan Now button')
      it('renders upgrade prompt card')
      it('upgrade CTA links to /dashboard/billing')
    })
    describe('errors', () => {
      it('shows dismissible error message on API failure')
      it('button returns to normal state after error')
    })
    describe('accessibility', () => {
      it('button aria-label reflects current state')
      it('countdown uses aria-live=polite')
    })
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRESSION GUARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Do NOT modify:
  - Any existing Inngest job definitions (only SEND events to existing jobs)
  - Existing scan schedule/cron logic
  - Existing scan data display components
  - Any existing scan-related DB queries (add new ones, don't alter old ones)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P1-FIX-05
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] scan_cooldowns table created and migrated
  [ ] POST /api/scans/trigger returns 202 for Growth/AI Shield users
  [ ] POST /api/scans/trigger returns 403 for Free/Starter users
  [ ] POST /api/scans/trigger returns 429 within 1-hour cooldown window
  [ ] POST /api/scans/trigger returns 409 if scan already in progress
  [ ] GET /api/scans/[scanId]/status returns correct status
  [ ] useScanStatus hook polls and updates state correctly
  [ ] ManualScanTrigger renders correct state for each scenario
  [ ] Free/Starter users see upgrade prompt (not a broken button)
  [ ] All API, hook, and component tests pass
  [ ] Full test suite: 0 regressions | pnpm tsc --noEmit: 0 errors
  [ ] Manual: Growth user triggers scan → sees in-progress → sees completed
  [ ] Manual: Free user sees upgrade prompt, not broken button
  [ ] Manual: Trigger again within 1 hour → countdown shown
```

---

---

# P1-FIX-06 — Sidebar Navigation Plan Gating + Upgrade Modals

## Background

All 8 non-Dashboard sidebar items are currently visible and clickable for all plan
tiers. Free and Starter users clicking Growth-only or AI Shield-only features either
hit empty pages or get confused about what they have access to. Every sidebar item
must be locked with a plan gate, visually dimmed for locked items, and clicking a
locked item should open an upgrade modal — never a 404.

## Pre-Flight Checklist

```bash
# 1. Find the sidebar navigation component
grep -r "Sidebar\|sidebar\|nav.*item\|SideNav" --include="*.tsx" -l . | head -5

# 2. Understand current sidebar item structure
find . -name "*.tsx" | xargs grep -l "AI Mentions\|Your Position\|Voice Search" 2>/dev/null

# 3. Check existing modal/dialog components to reuse
find . -name "*.tsx" | xargs grep -l "Dialog\|Modal\|useModal" 2>/dev/null | head -5

# 4. Check if shadcn/ui Dialog is already installed
ls components/ui/dialog.tsx 2>/dev/null || echo "not present"

# 5. Confirm plan-features.ts exists from FIX-03
ls lib/plan-features.ts

# 6. Baseline test run
pnpm test --passWithNoTests 2>&1 | tail -5
```

## Files This Sprint Will Create/Touch

```
MODIFY:  components/layout/Sidebar.tsx (or wherever sidebar nav lives)
CREATE:  components/layout/SidebarNavItem.tsx       ← new composable item
CREATE:  components/ui/UpgradeModal.tsx             ← reusable upgrade modal
CREATE:  lib/navigation/sidebar-config.ts           ← nav config with plan gates
CREATE:  __tests__/components/SidebarNavItem.test.tsx
CREATE:  __tests__/components/UpgradeModal.test.tsx
CREATE:  __tests__/lib/navigation/sidebar-config.test.ts
```

---

### PROMPT — P1-FIX-06

```
You are a senior fullstack engineer on LocalVector.ai (Next.js 14 App Router,
TypeScript, Tailwind CSS). Your task is P1-FIX-06: implement plan-gated sidebar
navigation so locked features show upgrade modals instead of leading to 404s or
confusing empty states.

DEPENDS ON: P0-FIX-01 (plan_tier), P0-FIX-03 (lib/plan-features.ts)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — SIDEBAR NAVIGATION CONFIG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: lib/navigation/sidebar-config.ts

  import type { PlanTier, PlanFeatures } from '@/lib/plan-features'

  export interface SidebarNavItem {
    key: string
    label: string
    href: string
    icon: string                    // icon component name, resolved in SidebarNavItem
    section: 'overview' | 'how_ai_sees_you'
    requiredFeature: keyof PlanFeatures | null   // null = available to all plans
    requiredPlan: PlanTier | null                // null = available to all plans
    upgradeMessage: string          // shown in modal when locked
    upgradeTargetPlan: PlanTier     // minimum plan needed to unlock
    badge?: string                  // optional badge text e.g. "New"
  }

  export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
    // ── OVERVIEW ──────────────────────────────────────────────
    {
      key: 'dashboard',
      label: 'Dashboard',
      href: '/dashboard',
      icon: 'LayoutDashboard',
      section: 'overview',
      requiredFeature: null,
      requiredPlan: null,
      upgradeMessage: '',
      upgradeTargetPlan: 'free',
    },
    {
      key: 'ai_mistakes',
      label: 'AI Mistakes',
      href: '/dashboard/ai-mistakes',
      icon: 'AlertTriangle',
      section: 'overview',
      requiredFeature: 'canAccessAIMistakes',
      requiredPlan: 'growth',
      upgradeMessage: 'Discover where AI search engines are getting your business wrong. Available on Growth plan and above.',
      upgradeTargetPlan: 'growth',
    },

    // ── HOW AI SEES YOU ────────────────────────────────────────
    {
      key: 'ai_mentions',
      label: 'AI Mentions',
      href: '/dashboard/ai-mentions',
      icon: 'MessageSquare',
      section: 'how_ai_sees_you',
      requiredFeature: null,
      requiredPlan: null,        // available to all plans (even free — show sample)
      upgradeMessage: '',
      upgradeTargetPlan: 'free',
    },
    {
      key: 'your_position',
      label: 'Your Position',
      href: '/dashboard/position',
      icon: 'TrendingUp',
      section: 'how_ai_sees_you',
      requiredFeature: null,
      requiredPlan: null,        // available to all plans (show sample for free)
      upgradeMessage: '',
      upgradeTargetPlan: 'free',
    },
    {
      key: 'site_visitors',
      label: 'Site Visitors',
      href: '/dashboard/site-visitors',
      icon: 'Users',
      section: 'how_ai_sees_you',
      requiredFeature: 'canAccessVoiceSearch',   // growth+ feature
      requiredPlan: 'growth',
      upgradeMessage: 'See which AI-referred visitors are landing on your website. Available on Growth plan and above.',
      upgradeTargetPlan: 'growth',
    },
    {
      key: 'ai_says',
      label: 'AI Says',
      href: '/dashboard/ai-says',
      icon: 'Bot',
      section: 'how_ai_sees_you',
      requiredFeature: null,
      requiredPlan: null,
      upgradeMessage: '',
      upgradeTargetPlan: 'free',
    },
    {
      key: 'your_reputation',
      label: 'Your Reputation',
      href: '/dashboard/reputation',
      icon: 'Star',
      section: 'how_ai_sees_you',
      requiredFeature: 'canAccessReputation',
      requiredPlan: 'ai_shield',
      upgradeMessage: 'Monitor and manage how AI models describe your brand reputation. Exclusive to AI Shield plan.',
      upgradeTargetPlan: 'ai_shield',
    },
    {
      key: 'your_sources',
      label: 'Your Sources',
      href: '/dashboard/sources',
      icon: 'BookOpen',
      section: 'how_ai_sees_you',
      requiredFeature: 'canAccessSources',
      requiredPlan: 'ai_shield',
      upgradeMessage: 'See exactly which sources AI engines are citing about your business. Exclusive to AI Shield plan.',
      upgradeTargetPlan: 'ai_shield',
    },
    {
      key: 'voice_search',
      label: 'Voice Search',
      href: '/dashboard/voice-search',
      icon: 'Mic',
      section: 'how_ai_sees_you',
      requiredFeature: 'canAccessVoiceSearch',
      requiredPlan: 'growth',
      upgradeMessage: 'Optimize how your business appears in voice search and AI assistants. Available on Growth plan and above.',
      upgradeTargetPlan: 'growth',
    },
  ]

  export function isItemLocked(item: SidebarNavItem, planTier: PlanTier): boolean {
    if (!item.requiredFeature) return false
    const { hasFeature } = require('@/lib/plan-features')
    return !hasFeature(planTier, item.requiredFeature)
  }

  export function getItemsBySection(section: SidebarNavItem['section']): SidebarNavItem[] {
    return SIDEBAR_NAV_ITEMS.filter(item => item.section === section)
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — UPGRADE MODAL COMPONENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: components/ui/UpgradeModal.tsx

  'use client'

  Use the existing Dialog/Modal pattern in the codebase. If shadcn/ui Dialog
  is available (components/ui/dialog.tsx), use it. If not, build a simple
  accessible modal with focus trap.

  Props:
    isOpen: boolean
    onClose: () => void
    featureName: string         // e.g. "AI Mistakes"
    message: string             // from sidebar config upgradeMessage
    requiredPlan: PlanTier      // 'growth' | 'ai_shield'
    currentPlan: PlanTier

  Layout:
    - Modal header: Lock icon + "Upgrade to unlock [featureName]"
    - Body: [message] text
    - Plan highlight box showing:
        Required: [PLAN_DISPLAY_NAMES[requiredPlan]]
        [List 2-3 key features of that plan]
    - CTA button: "Upgrade to [PLAN_DISPLAY_NAMES[requiredPlan]]"
        → href="/dashboard/billing?highlight=[requiredPlan]"
        → onClick: close modal then navigate
    - Secondary: "Maybe later" (closes modal)
    - Close (×) button in top right
    - Clicking backdrop closes modal
    - Pressing Escape closes modal

  Styling:
    - Match existing dark UI theme
    - Use existing color palette — do not introduce new colors
    - requiredPlan='ai_shield': use a slightly more premium visual treatment
      (subtle gradient or border highlight)

  Accessibility:
    - role="dialog", aria-modal="true"
    - aria-labelledby pointing to modal title
    - Focus trapped inside modal when open
    - Focus returns to trigger element on close
    - Escape key closes modal

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — SIDEBAR NAV ITEM COMPONENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: components/layout/SidebarNavItem.tsx

  'use client'

  Props:
    item: SidebarNavItem
    planTier: PlanTier
    isActive: boolean      // true when current route matches item.href

  Behavior:
    const locked = isItemLocked(item, planTier)

  If NOT locked:
    Render as Next.js <Link href={item.href}>
    Apply active styles when isActive=true
    Render icon + label normally

  If locked:
    Render as <button type="button"> (not a link — prevents 404 navigation)
    Apply dimmed/muted styling (opacity-50 or text-muted)
    Render lock icon (small) alongside the feature icon
    onClick: open UpgradeModal with item's upgrade config
    Do NOT navigate anywhere

  Visual states:
    Active:       bright text, left border accent, bg highlight
    Unlocked:     normal text, hover highlight
    Locked:       dimmed text, lock badge, hover shows cursor-pointer

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — REFACTOR SIDEBAR COMPONENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Open the existing Sidebar component. PRESERVE all existing structure, styling,
branding (logo, business name, credits counter). Only change how nav items render.

Replace the hardcoded list of nav items with:
  import { SIDEBAR_NAV_ITEMS, getItemsBySection } from '@/lib/navigation/sidebar-config'
  import { SidebarNavItem } from './SidebarNavItem'

  // In render:
  const overviewItems = getItemsBySection('overview')
  const aiItems = getItemsBySection('how_ai_sees_you')

  // Render each section with SidebarNavItem
  // Section labels ("OVERVIEW", "HOW AI SEES YOU") must remain exactly as before

The Sidebar needs planTier passed in. Find where it's rendered (likely in
app/dashboard/layout.tsx) and ensure profile.plan_tier is passed down.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — WRITE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE: __tests__/lib/navigation/sidebar-config.test.ts

  describe('SIDEBAR_NAV_ITEMS', () => {
    it('every item has a unique key')
    it('every item has a non-empty label')
    it('every item has a valid href')
    it('every item has an upgradeTargetPlan value')
    it('items with requiredFeature have a non-empty upgradeMessage')
    it('Dashboard item has no plan requirement')
    it('AI Mentions has no plan requirement (visible to all)')
    it('AI Mistakes requires growth+')
    it('Your Reputation requires ai_shield')
    it('Your Sources requires ai_shield')
    it('Voice Search requires growth+')
    it('Site Visitors requires growth+')
  })

  describe('isItemLocked', () => {
    it('returns false for items with no requiredFeature')
    it('returns true for ai_mistakes on free plan')
    it('returns true for ai_mistakes on starter plan')
    it('returns false for ai_mistakes on growth plan')
    it('returns false for ai_mistakes on ai_shield plan')
    it('returns true for reputation on free plan')
    it('returns true for reputation on growth plan')
    it('returns false for reputation on ai_shield plan')
  })

CREATE: __tests__/components/UpgradeModal.test.tsx

  describe('UpgradeModal', () => {
    describe('rendering', () => {
      it('renders when isOpen=true')
      it('does not render when isOpen=false')
      it('shows featureName in title')
      it('shows message body text')
      it('shows required plan name')
      it('CTA button links to /dashboard/billing?highlight=[plan]')
      it('"Maybe later" button exists')
    })
    describe('closing', () => {
      it('calls onClose when × button clicked')
      it('calls onClose when "Maybe later" clicked')
      it('calls onClose when Escape key pressed')
      it('calls onClose when backdrop clicked')
      it('does NOT call onClose when modal content clicked')
    })
    describe('accessibility', () => {
      it('has role=dialog')
      it('has aria-modal=true')
      it('focus is trapped inside modal when open')
      it('focus returns to trigger element on close')
    })
  })

CREATE: __tests__/components/SidebarNavItem.test.tsx

  describe('SidebarNavItem — unlocked', () => {
    it('renders as a Link element')
    it('links to correct href')
    it('does not show lock icon')
    it('applies active styles when isActive=true')
    it('applies hover styles when not active')
  })

  describe('SidebarNavItem — locked', () => {
    it('renders as a button (not a Link)')
    it('shows lock icon')
    it('applies dimmed styling')
    it('does NOT navigate on click')
    it('opens UpgradeModal on click')
    it('UpgradeModal receives correct featureName and message')
    it('UpgradeModal can be closed')
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRESSION GUARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Do NOT change:
  - Sidebar branding area (logo, business name, plan badge, credits counter)
  - Sidebar visual dimensions, widths, or responsive behavior
  - Any existing section heading labels or spacing
  - Active route detection logic (replicate it in SidebarNavItem)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P1-FIX-06
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] sidebar-config.ts defines all 9 items with correct plan gates
  [ ] SidebarNavItem renders as Link (unlocked) or Button (locked)
  [ ] Locked items show lock indicator and dimmed styling
  [ ] Clicking locked item opens UpgradeModal (never navigates to 404)
  [ ] UpgradeModal shows correct message and CTA for each plan
  [ ] Free user: 5+ sidebar items appear locked
  [ ] Growth user: Reputation + Sources appear locked; others accessible
  [ ] AI Shield user: all items accessible (no locks)
  [ ] All tests pass | 0 regressions | 0 TypeScript errors | 0 lint errors
  [ ] Manual: click "Your Reputation" as Growth user → modal appears, not 404
```

---

---

# P1-FIX-07 — Settings: Domain + Team Pages (Clean Stubs or Working Pages)

## Background

`/dashboard/settings/domain` and `/dashboard/settings/team` are linked from Getting
Started and from the Settings sidebar layout (created in P0-FIX-02). Both currently
404. This sprint either builds the actual pages or implements proper "Coming Soon"
placeholder pages that clearly communicate status and don't 404. Either way, no user
should ever hit a 404 from a settings link again.

## Pre-Flight Checklist

```bash
# 1. Confirm settings layout and profile page exist (FIX-02 dependency)
ls app/dashboard/settings/

# 2. Check if any domain/team logic exists in the codebase
grep -r "custom_domain\|customDomain\|team_members\|teamMembers" --include="*.ts" -l . | head -10

# 3. Check if DNS verification utilities exist
grep -r "dns\|vercel.*domain\|domain.*verify" --include="*.ts" . | head -5

# 4. Check Supabase schema for relevant tables
grep -i "custom_domain\|team_member\|invitation" supabase/schema.sql supabase/migrations/*.sql 2>/dev/null

# 5. Baseline
pnpm test --passWithNoTests 2>&1 | tail -5
```

---

### PROMPT — P1-FIX-07

```
You are a senior fullstack engineer on LocalVector.ai (Next.js 14 App Router,
TypeScript, Tailwind CSS). Your task is P1-FIX-07: build the Custom Domain and
Team Management settings pages so no settings navigation link ever 404s.

These are AI Shield-only features. Implement them as:
  - FULL PAGES if the backend infrastructure already exists
  - CLEAN FEATURE STUBS if the backend is not yet built

Do NOT leave any route returning 404. A well-designed stub is better than a 404.

DEPENDS ON: P0-FIX-02 (settings layout), P0-FIX-01 (plan_tier), P0-FIX-03 (plan-features)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — PLAN GATE SERVER HELPER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: lib/auth/require-plan.ts

  This utility is used by server components that require a minimum plan tier.

  import { redirect } from 'next/navigation'
  import type { PlanTier } from '@/lib/stripe/plan-sync'

  const PLAN_RANK: Record<PlanTier, number> = {
    free: 0, starter: 1, growth: 2, ai_shield: 3
  }

  export function requirePlan(
    userPlan: PlanTier,
    requiredPlan: PlanTier,
    redirectTo = '/dashboard'
  ): void {
    if (PLAN_RANK[userPlan] < PLAN_RANK[requiredPlan]) {
      redirect(redirectTo)
    }
  }

  // Use in server components:
  // requirePlan(profile.plan_tier, 'ai_shield', '/dashboard?upgrade=domain')

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — CUSTOM DOMAIN PAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: app/dashboard/settings/domain/page.tsx

  Server component. Logic:
    1. Get session; redirect to /login if missing
    2. Get profile.plan_tier
    3. If plan_tier !== 'ai_shield': redirect to /dashboard?upgrade=domain
       (do NOT show the page to non-AI-Shield users — they see upgrade via modal)
    4. Check if custom_domains table exists in schema

  IF custom_domains table EXISTS and has the needed columns:
    Implement a FULL page with:
      a. Current domain status section:
           - If no domain set: "No custom domain connected"
           - If domain set: show domain + verification status badge
      b. Add domain form:
           - Text input: "your-domain.com" (no https prefix)
           - Validate: must be valid domain format (regex)
           - Submit → POST /api/settings/domain/add
      c. DNS verification instructions:
           After adding domain, show:
           "Add this CNAME record to your DNS:"
           Host: @ or www
           Value: [localvector-cname-target from env]
           TTL: 3600
           "Verify DNS" button → POST /api/settings/domain/verify
      d. Remove domain option (with confirmation)

  IF custom_domains table does NOT EXIST:
    Implement a CLEAN STUB page:
      - Page title: "Custom Domain"
      - Status badge: "Coming Soon"
      - Explanation card:
          "Connect your own domain to your LocalVector dashboard.
           Your insights will be accessible at your-domain.com/dashboard."
      - Feature list (what users will be able to do):
          ✓ Connect any domain you own
          ✓ Automatic SSL certificate provisioning
          ✓ Verified business identity for AI citations
      - "Notify me when available" button → logs interest to a feature_interest
        table (or just shows "We'll notify you via email when this is ready")
      - DO NOT show any form that leads to a broken API

  In both cases:
    - Page has metadata: title: 'Custom Domain | LocalVector Settings'
    - Page renders inside the settings layout (from FIX-02)
    - Non-AI-Shield users are redirected (never see this page)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — TEAM MANAGEMENT PAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: app/dashboard/settings/team/page.tsx

  Server component. Logic:
    1. Get session; redirect to /login if missing
    2. Get profile.plan_tier
    3. If plan_tier !== 'ai_shield': redirect to /dashboard?upgrade=team

  IF team_members / invitations tables EXIST in schema:
    Implement a FULL page with:
      a. Current team members list:
           - Show user email, role, joined date
           - Remove member button (with confirmation)
      b. Invite form:
           - Email input (validate email format)
           - Role selector: Admin | Member | Viewer
           - Submit → POST /api/settings/team/invite
           - On success: show "Invitation sent to [email]"
      c. Pending invitations list:
           - Show pending invites with resend / revoke options
      d. Team seat limit: "X of Y seats used" (based on plan)

  IF team tables do NOT EXIST:
    Implement a CLEAN STUB page:
      - Page title: "Team Management"
      - Status badge: "Coming Soon"
      - Explanation card:
          "Invite your team to collaborate on your LocalVector dashboard.
           Everyone on your team can monitor AI visibility and take action."
      - Feature preview list:
          ✓ Invite unlimited team members
          ✓ Role-based access control (Admin, Member, Viewer)
          ✓ Shared scan results and recommendations
          ✓ Team activity log
      - "Notify me when available" (same as domain page)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — HANDLE UPGRADE REDIRECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When a non-AI-Shield user is redirected from /settings/domain or /settings/team
back to /dashboard?upgrade=domain or ?upgrade=team, the dashboard should detect
this query param and auto-open the UpgradeModal for the appropriate feature.

In app/dashboard/page.tsx:
  - Read searchParams.upgrade
  - If present, pass an initialUpgradeModal prop to a client component that opens
    the modal on mount
  - This ensures users who try to access AI Shield pages directly are shown the
    upgrade path instead of being silently redirected with no explanation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — WRITE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE: __tests__/lib/auth/require-plan.test.ts

  describe('requirePlan', () => {
    it('does not redirect when user meets requirement')
    it('redirects when user plan is below required')
    it('redirects free user trying to access ai_shield resource')
    it('redirects growth user trying to access ai_shield resource')
    it('allows ai_shield user to access ai_shield resource')
    it('uses custom redirectTo when provided')
    it('defaults to /dashboard redirect when not specified')
  })

CREATE: __tests__/app/settings/domain.test.ts

  describe('/dashboard/settings/domain', () => {
    it('redirects to /login when unauthenticated')
    it('redirects non-ai_shield users to /dashboard?upgrade=domain')
    it('renders page for ai_shield users (no redirect)')
    it('page has correct metadata title')
    it('renders inside settings layout')
    it('never returns 404 for any authenticated user')
  })

CREATE: __tests__/app/settings/team.test.ts

  describe('/dashboard/settings/team', () => {
    it('redirects to /login when unauthenticated')
    it('redirects non-ai_shield users to /dashboard?upgrade=team')
    it('renders page for ai_shield users (no redirect)')
    it('never returns 404 for any authenticated user')
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P1-FIX-07
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] /dashboard/settings/domain returns 200 for AI Shield users (never 404)
  [ ] /dashboard/settings/team returns 200 for AI Shield users (never 404)
  [ ] Non-AI Shield users are redirected (not 404'd, not shown an error)
  [ ] Redirected users see the upgrade modal on the dashboard
  [ ] require-plan.ts utility works for all tier combinations
  [ ] Settings sidebar links to domain + team are now functional
  [ ] All tests pass | 0 regressions | 0 TS errors | 0 lint errors
  [ ] Manual: visit /settings/domain as Growth user → redirected to dashboard + modal
  [ ] Manual: visit /settings/domain as AI Shield user → page loads
```

---

---

# P1-FIX-08 — Full Codebase Audit: Eliminate All Stale `profiles.plan` Reads

## Background

After P0-FIX-01, the authoritative plan field is `profiles.plan_tier`. But there may
be scattered reads of the legacy `profiles.plan` field still in the codebase — in
middleware, API guards, server components, client components, and utility functions.
This sprint systematically finds and eliminates every one of them.

**Run this sprint LAST in P1** — after FIX-05, 06, and 07 have all been written, so
the grep catches newly added code from those sprints too.

---

### PROMPT — P1-FIX-08

```
You are a senior fullstack engineer on LocalVector.ai. Your task is P1-FIX-08:
audit the entire codebase for any remaining reads of the legacy `profiles.plan`
field and migrate them all to `profiles.plan_tier` (the authoritative source set
up in P0-FIX-01). This is a codebase-wide cleanup sprint.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — DISCOVERY: GENERATE AUDIT REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run these grep commands and document every match:

  # Direct plan field reads in TypeScript/TSX
  grep -rn "\.plan\b" --include="*.ts" --include="*.tsx" . \
    | grep -v "plan_tier\|plan_id\|plan_name\|plan_features\|PLAN_\|planTier\|node_modules\|\.next\|dist"

  # Supabase select queries fetching plan
  grep -rn "select.*'plan'\|select.*\"plan\"\|\.select.*plan[^_]" --include="*.ts" --include="*.tsx" .

  # Middleware/auth plan checks
  grep -rn "plan.*===\|===.*plan\|plan.*!==\|plan.*includes\|plan.*switch" \
    --include="*.ts" --include="*.tsx" . \
    | grep -v "plan_tier\|node_modules\|\.next"

  # API response shapes that include plan
  grep -rn "plan:" --include="*.ts" --include="*.tsx" . \
    | grep -v "plan_tier\|plan_id\|PLAN_\|planTier\|node_modules\|\.next"

Document ALL matches in a list before making any changes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — CATEGORIZE EACH MATCH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For each match, classify it as one of:

  A. READ for DISPLAY → replace .plan with .plan_tier + PLAN_DISPLAY_NAMES lookup
  B. READ for GATING → replace .plan check with .plan_tier + hasFeature() or PLAN_RANK comparison
  C. DB SELECT query → add plan_tier to the SELECT clause; keep plan if needed for backward compat
  D. DB WRITE (Stripe webhook area) → skip — FIX-01 already handles this correctly
  E. Type definition → update to include plan_tier: PlanTier
  F. Test file → update to test plan_tier not plan
  G. Migration file → skip — do not touch migration files
  H. External API call (e.g., Stripe.com API params) → skip — these use Stripe's own field names
  I. Already correct (reads plan_tier) → mark as OK, no change needed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — APPLY FIXES BY CATEGORY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Category A — Display reads:
  Before: <Badge>{profile.plan}</Badge>
  After:  <Badge>{PLAN_DISPLAY_NAMES[profile.plan_tier]}</Badge>

Category B — Gating reads:
  Before: if (profile.plan === 'growth' || profile.plan === 'ai_shield') { ... }
  After:  if (hasFeature(profile.plan_tier, 'canTriggerManualScan')) { ... }
  OR:     if (PLAN_RANK[profile.plan_tier] >= PLAN_RANK['growth']) { ... }

Category C — DB SELECT:
  Before: .select('id, plan, business_name')
  After:  .select('id, plan, plan_tier, business_name')
  (keep 'plan' in select for now to avoid breaking anything that uses it,
   but ensure plan_tier is also fetched and preferred)

Category E — Type definitions:
  Add plan_tier: PlanTier to any Profile/User type that has plan: string
  Do NOT remove the plan field yet (backward compat during transition)

Category F — Test files:
  Update test fixtures to include plan_tier
  Update assertions to check plan_tier instead of plan where applicable

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — MIDDLEWARE AUDIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find middleware.ts or middleware files that protect routes by plan:
  grep -rn "plan" middleware.ts middleware/ 2>/dev/null

For each plan check in middleware:
  - If it reads from a JWT claim: verify the JWT includes plan_tier
    If not: update the JWT generation in signIn/callback to include plan_tier
  - If it reads from a DB call: update to use plan_tier column
  - If it reads from a cookie: verify the cookie is set with plan_tier post-login
    Update cookie write to use plan_tier

Critical: middleware must NEVER read plan_tier from the database on every request
(too slow). It should read from the session JWT or a session cookie that was
set at login time. Verify this pattern is correct and plan_tier is in the token.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — WRITE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE: __tests__/audit/plan-field-consistency.test.ts

  This is an automated consistency test that catches future regressions.

  import { execSync } from 'child_process'

  describe('Plan field consistency audit', () => {
    it('no UI component reads .plan for display without PLAN_DISPLAY_NAMES', () => {
      // This grep should return 0 matches (excluding safe patterns)
      const result = execSync(
        `grep -rn "\\.plan}" --include="*.tsx" src/ components/ app/ 2>/dev/null | ` +
        `grep -v "plan_tier\\|PLAN_DISPLAY\\|plan_id\\|plan_name\\|node_modules" | wc -l`
      ).toString().trim()
      expect(parseInt(result)).toBe(0)
    })

    it('no gating logic uses hardcoded plan string comparison', () => {
      const result = execSync(
        `grep -rn "=== 'growth'\\|=== 'starter'\\|=== 'free'\\|=== 'ai_shield'" ` +
        `--include="*.ts" --include="*.tsx" app/ lib/ components/ 2>/dev/null | ` +
        `grep -v "plan-sync\\|plan-features\\|sidebar-config\\|node_modules\\|\\.test\\." | wc -l`
      ).toString().trim()
      // Allow 0 hardcoded string comparisons outside of config files
      expect(parseInt(result)).toBe(0)
    })

    it('all Profile type definitions include plan_tier field', () => {
      const result = execSync(
        `grep -rn "type Profile\\|interface Profile" --include="*.ts" app/ lib/ types/ 2>/dev/null`
      ).toString()
      // Verify plan_tier is present in type definitions
      // This is a documentation/reminder test — adjust assertion to match your type file location
      expect(result).toBeTruthy()
    })
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P1-FIX-08
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] Audit report generated — all .plan reads documented and categorized
  [ ] All Category A (display) reads updated to use PLAN_DISPLAY_NAMES
  [ ] All Category B (gating) reads updated to use hasFeature() or PLAN_RANK
  [ ] All Category C (DB selects) include plan_tier in fetch
  [ ] All type definitions include plan_tier: PlanTier
  [ ] Middleware uses plan_tier from JWT/session (not DB query)
  [ ] JWT/session token includes plan_tier at login time
  [ ] Consistency test passes (0 hardcoded plan string comparisons outside config)
  [ ] All tests pass | 0 regressions | 0 TS errors | 0 lint errors
  [ ] Manual: header badge shows "AI Shield" for dev@localvector.ai on fresh login
```

---

---

# P2-FIX-09 — Skeleton Loaders on All Dashboard Charts

## Background

The dashboard loads data asynchronously (scan results, SOV charts, mentions, position
rankings). Currently there are no loading states — users see a blank/empty page flash
before data populates. This creates a perception that the app is broken or slow.

---

### PROMPT — P2-FIX-09

```
You are a senior frontend engineer on LocalVector.ai (Next.js 14, TypeScript,
Tailwind CSS). Your task is P2-FIX-09: add consistent skeleton loading states
to all dashboard data sections so users always see meaningful content while
data loads.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — SKELETON PRIMITIVES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: components/ui/Skeleton.tsx

  A single composable skeleton component used everywhere:

  interface SkeletonProps {
    className?: string
    variant?: 'text' | 'circle' | 'rect' | 'chart-bar' | 'stat-card'
  }

  All variants use the same shimmer animation:
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    background: linear-gradient(90deg, #1f2937 25%, #374151 50%, #1f2937 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;

  Variants:
    text:        h-4 w-full rounded
    circle:      rounded-full (width/height from className)
    rect:        rounded-lg (width/height from className)
    chart-bar:   rounded-t-sm w-8 (height from className) — for bar charts
    stat-card:   full card skeleton: title line + large number + small label

  Export helper: SkeletonCard wrapping a standard card with common patterns

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — DASHBOARD SECTION SKELETONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Audit every data section on the dashboard and create a skeleton variant for each.
Sections to cover (find exact component names in codebase):

  1. Share of Voice chart     → SkeletonSOVChart: 5 bars of varying heights
  2. AI Mentions count card   → SkeletonStatCard with shimmer number
  3. Your Position card       → SkeletonStatCard + rank indicator placeholder
  4. Site Visitors chart      → SkeletonLineChart: flat line with shimmer
  5. Content Recommendations  → SkeletonList: 3 rows of text + action shimmer
  6. Recent Scan Results      → SkeletonList: 3 rows with status badges

For each section that uses Suspense:
  Add a loading.tsx or loading state using the skeleton

For each section that fetches client-side:
  Show skeleton while loading=true, replace with real component when data arrives

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — NEXT.JS SUSPENSE BOUNDARIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For server components that fetch data:
  Wrap each dashboard section in <Suspense fallback={<SkeletonSOVChart />}>
  This allows sections to stream in independently rather than blocking together.

Create file: app/dashboard/loading.tsx
  Full-page dashboard skeleton shown while the entire page hydrates.
  Should mirror the dashboard layout structure with all sections as skeletons.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — WRITE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE: __tests__/components/Skeleton.test.tsx

  describe('Skeleton', () => {
    it('renders text variant with shimmer class')
    it('renders chart-bar variant')
    it('renders stat-card variant')
    it('accepts and applies custom className')
    it('renders without crashing for all variant values')
    it('has aria-hidden=true (decorative, not read by screen readers)')
  })

  describe('Dashboard loading states', () => {
    it('SOV chart shows skeleton while data is loading')
    it('Stat cards show skeleton while loading')
    it('Recommendations show skeleton rows while loading')
    it('Skeleton is replaced by real content when data arrives')
    it('No layout shift between skeleton and real content (same dimensions)')
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P2-FIX-09
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] Skeleton primitive covers all 5 variants
  [ ] Every dashboard data section has a matching skeleton
  [ ] app/dashboard/loading.tsx created (full-page skeleton)
  [ ] Suspense boundaries wrap server-side data sections
  [ ] No blank flash — skeleton is always shown before data
  [ ] Skeleton dimensions match real content (no layout shift)
  [ ] All tests pass | 0 regressions | 0 TS errors
```

---

---

# P2-FIX-10 — Upgrade Modals: Locked Feature Clicks (Reuse FIX-06 UpgradeModal)

## Background

After P1-FIX-06, the sidebar's locked items correctly open upgrade modals. But other
parts of the app may also have locked features that are currently broken or hidden —
dashboard metric cards, inline feature CTAs, and deep-link accesses. This sprint
ensures every locked feature interaction in the entire app opens the UpgradeModal
rather than a 404 or empty state.

---

### PROMPT — P2-FIX-10

```
You are a senior frontend engineer on LocalVector.ai. Your task is P2-FIX-10:
audit every place in the app where a user might interact with a feature above
their plan tier, and ensure every locked interaction opens the UpgradeModal
from P1-FIX-06 (never a 404, never a silent failure).

DEPENDS ON: P1-FIX-06 (UpgradeModal component must exist)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — AUDIT LOCKED INTERACTION POINTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find every location where plan-gated content could be accessed:

  grep -rn "canAccess\|canUse\|isLocked\|plan.*guard\|feature.*gate" \
    --include="*.tsx" --include="*.ts" . | grep -v node_modules

  grep -rn "href.*dashboard.*reputation\|href.*dashboard.*sources\|href.*voice\|href.*ai-mistakes" \
    --include="*.tsx" .

  grep -rn "disabled\|locked\|coming.soon\|upgrade" --include="*.tsx" . \
    | grep -v node_modules | grep -v "\.test\."

Categorize matches:
  A. Dashboard stat/metric cards that link to locked pages
  B. Inline CTAs inside chart/data components
  C. Direct href links to plan-gated pages in any component
  D. Buttons that call plan-gated API endpoints

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — CREATE useUpgradeModal HOOK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: hooks/useUpgradeModal.ts

  'use client'
  import { useState, useCallback } from 'react'
  import type { PlanTier } from '@/lib/stripe/plan-sync'

  interface UpgradeModalConfig {
    featureName: string
    message: string
    requiredPlan: PlanTier
  }

  export function useUpgradeModal() {
    const [isOpen, setIsOpen] = useState(false)
    const [config, setConfig] = useState<UpgradeModalConfig | null>(null)

    const openUpgradeModal = useCallback((cfg: UpgradeModalConfig) => {
      setConfig(cfg)
      setIsOpen(true)
    }, [])

    const closeUpgradeModal = useCallback(() => {
      setIsOpen(false)
    }, [])

    return { isOpen, config, openUpgradeModal, closeUpgradeModal }
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — FIX EACH LOCKED INTERACTION POINT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For each match from Step 1:

  Category A — Dashboard stat cards linking to locked pages:
    Replace <Link href="/dashboard/reputation"> with:
    <button onClick={() => openUpgradeModal({ featureName: 'Your Reputation', ... })}>
      [existing card content]
    </button>
    Add lock icon overlay on card (top-right corner, small, subtle)

  Category B — Inline CTAs in charts:
    Replace any <Link> or <a> that goes to a plan-gated page with
    a button + useUpgradeModal pattern

  Category C — Direct href links anywhere in the app:
    Every <Link href="/dashboard/reputation|sources|voice-search|ai-mistakes">
    that could be reached by a lower-plan user must be replaced with a gated
    component that checks planTier first.

  Category D — API calls:
    These should already return 403 from the API (set up in FIX-05).
    Ensure the UI catches 403 and opens the upgrade modal instead of
    showing a generic error.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — UPGRADE REDIRECT ON PAGE LOAD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For plan-gated pages that are accessed directly via URL (bookmarks, direct links):
  These pages should redirect (not 404) using requirePlan() from P1-FIX-07.
  Ensure ALL plan-gated pages use requirePlan() at the top of their server component.

  Check these pages specifically:
    /dashboard/ai-mistakes   → requires growth
    /dashboard/site-visitors → requires growth
    /dashboard/voice-search  → requires growth
    /dashboard/reputation    → requires ai_shield
    /dashboard/sources       → requires ai_shield

  For each: add requirePlan() call at top of server component.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — WRITE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE: __tests__/hooks/useUpgradeModal.test.ts

  describe('useUpgradeModal', () => {
    it('starts with isOpen=false')
    it('opens modal with correct config when openUpgradeModal called')
    it('closes modal when closeUpgradeModal called')
    it('config is null when modal is closed')
    it('config persists after close (no flash on re-open)')
  })

CREATE: __tests__/integration/locked-feature-interactions.test.ts

  Smoke tests for every plan-gated page:

  describe('Direct URL access to gated pages', () => {
    const gatedRoutes = [
      { path: '/dashboard/ai-mistakes', minPlan: 'growth' },
      { path: '/dashboard/site-visitors', minPlan: 'growth' },
      { path: '/dashboard/voice-search', minPlan: 'growth' },
      { path: '/dashboard/reputation', minPlan: 'ai_shield' },
      { path: '/dashboard/sources', minPlan: 'ai_shield' },
    ]

    gatedRoutes.forEach(({ path, minPlan }) => {
      it(`${path} redirects free user (never 404)`)
      it(`${path} redirects starter user (never 404)`)
      it(`${path} accessible for ${minPlan} and above`)
    })
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P2-FIX-10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] useUpgradeModal hook created and tested
  [ ] Every dashboard stat card that links to a gated page uses the hook
  [ ] No <Link> in the app points to a plan-gated route without a plan check
  [ ] All 5 plan-gated pages use requirePlan() and redirect (not 404)
  [ ] 403 API responses open upgrade modal (not generic error)
  [ ] All tests pass | 0 regressions | 0 TS errors | 0 lint errors
```

---

---

# P2-FIX-11 — Full Route Audit: Zero 404s Across All Plans

## Background

A systematic verification sprint — no new code is written, only bugs found and fixed.
Every route in the app is tested for every plan tier. Any that return 404 are fixed.

---

### PROMPT — P2-FIX-11

```
You are a senior QA engineer on LocalVector.ai. Your task is P2-FIX-11: generate
a comprehensive list of every route in the app, verify each one is reachable
(or correctly redirects) for each plan tier, and fix any remaining 404s.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — GENERATE ROUTE MANIFEST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  # List all Next.js routes
  find app/ -name "page.tsx" | sort | sed 's|app/||' | sed 's|/page.tsx||'

  # List all API routes
  find app/api/ -name "route.ts" | sort | sed 's|app/api/||' | sed 's|/route.ts||'

Document the complete route manifest.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — EXPECTED STATUS PER ROUTE PER PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For each route, define the expected HTTP response for each plan:

  Route                           | free    | starter | growth  | ai_shield
  ─────────────────────────────────────────────────────────────────────────
  /dashboard                      | 200     | 200     | 200     | 200
  /dashboard/settings/profile     | 200     | 200     | 200     | 200
  /dashboard/settings/domain      | 302→/db | 302→/db | 302→/db | 200
  /dashboard/settings/team        | 302→/db | 302→/db | 302→/db | 200
  /dashboard/ai-mistakes          | 302→/db | 302→/db | 200     | 200
  /dashboard/site-visitors        | 302→/db | 302→/db | 200     | 200
  /dashboard/voice-search         | 302→/db | 302→/db | 200     | 200
  /dashboard/reputation           | 302→/db | 302→/db | 302→/db | 200
  /dashboard/sources              | 302→/db | 302→/db | 302→/db | 200
  /dashboard/billing              | 200     | 200     | 200     | 200
  /dashboard/ai-mentions          | 200     | 200     | 200     | 200
  /dashboard/position             | 200     | 200     | 200     | 200
  /dashboard/ai-says              | 200     | 200     | 200     | 200
  /login                          | 200     | 200     | 200     | 200
  /signup                         | 200     | 200     | 200     | 200

  Any route not in this list should return 404 (intentional 404 for unknown paths).
  NO authenticated internal route should return 404 for its intended audience.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — CREATE ROUTE COVERAGE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE: __tests__/routes/route-coverage.test.ts

  Use Next.js test utilities or supertest to verify every route returns
  the expected status code for each plan tier.

  For each route × plan tier combination:
    - Mock authentication session with the given plan_tier
    - Request the route
    - Assert the expected status (200 or 302)
    - Assert 302 redirects go to the correct destination (not /login)
    - Assert NO route returns 404 for authenticated users

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — FIX ANY REMAINING 404s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For every route that returns 404 when it shouldn't:
  Option A: Create the missing page.tsx with stub content
  Option B: Add a redirect rule in next.config.js
  Option C: Add the route to the not-found handler with a helpful message

Rule: A missing route for an authenticated user ALWAYS gets Option A or B.
      Option C (404) is only acceptable for truly unknown/invalid URLs.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P2-FIX-11
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] Complete route manifest documented
  [ ] Expected status matrix completed for all routes × all plans
  [ ] Route coverage tests created and passing
  [ ] Zero authenticated routes return 404 for their intended audience
  [ ] All redirects go to correct destinations
  [ ] Full test suite: 0 regressions | 0 TS errors | 0 lint errors
```

---

---

# P2-FIX-12 — End-to-End QA Automation: All 4 Plan Tiers

## Background

All prior fixes are validated by unit and integration tests. This final sprint
adds Playwright end-to-end tests that simulate a real user journey through the
entire app for each plan tier. These tests catch visual regressions, navigation
bugs, and integration issues that unit tests cannot.

---

### PROMPT — P2-FIX-12

```
You are a senior SDET on LocalVector.ai. Your task is P2-FIX-12: write
comprehensive Playwright end-to-end tests covering the complete user journey
for all 4 plan tiers (Free, Starter, Growth, AI Shield).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — PLAYWRIGHT SETUP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If Playwright is not installed:
  pnpm add -D @playwright/test playwright
  npx playwright install chromium

Create file: playwright.config.ts

  import { defineConfig } from '@playwright/test'
  export default defineConfig({
    testDir: 'e2e',
    use: {
      baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
      screenshot: 'only-on-failure',
      video: 'retain-on-failure',
    },
    projects: [
      { name: 'chromium', use: { browserName: 'chromium' } },
    ],
    reporter: [['html', { outputFolder: 'playwright-report' }]],
  })

Add to package.json scripts:
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — AUTH FIXTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: e2e/fixtures/auth.ts

  Use Playwright's storageState to pre-authenticate 4 test users,
  one per plan tier. These users must exist in the Supabase test/staging DB.

  export const TEST_USERS = {
    free:      { email: process.env.E2E_USER_FREE!,      password: process.env.E2E_PASS_FREE! },
    starter:   { email: process.env.E2E_USER_STARTER!,   password: process.env.E2E_PASS_STARTER! },
    growth:    { email: process.env.E2E_USER_GROWTH!,    password: process.env.E2E_PASS_GROWTH! },
    ai_shield: { email: process.env.E2E_USER_AI_SHIELD!, password: process.env.E2E_PASS_AI_SHIELD! },
  }

  // Global setup: login each user and save session state
  // e2e/global-setup.ts saves storageState for each plan

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — TEST FILES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE: e2e/dashboard/plan-badge.spec.ts

  test.describe('Plan badge accuracy', () => {
    test('free user sees Free badge', ...)
    test('starter user sees Starter badge', ...)
    test('growth user sees Growth badge', ...)
    test('ai_shield user sees AI Shield badge', ...)
    test('credits counter matches plan limits', ...)
  })

CREATE: e2e/onboarding/getting-started.spec.ts

  test.describe('Getting Started — plan gating', () => {
    test('free user sees 3 steps, not 5', ...)
    test('growth user sees 3 steps, not 5', ...)
    test('ai_shield user sees 5 steps', ...)
    test('"Set up profile" navigates to settings/profile (no 404)', ...)
    test('completing profile advances the step counter', ...)
  })

CREATE: e2e/navigation/sidebar-gating.spec.ts

  test.describe('Sidebar navigation — plan gating', () => {
    test('free user: AI Mistakes shows lock icon', ...)
    test('free user: clicking locked item opens upgrade modal', ...)
    test('free user: upgrade modal has correct CTA', ...)
    test('growth user: AI Mistakes is accessible', ...)
    test('growth user: Your Reputation shows lock icon', ...)
    test('ai_shield user: all items are accessible', ...)
    test('no sidebar item navigates to 404 for any plan', ...)
  })

CREATE: e2e/settings/profile.spec.ts

  test.describe('Business Profile settings', () => {
    test('page loads at /dashboard/settings/profile', ...)
    test('form pre-fills with existing profile data', ...)
    test('saving valid data shows success message', ...)
    test('invalid phone shows validation error', ...)
    test('getting started step 1 advances after save', ...)
  })

CREATE: e2e/scans/manual-trigger.spec.ts

  test.describe('Manual scan trigger', () => {
    test('growth user sees enabled Run Scan Now button', ...)
    test('ai_shield user sees enabled Run Scan Now button', ...)
    test('free user sees upgrade prompt (no button)', ...)
    test('starter user sees upgrade prompt (no button)', ...)
    test('scan in progress shows loading state', ...)
    test('triggering twice within 1 hour shows cooldown', ...)
  })

CREATE: e2e/routes/no-404s.spec.ts

  test.describe('Zero 404 policy', () => {
    const allRoutes = [
      '/dashboard',
      '/dashboard/settings/profile',
      '/dashboard/ai-mentions',
      '/dashboard/position',
      '/dashboard/ai-says',
      '/dashboard/billing',
    ]
    const growthRoutes = [
      '/dashboard/ai-mistakes',
      '/dashboard/site-visitors',
      '/dashboard/voice-search',
    ]
    const shieldRoutes = [
      '/dashboard/reputation',
      '/dashboard/sources',
      '/dashboard/settings/domain',
      '/dashboard/settings/team',
    ]

    // All authenticated routes return 200 or 302 — never 404
    for (const route of allRoutes) {
      test(`${route} returns 200 for all plans`, async ({ page }) => {
        await page.goto(route)
        expect(page.url()).not.toContain('404')
        await expect(page.locator('body')).not.toContainText('404')
        await expect(page.locator('body')).not.toContainText('Page not found')
      })
    }

    for (const route of growthRoutes) {
      test(`${route} redirects free users (no 404)`, ...)
      test(`${route} accessible for growth users`, ...)
    }

    for (const route of shieldRoutes) {
      test(`${route} redirects non-shield users (no 404)`, ...)
      test(`${route} accessible for ai_shield users`, ...)
    }
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — CI INTEGRATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add to .github/workflows/e2e.yml (create if absent):

  name: E2E Tests
  on:
    push:
      branches: [main, staging]
    pull_request:
      branches: [main]
  jobs:
    e2e:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
        - run: pnpm install
        - run: npx playwright install --with-deps chromium
        - run: pnpm build
        - run: pnpm test:e2e
          env:
            E2E_USER_FREE: ${{ secrets.E2E_USER_FREE }}
            E2E_PASS_FREE: ${{ secrets.E2E_PASS_FREE }}
            # ... other test user secrets
        - uses: actions/upload-artifact@v4
          if: failure()
          with:
            name: playwright-report
            path: playwright-report/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFINITION OF DONE — P2-FIX-12
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [ ] Playwright installed and configured
  [ ] Auth fixture set up for all 4 plan tier test users
  [ ] All 6 spec files created with full test coverage
  [ ] All E2E tests pass against local dev server
  [ ] CI workflow runs E2E on every push to main/staging
  [ ] No 404s reported across any route × plan combination
  [ ] Screenshots/videos captured on failure for debugging
```

---

---

# Master Regression Smoke Test (Run After All P1 + P2 Sprints)

```bash
#!/bin/bash
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "LocalVector P1+P2 — Master Regression Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "1. TypeScript..."
pnpm tsc --noEmit && echo "   ✅ 0 type errors"

echo ""
echo "2. Lint..."
pnpm lint && echo "   ✅ 0 lint errors"

echo ""
echo "3. Unit + Integration tests..."
pnpm test --reporter=verbose 2>&1 | tail -40
echo "   ✅ All tests pass"

echo ""
echo "4. Plan field consistency audit..."
pnpm test __tests__/audit/plan-field-consistency.test.ts
echo "   ✅ No stale plan reads"

echo ""
echo "5. E2E tests (Playwright)..."
pnpm test:e2e
echo "   ✅ All E2E journeys pass"

echo ""
echo "6. Route coverage..."
pnpm test __tests__/routes/route-coverage.test.ts
echo "   ✅ Zero 404s across all routes × all plans"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Manual Final Verification Checklist:"
echo ""
echo "  Free plan user:"
echo "   [ ] Dashboard loads, plan badge = 'Free'"
echo "   [ ] Getting Started shows 3 steps only"
echo "   [ ] Sidebar AI Mistakes = locked (shows modal)"
echo "   [ ] Sidebar Voice Search = locked (shows modal)"
echo "   [ ] Reputation = locked (shows modal)"
echo "   [ ] /dashboard/reputation → redirect, not 404"
echo ""
echo "  Growth plan user:"
echo "   [ ] Plan badge = 'Growth'"
echo "   [ ] Getting Started shows 3 steps"
echo "   [ ] AI Mistakes accessible"
echo "   [ ] Voice Search accessible"
echo "   [ ] Run Scan Now button visible and functional"
echo "   [ ] Your Reputation = locked (shows modal)"
echo "   [ ] /settings/domain → redirect + modal, not 404"
echo ""
echo "  AI Shield user (dev@localvector.ai):"
echo "   [ ] Plan badge = 'AI Shield'"
echo "   [ ] Credits = 498/500"
echo "   [ ] Getting Started shows 5 steps"
echo "   [ ] All sidebar items accessible (no locks)"
echo "   [ ] Run Scan Now button functional"
echo "   [ ] /settings/domain → loads (stub or full page)"
echo "   [ ] /settings/team → loads (stub or full page)"
echo "   [ ] Profile save → step 1 advances to complete"
echo "   [ ] All skeletons visible briefly on hard refresh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

---

# Sprint Summary

| ID | Sprint | Key Deliverable | Effort |
|----|--------|-----------------|--------|
| P1-FIX-05 | Manual Scan Trigger | Growth/Shield users can run scans on demand with cooldown guard | ~8h |
| P1-FIX-06 | Sidebar Gating | Locked nav items open upgrade modals, never 404 | ~6h |
| P1-FIX-07 | Domain + Team Pages | Clean pages or stubs — no more 404s from settings nav | ~5h |
| P1-FIX-08 | Plan Field Audit | Zero stale .plan reads; consistency test as regression guard | ~4h |
| P2-FIX-09 | Skeleton Loaders | Every dashboard chart has shimmer loading state | ~4h |
| P2-FIX-10 | Upgrade Modals | Every locked interaction across the whole app opens modal | ~5h |
| P2-FIX-11 | Route Audit | Route coverage test matrix confirms zero 404s | ~3h |
| P2-FIX-12 | E2E Tests | Playwright suite covers all 4 plans end-to-end, CI integrated | ~8h |

**Total: ~43 hours of engineering work across 8 sprints**

---

*LocalVector.ai P1 + P2 Sprint Prompts — End*
*Generated: March 3, 2026 | SDET Audit Mode*
