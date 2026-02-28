# Sprint K — Infrastructure & Trust: Listings Honesty, Sentry Sweep, Sidebar Grouping & Quick Wins

> **Claude Code Prompt — Bulletproof Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`
> **Prerequisites:** Sprints A–J must be fully merged and all tests passing. Sprint K is infrastructure — no new DB tables beyond what's noted, no new feature pages. Most of this sprint is fixing things that are quietly broken.

---

## 🎯 Objective

Sprint K fixes four categories of quiet breakage that have been accumulating since the code analysis. The word "quiet" is deliberate: these are not bugs that crash the app or show error screens. They're bugs that look fine on the surface and are broken underneath — a listing platform that shows "Synced" when nothing actually synced, a Sentry integration that's wired but completely silent, a sidebar that requires scrolling past 22 undifferentiated items before finding anything, a weekly email that sends to new users with a blank score. None of these crash the app. All of them erode trust.

**The four areas and the specific work:**

1. **C2 — Listings Honesty (Primary, new work):** Five of the six listing platforms in the Integrations page are mocked — clicking "Sync" runs a `setTimeout(2000)` and then sets status to `'connected'`. Paying customers see "Synced ✓" on Yelp, TripAdvisor, Bing Places, Apple Business Connect, and Foursquare. None of them are actually synced. Only GBP (Google Business Profile) is real. This sprint does two things: (a) honestly labels the five mock platforms as "Manual tracking — automated sync in progress" and (b) replaces the fake sync flow with a real manual URL-entry workflow so customers can at least track these platforms accurately, even without automated sync.

2. **C1 gap-fill (verification + completion):** Sprint A specified a full sweep of all 42 bare `catch {}` blocks and wiring of Sentry. That spec was correct. Sprint K verifies it was done completely by running a fresh grep. For any remaining bare catches found, this sprint finishes the job. The target is zero bare `catch {` patterns in `app/` and `lib/`. This is not a repeat of Sprint A's work — it's an audit that ensures Sprint A's work was complete.

3. **H4 gap-fill (verification + completion):** Sprint A also specified sidebar NAV_GROUPS with section headers. Sprint K verifies it was done. If the sidebar still has a flat 22-item list, Sprint K implements the grouping now. If it was done in Sprint A, Sprint K verifies the group labels and item assignments match the code analysis recommendation and makes minor corrections if needed.

4. **Quick wins — H6 and L2:** Two small but real bugs. H6: `monthlyCostPerSeat: null` is a `TODO` comment in production code served to Agency billing customers — it makes their per-seat cost invisible. L2: the weekly digest cron sends emails to new users whose first scan hasn't run yet — those users receive "Your Reality Score this week: —" which is a bad first impression from a paid product.

**Why this sprint now:** Sprints G–J transformed the product's UX. Sprint K ensures the product is also honest and observable. A beautiful product that silently lies about listing sync status, sends blank emails to new users, and swallows production errors is not a product customers renew. Trust and observability are the foundation everything else stands on.

**Estimated total implementation time:** 12–16 hours. C2 (Listings Honesty) is the heaviest at 6–8 hours because it requires new UI (manual URL entry workflow) and honest copy. The gap-fills for C1 and H4 should be 1–2 hours each if Sprint A was mostly done. H6 and L2 are 30–60 minutes each.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                                       — Rules 42–67 from Sprints A–J
Read CLAUDE.md                                              — Full Sprint A–J implementation inventory
Read MEMORY.md                                              — All architecture decisions through Sprint J

--- C1: Sentry sweep verification ---
Read sentry.client.config.ts                                — Confirm DSN, tunnel route, Sentry version
Read sentry.server.config.ts                                — Server-side config
Read sentry.edge.config.ts                                  — Edge config
# Then run this command to find remaining bare catches:
$ grep -rn "} catch {" app/ lib/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".test." | grep -v ".spec."
# Document every file:line in the DEVLOG. These are the gaps Sprint K fills.

--- H4: Sidebar verification ---
Read components/layout/Sidebar.tsx                          — COMPLETE FILE. Is NAV_GROUPS already there?
                                                              Are section header labels visible in the UI?
                                                              Are the 22 items distributed across groups?
# If NAV_GROUPS exists and groups have labels → verify the grouping matches the spec; done
# If still a flat array → implement grouping now (spec below)

--- C2: Listings honest labeling ---
Read app/dashboard/integrations/page.tsx                    — COMPLETE FILE. Current page layout
Read app/dashboard/integrations/                            — ls; read every component
Read app/dashboard/integrations/actions.ts                  — COMPLETE FILE. Find the mock setTimeout.
                                                              Lines 94–160. Understand toggleIntegration().
Read app/dashboard/integrations/_components/PlatformRow.tsx — COMPLETE FILE. Current sync button,
                                                              status display, how 'connected' state renders
Read supabase/prod_schema.sql                               — integrations or platform_listings table:
                                                              ALL columns. What does an integration row look
                                                              like? Does it store a URL? A status enum?
Read lib/supabase/database.types.ts                         — TypeScript types for integration rows
Read src/__fixtures__/golden-tenant.ts                      — Integration fixture data shape
# Then answer: which platforms exist in the DB? What status values are used?

--- H6: monthlyCostPerSeat ---
Read app/actions/seat-actions.ts                            — COMPLETE FILE. Find line ~190: the null TODO.
                                                              Understand the full action's return shape.
Read app/dashboard/billing/page.tsx                         — How SeatManagementCard receives this data.
                                                              How is monthlyCostPerSeat displayed?
Read lib/stripe.ts (or equivalent)                          — How Stripe is imported. Is there a helper
                                                              to fetch price data?
# Stripe Price IDs are likely in env vars — grep for STRIPE_PRICE in .env.example or similar

--- L2: Weekly digest guard ---
Read app/api/cron/weekly-digest/route.ts                    — COMPLETE FILE. Line 86: the bare catch.
                                                              How orgs are fetched. How the digest is sent.
Read lib/services/weekly-digest.service.ts                  — COMPLETE FILE. What data does the service
                                                              need? Does it already handle null scores?
Read supabase/prod_schema.sql                               — Find the scores or reality_scores table.
                                                              What column indicates "has had a scan"?
```

**Before writing any code, answer these questions from the files:**

For **C2**: What is the exact shape of a `connected` integration row in the DB? Does it store a URL, a last-synced timestamp, or just a status string? The manual URL-entry workflow needs to store something meaningful. If the table only has a `status` column with no `url` column, you need to know before designing the form.

For **H6**: What Stripe Price ID env var is available for Agency per-seat pricing? It may be `NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID`, `STRIPE_AGENCY_PRICE_ID`, or similar. Check `.env.example`. If no Agency price ID is configured, the fix is different (see Edge Cases).

For **L2**: What column on the scores/org table indicates "at least one scan has been completed"? It may be `reality_score IS NOT NULL`, or a `first_scan_completed_at` column, or `scan_count > 0`. This is the guard condition.

---

## 🏗️ Architecture — What to Build

---

### Fix 1: C2 — Listings Honesty (Primary new work, 6–8 hours)

**The problem:** Five of six listing platforms are mocked. The mock runs `setTimeout(2000)` then sets status `'connected'`. Paying customers see green checkmarks on platforms that have never actually synced.

**The fix has two parts:**
- **Part A — Honest status:** Replace "Synced" with "Manual tracking" for non-GBP platforms. Remove the fake sync button. Show clearly that automated sync for these platforms is not yet available.
- **Part B — Useful replacement:** Give users something real to do — a URL entry field where they can paste their Yelp/TripAdvisor/etc. business page URL. LocalVector can then link to it, track it, and (in a future sprint) scrape it for accuracy data. This replaces a useless fake sync button with a genuinely useful data-collection flow.

#### Step 1: Understand the mock and the DB schema

Read `app/dashboard/integrations/actions.ts` lines 94–160. Find:
- The `setTimeout(2000)` mock
- The `toggleIntegration` server action
- What it writes to the DB after the fake sync

Read `prod_schema.sql` to find the integrations table. Look for columns: `status`, `url`, `platform`, `last_synced_at`, `org_id`.

**If the table has a `url` column:** Part B (URL entry) can store the URL directly. No migration needed.

**If the table has NO `url` column:** Add a migration:
```sql
-- Sprint K: Add url column to integrations for manual tracking
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS manual_url text;

COMMENT ON COLUMN public.integrations.manual_url IS
  'User-entered business page URL for manual tracking. Sprint K.
   Populated when automated sync is not available for a platform.';
```

Run the migration only if the column doesn't exist. Verify first.

#### Step 2: Define which platforms are real vs. mock

```typescript
// lib/integrations/platform-config.ts
// (Create this file if it doesn't exist; or add to existing platform config)

export type PlatformId =
  | 'google_business_profile'
  | 'yelp'
  | 'tripadvisor'
  | 'bing_places'
  | 'apple_business_connect'
  | 'foursquare';

export interface PlatformConfig {
  id: PlatformId;
  displayName: string;
  /** True = real OAuth + API sync available. False = manual tracking only. */
  hasAutomatedSync: boolean;
  /** Used for the manual URL placeholder */
  exampleUrl?: string;
  /** Link to the platform's business management page (for manual tracking) */
  claimUrl?: string;
  /** Favicon/logo URL for display */
  iconUrl?: string;
}

export const PLATFORM_CONFIG: Record<PlatformId, PlatformConfig> = {
  google_business_profile: {
    id: 'google_business_profile',
    displayName: 'Google Business Profile',
    hasAutomatedSync: true,
    exampleUrl: 'https://business.google.com/dashboard/...',
    claimUrl: 'https://business.google.com',
  },
  yelp: {
    id: 'yelp',
    displayName: 'Yelp',
    hasAutomatedSync: false,
    exampleUrl: 'https://www.yelp.com/biz/your-business-name',
    claimUrl: 'https://biz.yelp.com',
  },
  tripadvisor: {
    id: 'tripadvisor',
    displayName: 'TripAdvisor',
    hasAutomatedSync: false,
    exampleUrl: 'https://www.tripadvisor.com/Restaurant_Review-...',
    claimUrl: 'https://www.tripadvisor.com/Owners',
  },
  bing_places: {
    id: 'bing_places',
    displayName: 'Bing Places',
    hasAutomatedSync: false,
    exampleUrl: 'https://www.bingplaces.com/...',
    claimUrl: 'https://www.bingplaces.com',
  },
  apple_business_connect: {
    id: 'apple_business_connect',
    displayName: 'Apple Business Connect',
    hasAutomatedSync: false,
    exampleUrl: 'https://businessconnect.apple.com/...',
    claimUrl: 'https://businessconnect.apple.com',
  },
  foursquare: {
    id: 'foursquare',
    displayName: 'Foursquare',
    hasAutomatedSync: false,
    exampleUrl: 'https://foursquare.com/v/your-venue/...',
    claimUrl: 'https://business.foursquare.com',
  },
};

// Adapt PlatformId values to match actual platform identifiers in the DB
// (check the integrations table's 'platform' column enum/values)
```

#### Step 3: Update `app/dashboard/integrations/actions.ts`

**Remove the mock sync entirely for non-GBP platforms.** Add a real `saveManualUrl` server action.

```typescript
// In app/dashboard/integrations/actions.ts:

'use server';

import * as Sentry from '@sentry/nextjs';
import { PLATFORM_CONFIG } from '@/lib/integrations/platform-config';
// ... existing imports

/**
 * Save a manually entered business page URL for a non-automated platform.
 * Replaces the fake setTimeout sync for Yelp/TripAdvisor/etc.
 */
export async function saveManualUrl(
  platformId: string,
  url: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { data: org } = await supabase
      .from('orgs')
      .select('id')
      .eq('owner_id', user.id)
      .single();
    if (!org) return { success: false, error: 'Org not found' };

    // Validate URL — must be a real URL, not empty, not a malicious string
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return { success: false, error: 'URL must start with https://' };
      }
    } catch {
      return { success: false, error: 'Please enter a valid URL' };
    }

    // Upsert the integration row with the manual URL
    // Adapt table name and column names to prod_schema.sql:
    const { error } = await supabase
      .from('integrations')
      .upsert({
        org_id: org.id,
        platform: platformId,
        manual_url: parsedUrl.href,
        status: 'manual',       // New status value — see Edge Cases below
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'org_id,platform',
      });

    if (error) {
      Sentry.captureException(error, {
        tags: { action: 'saveManualUrl', platform: platformId },
      });
      return { success: false, error: 'Failed to save — please try again' };
    }

    return { success: true };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: 'saveManualUrl', sprint: 'K' },
    });
    return { success: false, error: 'Unexpected error — please try again' };
  }
}

/**
 * The old toggleIntegration / syncPlatform action.
 * For GBP: unchanged (real OAuth flow).
 * For non-GBP platforms: REMOVE the fake setTimeout. Return an error
 * explaining that automated sync isn't available yet.
 *
 * This function may be used by existing GBP connect flow — do NOT remove it,
 * only remove the mock paths for non-GBP platforms.
 */
export async function syncPlatform(platformId: string) {
  const config = PLATFORM_CONFIG[platformId as keyof typeof PLATFORM_CONFIG];

  if (config && !config.hasAutomatedSync) {
    // This code path should never be called from the UI after Sprint K
    // (the UI no longer shows a sync button for manual-only platforms)
    // Return a no-op to prevent errors if called from old cached UI
    return { success: false, error: 'Automated sync not available for this platform' };
  }

  // GBP and other automated platforms: existing logic unchanged below
  // ... (keep existing GBP sync code exactly as-is)
}
```

#### Step 4: Redesign `PlatformRow` for honest status

Read `PlatformRow.tsx` fully before modifying. The redesign replaces the fake sync button for non-GBP platforms with: (a) a status badge ("Manual tracking"), (b) a URL entry field, and (c) a link to the platform's business management page.

```tsx
// app/dashboard/integrations/_components/PlatformRow.tsx
// MODIFY: Add manual tracking UI for non-automated platforms

'use client';

import { useState, useTransition } from 'react';
import { PLATFORM_CONFIG, type PlatformId } from '@/lib/integrations/platform-config';
import { saveManualUrl } from '../actions';
import { ExternalLink, CheckCircle2, AlertCircle, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlatformRowProps {
  platformId: PlatformId;
  status: string | null;
  manualUrl?: string | null;    // URL stored from previous manual save
  lastSyncedAt?: string | null; // For GBP
  isConnected?: boolean;        // For GBP — from real OAuth state
}

export function PlatformRow({
  platformId,
  status,
  manualUrl,
  lastSyncedAt,
  isConnected,
}: PlatformRowProps) {
  const config = PLATFORM_CONFIG[platformId];
  if (!config) return null;

  // GBP: real connected state from OAuth
  if (config.hasAutomatedSync) {
    return <GBPPlatformRow
      config={config}
      isConnected={isConnected ?? false}
      lastSyncedAt={lastSyncedAt}
    />;
  }

  // Non-GBP: manual tracking UI
  return <ManualTrackingRow
    config={config}
    currentUrl={manualUrl}
  />;
}

// ── GBP Row (real OAuth) ─────────────────────────────────────────────────────
function GBPPlatformRow({
  config,
  isConnected,
  lastSyncedAt,
}: {
  config: typeof PLATFORM_CONFIG[PlatformId];
  isConnected: boolean;
  lastSyncedAt?: string | null;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3"
      data-testid={`platform-row-${config.id}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground">{config.displayName}</span>
        {isConnected ? (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Connected
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Not connected</span>
        )}
      </div>
      {/* GBP connect/sync button — unchanged from pre-Sprint-K */}
      {/* Keep existing GBP connect flow exactly as-is */}
      {isConnected && lastSyncedAt && (
        <span className="text-xs text-muted-foreground">
          Last synced {new Date(lastSyncedAt).toLocaleDateString()}
        </span>
      )}
    </div>
  );
}

// ── Manual Tracking Row (non-automated platforms) ───────────────────────────
function ManualTrackingRow({
  config,
  currentUrl,
}: {
  config: typeof PLATFORM_CONFIG[PlatformId];
  currentUrl?: string | null;
}) {
  const [urlInput, setUrlInput] = useState(currentUrl ?? '');
  const [showForm, setShowForm] = useState(false);
  const [saved, setSaved] = useState(!!currentUrl);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await saveManualUrl(config.id, urlInput.trim());
      if (result.success) {
        setSaved(true);
        setShowForm(false);
      } else {
        setError(result.error ?? 'Failed to save');
      }
    });
  }

  return (
    <div
      className="rounded-lg border border-border bg-card px-4 py-3 space-y-3"
      data-testid={`platform-row-${config.id}`}
    >
      {/* Platform header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-medium text-foreground">{config.displayName}</span>
          {saved ? (
            <span className="flex items-center gap-1 text-xs font-medium text-blue-600">
              <LinkIcon className="h-3.5 w-3.5" />
              Tracking
            </span>
          ) : (
            <span
              className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              data-testid={`platform-manual-badge-${config.id}`}
            >
              Manual tracking
            </span>
          )}
        </div>

        {/* Right side: link to platform + action */}
        <div className="flex items-center gap-2 shrink-0">
          {config.claimUrl && (
            <a
              href={config.claimUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              data-testid={`platform-claim-link-${config.id}`}
            >
              Open {config.displayName}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button
            type="button"
            onClick={() => setShowForm(prev => !prev)}
            className="text-xs text-primary underline hover:text-primary/80"
            data-testid={`platform-add-url-${config.id}`}
          >
            {saved ? 'Edit URL' : 'Add your listing URL'}
          </button>
        </div>
      </div>

      {/* Disclosure: why no auto-sync */}
      {!saved && !showForm && (
        <p className="text-xs text-muted-foreground">
          Automated sync for {config.displayName} is coming soon. In the meantime, add your listing URL
          so LocalVector can track it.
        </p>
      )}

      {/* Saved URL display */}
      {saved && !showForm && urlInput && (
        <p className="truncate text-xs text-muted-foreground" data-testid={`platform-saved-url-${config.id}`}>
          {urlInput}
        </p>
      )}

      {/* URL entry form */}
      {showForm && (
        <div className="space-y-2" data-testid={`platform-url-form-${config.id}`}>
          <label className="block text-xs font-medium text-foreground">
            Your {config.displayName} listing URL
          </label>
          <input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder={config.exampleUrl}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid={`platform-url-input-${config.id}`}
          />
          {error && (
            <p className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || !urlInput.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              data-testid={`platform-save-url-${config.id}`}
            >
              {isPending ? 'Saving…' : 'Save URL'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(null); }}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

#### Step 5: Update the integrations page header copy

In `app/dashboard/integrations/page.tsx`, update the page description to be honest about the current state:

```tsx
// Find and update the page header description (adapt to actual JSX):
<div>
  <h1 className="text-lg font-semibold text-foreground">Listings & Integrations</h1>
  <p className="mt-0.5 text-sm text-muted-foreground">
    Connect your business listings so LocalVector can monitor what each platform tells AI models.
    Google Business Profile syncs automatically. Add your URLs for other platforms to start tracking them.
  </p>
</div>
```

---

### Fix 2: C1 Gap-Fill — Complete the Sentry Sweep

Sprint A specified this fix in full. Sprint K verifies and completes it.

#### Step 1: Run the grep — document what remains

```bash
grep -rn "} catch {" app/ lib/ --include="*.ts" --include="*.tsx" \
  | grep -v node_modules | grep -v ".test." | grep -v ".spec."
```

If this returns 0 results: **Sprint A completed the sweep. Document in DEVLOG and move on.**

If it returns results: those are the gaps. For each result, apply the Sprint A pattern:

```typescript
// BEFORE:
} catch {
  // some comment or nothing
}

// AFTER:
} catch (err) {
  Sentry.captureException(err, {
    tags: {
      file: 'relative/path/to/file.tsx',
      component: 'ComponentName',   // or action name
      sprint: 'K',
    },
  });
  // Keep any existing non-critical comment/behavior
}
```

**Rules for the gap-fill (same as Sprint A):**
- `import * as Sentry from '@sentry/nextjs'` — use the exact import pattern already used in the file (or this pattern if no Sentry import exists yet)
- Non-critical catches (dashboard card data, optional features): add Sentry + set a degraded-state boolean if the component renders blank
- Critical catches (auth, cron, payment): add Sentry + return/throw an error — do not silently continue
- Document each fix in the DEVLOG: `file:line — catch type — fix applied`

**Do NOT over-fix:** The goal is `} catch (err) {` + `Sentry.captureException(err)`. Don't restructure error handling patterns beyond adding the exception capture. Sprint A's approach was correct; just complete it.

---

### Fix 3: H4 Gap-Fill — Sidebar Section Headers

Sprint A specified this fix. Sprint K verifies it's done.

#### Step 1: Verify

Open `components/layout/Sidebar.tsx`. Look for:
- A `NAV_GROUPS` variable (an array of `{ label: string; items: NavItem[] }`)
- Section header labels rendered as `<p className="...text-muted-foreground/60 uppercase tracking-widest...">` or similar
- The six group labels: **Monitor**, **Optimize**, **Create**, **Manage**, **Intelligence**, **Account**

**If NAV_GROUPS exists with group headers:** Sprint A completed this. Verify the grouping matches the spec (below) and make minor corrections if items are in wrong groups. Skip Step 2.

**If the sidebar is still a flat array:** Implement now.

#### Step 2: Implement (only if not already done)

```typescript
// In components/layout/Sidebar.tsx
// Convert NAV_ITEMS flat array to NAV_GROUPS

// Read the actual NAV_ITEMS content FIRST — adapt the items array below:
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Monitor',
    items: [
      // Dashboard — always first
      // Alerts
      // AI Says (ai-responses)
    ],
  },
  {
    label: 'Optimize',
    items: [
      // Share of Voice
      // Cluster Map
      // Compete
      // Citations
      // Page Audits
    ],
  },
  {
    label: 'Create',
    items: [
      // Content
      // Content Calendar
      // Magic Menu / Magic Services (dynamic label from Sprint E)
    ],
  },
  {
    label: 'Manage',
    items: [
      // Listings
      // Revenue Impact
      // AI Assistant
    ],
  },
  {
    label: 'Intelligence',
    items: [
      // Bot Activity
      // Proof Timeline
      // Entity Health
      // Agent Readiness
      // AI Sentiment
      // Source Intelligence (AI Sources)
    ],
  },
  {
    label: 'Account',
    items: [
      // System Health
      // Settings
      // Billing
    ],
  },
];
```

```tsx
// Render NAV_GROUPS in the sidebar JSX:
{NAV_GROUPS.map(group => (
  <div key={group.label} className="mb-4">
    <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
      {group.label}
    </p>
    {group.items.map(item => (
      // Existing NavItem render — unchanged
      <NavItem key={item.href} item={item} />
    ))}
  </div>
))}
```

**Important:** The exact items in each group must come from the actual `NAV_ITEMS` array. Read the file first. Do not guess item names or hrefs. The grouping above is the target structure — the actual item objects come from whatever is already in the sidebar.

**Preserve:**
- Existing `NavItem` component render logic (active state, icons, plan gating)
- Sprint E's dynamic Magic Menu icon (Utensils vs. Stethoscope based on industry)
- Mobile sidebar behavior if any
- Plan-gated items (items hidden on Starter plan, etc.)

---

### Fix 4: H6 — `monthlyCostPerSeat: null` → Real Stripe Price

**The problem:** `app/actions/seat-actions.ts` line ~190 has:
```typescript
monthlyCostPerSeat: null, // TODO: fetch from Stripe price when Agency pricing is configured
```

This is served to the billing page's `SeatManagementCard`. Agency customers cannot see their per-seat cost.

#### Step 1: Find the Stripe Price ID

```bash
grep -rn "STRIPE_PRICE\|PRICE_ID\|agency.*price\|price.*agency" .env.example .env.local lib/stripe* | head -20
```

**Case A — A Stripe Agency Price ID env var exists (e.g., `STRIPE_AGENCY_PRICE_ID`):**

```typescript
// In app/actions/seat-actions.ts, replace the null TODO:

import Stripe from 'stripe';
import { stripe } from '@/lib/stripe'; // Use existing Stripe client

// Replace:
// monthlyCostPerSeat: null,

// With:
let monthlyCostPerSeat: number | null = null;
const agencyPriceId = process.env.STRIPE_AGENCY_PRICE_ID;
if (agencyPriceId) {
  try {
    const price = await stripe.prices.retrieve(agencyPriceId);
    // unit_amount is in cents — convert to dollars
    monthlyCostPerSeat = price.unit_amount ? price.unit_amount / 100 : null;
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'seat-actions', field: 'monthlyCostPerSeat' } });
    // Non-critical: UI falls back to "Contact sales" if null
  }
}
// Then: monthlyCostPerSeat (now a number or null)
```

**Case B — No Stripe Agency Price ID env var exists:**

The fix is in the UI: instead of showing nothing (or "$null"), the `SeatManagementCard` should show "Contact sales for pricing" when `monthlyCostPerSeat` is null. This prevents an ugly blank but doesn't require a Stripe API call.

Read `app/dashboard/billing/page.tsx` to find where `monthlyCostPerSeat` is rendered. Update the null state:

```tsx
// In SeatManagementCard or the billing page (adapt to actual JSX):
{monthlyCostPerSeat !== null ? (
  <span>${monthlyCostPerSeat}/seat/month</span>
) : (
  <span className="text-muted-foreground text-sm">
    Contact us for per-seat pricing
  </span>
)}
```

Document in DEVLOG which case applied.

---

### Fix 5: L2 — Weekly Digest Guard for No-Scan Orgs

**The problem:** The weekly digest cron runs for all orgs. New users whose first scan hasn't completed yet receive an email with a blank Reality Score — "Your Reality Score this week: —". This is a bad first impression from a paid product.

#### Step 1: Read the cron route and service

Read `app/api/cron/weekly-digest/route.ts` fully. Understand:
- How orgs are fetched (likely `SELECT * FROM orgs WHERE notifications_enabled = true`)
- Where score data is attached to each org
- Line 86: the bare catch

Read `lib/services/weekly-digest.service.ts`. Understand:
- What happens when `realityScore` is null
- Does the email template gracefully handle null scores, or does it show a dash?

#### Step 2: Add the guard

```typescript
// In app/api/cron/weekly-digest/route.ts
// Find where orgs are fetched and scores attached

// Add guard — skip orgs with no scan data:
const orgsWithData = allOrgs.filter(org => {
  // Adapt to the actual column/query that indicates a scan has run:
  // Option A: reality_score is not null
  return org.reality_score !== null;
  // Option B: first_scan_completed_at is not null
  // return org.first_scan_completed_at !== null;
  // Option C: scan_count > 0
  // return (org.scan_count ?? 0) > 0;
});

// Send digest only to orgs with data:
for (const org of orgsWithData) {
  // existing digest send logic
}

// Log the skip count (Sentry breadcrumb, not exception):
if (allOrgs.length > orgsWithData.length) {
  Sentry.addBreadcrumb({
    message: `Weekly digest: skipped ${allOrgs.length - orgsWithData.length} orgs with no scan data`,
    level: 'info',
    data: { totalOrgs: allOrgs.length, sentToOrgs: orgsWithData.length },
  });
}
```

#### Step 3: Fix the bare catch at line 86

While in the file, fix the bare catch:

```typescript
// Line 86 — BEFORE:
} catch {
  // some comment
}

// AFTER:
} catch (err) {
  Sentry.captureException(err, {
    tags: { cron: 'weekly-digest', sprint: 'K' },
  });
}
```

---

## 🧪 Testing

### Test File 1: `src/__tests__/unit/integrations-listings.test.tsx` — 18 tests

```
describe('PLATFORM_CONFIG')
  1.  google_business_profile has hasAutomatedSync: true
  2.  yelp has hasAutomatedSync: false
  3.  tripadvisor has hasAutomatedSync: false
  4.  bing_places has hasAutomatedSync: false
  5.  apple_business_connect has hasAutomatedSync: false
  6.  All non-GBP platforms have claimUrl and exampleUrl

describe('ManualTrackingRow / PlatformRow for non-automated platforms')
  7.  Renders "Manual tracking" badge when no URL saved
  8.  No fake sync button present for non-GBP platforms
  9.  "Add your listing URL" button visible
  10. Click "Add your listing URL": URL form appears
  11. URL form has input and "Save URL" button
  12. Empty input: "Save URL" button is disabled
  13. After successful save: form closes, URL displayed, badge changes to "Tracking"
  14. Invalid URL: error message shown below input
  15. data-testid="platform-manual-badge-{id}" present when no URL saved
  16. data-testid="platform-url-form-{id}" visible when form is open

describe('saveManualUrl action')
  17. Valid https:// URL: returns { success: true }
  18. Non-https URL (e.g., "javascript:..."): returns { success: false, error: 'URL must start with https://' }
  19. Empty URL: returns error
  20. Sentry.captureException called when Supabase write fails
```

**Target: 20 tests**

### Test File 2: `src/__tests__/unit/sentry-sweep-verification.test.ts` — functional grep test

This test is unusual — it's a code-quality test that runs a grep to verify zero bare catches remain:

```typescript
// src/__tests__/unit/sentry-sweep-verification.test.ts
import { execSync } from 'child_process';

describe('C1 — Sentry coverage: zero bare catch {} blocks')

test('no bare } catch { in app/ directory', () => {
  const result = execSync(
    'grep -rn "} catch {" app/ --include="*.ts" --include="*.tsx" | grep -v ".test." | grep -v ".spec." || true',
    { encoding: 'utf-8', cwd: process.cwd() }
  );
  const lines = result.trim().split('\n').filter(Boolean);
  expect(lines).toHaveLength(0);
  // If this fails, it will print the files:lines that still have bare catches
});

test('no bare } catch { in lib/ directory', () => {
  const result = execSync(
    'grep -rn "} catch {" lib/ --include="*.ts" --include="*.tsx" | grep -v ".test." | grep -v ".spec." || true',
    { encoding: 'utf-8', cwd: process.cwd() }
  );
  const lines = result.trim().split('\n').filter(Boolean);
  expect(lines).toHaveLength(0);
});
```

**Target: 2 tests** (these will fail until every bare catch is fixed, then pass permanently)

### Test File 3: `src/__tests__/unit/sidebar-nav-groups.test.tsx` — 7 tests

(Same as Sprint A spec — verify these are passing if H4 was already done)

```
describe('H4 — Sidebar NAV_GROUPS structure')
  1.  NAV_GROUPS is an array with 4–6 groups
  2.  Every group has a non-empty string label
  3.  Every group has at least 1 item
  4.  Total item count across all groups equals the full nav item count (no items lost)
  5.  No item appears in more than one group
  6.  Every item has a valid href (starts with '/')
  7.  Group labels include 'Monitor', 'Optimize', 'Create', 'Manage', 'Intelligence', 'Account'
     (or equivalent grouping labels)
```

**Target: 7 tests** (if already passing from Sprint A, no new work needed — just confirm)

### Test File 4: `src/__tests__/unit/weekly-digest-guard.test.ts` — 8 tests

```
describe('L2 — Weekly digest guard')
  1.  orgs with null reality_score are filtered out of the digest send list
  2.  orgs with non-null reality_score are included
  3.  digest route handles all-empty org list (no errors, no sends)
  4.  Sentry.addBreadcrumb called when some orgs are skipped
  5.  Skipped count in breadcrumb data equals (totalOrgs - sentToOrgs)
  6.  The bare catch at original line 86 now calls Sentry.captureException
  7.  digest sends correctly to org with valid score data
  8.  digest skips org with score=null even if notifications_enabled=true
```

**Target: 8 tests**

### E2E Test File: `src/__tests__/e2e/sprint-k-smoke.spec.ts` — 15 tests

```
describe('Sprint K — Infrastructure & Trust E2E')

  Listings Honesty (C2):
  1.  /dashboard/integrations: page loads without error
  2.  google_business_profile row: no "Manual tracking" badge (it's real)
  3.  yelp row: "Manual tracking" badge visible, data-testid="platform-manual-badge-yelp"
  4.  tripadvisor row: "Manual tracking" badge visible
  5.  No platform row has a "Sync" button that runs a fake timeout
  6.  yelp row: "Add your listing URL" button present
  7.  Click "Add your listing URL" on yelp: URL form appears
  8.  Enter valid Yelp URL and click Save: form closes, "Tracking" label appears

  Sidebar (H4):
  9.  /dashboard: sidebar has at least 4 group label elements
  10. Group label "Monitor" is visible in sidebar
  11. Group label "Intelligence" is visible in sidebar
  12. All 22 nav items still present (no items removed from nav)

  C1 (Sentry):
  13. /dashboard: page loads and all cards render (no blank cards from swallowed errors)
  14. Trigger AddCompetitorForm with network mocked to fail: error UI shown (not blank)
  15. ViralScanner with Places API mocked to fail: error state visible (not blank)
```

### Run commands

```bash
npx vitest run src/__tests__/unit/integrations-listings.test.tsx
npx vitest run src/__tests__/unit/sentry-sweep-verification.test.ts
npx vitest run src/__tests__/unit/sidebar-nav-groups.test.tsx
npx vitest run src/__tests__/unit/weekly-digest-guard.test.ts
npx vitest run                                                      # ALL Sprints A–K — 0 regressions
npx playwright test src/__tests__/e2e/sprint-k-smoke.spec.ts
npx tsc --noEmit                                                    # 0 new type errors
```

---

## 📂 Files to Create / Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/integrations/platform-config.ts` | **CREATE** | `PLATFORM_CONFIG` — which platforms have real sync vs. manual tracking |
| 2 | `app/dashboard/integrations/actions.ts` | **MODIFY** | Remove fake setTimeout; add `saveManualUrl` server action |
| 3 | `app/dashboard/integrations/_components/PlatformRow.tsx` | **MODIFY** | Honest status for non-GBP; `ManualTrackingRow` with URL entry form |
| 4 | `app/dashboard/integrations/page.tsx` | **MODIFY** | Update page description copy; pass `manualUrl` to PlatformRow |
| 5 | `app/actions/seat-actions.ts` | **MODIFY** | Fix `monthlyCostPerSeat: null` TODO |
| 6 | `app/api/cron/weekly-digest/route.ts` | **MODIFY** | Add no-scan guard; fix bare catch at line 86 |
| 7 | `components/layout/Sidebar.tsx` | **MODIFY (if needed)** | NAV_GROUPS with 6 section headers (skip if Sprint A already did this) |
| 8 | `All bare-catch files` | **MODIFY (if needed)** | Add `catch (err)` + `Sentry.captureException(err)` (skip if Sprint A already did this) |
| 9 | `supabase/migrations/YYYYMMDD_add_manual_url_to_integrations.sql` | **CREATE (if needed)** | Add `manual_url` column to integrations if not present |
| 10 | `src/__tests__/unit/integrations-listings.test.tsx` | **CREATE** | 20 tests |
| 11 | `src/__tests__/unit/sentry-sweep-verification.test.ts` | **CREATE** | 2 grep-based tests |
| 12 | `src/__tests__/unit/sidebar-nav-groups.test.tsx` | **CREATE (if not from Sprint A)** | 7 tests |
| 13 | `src/__tests__/unit/weekly-digest-guard.test.ts` | **CREATE** | 8 tests |
| 14 | `src/__tests__/e2e/sprint-k-smoke.spec.ts` | **CREATE** | 15 E2E tests |

---

## 🧠 Edge Cases to Handle

1. **`status` enum for manual tracking.** The integrations table likely has a `status` column with enum values like `'connected' | 'disconnected' | 'syncing'`. Adding `'manual'` as a new status value requires either: (a) the column is a `text` type and accepts any string — just use `'manual'`; (b) the column is an enum and needs a migration to add the new value. Check `prod_schema.sql` first. If enum: `ALTER TYPE integration_status ADD VALUE IF NOT EXISTS 'manual';`.

2. **Existing fake-synced platforms.** Some users may already have Yelp, TripAdvisor, etc. showing as `'connected'` in their DB from the old fake sync. After Sprint K, these will render as `ManualTrackingRow` components regardless of their DB status (because `hasAutomatedSync: false`). But their DB status is still `'connected'`. This is acceptable — the component ignores the DB status for non-GBP platforms. Document in DEVLOG.

3. **GBP `toggleIntegration` / `syncPlatform` removal.** The `syncPlatform` function likely handles all platforms. Do not delete it — just short-circuit the non-GBP paths to return an error (as shown in the spec above). The GBP path remains functional. Existing GBP connect flows must still work after Sprint K.

4. **`saveManualUrl` URL validation.** The validator uses the native `URL` constructor. This accepts `javascript:` URLs — hence the explicit `protocol` check. Also validate that the URL contains a recognizable platform domain (optional but useful): e.g., a URL saved for the Yelp platform should contain `yelp.com`. Make this a warning, not an error — users may use regional Yelp domains.

5. **H6: No Stripe Agency Price ID in env.** The most common case in early-stage SaaS is that Agency pricing is custom/negotiated and there's no Stripe Price object to fetch. In this case, implement Case B (UI fallback to "Contact us for pricing") and document in DEVLOG. Do not create a fake price or hardcode a number.

6. **H6: Stripe API call latency.** The `seat-actions.ts` action is called on the billing page render. A Stripe API call adds latency. Cache the price in a module-level variable or use `unstable_cache` (Next.js) with a 1-hour TTL. The price changes rarely — caching is appropriate.

7. **L2: What counts as "has had a scan."** Read `prod_schema.sql` carefully. Options: `reality_score IS NOT NULL` on the scores table, `first_scan_at IS NOT NULL` on orgs, `scan_count > 0`, or the existence of any row in `hallucination_alerts`. Use the most direct indicator available. Document in DEVLOG which column was used.

8. **L2: orgs with `notifications_enabled = false`.** The digest cron likely already filters for opted-in orgs. The new guard adds a second filter for no-scan orgs. Both filters must apply — don't accidentally remove the existing notification preference filter when adding the scan guard.

9. **Sidebar: plan-gated items.** Some nav items may be hidden on lower plans (e.g., Agent Readiness gated to Growth+). The NAV_GROUPS structure must preserve this gating. Read how gating works in the existing `NavItem` component before restructuring. The group headers should not appear above groups whose items are all gated (no empty group headers for users on lower plans).

10. **Sentry bare-catch in test files.** The grep command filters `.test.` and `.spec.` files. Some test utilities may have try/catch patterns that look like bare catches. The sweep applies only to `app/` and `lib/` — not test files. Confirm the grep filter is working before counting the remaining fixes.

11. **`ManualTrackingRow` loading state.** When `saveManualUrl` is pending, the "Save URL" button shows "Saving…" and is disabled. The URL input should also be disabled during pending. Do not allow double-submission.

12. **Migration idempotency.** If a migration for `manual_url` column is needed, it must be idempotent: `ADD COLUMN IF NOT EXISTS`. Never run `ALTER TABLE` without `IF NOT EXISTS` — the migration runner may run it multiple times in different environments.

---

## 🚫 What NOT to Do

1. **DO NOT keep any fake sync flow for non-GBP platforms.** The `setTimeout(2000)` mock must be removed entirely. The old `toggleIntegration` / `syncPlatform` paths for Yelp, TripAdvisor, etc. must either be removed or short-circuited to return an error. Any code path that sets a non-GBP platform status to `'connected'` without a real API call is the bug being fixed.
2. **DO NOT wire real Yelp/TripAdvisor/Bing APIs.** That is C2's Phase 2 — not this sprint. This sprint's goal for those platforms is honest labeling and useful manual URL tracking. The analysis report says "Either wire the real APIs or clearly label as manual tracking so customers aren't misled." Sprint K does the honest labeling. Real APIs come later.
3. **DO NOT remove the GBP connect flow.** Google Business Profile is the only platform with real OAuth + sync. It must continue to work exactly as before. Sprint K only changes behavior for the 5 mock platforms.
4. **DO NOT remove items from the sidebar to make grouping easier.** All 22 items stay. Grouping adds section headers between items — it never removes items. A user who could navigate to Agent Readiness before Sprint K can still navigate to Agent Readiness after.
5. **DO NOT run a migration if the `manual_url` column already exists.** Check `prod_schema.sql` first. Running `ADD COLUMN IF NOT EXISTS` is safe, but unnecessary migrations add noise.
6. **DO NOT send the weekly digest to users with no scan data.** The guard is the primary fix. The secondary fix (the bare catch at line 86) is separate. Both must be applied, but the guard is the more important of the two.
7. **DO NOT hardcode a per-seat cost for Agency customers.** If the Stripe Price ID doesn't exist, show "Contact us for pricing" — not a made-up number. AI_RULES §62 (revenue estimates labeled as estimates) applies here too.
8. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12).
9. **DO NOT modify `middleware.ts`** (AI_RULES §6).
10. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).

---

## ✅ Definition of Done

**C2 — Listings Honesty:**
- [ ] `lib/integrations/platform-config.ts` created with 6 platforms; `hasAutomatedSync: true` only for GBP
- [ ] Fake `setTimeout(2000)` sync removed for all non-GBP platforms
- [ ] `saveManualUrl` server action created; validates URL; writes to DB
- [ ] `ManualTrackingRow` renders for non-GBP platforms: "Manual tracking" badge + URL entry form
- [ ] GBP platform row unchanged — real OAuth flow still works
- [ ] Page description copy updated to be honest about sync status
- [ ] If `manual_url` column was needed: migration written and idempotent
- [ ] `status: 'manual'` enum value added if needed

**C1 — Sentry sweep:**
- [ ] `grep -rn "} catch {" app/ lib/` returns 0 results (excluding test files)
- [ ] Sentry sweep test passes: 2/2 tests green
- [ ] DEVLOG documents all catch locations fixed in Sprint K (if any gaps remained)

**H4 — Sidebar grouping:**
- [ ] `NAV_GROUPS` exists in `components/layout/Sidebar.tsx` with 6 groups
- [ ] All 6 group labels visible in the rendered sidebar
- [ ] All nav items remain present — zero removed
- [ ] Sidebar nav group test passes: 7/7 tests green

**H6 — monthlyCostPerSeat:**
- [ ] `monthlyCostPerSeat: null` TODO removed from production code
- [ ] Either: real Stripe price fetched when env var is set, OR: UI shows "Contact us for pricing" when null
- [ ] DEVLOG documents which case applied

**L2 — Weekly digest guard:**
- [ ] Orgs with no scan data (null reality_score or equivalent) are skipped in digest send loop
- [ ] Sentry breadcrumb logged with skip count
- [ ] Bare catch at original line 86 now calls `Sentry.captureException`
- [ ] Weekly digest guard test passes: 8/8 tests green

**Tests:**
- [ ] `integrations-listings.test.tsx` — **20 tests passing**
- [ ] `sentry-sweep-verification.test.ts` — **2 tests passing**
- [ ] `sidebar-nav-groups.test.tsx` — **7 tests passing**
- [ ] `weekly-digest-guard.test.ts` — **8 tests passing**
- [ ] `npx vitest run` — ALL Sprints A–K passing, zero regressions
- [ ] `sprint-k-smoke.spec.ts` — **15 E2E tests passing**
- [ ] `npx tsc --noEmit` — 0 new type errors

---

## 📓 DEVLOG Entry

```markdown
## [DATE] — Sprint K: Infrastructure & Trust (Completed)

**C1 — Sentry gap-fill:**
- Bare catches remaining before Sprint K: [N] (from grep)
- Files fixed: [list file:line pairs]
- Bare catches remaining after Sprint K: 0 (confirmed by sentry-sweep test)

**C2 — Listings Honesty:**
- Mock setTimeout removed: yes
- Platforms changed to manual tracking: yelp, tripadvisor, bing_places, apple_business_connect, foursquare
- manual_url column: [already existed / migration created — migration file name]
- status enum for 'manual': [column is text, accepts any string / enum extended with migration]
- GBP connect flow: unchanged, still functional

**H4 — Sidebar:**
- Status: [Sprint A already completed / Implemented in Sprint K]
- Groups: Monitor ([N] items), Optimize ([N]), Create ([N]), Manage ([N]), Intelligence ([N]), Account ([N])
- Plan-gated items: [describe how gating preserved across groups]

**H6 — monthlyCostPerSeat:**
- Case applied: [A — fetched from Stripe Price ID / B — "Contact us" fallback]
- Price ID env var: [STRIPE_AGENCY_PRICE_ID / not configured]
- Caching: [module-level cache / unstable_cache with 1hr TTL / not needed]

**L2 — Weekly digest guard:**
- No-scan detection column: [reality_score IS NOT NULL / first_scan_completed_at IS NOT NULL / other]
- Guard applied: yes — [N] orgs would be skipped in current DB state
- Bare catch at line 86: fixed

**Tests:** 37 Vitest + 15 Playwright; 0 regressions Sprints A–K
**Cumulative (A–K):** [N] Vitest + [N] Playwright
```

---

## 🔮 AI_RULES Update

```markdown
## 68. 🚫 No Mock Sync Flows in Production UI (Sprint K)

Server actions that simulate API work with setTimeout are never acceptable in production.
A status of 'connected' must only be set when a real API confirms the connection.

Non-automated platform integrations must:
- Display an honest status badge ("Manual tracking" or "Automated sync coming soon")
- Provide a manual URL-entry workflow as a useful alternative
- Never display "Synced" or "Connected" without a real API confirmation

The distinction between automated (GBP) and manual platforms is codified in
lib/integrations/platform-config.ts and PLATFORM_CONFIG.hasAutomatedSync.
Never add a new platform with hasAutomatedSync: true without a real OAuth + API implementation.

## 69. 🔍 Zero Bare catch {} Policy (Sprint K)

The target state for app/ and lib/ is zero bare } catch { patterns.
This is verified by src/__tests__/unit/sentry-sweep-verification.test.ts which runs as
part of the test suite.

Every new catch block must:
1. Name the error: } catch (err) {
2. Call Sentry.captureException(err, { tags: { file, component/action, sprint } })
3. Handle the user-visible degraded state (error UI, not blank)

The sentry-sweep test will catch any regressions — treat a failing sentry-sweep test
with the same urgency as a type error.
```

---

## 📚 Git Commit

```bash
git add -A
git commit -m "Sprint K: Infrastructure & Trust — Listings Honesty, Sentry Sweep, Sidebar, Quick Wins

C2 — Listings Honesty:
- lib/integrations/platform-config.ts: PLATFORM_CONFIG, hasAutomatedSync per platform
- Fake setTimeout sync removed for yelp/tripadvisor/bing_places/apple_business_connect/foursquare
- saveManualUrl server action: URL validation + Supabase upsert
- ManualTrackingRow: 'Manual tracking' badge + URL entry form + claim link
- integrations/page.tsx: honest copy; passes manualUrl to PlatformRow
- GBP connect flow: unchanged

C1 — Sentry gap-fill:
- Remaining bare catches: [N] → 0
- Files fixed: [list]
- sentry-sweep-verification.test.ts: permanent regression guard

H4 — Sidebar (Sprint A verification/completion):
- NAV_GROUPS: 6 groups (Monitor / Optimize / Create / Manage / Intelligence / Account)
- All [N] nav items distributed across groups, none removed

H6 — monthlyCostPerSeat:
- Resolved null TODO in app/actions/seat-actions.ts
- [Case A: Stripe price fetch / Case B: 'Contact us' fallback]

L2 — Weekly digest guard:
- Skip orgs with no scan data (null reality_score)
- Sentry breadcrumb logs skip count
- Bare catch at line 86 fixed

Tests: 37 Vitest + 15 Playwright; 0 regressions Sprints A–K
AI_RULES: 68 (no mock sync flows), 69 (zero bare catch policy)"

git push origin main
```

---

## 🏁 Sprint Outcome

Sprint K is the gap-closing sprint — it makes the product honest and observable in ways that matter to trust and retention.

**Listings** — Five platforms no longer lie. Yelp, TripAdvisor, Bing Places, Apple Business Connect, and Foursquare now say "Manual tracking" instead of showing a fake green checkmark. The URL entry form gives users something real to do instead of clicking a button that does nothing. When automated sync is eventually built for these platforms, `PLATFORM_CONFIG.hasAutomatedSync` flips to `true` and the UI updates automatically — no additional component changes needed.

**Sentry** — The grep test runs on every CI build. Zero bare catches is now a permanent enforced invariant, not a one-time cleanup. Any developer who introduces a new `} catch {` will see the sentry-sweep test fail in CI before it ships.

**Sidebar** — 22 undifferentiated items become six labeled sections. Users who open the product for the first time see "Monitor / Optimize / Create / Manage / Intelligence / Account" — a structure they can reason about. The same 22 items are there; they're just findable now.

**Agency billing** — `monthlyCostPerSeat` is no longer `null`. Agency customers can see their per-seat cost, or a clear "Contact us" if pricing isn't configured.

**Weekly digest** — New users don't receive blank-score emails. The cron now skips orgs with no scan data. The breadcrumb tells you exactly how many orgs were skipped each week — useful operational data.

**What's next — Sprint L:** Three items that require real external API work: (1) real Yelp/TripAdvisor API integration (C2 Phase 2 — now that the UI is honest, the plumbing is clean for real sync), (2) sample data mode for new users waiting for their first scan (C4 — the highest-churn-risk moment in the product), and (3) the GuidedTour additions from Sprint E's M2 spec (Share of Voice, Citations, Revenue Impact tour steps — the three pages most users don't understand on their own).
