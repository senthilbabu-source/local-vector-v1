# Sprint 121 — Correction Follow-up + Settings Expansion

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`,
> `golden-tenant.ts`, `database.types.ts`, `lib/ai/providers.ts`,
> `app/api/cron/audit/route.ts`,
> `app/dashboard/settings/page.tsx`,
> `app/dashboard/hallucinations/` (entire dir)

---

## Objective

Build **Correction Follow-up + Settings Expansion** — when a hallucination is marked corrected, automatically generate a correction brief content draft, track correction effectiveness by re-running the hallucinated query after 14 days, and expand the settings page with notification preferences, AI scan frequency controls, and API key management for white-label Agency orgs.

**What this sprint answers:** "I marked that hallucination as corrected — now what? Does the AI actually stop saying it? And how do I control when my scans run?"

**What Sprint 121 delivers:**
- `correction_follow_ups` table — tracks the correction lifecycle: hallucination → correction brief created → re-scan scheduled → re-scan result
- Correction brief auto-generation: when a hallucination is marked `status='corrected'`, a `content_drafts` row is created with a correction-focused content piece
- `POST /api/hallucinations/[id]/correct` — marks a hallucination as corrected, triggers brief generation
- Correction re-scan: nightly cron checks for corrections due for re-scan (14 days after marking corrected), re-runs the hallucinated query, records whether the hallucination persists
- `correction_effectiveness_score` — per-org metric: % of corrections where the hallucination stopped appearing within 30 days
- Settings page expansion: 4 new sections — Notification Preferences, Scan Frequency, API Keys (Agency only), Danger Zone
- `org_settings` table — stores per-org configurable settings
- `GET/PUT /api/settings` — read and update org settings
- Scan frequency: weekly (default), bi-weekly, monthly — gates the SOV cron per org
- API keys: Agency orgs can generate a LocalVector API key (`lv_live_` prefix, SHA-256 hash stored)
- Danger Zone: delete all scan data, delete organization (owner only, exact confirmation text, 5-second countdown)

**What this sprint does NOT build:** the actual API that uses Agency API keys (future), advanced Slack notification customization, custom scan scheduling by specific day/time.

---

## Pre-Flight Checklist — READ THESE FILES FIRST

```
Read AI_RULES.md                        — All rules (58 rules as of Sprint 120)
Read CLAUDE.md                          — Full implementation inventory
Read lib/ai/providers.ts                — AI client initialization pattern
Read supabase/prod_schema.sql
  FIND: ai_hallucinations status CHECK constraint (exact values + name)
  FIND: content_drafts trigger_type CHECK constraint (exact values + name)
  FIND: organizations — all existing columns
  FIND: org_members — role values
  FIND: sov_evaluations — schema
Read app/dashboard/hallucinations/      — Existing hallucination UI + actions
Read app/dashboard/settings/page.tsx    — Current settings page structure
Read app/api/cron/audit/route.ts        — Hallucination detection logic
Read lib/supabase/database.types.ts     — All current types
Read src/__fixtures__/golden-tenant.ts  — Existing fixtures
Read vercel.json                        — Cron schedule format
```

**Read before writing code:**

1. **`ai_hallucinations.status` CHECK constraint.** Find the exact constraint name and values in prod_schema.sql. Add 'corrected' only if missing. The migration must use the exact existing constraint name in DROP CONSTRAINT.

2. **Content draft `trigger_type` constraint.** Same — find exact name and values. Add 'correction' only if missing.

3. **API key generation.** Use Node's built-in `crypto`: `randomBytes(32).toString('hex')` for the key body, prefix `lv_live_`. Store only SHA-256 hex hash. Show raw key ONCE.

4. **Correction re-scan vs. full SOV cron.** The re-scan runs only the specific claim text through AI and checks if it's still presented as true. Does NOT update `sov_evaluations`. Writes to `correction_follow_ups` only.

5. **Scan frequency gates the SOV cron.** Before processing each org, check `org_settings.scan_frequency` and when the org was last scanned. Skip if within threshold: weekly=7d, bi-weekly=14d, monthly=28d.

6. **Danger Zone requires service role client.** Auth check (owner role) first, then `createServiceRoleClient()` for the destructive DELETE.


---

## Architecture

```
lib/corrections/
  index.ts
  types.ts                        — CorrectionFollowUp, CorrectionReScanStatus
  correction-brief-prompt.ts      — Pure prompt builders
  correction-service.ts           — Full correction lifecycle

lib/settings/
  index.ts
  types.ts                        — OrgSettings, OrgApiKey, ScanFrequency
  settings-service.ts             — DB ops + shouldScanOrg
  api-key-service.ts              — Key gen, list, revoke

app/api/
  hallucinations/[id]/correct/route.ts
  cron/correction-rescan/route.ts
  settings/route.ts               — GET + PUT
  settings/api-keys/route.ts      — GET + POST
  settings/api-keys/[keyId]/route.ts — DELETE
  settings/danger/delete-scan-data/route.ts
  settings/danger/delete-org/route.ts

app/dashboard/
  settings/_components/
    NotificationSettings.tsx
    ScanFrequencySettings.tsx
    ApiKeySettings.tsx
    DangerZoneSettings.tsx
  hallucinations/_components/
    CorrectButton.tsx
    CorrectionStatusBadge.tsx
```

---

## Migration — `[ts]_corrections_settings.sql`

```sql
-- Sprint 121: Correction Follow-up + Settings Expansion

-- 1. Add 'corrected' to ai_hallucinations status if not present
-- READ exact constraint name from prod_schema.sql before writing.
-- Pattern (adjust names to match schema):
-- ALTER TABLE public.ai_hallucinations
--   DROP CONSTRAINT IF EXISTS ai_hallucinations_status_check;
-- ALTER TABLE public.ai_hallucinations
--   ADD CONSTRAINT ai_hallucinations_status_check
--   CHECK (status IN ('new', 'confirmed', 'corrected', 'dismissed'));
-- Only add 'corrected' — preserve all existing values.

ALTER TABLE public.ai_hallucinations
  ADD COLUMN IF NOT EXISTS corrected_at timestamptz;

-- 2. Add 'correction' to content_drafts trigger_type if not present
-- Same pattern — read existing constraint name from schema.

-- 3. correction_follow_ups table
CREATE TABLE IF NOT EXISTS public.correction_follow_ups (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hallucination_id      uuid        NOT NULL UNIQUE
                                    REFERENCES public.ai_hallucinations(id)
                                    ON DELETE CASCADE,
  org_id                uuid        NOT NULL
                                    REFERENCES public.organizations(id)
                                    ON DELETE CASCADE,
  correction_brief_id   uuid        REFERENCES public.content_drafts(id)
                                    ON DELETE SET NULL,
  rescan_due_at         timestamptz NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  rescan_completed_at   timestamptz,
  rescan_status         text        NOT NULL DEFAULT 'pending'
                                    CHECK (rescan_status IN (
                                      'pending','cleared','persists','inconclusive'
                                    )),
  rescan_ai_response    text,
  created_at            timestamptz NOT NULL DEFAULT NOW(),
  updated_at            timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_correction_follow_ups_org_id
  ON public.correction_follow_ups (org_id);

CREATE INDEX IF NOT EXISTS idx_correction_follow_ups_rescan_due
  ON public.correction_follow_ups (rescan_due_at, rescan_status)
  WHERE rescan_status = 'pending';

ALTER TABLE public.correction_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "correction_follow_ups: members can read"
  ON public.correction_follow_ups FOR SELECT
  USING (org_id = public.current_user_org_id());

CREATE POLICY "correction_follow_ups: service role full access"
  ON public.correction_follow_ups FOR ALL
  USING (auth.role() = 'service_role');

-- 4. org_settings table
CREATE TABLE IF NOT EXISTS public.org_settings (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    uuid        NOT NULL UNIQUE
                                        REFERENCES public.organizations(id)
                                        ON DELETE CASCADE,
  notify_email_digest       boolean     NOT NULL DEFAULT true,
  notify_slack_webhook_url  text,
  notify_in_app             boolean     NOT NULL DEFAULT true,
  notify_sov_drop_threshold int         NOT NULL DEFAULT 5
                                        CHECK (notify_sov_drop_threshold BETWEEN 1 AND 20),
  scan_frequency            text        NOT NULL DEFAULT 'weekly'
                                        CHECK (scan_frequency IN ('weekly','bi-weekly','monthly')),
  created_at                timestamptz NOT NULL DEFAULT NOW(),
  updated_at                timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_settings: members can read"
  ON public.org_settings FOR SELECT
  USING (org_id = public.current_user_org_id());

CREATE POLICY "org_settings: owner and admin can update"
  ON public.org_settings FOR UPDATE
  USING (
    org_id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = public.current_user_org_id()
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  );

CREATE POLICY "org_settings: service role full access"
  ON public.org_settings FOR ALL
  USING (auth.role() = 'service_role');

-- 5. org_api_keys table (Agency plan only)
CREATE TABLE IF NOT EXISTS public.org_api_keys (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL
                            REFERENCES public.organizations(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  key_prefix    text        NOT NULL,   -- first 12 chars for display
  key_hash      text        NOT NULL,   -- SHA-256 hex — NEVER returned to clients
  created_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  last_used_at  timestamptz,
  expires_at    timestamptz,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, key_hash)
);

CREATE INDEX IF NOT EXISTS idx_org_api_keys_org_id
  ON public.org_api_keys (org_id) WHERE is_active = true;

ALTER TABLE public.org_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_api_keys: members can read"
  ON public.org_api_keys FOR SELECT
  USING (org_id = public.current_user_org_id());

CREATE POLICY "org_api_keys: owner only insert/update/delete"
  ON public.org_api_keys FOR ALL
  USING (
    org_id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = public.current_user_org_id()
        AND om.user_id = auth.uid()
        AND om.role = 'owner'
    )
  );

CREATE POLICY "org_api_keys: service role full access"
  ON public.org_api_keys FOR ALL
  USING (auth.role() = 'service_role');

-- 6. Backfill org_settings for existing orgs
INSERT INTO public.org_settings (org_id)
SELECT id FROM public.organizations
ON CONFLICT (org_id) DO NOTHING;
```


---

## Component Specs

### `lib/corrections/types.ts`

```typescript
export type CorrectionReScanStatus = 'pending' | 'cleared' | 'persists' | 'inconclusive';

export interface CorrectionFollowUp {
  id: string;
  hallucination_id: string;
  org_id: string;
  correction_brief_id: string | null;
  rescan_due_at: string;
  rescan_completed_at: string | null;
  rescan_status: CorrectionReScanStatus;
  rescan_ai_response: string | null;
  created_at: string;
  updated_at: string;
}

export interface CorrectionResult {
  follow_up: CorrectionFollowUp;
  brief_id: string | null;
}
```

### `lib/settings/types.ts`

```typescript
export type ScanFrequency = 'weekly' | 'bi-weekly' | 'monthly';

export const SCAN_FREQUENCY_DAYS: Record<ScanFrequency, number> = {
  'weekly':    7,
  'bi-weekly': 14,
  'monthly':   28,
};

export interface OrgSettings {
  id: string; org_id: string;
  notify_email_digest: boolean;
  notify_slack_webhook_url: string | null;
  notify_in_app: boolean;
  notify_sov_drop_threshold: number;
  scan_frequency: ScanFrequency;
  created_at: string; updated_at: string;
}

export type OrgSettingsUpdate = Partial<Omit<OrgSettings,
  'id' | 'org_id' | 'created_at' | 'updated_at'>>;

export interface OrgApiKey {
  id: string; org_id: string; name: string;
  key_prefix: string;         // displayed in list — NOT the hash
  created_by: string;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  // key_hash NEVER in this type
}

export interface CreateApiKeyResult {
  api_key: OrgApiKey;
  raw_key: string;  // returned ONCE only
}
```

### `lib/corrections/correction-brief-prompt.ts` — PURE FUNCTIONS

```typescript
// buildCorrectionBriefPrompt(params): { systemPrompt: string; userPrompt: string }
// params: { claim_text, org_name, correct_info, content_type }
//
// systemPrompt:
//   "You are a professional content writer helping a local business correct
//    misinformation appearing in AI responses. Write factual, authoritative
//    content that clearly establishes the correct information so AI systems
//    can learn from it. Keep content concise (150-200 words) and factual."
//
// userPrompt:
//   "A false claim about {org_name} is circulating in AI responses:
//    FALSE CLAIM: "{claim_text}"
//    Write a {content_type} that clearly establishes: {correct_info}
//    Make it factual, easy for AI systems to parse, suitable for publishing."
//
// buildCorrectionDraftTitle(claim_text, org_name): string
//   Returns: "Correction: {claim_text.slice(0, 60)} — {org_name}"
```

### `lib/corrections/correction-service.ts`

```typescript
// markHallucinationCorrected(supabase, hallucinationId, orgId, notes?)
//   1. Fetch hallucination — throw 'hallucination_not_found' if missing/wrong org
//   2. Throw 'already_corrected' if status already 'corrected'
//   3. UPDATE ai_hallucinations SET status='corrected', corrected_at=NOW()
//   4. INSERT correction_follow_ups (rescan_due_at = NOW() + 14d)
//   5. void generateCorrectionBrief(...) — fire-and-forget
//   6. Return CorrectionResult
//
// generateCorrectionBrief(supabase, hallucination, orgName, notes?) — NEVER THROWS
//   1. Build prompt via buildCorrectionBriefPrompt()
//   2. anthropic.messages.create({ model: 'claude-3-5-haiku-20241022', max_tokens:512 })
//   3. INSERT content_drafts { trigger_type:'correction', status:'draft', ... }
//   4. UPDATE correction_follow_ups SET correction_brief_id = newDraft.id
//   On any error: log warning, return
//
// runCorrectionRescan(supabase, followUp)
//   1. Fetch hallucination.claim_text
//   2. Ask Haiku: does this claim appear accurate?
//      messages: [{ role:'user', content: `${claim_text}\n\nIs this statement true?` }]
//   3. Heuristic on response:
//      'no longer'|'not accurate'|'false'|'incorrect'|'not true' → 'cleared'
//      'yes'|'accurate'|'true'|'correct' → 'persists'
//      else → 'inconclusive'
//   4. UPDATE correction_follow_ups: rescan_status, rescan_completed_at=NOW(),
//      rescan_ai_response, updated_at=NOW()
//
// getCorrectionEffectivenessScore(supabase, orgId)
//   COUNT cleared / COUNT (cleared+persists) in last 30 days
//   Returns { cleared, total_rescanned, score: number|null }

// lib/settings/settings-service.ts
//
// getOrCreateOrgSettings(supabase, orgId)
//   SELECT * WHERE org_id=$orgId — if missing: INSERT defaults and return
//
// updateOrgSettings(supabase, orgId, updates: OrgSettingsUpdate)
//   Validate: scan_frequency enum, threshold 1-20,
//   webhook starts with 'https://hooks.slack.com/' or is null
//   UPDATE SET ...updates, updated_at=NOW()
//
// shouldScanOrg(supabase, orgId, settings)
//   SELECT MAX(created_at) FROM sov_evaluations WHERE org_id=$orgId
//   New org (no rows) → return true
//   last_scan < NOW() - INTERVAL '{SCAN_FREQUENCY_DAYS[freq]} days' → true
//   else → false

// lib/settings/api-key-service.ts
//
// generateApiKey(supabase, orgId, userId, name, planTier)
//   Throw 'agency_required' if planTier !== 'agency'
//   raw_key = 'lv_live_' + randomBytes(32).toString('hex')
//   key_hash = createHash('sha256').update(raw_key).digest('hex')
//   key_prefix = raw_key.slice(0, 12)
//   INSERT org_api_keys { org_id, name, key_prefix, key_hash, created_by }
//   Return { api_key: OrgApiKey, raw_key }  — raw_key shown ONCE
//
// listApiKeys(supabase, orgId)
//   SELECT id,org_id,name,key_prefix,created_by,last_used_at,
//          expires_at,is_active,created_at   -- key_hash NEVER selected
//   WHERE org_id=$orgId AND is_active=true
//
// revokeApiKey(supabase, orgId, keyId)
//   UPDATE SET is_active=false WHERE id=$keyId AND org_id=$orgId
//   Return { ok: true }
```

### API Routes

```typescript
// POST /api/hallucinations/[id]/correct
// Auth: owner | admin only
// Body: { notes?: string }
// 1. markHallucinationCorrected(supabase, id, orgId, notes)
// 2. Return { ok:true, follow_up_id, brief_generating:true }
// Errors: 400 hallucination_not_found|already_corrected, 403 insufficient_role

// GET /api/settings — any org member
// Returns OrgSettings

// PUT /api/settings — owner | admin
// Body: OrgSettingsUpdate
// Validates: scan_frequency, threshold 1-20, webhook URL prefix
// Returns updated OrgSettings
// Errors: 400 invalid_*, 403

// GET /api/settings/api-keys — owner + agency plan
// Returns { keys: OrgApiKey[] }  — key_hash never included

// POST /api/settings/api-keys — owner + agency plan
// Body: { name: string }
// Returns CreateApiKeyResult with warning: "Copy this key now. It will not be shown again."
// Errors: 400 missing_name|name_too_long, 403 owner_required|agency_required

// DELETE /api/settings/api-keys/[keyId] — owner + agency plan
// Returns { ok: true }

// DELETE /api/settings/danger/delete-scan-data — OWNER ONLY
// Body: { confirmation: string }
// confirmation must === 'DELETE' (exact, case-sensitive)
// Uses service role client to delete:
//   correction_follow_ups, sov_first_mover_alerts, ai_hallucinations, sov_evaluations
// Returns { ok:true, deleted_at: ISO string }
// Errors: 400 confirmation_required|wrong_confirmation, 403 owner_required

// DELETE /api/settings/danger/delete-org — OWNER ONLY
// Body: { confirmation: string }
// confirmation must === org.slug
// 1. Cancel Stripe subscription (log warning on error, proceed)
// 2. DELETE FROM organizations WHERE id=$orgId (CASCADE)
// 3. Sign out user
// Returns { ok:true, redirect:'/' }

// POST /api/cron/correction-rescan
// CRON_SECRET protected
// SELECT pending corrections WHERE rescan_due_at <= NOW() LIMIT 20
// runCorrectionRescan() for each
// Add to vercel.json: { "path":"/api/cron/correction-rescan", "schedule":"0 4 * * *" }
```

### Dashboard Components

```typescript
// CorrectButton.tsx — 'use client'
// Props: { hallucinationId, claimText, onCorrected? }
// Flow: button → inline form (optional notes textarea) → confirm
// POST /api/hallucinations/{id}/correct
// Success: "Marked as corrected. A correction brief is being generated."
// Disable button after success to prevent double-submit
// data-testid: correct-hallucination-btn, correction-notes-input,
//              confirm-correction-btn, cancel-correction-btn, correction-success-msg

// CorrectionStatusBadge.tsx
// Props: { followUp?: CorrectionFollowUp | null }
// pending → amber "Rescan pending in {N} days"
// cleared → green "Cleared — hallucination no longer detected"
// persists → red "Still appearing — consider stronger correction content"
// inconclusive → gray "Rescan inconclusive"
// data-testid: correction-status-badge

// NotificationSettings.tsx — 'use client'
// Fields: email digest toggle, SOV drop threshold (1-20),
//         Slack webhook URL, in-app notifications toggle
// PUT /api/settings on save
// data-testid: notification-settings-form, email-digest-toggle,
//              sov-threshold-input, slack-webhook-input, save-notification-settings-btn

// ScanFrequencySettings.tsx — 'use client'
// Radio: Weekly / Bi-weekly / Monthly
// Auto-saves on selection (no separate save button)
// Shows estimated next scan date
// data-testid: scan-frequency-select, scan-frequency-weekly,
//              scan-frequency-bi-weekly, scan-frequency-monthly

// ApiKeySettings.tsx — 'use client'
// Agency plan: list of keys (name, prefix, created_at, last_used_at) + Revoke
// Generate New Key: name input → POST → modal with raw key
// Modal: "Copy this key now. It will not be shown again."
// [Copy to Clipboard] [I've saved the key — Close]
// Close only enabled after copy OR after 10 seconds
// Non-agency: upgrade prompt
// data-testid: api-keys-section, api-key-row-{id}, revoke-api-key-{id},
//              generate-api-key-btn, new-key-name-input,
//              raw-key-display, copy-key-btn, confirm-saved-key-btn

// DangerZoneSettings.tsx — 'use client'
// Props: { orgSlug, isOwner }
// If !isOwner: return null
//
// Action 1: Delete All Scan Data
//   [Delete Scan Data] → modal → "Type DELETE to confirm" text input
//   5-second countdown before Confirm button enables
//   Both: countdown complete AND input === 'DELETE' required
//   → DELETE /api/settings/danger/delete-scan-data { confirmation: 'DELETE' }
//   → Success: router.refresh()
//
// Action 2: Delete Organization
//   [Delete Organization] → modal → "Type your org slug to confirm: {orgSlug}"
//   5-second countdown + input === orgSlug required
//   → DELETE /api/settings/danger/delete-org { confirmation: orgSlug }
//   → Success: router.push('/')
//
// Both buttons: red color
// data-testid: danger-zone-section, delete-scan-data-btn,
//              delete-scan-data-confirm-input, confirm-delete-scan-data-btn,
//              delete-org-btn, delete-org-confirm-input, confirm-delete-org-btn
```

---

## SOV Cron Modification

```typescript
// MODIFY app/api/cron/sov/route.ts
// Add scan frequency gate at start of per-org processing:
//
// const settings = await getOrCreateOrgSettings(serviceClient, orgId);
// const shouldScan = await shouldScanOrg(serviceClient, orgId, settings);
// if (!shouldScan) {
//   console.log(`Skipping org ${orgId}: scan_frequency=${settings.scan_frequency}`);
//   continue;
// }
//
// Change nothing else in the cron. Default (weekly) behavior is unchanged.
```

---

## Seed + Fixtures

```typescript
// supabase/seed.sql — add org_settings for golden tenant
// INSERT INTO public.org_settings (org_id) VALUES (golden_org_id)
// ON CONFLICT (org_id) DO NOTHING;

// golden-tenant.ts additions:
export const MOCK_CORRECTION_FOLLOW_UP_PENDING = {
  id: 'cfu-001', hallucination_id: 'hall-001',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  correction_brief_id: 'draft-correction-001',
  rescan_due_at: '2026-03-15T00:00:00.000Z',
  rescan_completed_at: null, rescan_status: 'pending' as const,
  rescan_ai_response: null,
  created_at: '2026-03-01T10:00:00.000Z', updated_at: '2026-03-01T10:00:00.000Z',
};

export const MOCK_CORRECTION_FOLLOW_UP_CLEARED = {
  ...MOCK_CORRECTION_FOLLOW_UP_PENDING, id: 'cfu-002',
  rescan_completed_at: '2026-03-15T04:00:00.000Z',
  rescan_status: 'cleared' as const,
  rescan_ai_response: 'This statement is no longer accurate...',
};

export const MOCK_ORG_SETTINGS = {
  id: 'settings-001', org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  notify_email_digest: true, notify_slack_webhook_url: null,
  notify_in_app: true, notify_sov_drop_threshold: 5,
  scan_frequency: 'weekly' as const,
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-03-01T00:00:00.000Z',
};

export const MOCK_ORG_API_KEY = {
  id: 'key-001', org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  name: 'Production Key', key_prefix: 'lv_live_3a',
  created_by: 'golden-user-id', last_used_at: null,
  expires_at: null, is_active: true,
  created_at: '2026-03-01T10:00:00.000Z',
};
```


---

## Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/correction-service.test.ts` — 16 tests

```
describe('markHallucinationCorrected — Supabase mocked')
  1.  updates status='corrected' and corrected_at=NOW()
  2.  inserts correction_follow_ups with rescan_due_at = NOW()+14d
  3.  throws 'hallucination_not_found' when id not found or wrong org
  4.  throws 'already_corrected' when status already 'corrected'
  5.  calls generateCorrectionBrief() as fire-and-forget

describe('generateCorrectionBrief — Supabase + Anthropic mocked')
  6.  calls Anthropic with model='claude-3-5-haiku-20241022'
  7.  inserts content_drafts with trigger_type='correction'
  8.  updates correction_follow_ups.correction_brief_id
  9.  does NOT throw on Anthropic error (logs warning only)
  10. includes notes in prompt when provided

describe('runCorrectionRescan — Supabase + Anthropic mocked')
  11. rescan_status='cleared' when response has 'not accurate'
  12. rescan_status='persists' when response has 'accurate'
  13. rescan_status='inconclusive' for ambiguous response
  14. sets rescan_completed_at to NOW()
  15. stores rescan_ai_response text

describe('getCorrectionEffectivenessScore — Supabase mocked')
  16. score = (cleared/total)*100; null when total_rescanned=0
```

### Test File 2: `src/__tests__/unit/settings-service.test.ts` — 12 tests

```
describe('updateOrgSettings')
  1.  rejects invalid scan_frequency values
  2.  rejects threshold < 1
  3.  rejects threshold > 20
  4.  rejects webhook not starting with https://hooks.slack.com/
  5.  accepts null webhook URL
  6.  returns updated OrgSettings

describe('shouldScanOrg')
  7.  true for new org (no sov_evaluations)
  8.  weekly: true when last scan > 7 days ago
  9.  weekly: false when last scan < 7 days ago
  10. bi-weekly: false when last scan < 14 days ago
  11. monthly: false when last scan < 28 days ago
  12. monthly: true when last scan > 28 days ago
```

### Test File 3: `src/__tests__/unit/api-key-service.test.ts` — 10 tests

```
1.  throws 'agency_required' for non-agency plan
2.  raw_key starts with 'lv_live_'
3.  raw_key body is 64 hex chars
4.  key_prefix = first 12 chars of raw_key
5.  key_hash is SHA-256 hex (64 chars)
6.  OrgApiKey returned does NOT contain key_hash field
7.  listApiKeys: SELECT never includes key_hash
8.  listApiKeys: only returns is_active=true rows
9.  revokeApiKey: sets is_active=false (not DELETE)
10. revokeApiKey: throws 404 if key not found in org
```

### Test File 4: `src/__tests__/unit/correction-settings-routes.test.ts` — 14 tests

```
describe('POST /api/hallucinations/[id]/correct')
  1.  401 when not authenticated
  2.  403 for member role
  3.  400 hallucination_not_found
  4.  400 already_corrected
  5.  returns { ok:true, follow_up_id, brief_generating:true }

describe('PUT /api/settings')
  6.  403 for member role
  7.  400 for invalid scan_frequency
  8.  400 for invalid webhook URL
  9.  returns updated OrgSettings

describe('DELETE /api/settings/danger/delete-scan-data')
  10. 400 when confirmation missing
  11. 400 when confirmation != 'DELETE'
  12. 403 for admin role (owner only)
  13. deletes the 4 scan tables for the org only

describe('POST /api/settings/api-keys')
  14. raw_key present in response
```

### Test File 5: `src/__tests__/e2e/corrections-settings.spec.ts` — 7 Playwright tests

```
1.  Mark Corrected button visible for non-corrected hallucinations
2.  Correction flow: click, notes modal, confirm, success message
3.  After correction: CorrectionStatusBadge shows pending state
4.  Cleared correction: badge shows green cleared state
5.  Scan frequency: selecting bi-weekly auto-saves
6.  API key generation: raw key modal appears (Agency plan mocked)
7.  Danger zone: Confirm button disabled until DELETE typed and countdown done
```

### Run Commands

```bash
npx vitest run src/__tests__/unit/correction-service.test.ts
npx vitest run src/__tests__/unit/settings-service.test.ts
npx vitest run src/__tests__/unit/api-key-service.test.ts
npx vitest run src/__tests__/unit/correction-settings-routes.test.ts
npx vitest run
npx playwright test src/__tests__/e2e/corrections-settings.spec.ts
npx tsc --noEmit
```

Total: 52 Vitest + 7 Playwright = 59 tests

---

## Files to Create/Modify — 30 files

1. supabase/migrations/[ts]_corrections_settings.sql — CREATE
2. lib/corrections/types.ts — CREATE
3. lib/corrections/correction-brief-prompt.ts — CREATE
4. lib/corrections/correction-service.ts — CREATE
5. lib/corrections/index.ts — CREATE
6. lib/settings/types.ts — CREATE
7. lib/settings/settings-service.ts — CREATE
8. lib/settings/api-key-service.ts — CREATE
9. lib/settings/index.ts — CREATE
10. app/api/hallucinations/[id]/correct/route.ts — CREATE
11. app/api/cron/correction-rescan/route.ts — CREATE
12. app/api/settings/route.ts — CREATE
13. app/api/settings/api-keys/route.ts — CREATE
14. app/api/settings/api-keys/[keyId]/route.ts — CREATE
15. app/api/settings/danger/delete-scan-data/route.ts — CREATE
16. app/api/settings/danger/delete-org/route.ts — CREATE
17. app/dashboard/hallucinations/_components/CorrectButton.tsx — CREATE
18. app/dashboard/hallucinations/_components/CorrectionStatusBadge.tsx — CREATE
19. app/dashboard/settings/_components/NotificationSettings.tsx — CREATE
20. app/dashboard/settings/_components/ScanFrequencySettings.tsx — CREATE
21. app/dashboard/settings/_components/ApiKeySettings.tsx — CREATE
22. app/dashboard/settings/_components/DangerZoneSettings.tsx — CREATE
23. app/dashboard/settings/page.tsx — MODIFY (add 4 sections)
24. app/dashboard/hallucinations/ (existing) — MODIFY
25. app/api/cron/sov/route.ts — MODIFY (scan frequency gate)
26. vercel.json — MODIFY (correction-rescan at "0 4 * * *")
27. supabase/prod_schema.sql — MODIFY
28. lib/supabase/database.types.ts — MODIFY
29. src/__fixtures__/golden-tenant.ts — MODIFY
30. supabase/seed.sql — MODIFY

---

## What NOT to Do

1. DO NOT store raw API keys — SHA-256 hash only in DB
2. DO NOT block correction API on brief generation — always void
3. DO NOT hardcode constraint names — read from prod_schema.sql first
4. DO NOT allow admin/member to access Danger Zone — owner only
5. DO NOT skip the 5-second countdown in Danger Zone UI
6. DO NOT run Danger Zone deletes as regular user — service role client
7. DO NOT expose key_hash in any response — explicit column SELECT only
8. DO NOT gate the correction-rescan cron with scan frequency
9. DO NOT use page.waitForTimeout() in Playwright
10. DO NOT use as any on Supabase clients (AI_RULES 38.2)

---

## Definition of Done

- Migration: constraints updated, corrected_at col, 3 new tables, 8 RLS policies, backfill
- All 4 service files complete with specified functions
- All 8 API routes with correct auth guards
- All 6 dashboard components with data-testid attributes
- Settings page + hallucinations UI modified
- SOV cron modified with frequency gate
- vercel.json updated with new cron
- 52 Vitest + 7 Playwright = 59 tests passing
- npx vitest run — ALL passing, zero regressions
- npx tsc --noEmit — 0 errors
- DEVLOG.md entry, AI_RULES Rule 59, roadmap Sprint 121 marked done

---

## AI_RULES Update (Add Rule 59)

59. Corrections + Settings in lib/corrections/ + lib/settings/ (Sprint 121)

- generateCorrectionBrief() never throws. Always void fire-and-forget.
- API keys: SHA-256 hash only stored. raw_key returned ONCE, never in type.
  listApiKeys() explicit column SELECT — key_hash never in OrgApiKey type.
- shouldScanOrg() gates the SOV cron. weekly=7d, bi-weekly=14d, monthly=28d.
  New orgs (no evaluations) always scan regardless of frequency.
- Danger Zone: service role + owner only. Auth check first. 5s countdown + exact text.
- Correction rescan LIMIT 20 per run. 3-way result: cleared/persists/inconclusive.
- Settings validation server-side: scan_frequency enum, threshold 1-20,
  Slack webhook prefix https://hooks.slack.com/ or null.

---

## What Comes Next

Sprint 122 — Benchmark Comparisons: Show how each org's AI visibility compares
to industry category and location. Requires anonymized cross-org aggregate stats,
benchmark_snapshots table, and a Benchmark card on the main dashboard.
