# Sprint 93 — Business Info Editor (Post-Onboarding)

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `MEMORY.md`, `prod_schema.sql`,
> `golden-tenant.ts`, `database.types.ts`

---

## 🎯 Objective

Build the **Business Info Editor** — a "Business Info" tab inside the existing Settings page that allows users to update their ground-truth business data (hours, amenities, categories, address, phone, website) at any time after onboarding.

**The core problem this solves:** Right now, a user who enters wrong hours during onboarding has no way to fix them without re-onboarding. Their dashboard will keep showing AI hallucinations that are actually correct — the *location data* is wrong, not the AI. This is the #1 support request for local business SaaS products and a direct cause of churn.

**Key design principles for this sprint:**

1. **Reuse, don't rebuild.** `TruthCalibrationForm` (onboarding Step 2), `saveLocationTruth()` (Sprint 91), and `triggerGBPImport()` (Sprint 89) already exist. This sprint wires them into a Settings tab — it does NOT rewrite them.

2. **Pre-populated by default.** Unlike onboarding (which starts empty on the manual path), this editor always opens with the current saved values. A user should see their existing data and only touch what needs changing.

3. **Change detection + audit prompt.** When a user saves changes that affect ground truth (hours, amenities), they should be prompted to run a new hallucination audit so the system can check whether AI models now have the correct information. This is the core value loop.

4. **GBP re-sync is one click.** If GBP is connected, a "Re-sync from Google" button re-runs the Sprint 89 import pipeline and updates all fields. This is not a full re-onboarding — just a data refresh.

**Gap being closed:** Feature #76 (Business Info Editor) — 0% → 100%.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                                      — All engineering rules
Read CLAUDE.md                                             — Full implementation inventory
Read MEMORY.md                                             — All architectural decisions

# The three key building blocks you will reuse — read ALL of them:
Read components/onboarding/TruthCalibrationForm.tsx        — OR wherever this component lives
                                                             (search: grep -rn "TruthCalibrationForm" app/ components/)
Read app/actions/save-location-truth.ts                    — Sprint 91 save action
Read app/actions/gbp-import.ts                             — Sprint 89 GBP import action (triggerGBPImport)
Read lib/gbp/gbp-data-mapper.ts                            — Sprint 89 MappedLocationData type

# The Settings page this tab is being added to:
Read app/dashboard/settings/page.tsx                       — Current Settings page structure
Read app/dashboard/settings/                               — All files in settings directory
                                                             (tabs? separate route segments? understand the pattern)

# Schema — understand what fields exist on locations:
Read supabase/prod_schema.sql                              — locations table: all columns
Read lib/supabase/database.types.ts                        — locations Row type: exact TypeScript shape

# Fear Engine trigger — for the post-save audit prompt:
Read app/actions/trigger-first-audit.ts                    — Sprint 91 audit trigger (reuse this)
Read app/api/cron/                                         — Understand audit trigger mechanism

# Data fetching pattern:
Read lib/data/dashboard.ts                                 — lib/data/ pattern for Server Component data fetching
Read lib/data/                                             — All data fetchers — find one that reads locations

# Plan enforcement:
Read lib/plan-enforcer.ts                                  — Is Business Info Editor plan-gated? (it should NOT be)

# Golden tenant — understand what data currently exists:
Read src/__fixtures__/golden-tenant.ts                     — MOCK_GBP_MAPPED and location data
```

**Critical things to understand before writing code:**
- The exact shape of `TruthCalibrationForm` props: what does it accept, what does it call on submit, does it manage its own state or is it controlled?
- The exact columns on the `locations` table — specifically: `hours_data`, `operational_status`, `amenities`, `name`, `phone`, `address`, `city`, `state`, `zip`, `website`, `primary_category`, `gbp_synced_at`
- How Settings page is currently structured — does it use tabs with URL segments (`/settings/billing`, `/settings/notifications`), a tab component with client-side switching, or a single page with sections?
- Whether `saveLocationTruth()` already accepts all the fields needed here, or needs to be extended

---

## 🏗️ Architecture

### Where This Lives

**New tab in the existing Settings page.** Do NOT create a new top-level dashboard route. The Business Info editor is a tab inside `/dashboard/settings`, alongside whatever tabs already exist (notifications, billing, danger zone, etc.).

The exact implementation depends on how Settings is currently structured — match the existing pattern exactly:

- **If Settings uses URL-segment tabs** (`/settings/billing`, etc.): Create `app/dashboard/settings/business-info/page.tsx`
- **If Settings uses client-side tab switching**: Add a new tab to the existing tabs array and render `<BusinessInfoTab />` when active
- **If Settings is a single scrolling page with sections**: Add a new `<BusinessInfoSection />` component at the top of the page

Read `app/dashboard/settings/` carefully and match the pattern. Do not introduce a new navigation pattern.

**Sidebar:** The existing "Settings" nav item already covers this — do NOT add a new sidebar entry for Business Info.

---

### Page Layout

```
Settings
├── [Existing tabs: Notifications, Billing, Danger Zone, etc.]
└── Business Info  ← NEW TAB

Business Info tab:
┌─────────────────────────────────────────────────────────────────┐
│  Business Information                                            │
│  Keep your hours and details accurate — AI models cite what     │
│  they find. Wrong hours here = AI hallucinations about you.     │
│                                                                   │
│  ┌─── Google Business Profile ──────────────────────────────┐   │
│  │ Connected · Last synced 3 days ago                        │   │
│  │ [↻ Re-sync from Google]                                   │   │
│  └───────────────────────────────────────────────────────────┘   │
│  (GBP card only shown if gbp_connections row exists)             │
│                                                                   │
│  ┌─── Basic Info ───────────────────────────────────────────┐   │
│  │ Business Name  [Charcoal N Chill              ]           │   │
│  │ Phone          [(470) 555-0123                ]           │   │
│  │ Website        [https://charcoalnchill.com    ]           │   │
│  │ Address        [11950 Jones Bridge Rd         ]           │   │
│  │ City           [Alpharetta      ] State [GA] Zip [30005]  │   │
│  │ Category       [Hookah Bar                    ]           │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─── Hours & Amenities ────────────────────────────────────┐   │
│  │ [TruthCalibrationForm — pre-populated with current data]  │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                   │
│  [Save Changes]           Last saved: 3 days ago                 │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

[Post-save — change detection banner:]
┌─────────────────────────────────────────────────────────────────┐
│  ✅ Business info updated.                                        │
│                                                                   │
│  You changed your hours. AI models may still have the old data.  │
│  Run a new audit to check.                                       │
│  [Run Hallucination Audit →]          [Dismiss]                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Components to Build

### Component 1: Data Fetcher — `lib/data/business-info.ts`

Server-side data fetcher following the `lib/data/` pattern. Fetches everything the Business Info tab needs in one call.

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export interface BusinessInfoData {
  location: {
    id: string;
    name: string | null;
    phone: string | null;
    website: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    primary_category: string | null;
    hours_data: Record<string, { open: string; close: string; closed: boolean }> | null;
    operational_status: string | null;
    amenities: Record<string, boolean> | null;
    gbp_synced_at: string | null;
  } | null;
  /** Whether this org has a connected GBP account */
  hasGBPConnected: boolean;
  /** ISO timestamp of the most recent hallucination audit completion */
  lastAuditAt: string | null;
}

/**
 * Fetches all data needed for the Business Info settings tab.
 * Called server-side in the settings page/tab server component.
 */
export async function fetchBusinessInfo(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<BusinessInfoData> {
  // Three parallel queries:
  // 1. Primary location for org (order by created_at asc, limit 1)
  // 2. gbp_connections row for org (just check existence — select id)
  // 3. Most recent completed audit (created_at of latest hallucination_audits row)

  const [locationResult, gbpResult, auditResult] = await Promise.all([
    supabase
      .from('locations')
      .select('id, name, phone, website, address, city, state, zip, primary_category, hours_data, operational_status, amenities, gbp_synced_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('gbp_connections')
      .select('id')
      .eq('org_id', orgId)
      .maybeSingle(),

    supabase
      .from('hallucination_audits')  // ← verify exact table name in prod_schema.sql
      .select('created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    location: locationResult.data ?? null,
    hasGBPConnected: !!gbpResult.data,
    lastAuditAt: auditResult.data?.created_at ?? null,
  };
}
```

**Note:** Verify the exact table name for hallucination audits in `prod_schema.sql` before writing this. It may be `hallucination_audits`, `fear_engine_results`, `audits`, or something else. Use whatever is in the schema.

---

### Component 2: Extended Save Action — `app/actions/save-location-truth.ts`

**Read the existing `saveLocationTruth()` action from Sprint 91 first.** It was built to handle `hoursData` and `amenities`. This sprint extends it to also handle basic info fields (`name`, `phone`, `website`, `address`, `city`, `state`, `zip`, `primary_category`, `operational_status`).

**If `saveLocationTruth()` already accepts all these fields:** do NOT create a new action. Simply call it with the additional fields — the function signature may already be broad enough.

**If it needs extension:** update the existing function's input type and UPDATE query to include the new fields. Do NOT create a parallel `saveBusinessInfo()` action — extend the one that exists to avoid drift.

```typescript
// Extended input type (update the existing interface, don't duplicate it):
export interface LocationTruthData {
  // Basic info (new in Sprint 93)
  name?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  primary_category?: string;
  operational_status?: string | null;
  // Hours + amenities (existing from Sprint 91)
  hours_data?: Record<string, { open: string; close: string; closed: boolean }>;
  amenities?: Record<string, boolean>;
}
```

**Return type — extend with change detection:**

```typescript
export interface SaveLocationTruthResult {
  ok: boolean;
  location_id?: string;
  error?: string;
  /** Fields that changed in this save — used for post-save audit prompt */
  changedFields?: string[];
  /** True if hours_data or amenities changed — these are the fields that affect AI accuracy */
  groundTruthChanged?: boolean;
}
```

**Change detection implementation:**

Before running the UPDATE, fetch the current values and diff them:
```typescript
const { data: current } = await supabase
  .from('locations')
  .select('hours_data, amenities, name, phone, ...')
  .eq('id', location.id)
  .single();

const changedFields: string[] = [];
if (JSON.stringify(current.hours_data) !== JSON.stringify(data.hours_data)) {
  changedFields.push('hours_data');
}
if (JSON.stringify(current.amenities) !== JSON.stringify(data.amenities)) {
  changedFields.push('amenities');
}
// ... check other fields

const groundTruthChanged = changedFields.some(f =>
  ['hours_data', 'amenities', 'operational_status'].includes(f)
);
```

**Note:** This adds one extra SELECT before the UPDATE — acceptable cost for the UX value of targeted audit prompts.

---

### Component 3: GBP Re-sync Action — `app/actions/resync-gbp.ts`

A thin wrapper around `triggerGBPImport()` with a different return shape optimized for the Settings context (shows what specifically changed).

```typescript
'use server';

import { triggerGBPImport, type GBPImportResult } from '@/app/actions/gbp-import';

export interface ResyncGBPResult {
  ok: boolean;
  error?: string;
  error_code?: string;
  /** Human-readable summary of what changed after re-sync */
  changesSummary?: string;
  /** True if hours or amenities changed — triggers audit prompt */
  groundTruthChanged?: boolean;
}

/**
 * Re-syncs GBP data for the current user's org.
 * Wrapper around triggerGBPImport() that adds change summary for Settings UI.
 * Called from the "Re-sync from Google" button in Business Info tab.
 */
export async function resyncGBP(): Promise<ResyncGBPResult> {
  const result = await triggerGBPImport();

  if (!result.ok) {
    return { ok: false, error_code: result.error_code, error: result.error };
  }

  // Build a human-readable summary of what was updated
  const updated: string[] = [];
  if (result.mapped?.hours_data)        updated.push('hours');
  if (result.mapped?.amenities)         updated.push('amenities');
  if (result.mapped?.phone)             updated.push('phone');
  if (result.mapped?.name)              updated.push('business name');
  if (result.mapped?.operational_status) updated.push('operational status');

  const changesSummary = updated.length > 0
    ? `Updated: ${updated.join(', ')}`
    : 'No changes detected — your Google data matches what's saved.';

  const groundTruthChanged = updated.some(f =>
    ['hours', 'amenities', 'operational status'].includes(f)
  );

  return { ok: true, changesSummary, groundTruthChanged };
}
```

---

### Component 4: Basic Info Form Section — `app/dashboard/settings/_components/BasicInfoForm.tsx`

**`'use client'` component.** The simple fields that are NOT part of `TruthCalibrationForm` (which handles hours + amenities). This handles name, phone, website, address, city, state, zip, category, operational status.

```typescript
'use client';

interface BasicInfoFormProps {
  initialValues: {
    name: string | null;
    phone: string | null;
    website: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    primary_category: string | null;
    operational_status: string | null;
  };
  onChange: (field: string, value: string) => void;
}
```

**Fields:**

| Field | Input Type | Validation |
|-------|-----------|-----------|
| Business Name | `text` | Max 100 chars |
| Phone | `tel` | Optional — no strict format enforcement (GBP has variants) |
| Website | `url` | Optional — validate starts with `http://` or `https://` |
| Address | `text` | Optional |
| City | `text` | Optional |
| State | `text` | Max 2 chars (abbreviation), uppercase |
| ZIP | `text` | Max 10 chars |
| Category | `text` | Optional — free-form, not a dropdown |
| Operational Status | `select` | Options: `open`, `closed_temporarily`, `closed_permanently` |

**Implementation rules:**
- Controlled component — all values via `onChange` prop, no internal state
- Client-side validation only (no API call on field blur) — validate on submit
- State field: `toUpperCase()` on blur
- Website field: prefix `https://` automatically if user types without protocol
- All fields optional except Business Name (required, min 2 chars)

**data-testid attributes (required):**
- `data-testid="basic-info-name"` — business name input
- `data-testid="basic-info-phone"` — phone input
- `data-testid="basic-info-website"` — website input
- `data-testid="basic-info-address"` — address input
- `data-testid="basic-info-city"` — city input
- `data-testid="basic-info-state"` — state input
- `data-testid="basic-info-zip"` — zip input
- `data-testid="basic-info-category"` — category input
- `data-testid="basic-info-status"` — operational status select

---

### Component 5: GBP Sync Card — `app/dashboard/settings/_components/GBPSyncCard.tsx`

**`'use client'` component.** Shown only when `hasGBPConnected === true`. Displays last sync time and the re-sync button.

```typescript
'use client';

interface GBPSyncCardProps {
  gbpSyncedAt: string | null;   // ISO timestamp or null
  onResyncComplete: (result: ResyncGBPResult) => void;
}
```

**States:**

```
[Default — synced previously]
Connected · Last synced {relative time}
[↻ Re-sync from Google]

[Default — never synced]
Connected · Never synced
[↻ Import from Google]

[Syncing — button clicked]
↻ Syncing...  [spinner, button disabled]

[Success]
✅ Synced · Updated: hours, amenities, phone
[Run Audit to check AI accuracy →]   (only if groundTruthChanged)

[Error: token_expired]
⚠️ Google connection expired.
[Reconnect Google Business Profile →]  (links to settings GBP connect flow)

[Error: gbp_api_error]
⚠️ Couldn't reach Google right now. Try again in a few minutes.
[↻ Retry]
```

**Relative time formatting:** Use `Intl.RelativeTimeFormat` — no external date library (AI_RULES: check whether a date util exists in the project first, use it if so).

**data-testid attributes:**
- `data-testid="gbp-sync-card"` — outer wrapper
- `data-testid="gbp-sync-btn"` — the re-sync / import button
- `data-testid="gbp-sync-status"` — the status text
- `data-testid="gbp-sync-success"` — success state
- `data-testid="gbp-sync-error"` — error state

---

### Component 6: Post-Save Audit Prompt Banner — `app/dashboard/settings/_components/AuditPromptBanner.tsx`

**`'use client'` component.** Shown conditionally after a save that changed ground-truth fields.

```typescript
'use client';

interface AuditPromptBannerProps {
  changedFields: string[];     // e.g. ['hours_data', 'amenities']
  onRunAudit: () => void;
  onDismiss: () => void;
  /** true while audit is being triggered */
  auditRunning: boolean;
}
```

**UI:**
```
┌──────────────────────────────────────────────────────────────────┐
│  ✅ Business info updated.                                         │
│                                                                    │
│  You changed your {hours / amenities / hours and amenities}.      │
│  AI models may still have outdated information about you.         │
│  Running a new audit will check all 4 engines.                   │
│                                                                    │
│  [↻ Run Hallucination Audit]     [Dismiss]                        │
│                                                                    │
│  (If auditRunning: spinner + "Starting audit..." text)            │
└──────────────────────────────────────────────────────────────────┘
```

**Message copy rules:**
- `changedFields` includes `hours_data` only → "You changed your **hours**."
- `changedFields` includes `amenities` only → "You changed your **amenities**."
- `changedFields` includes both → "You changed your **hours and amenities**."
- `changedFields` includes `operational_status` → "You updated your **operational status**."
- Only show if `groundTruthChanged === true` — basic info changes (phone, website) do NOT trigger this banner

**data-testid attributes:**
- `data-testid="audit-prompt-banner"` — outer wrapper
- `data-testid="audit-prompt-run-btn"` — the Run Audit button
- `data-testid="audit-prompt-dismiss-btn"` — the Dismiss button
- `data-testid="audit-prompt-message"` — the message text

---

### Component 7: Business Info Tab — Main Assembly

**The top-level tab component.** This is either a Server Component page or a client component depending on how Settings is structured (re-read the settings directory before deciding).

**Recommended pattern (if Settings supports it): Server Component for data fetching, passes data down to client components.**

```typescript
// app/dashboard/settings/business-info/page.tsx  (or equivalent)
// Server Component

import { createClient } from '@/lib/supabase/server';
import { fetchBusinessInfo } from '@/lib/data/business-info';
import { getSafeAuthContext } from '@/lib/auth';  // or equivalent auth helper
import { BusinessInfoEditor } from './_components/BusinessInfoEditor';

export default async function BusinessInfoPage() {
  const { orgId } = await getSafeAuthContext();
  const supabase = createClient();
  const data = await fetchBusinessInfo(supabase, orgId);

  return <BusinessInfoEditor initialData={data} />;
}
```

```typescript
// app/dashboard/settings/_components/BusinessInfoEditor.tsx
// 'use client' — manages the form state, save/resync actions, banners

'use client';

interface BusinessInfoEditorProps {
  initialData: BusinessInfoData;
}
```

**State managed in `BusinessInfoEditor`:**
```typescript
type EditorState = {
  // Form values
  basicInfo: BasicInfoValues;
  hoursData: HoursData | null;
  amenities: AmenitiesData | null;

  // UI state
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  saveError: string | null;
  lastSavedAt: Date | null;

  // Post-save audit prompt
  showAuditPrompt: boolean;
  changedFields: string[];
  groundTruthChanged: boolean;
  auditRunning: boolean;

  // GBP resync
  resyncStatus: 'idle' | 'syncing' | 'success' | 'error';
  resyncResult: ResyncGBPResult | null;
};
```

**Save button behavior:**
1. Validate: business name is required (min 2 chars)
2. Set `saveStatus = 'saving'`, disable Save button
3. Call `saveLocationTruth({ ...basicInfo, hours_data: hoursData, amenities })`
4. On success: set `saveStatus = 'saved'`, `lastSavedAt = new Date()`, set `showAuditPrompt = groundTruthChanged`
5. After 3 seconds: reset `saveStatus` back to `'idle'` (the "saved" checkmark fades)
6. On error: set `saveStatus = 'error'`, `saveError = result.error`

**GBP resync behavior:**
1. Set `resyncStatus = 'syncing'`
2. Call `resyncGBP()`
3. On success: update form values with `result.mapped` (merge into existing form state), set `resyncStatus = 'success'`, set `showAuditPrompt = result.groundTruthChanged`
4. On token_expired: set `resyncStatus = 'error'` with reconnect link
5. On other error: set `resyncStatus = 'error'` with retry option

**data-testid attributes on the assembly:**
- `data-testid="business-info-editor"` — outer wrapper
- `data-testid="business-info-save-btn"` — the Save Changes button
- `data-testid="business-info-save-status"` — the save status indicator ("Saving...", "Saved ✅", "Error")
- `data-testid="business-info-last-saved"` — the "Last saved X ago" text

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/fetch-business-info.test.ts`

**Target: `lib/data/business-info.ts`**

```
describe('fetchBusinessInfo')
  1.  returns location data for the org's primary location
  2.  returns null location when org has no location row
  3.  hasGBPConnected is true when gbp_connections row exists for org
  4.  hasGBPConnected is false when no gbp_connections row
  5.  lastAuditAt is the created_at of the most recent audit
  6.  lastAuditAt is null when no audits exist
  7.  queries run in parallel (Promise.all — verify all three tables are queried)
  8.  scopes all queries to the provided orgId (belt-and-suspenders — AI_RULES §18)
  9.  returns primary location (first created) when org has multiple location rows
```

**9 tests. Mock Supabase client with `.from().select().eq().order().limit().maybeSingle()` chain.**

---

### Test File 2: `src/__tests__/unit/save-location-truth-extended.test.ts`

**Target: `app/actions/save-location-truth.ts` — extended with Sprint 93 fields**

*(If Sprint 91's `save-location-truth.test.ts` already exists, add to it rather than creating a new file. Only create a new file if the existing one will become too long or conflicting.)*

```
describe('saveLocationTruth — Sprint 93 extensions')
  1.  saves business name to location row
  2.  saves phone, website, address, city, state, zip
  3.  saves primary_category
  4.  saves operational_status
  5.  returns changedFields: ['hours_data'] when only hours changed
  6.  returns changedFields: ['amenities'] when only amenities changed
  7.  returns changedFields: [] when nothing changed
  8.  returns groundTruthChanged: true when hours_data in changedFields
  9.  returns groundTruthChanged: true when amenities in changedFields
  10. returns groundTruthChanged: true when operational_status in changedFields
  11. returns groundTruthChanged: false when only name/phone/website changed
  12. does not overwrite existing fields when partial update is passed
  13. returns { ok: false } when user is not authenticated
  14. returns { ok: false } when org has no location row
```

**14 tests. Mock Supabase client including the pre-save SELECT for change detection.**

---

### Test File 3: `src/__tests__/unit/resync-gbp.test.ts`

**Target: `app/actions/resync-gbp.ts`**

```
describe('resyncGBP')
  1.  calls triggerGBPImport() internally
  2.  returns { ok: false, error_code } when import fails with token_expired
  3.  returns { ok: false, error_code } when import fails with not_connected
  4.  returns { ok: true } when import succeeds
  5.  changesSummary includes "hours" when mapped.hours_data is present
  6.  changesSummary includes "amenities" when mapped.amenities is present
  7.  changesSummary is "No changes detected" when mapped has no relevant fields
  8.  groundTruthChanged is true when hours updated
  9.  groundTruthChanged is true when amenities updated
  10. groundTruthChanged is false when only phone/website updated
```

**10 tests. Mock `triggerGBPImport` from `@/app/actions/gbp-import`.**

```typescript
vi.mock('@/app/actions/gbp-import', () => ({
  triggerGBPImport: vi.fn(),
}));
```

---

### Test File 4: `src/__tests__/unit/basic-info-form.test.ts`

**Target: `app/dashboard/settings/_components/BasicInfoForm.tsx`**

```
describe('BasicInfoForm')
  1.  renders all 9 fields
  2.  all data-testid attributes are present
  3.  onChange is called with correct field name and value on input change
  4.  state input value is uppercased on blur
  5.  website input prefixes https:// when user types without protocol
  6.  operational status select renders three options (open, closed_temporarily, closed_permanently)
  7.  initial values are correctly pre-populated in all fields
  8.  null initial values render as empty strings (no "null" text in inputs)
```

**8 tests. Use `@testing-library/react`. Mock `onChange` prop with `vi.fn()`.**

---

### Test File 5: `src/__tests__/unit/gbp-sync-card.test.ts`

**Target: `app/dashboard/settings/_components/GBPSyncCard.tsx`**

```
describe('GBPSyncCard')
  1.  shows "Last synced {relative time}" when gbpSyncedAt is set
  2.  shows "Never synced" when gbpSyncedAt is null
  3.  Re-sync button has data-testid="gbp-sync-btn"
  4.  clicking Re-sync button calls resyncGBP() action
  5.  shows spinner and disables button during syncing state
  6.  shows success state with changesSummary after successful sync
  7.  shows "Run Audit" link in success state when groundTruthChanged is true
  8.  does NOT show "Run Audit" link when groundTruthChanged is false
  9.  shows token_expired error with "Reconnect" link
  10. shows generic error with "Retry" button on gbp_api_error
```

**10 tests. Use `@testing-library/react`. Mock `resyncGBP` action.**

---

### Test File 6: `src/__tests__/unit/audit-prompt-banner.test.ts`

**Target: `app/dashboard/settings/_components/AuditPromptBanner.tsx`**

```
describe('AuditPromptBanner')
  1.  renders audit-prompt-banner data-testid
  2.  message says "hours" when changedFields = ['hours_data']
  3.  message says "amenities" when changedFields = ['amenities']
  4.  message says "hours and amenities" when both in changedFields
  5.  message says "operational status" when changedFields = ['operational_status']
  6.  Run Audit button calls onRunAudit()
  7.  Dismiss button calls onDismiss()
  8.  shows spinner and "Starting audit..." when auditRunning is true
  9.  Run Audit button is disabled when auditRunning is true
```

**9 tests. Use `@testing-library/react`. Mock `onRunAudit` and `onDismiss` with `vi.fn()`.**

---

### Test File 7 (Playwright E2E): `src/__tests__/e2e/business-info-editor.spec.ts`

```typescript
describe('Business Info Editor — Settings Tab', () => {

  test('Business Info tab is visible in Settings navigation', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.getByText('Business Info')).toBeVisible();
  });

  test('form is pre-populated with existing location data', async ({ page }) => {
    await page.goto('/dashboard/settings/business-info'); // adjust path per implementation
    // Assert golden tenant data is pre-filled
    await expect(page.getByTestId('basic-info-name')).toHaveValue('Charcoal N Chill');
    await expect(page.getByTestId('basic-info-city')).toHaveValue('Alpharetta');
  });

  test('saving basic info changes shows saved confirmation', async ({ page }) => {
    await page.goto('/dashboard/settings/business-info');
    // Change the phone number
    await page.getByTestId('basic-info-phone').fill('+14705559999');
    await page.getByTestId('business-info-save-btn').click();
    // Assert save confirmation appears
    await expect(page.getByTestId('business-info-save-status')).toContainText('Saved');
  });

  test('changing hours shows audit prompt banner', async ({ page }) => {
    await page.goto('/dashboard/settings/business-info');
    // Change a hours field in TruthCalibrationForm
    // (find the Monday open time field — use existing TruthCalibrationForm data-testid)
    // Save
    await page.getByTestId('business-info-save-btn').click();
    // Assert audit prompt appears
    await expect(page.getByTestId('audit-prompt-banner')).toBeVisible();
    await expect(page.getByTestId('audit-prompt-message')).toContainText('hours');
  });

  test('changing only phone does NOT show audit prompt banner', async ({ page }) => {
    await page.goto('/dashboard/settings/business-info');
    await page.getByTestId('basic-info-phone').fill('+14705558888');
    await page.getByTestId('business-info-save-btn').click();
    // Audit prompt should NOT appear — phone change is not ground truth
    await expect(page.getByTestId('business-info-save-status')).toContainText('Saved');
    await expect(page.getByTestId('audit-prompt-banner')).not.toBeVisible();
  });

  test('dismissing audit prompt hides it', async ({ page }) => {
    // Setup: save with hours change to trigger banner
    await page.goto('/dashboard/settings/business-info');
    // [change hours, save]
    await expect(page.getByTestId('audit-prompt-banner')).toBeVisible();
    await page.getByTestId('audit-prompt-dismiss-btn').click();
    await expect(page.getByTestId('audit-prompt-banner')).not.toBeVisible();
  });

  test('GBP Sync card visible when GBP is connected', async ({ page }) => {
    // Setup: golden tenant has GBP connected (gbp_connections row exists)
    await page.goto('/dashboard/settings/business-info');
    await expect(page.getByTestId('gbp-sync-card')).toBeVisible();
    await expect(page.getByTestId('gbp-sync-btn')).toBeVisible();
  });

  test('GBP Sync card NOT visible when GBP is not connected', async ({ page }) => {
    // Setup: use a test user with no gbp_connections row
    // (use page.route() to mock the settings data fetch to return hasGBPConnected: false)
    await page.route('**/api/settings/business-info*', async (route) => {
      // return data with hasGBPConnected: false
    });
    await page.goto('/dashboard/settings/business-info');
    await expect(page.getByTestId('gbp-sync-card')).not.toBeVisible();
  });

  test('Re-sync from Google updates form fields', async ({ page }) => {
    // Mock /api/gbp/import to return MOCK_GBP_MAPPED
    await page.route('**/api/gbp/import', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, mapped: { phone: '+14705550000', hours_data: {...} } }),
      });
    });
    await page.goto('/dashboard/settings/business-info');
    await page.getByTestId('gbp-sync-btn').click();
    await expect(page.getByTestId('gbp-sync-success')).toBeVisible();
    // Verify the phone field was updated
    await expect(page.getByTestId('basic-info-phone')).toHaveValue('+14705550000');
  });

  test('running audit from banner triggers audit and shows confirmation', async ({ page }) => {
    // Mock audit trigger
    await page.route('**/api/cron/audit*', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
    });
    // [setup hours change to show banner]
    await page.getByTestId('audit-prompt-run-btn').click();
    await expect(page.getByTestId('audit-prompt-run-btn')).toBeDisabled();
    // After success: banner updates or disappears
  });

  test('validation prevents save when business name is empty', async ({ page }) => {
    await page.goto('/dashboard/settings/business-info');
    await page.getByTestId('basic-info-name').fill('');
    await page.getByTestId('business-info-save-btn').click();
    // Save should not fire — validation error should appear
    await expect(page.getByTestId('business-info-save-status')).not.toContainText('Saved');
  });
});
```

**Total Playwright tests: 10**

**Critical Playwright rules:**
- Mock `/api/gbp/import` with `page.route()` — never call real GBP API
- Mock audit trigger endpoint — never call real AI APIs
- Use `page.getByTestId()` for all selectors (stable across refactors)
- Use `page.waitForSelector()` not `page.waitForTimeout()` for async states
- Auth: use the existing Playwright auth helper (golden tenant user must have `onboarding_completed_at` set — onboarding should be complete for Settings access)

---

## 📂 Files to Create / Modify

| # | File | Action | Notes |
|---|------|--------|-------|
| 1 | `lib/data/business-info.ts` | **CREATE** | Data fetcher (3 parallel queries) |
| 2 | `app/actions/save-location-truth.ts` | **EXTEND** | Add basic info fields + change detection return |
| 3 | `app/actions/resync-gbp.ts` | **CREATE** | Thin GBP resync wrapper with change summary |
| 4 | `app/dashboard/settings/_components/BasicInfoForm.tsx` | **CREATE** | Basic info fields (controlled, no internal state) |
| 5 | `app/dashboard/settings/_components/GBPSyncCard.tsx` | **CREATE** | GBP sync status + re-sync button |
| 6 | `app/dashboard/settings/_components/AuditPromptBanner.tsx` | **CREATE** | Post-save audit CTA |
| 7 | `app/dashboard/settings/_components/BusinessInfoEditor.tsx` | **CREATE** | `'use client'` assembly of all components |
| 8 | `app/dashboard/settings/business-info/page.tsx` | **CREATE** | Server Component page (or equivalent per settings structure) |
| 9 | `app/dashboard/settings/page.tsx` (or layout/tabs file) | **MODIFY** | Add Business Info tab to settings navigation |
| 10 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | Add `MOCK_BUSINESS_INFO_DATA` fixture |
| 11 | `src/__tests__/unit/fetch-business-info.test.ts` | **CREATE** | 9 unit tests |
| 12 | `src/__tests__/unit/save-location-truth-extended.test.ts` | **CREATE** (or extend existing) | 14 unit tests |
| 13 | `src/__tests__/unit/resync-gbp.test.ts` | **CREATE** | 10 unit tests |
| 14 | `src/__tests__/unit/basic-info-form.test.ts` | **CREATE** | 8 unit tests |
| 15 | `src/__tests__/unit/gbp-sync-card.test.ts` | **CREATE** | 10 unit tests |
| 16 | `src/__tests__/unit/audit-prompt-banner.test.ts` | **CREATE** | 9 unit tests |
| 17 | `src/__tests__/e2e/business-info-editor.spec.ts` | **CREATE** | 10 Playwright tests |

---

## 🚫 What NOT to Do

1. **DO NOT create a new top-level dashboard route** (e.g., `/dashboard/business-info`). This lives in Settings — the nav structure is already correct.
2. **DO NOT add a new sidebar nav item** — "Settings" already covers this page.
3. **DO NOT rewrite `TruthCalibrationForm`** — it already exists and works. Use it as-is; just pass it pre-populated values and wire its `onSubmit` into your save flow.
4. **DO NOT duplicate `saveLocationTruth()`** — extend the existing action. Two actions that write to `locations` will drift.
5. **DO NOT skip the pre-save SELECT for change detection** — the audit prompt is only valuable if it triggers on real changes, not on every save.
6. **DO NOT show the audit prompt for phone/website/address changes** — only for `hours_data`, `amenities`, and `operational_status`. Non-ground-truth fields don't affect AI accuracy.
7. **DO NOT `await` the auto-save-status reset timeout in tests** — use `vi.useFakeTimers()` to advance the 3-second reset.
8. **DO NOT use dynamic Tailwind classes** for save/sync status colors (AI_RULES §12) — use literal class strings.
9. **DO NOT call real GBP API or real AI APIs in any test** — mock all external calls.
10. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).
11. **DO NOT allow the Business Info tab to be inaccessible on Starter plan** — this is available to all plans. Editing ground truth is not a premium feature.
12. **DO NOT edit `middleware.ts`** (AI_RULES §6).

---

## ✅ Definition of Done (AI_RULES §13.5)

- [ ] Business Info tab is visible in Settings page navigation for all plan tiers
- [ ] Form opens pre-populated with all current location data (never empty for existing users)
- [ ] `BasicInfoForm.tsx` — all 9 fields, all `data-testid` attributes, controlled component
- [ ] `GBPSyncCard.tsx` — shown only when GBP connected, all 5 states handled
- [ ] `AuditPromptBanner.tsx` — appears only for ground-truth field changes, correct copy per field
- [ ] `saveLocationTruth()` extended with basic info fields + change detection return
- [ ] `resyncGBP()` server action wraps `triggerGBPImport()`, returns change summary
- [ ] `fetchBusinessInfo()` runs 3 queries in parallel, returns `BusinessInfoData`
- [ ] Re-sync button updates all form fields in-place after successful GBP sync
- [ ] Save button shows idle → saving → saved → idle (3-second reset) states
- [ ] Validation prevents empty business name save
- [ ] `npx vitest run src/__tests__/unit/fetch-business-info.test.ts` — **9 tests passing**
- [ ] `npx vitest run src/__tests__/unit/save-location-truth-extended.test.ts` — **14 tests passing**
- [ ] `npx vitest run src/__tests__/unit/resync-gbp.test.ts` — **10 tests passing**
- [ ] `npx vitest run src/__tests__/unit/basic-info-form.test.ts` — **8 tests passing**
- [ ] `npx vitest run src/__tests__/unit/gbp-sync-card.test.ts` — **10 tests passing**
- [ ] `npx vitest run src/__tests__/unit/audit-prompt-banner.test.ts` — **9 tests passing**
- [ ] `npx vitest run` — ALL tests passing, zero regressions
- [ ] `npx playwright test src/__tests__/e2e/business-info-editor.spec.ts` — **10 tests passing**
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] DEVLOG.md entry written with actual test counts

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## 2026-02-28 — Sprint 93: Business Info Editor (Post-Onboarding) (Completed)

**Goal:** Allow users to update their ground-truth business data (hours, amenities, basic info) at any time post-onboarding without re-running the wizard. Added Business Info tab to Settings. Reused TruthCalibrationForm, saveLocationTruth(), and triggerGBPImport() from prior sprints.

**Scope:**
- `lib/data/business-info.ts` — **NEW.** Data fetcher. Three parallel queries: primary location, GBP connection status, last audit timestamp.
- `app/actions/save-location-truth.ts` — **EXTENDED.** Added basic info fields (name, phone, website, address, city, state, zip, primary_category, operational_status). Added pre-save change detection returning changedFields[] and groundTruthChanged bool.
- `app/actions/resync-gbp.ts` — **NEW.** Wrapper around triggerGBPImport(). Returns changesSummary (human-readable) and groundTruthChanged.
- `app/dashboard/settings/_components/BasicInfoForm.tsx` — **NEW.** Controlled form for 9 basic info fields. State auto-uppercase, website protocol prefix, all data-testid.
- `app/dashboard/settings/_components/GBPSyncCard.tsx` — **NEW.** GBP sync status + re-sync button. 5 states: default/never-synced/syncing/success/error. Relative time via Intl.RelativeTimeFormat.
- `app/dashboard/settings/_components/AuditPromptBanner.tsx` — **NEW.** Post-save audit CTA. Only shown when groundTruthChanged. Copy varies by changedFields.
- `app/dashboard/settings/_components/BusinessInfoEditor.tsx` — **NEW.** 'use client' assembly. Manages EditorState: form values, save/resync status, audit prompt visibility.
- `app/dashboard/settings/business-info/page.tsx` — **NEW** (or equivalent). Server Component. Calls fetchBusinessInfo(), passes data to BusinessInfoEditor.
- `app/dashboard/settings/[page or layout]` — **MODIFIED.** Added Business Info tab to navigation.
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added MOCK_BUSINESS_INFO_DATA.

**Tests added:**
- `fetch-business-info.test.ts` — **N Vitest tests.** Parallel queries, GBP connection detection, audit timestamp.
- `save-location-truth-extended.test.ts` — **N Vitest tests.** Sprint 93 fields, change detection, groundTruthChanged logic.
- `resync-gbp.test.ts` — **N Vitest tests.** triggerGBPImport mock, changesSummary generation.
- `basic-info-form.test.ts` — **N Vitest tests.** Field rendering, onChange, state uppercase, website prefix.
- `gbp-sync-card.test.ts` — **N Vitest tests.** All 5 states, relative time, conditional audit link.
- `audit-prompt-banner.test.ts` — **N Vitest tests.** changedFields copy variations, dismiss, auditRunning state.
- `business-info-editor.spec.ts` — **N Playwright tests.** Pre-population, save flow, audit prompt, GBP sync, validation.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/fetch-business-info.test.ts        # N tests
npx vitest run src/__tests__/unit/save-location-truth-extended.test.ts # N tests
npx vitest run src/__tests__/unit/resync-gbp.test.ts                 # N tests
npx vitest run src/__tests__/unit/basic-info-form.test.ts            # N tests
npx vitest run src/__tests__/unit/gbp-sync-card.test.ts              # N tests
npx vitest run src/__tests__/unit/audit-prompt-banner.test.ts        # N tests
npx vitest run                                                         # All — no regressions
npx playwright test src/__tests__/e2e/business-info-editor.spec.ts   # N e2e tests
npx tsc --noEmit                                                       # 0 type errors
```

**Note:** Replace N with actual counts via `grep -cE "^\s*(it|test)\("` (AI_RULES §13.3).
```

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| `TruthCalibrationForm` | Phase 4 / Sprint 91 | Hours + amenities form component — reused as-is in Step 2 of the editor |
| `saveLocationTruth()` | Sprint 91 | Action being extended here — read it before modifying |
| `triggerGBPImport()` / `GBPImportResult` | Sprint 89 | GBP import action wrapped by `resyncGBP()` |
| `triggerFirstAudit()` | Sprint 91 | Audit trigger called from `AuditPromptBanner` |
| `locations` schema with `gbp_synced_at` | Sprint 89 | `gbp_synced_at` column used by GBPSyncCard |
| `gbp_connections` table | Sprint 57B | Used to determine `hasGBPConnected` |
| Settings page structure | Phase 4 | Tab/nav pattern that Business Info follows |

---

## 🧠 Edge Cases to Handle

1. **User has no location row yet** (somehow completed onboarding without one): `fetchBusinessInfo()` returns `location: null`. The editor renders an empty form with a warning: "No location data found. Please contact support." — do not crash.

2. **`TruthCalibrationForm` expects a specific prop shape for pre-population:** Read the component carefully. If it expects `defaultValues` as a prop, pass `initialData.location.hours_data` and `initialData.location.amenities`. If it uses an `onSubmit` callback, wire it to call your save action. Do not duplicate its internal logic.

3. **Save while GBP sync is in progress:** Disable the Save button while `resyncStatus === 'syncing'` and vice versa. Concurrent writes to the same location row would produce unpredictable results.

4. **GBP resync replaces form values mid-edit:** If the user has made manual edits before clicking Re-sync, the sync will overwrite their changes. Show a confirmation dialog: "Re-syncing will replace your current edits with Google data. Continue?" — `window.confirm()` is fine here (not a critical UX path).

5. **`changedFields` diff with `null` vs `{}` for amenities:** An org that has never had amenities saved has `amenities: null` in the DB. An org that saved an empty amenities object has `amenities: {}`. Treat `null` and `{}` as equivalent for change detection — `JSON.stringify(null) !== JSON.stringify({})` would incorrectly flag a change.

6. **State field uppercasing:** The `toUpperCase()` on blur should not affect the cursor position or fire unnecessary onChange events. Set value directly without triggering a re-render race.

7. **Website field `https://` prefix:** Only prepend on blur and only if the field is non-empty and doesn't already start with `http://` or `https://`. Don't prepend while user is typing.

8. **`lastSavedAt` display:** "Last saved: just now" for < 60 seconds, "Last saved: 2 minutes ago" for 1–59 minutes, "Last saved: 3 hours ago" etc. Use `Intl.RelativeTimeFormat` with the same logic as `GBPSyncCard` — extract into a shared `lib/utils/relative-time.ts` helper to avoid duplication.

9. **Audit prompt shown after GBP resync:** If the re-sync changes hours, the `AuditPromptBanner` should appear *without* the user needing to click Save. The resync already writes to the DB — the audit prompt should appear immediately after a successful resync that changed ground truth.

---

## 📚 Document Sync + Git Commit

### Step 1: Update `/docs`

**`docs/roadmap.md`** — Update Feature #76 (Business Info Editor) from `❌ 0%` → `✅ 100%`. Add Sprint 93 note.

**`docs/09-BUILD-PLAN.md`** — Add Sprint 93 to completed sprints. Note that `saveLocationTruth()` was extended (not duplicated) — this is intentional.

### Step 2: Update `DEVLOG.md`
Paste the DEVLOG entry from above. Replace all `N` placeholders with actual test counts from `grep -cE "^\s*(it|test)\("` (AI_RULES §13.3).

### Step 3: Update `CLAUDE.md`
```markdown
### Sprint 93 — Business Info Editor (2026-02-28)
- `lib/data/business-info.ts` — fetchBusinessInfo() (3 parallel queries)
- `app/actions/save-location-truth.ts` — EXTENDED: basic info fields + change detection
- `app/actions/resync-gbp.ts` — GBP resync wrapper with change summary
- `app/dashboard/settings/_components/BasicInfoForm.tsx` — 9-field controlled form
- `app/dashboard/settings/_components/GBPSyncCard.tsx` — GBP sync status + re-sync
- `app/dashboard/settings/_components/AuditPromptBanner.tsx` — post-save audit CTA
- `app/dashboard/settings/_components/BusinessInfoEditor.tsx` — 'use client' assembly
- Business Info tab added to Settings navigation
- Tests: 60 Vitest + 10 Playwright
- Gap #76: Business Info Editor 0% → 100%
```

### Step 4: Update `MEMORY.md`
```markdown
## Decision: Business Info Editor Architecture (Sprint 93 — 2026-02-28)
- Lives in Settings tab — NOT a new top-level dashboard route
- Reuses TruthCalibrationForm, saveLocationTruth(), triggerGBPImport() from prior sprints
- saveLocationTruth() is the canonical single write path for location ground truth — always extend it, never duplicate
- Change detection: pre-save SELECT diff determines changedFields[] and groundTruthChanged
- Audit prompt only fires for hours_data, amenities, operational_status changes — not basic info
- GBP resync shows confirmation dialog if user has unsaved manual edits
- Relative time formatting: shared lib/utils/relative-time.ts (extracted to avoid duplication between GBPSyncCard and LastSavedAt)
```

### Step 5: Update `AI_RULES.md`
```markdown
## 45. 🏢 Location Ground Truth — Single Write Path (Sprint 93)

`saveLocationTruth()` in `app/actions/save-location-truth.ts` is the **only** action that writes to the `locations` table for ground-truth fields (hours_data, amenities, operational_status, name, phone, address, etc.).

* **Rule:** Never create a parallel action that writes these fields. Extend `saveLocationTruth()`.
* **Change detection:** The action performs a pre-save SELECT to detect which fields changed. `groundTruthChanged: true` when hours_data, amenities, or operational_status change.
* **Audit prompt:** Any caller that receives `groundTruthChanged: true` should prompt the user to run a hallucination audit.
```

### Step 6: Git Commit
```bash
git add -A
git status

git commit -m "Sprint 93: Business Info Editor — post-onboarding ground truth editing

- Settings: Business Info tab added (all plan tiers)
- Form pre-populated with current location data (never empty)
- saveLocationTruth() extended: basic info fields + change detection
- resyncGBP(): thin wrapper, changesSummary + groundTruthChanged
- BasicInfoForm: 9 fields, controlled, state uppercase, website prefix
- GBPSyncCard: 5 states, relative time, conditional audit link
- AuditPromptBanner: only for hours/amenities/status changes, correct copy
- fetchBusinessInfo(): 3 parallel queries
- lib/utils/relative-time.ts: shared relative time formatting
- tests: 60 Vitest + 10 Playwright passing, 0 regressions, 0 type errors
- docs: roadmap #76 → 100%, DEVLOG, CLAUDE.md, MEMORY.md, AI_RULES updated

Gap #76 closed. Tier 2 Sprint 1/5 complete.
Next: Sprint 94 (Publish Pipeline Verification)."

git push origin main
```

---

## 🏁 Sprint Outcome

After Sprint 93 completes:
- **Business Info Editor: 0% → 100%** (Gap #76 closed)
- Users can correct wrong hours, amenities, or contact info at any time without re-onboarding
- Every save that changes ground truth surfaces an immediate "run a new audit" prompt — closing the edit → verify loop
- GBP re-sync is one click from Settings — keeps ground truth fresh without a full reconnect
- `saveLocationTruth()` is now the canonical single write path for all location ground truth — no drift risk
- **Tier 2 Sprint 1 of 5 complete.** Sprint 94 (Publish Pipeline Verification) is next.
