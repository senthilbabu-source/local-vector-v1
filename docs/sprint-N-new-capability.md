# Sprint N — New Capability: Settings Expansion, On-Demand AI Preview & Correction Follow-Up

> **Claude Code Prompt — Bulletproof Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`
> **Prerequisites:** Sprints A–M must be fully merged and all tests passing. Sprint N is the first purely additive sprint — no debt, no repairs. All three features are net-new capability.

---

## 🎯 Objective

Sprint N is different from every sprint before it. Sprints A–M were debt repayment — fixing what was broken, filling gaps, making promises the product was already making. Sprint N adds capability the product hasn't had at all.

Three features, each targeting a specific high-value moment in the user journey:

1. **H2 — Settings Page Expansion:** The current settings page has 5 sections. Eight useful controls are missing — AI model selection, custom SOV queries, scan day preference, competitor management shortcut, webhook URL, and three new notification toggles. Each missing control is a user who opened Settings looking for something, didn't find it, and gave up. This sprint adds the three highest-value missing settings: AI model selection (which of OpenAI / Perplexity / Gemini / Copilot / Claude to include in scans), scan day preference (which day of the week to run the weekly cron), and a webhook URL for hallucination alert notifications (agency users). Competitor management from within Settings is also added as a shortcut to the existing AddCompetitorForm flow.

2. **N2 — On-Demand AI Answer Preview:** The most viscerally compelling feature the product can offer. Today, a user signs up, scans run weekly on a cron, and AI responses are stored and displayed from that batch data. There's no way to ask "what does ChatGPT say about my business right now?" outside of waiting for the next Sunday scan. The AI Answer Preview widget changes this: type any query, hit "Run", and see live responses from 3 AI models — ChatGPT, Perplexity, and Gemini — in real time. The result is streamed back model-by-model using Server-Sent Events. This is the feature that turns a skeptical trial user into a paying customer. Seeing "ChatGPT says your hookah lounge closes at 9pm but you actually close at midnight" in real time, on demand, is the moment the product's value becomes undeniable.

3. **N3 — Correction Follow-Up Scan:** When a user generates a hallucination correction brief and submits it, the alert status moves to `verifying`. Then nothing happens. There's no feedback loop — the user never learns whether their correction worked. This sprint adds an automated follow-up cron that, 14 days after a correction is submitted, runs a targeted re-scan on that specific hallucination's query/model combination and updates the alert status to either `resolved` (AI model now says the correct thing) or `persists` (still wrong). The user gets a notification. The proof timeline gets an entry. This closes the feedback loop that makes customers feel their work is paying off — the strongest retention signal in the product's arsenal.

**Why these three together:** Settings expansion is table stakes (users expect to configure their product). The AI Answer Preview is the acquisition and conversion hook — a feature you can demo in 30 seconds that immediately justifies the subscription. The correction follow-up closes the retention loop — it's the reason users come back after their first correction to see if it worked. Together they address onboarding (settings), conversion (preview), and retention (follow-up).

**Estimated total implementation time:** 26–32 hours. Settings expansion (6–8 hours): straightforward form additions, a new `org_settings` table migration for storing preferences. On-demand AI preview (12–15 hours): the heaviest lift — requires an SSE streaming endpoint, a client-side streaming renderer, and live calls to three AI provider APIs. Correction follow-up (6–8 hours): a new cron route, targeted re-scan logic, status update, notification trigger.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                                   — Rules 42–74 from Sprints A–M now in effect
Read CLAUDE.md                                          — Full Sprint A–M implementation inventory
Read MEMORY.md                                          — All architecture decisions through Sprint M

--- H2: Settings Expansion ---
Read app/dashboard/settings/_components/SettingsForm.tsx — COMPLETE FILE. Current 5 sections:
                                                          Account, Security, Organization,
                                                          Notifications, Danger Zone. Understand
                                                          how each section renders, how form actions
                                                          work, how state is managed.
Read app/dashboard/settings/                            — ls; read all files. Any existing
                                                          settings sections or tabs.
Read supabase/prod_schema.sql                           — Does an org_settings or org_preferences
                                                          table exist? What columns? If not, a
                                                          migration is needed for: tracked_models[],
                                                          scan_day_of_week, webhook_url.
Read app/api/cron/sov/route.ts                          — How does the SOV cron currently determine
                                                          which AI models to query? Is it hardcoded
                                                          or already driven by a config? Understanding
                                                          this tells you what the tracked_models[]
                                                          setting needs to write to.
Read lib/services/sov-seed.ts                           — How are SOV queries generated? Where
                                                          would user-added custom queries live?
Read app/dashboard/compete/_components/AddCompetitorForm.tsx — The competitor management flow
                                                          that Settings will link to.
Read app/dashboard/settings/team/                       — Sprint B: team management. Don't duplicate.

--- N2: On-Demand AI Answer Preview ---
Read app/dashboard/ai-responses/                        — COMPLETE directory. The existing page
                                                          that shows stored AI responses. What
                                                          data shape does it use? What components?
                                                          The AI Answer Preview is a sibling feature.
Read app/dashboard/ai-assistant/                        — COMPLETE directory. The existing general
                                                          chat interface. Don't duplicate — the
                                                          Preview is query-specific, not general-purpose.
Read app/api/                                           — ls. What API routes already exist?
                                                          Are there any existing streaming routes?
                                                          Check for SSE or streaming patterns.
Read lib/services/                                      — ls. What AI provider clients already
                                                          exist? Check for openai.ts, perplexity.ts,
                                                          gemini.ts or equivalent. If provider
                                                          clients already exist, use them — don't
                                                          rewrite from scratch.
Read .env.example                                       — What AI provider API keys already exist?
                                                          OPENAI_API_KEY, PERPLEXITY_API_KEY,
                                                          GOOGLE_AI_API_KEY (Gemini). If any are
                                                          missing, document in DEVLOG.
Read lib/plan-enforcer.ts                               — Is on-demand AI preview gated by plan?
                                                          If so, which plans have access? Enforce
                                                          this in the API route.

--- N3: Correction Follow-Up ---
Read app/dashboard/_components/CorrectionPanel.tsx      — COMPLETE FILE. How does the correction
                                                          flow work? What status values does
                                                          hallucination_alerts use? What happens
                                                          after 'verifying'?
Read lib/services/correction-generator.service.ts       — COMPLETE FILE. What does it generate?
                                                          What does it write to the DB?
Read supabase/prod_schema.sql                           — hallucination_alerts table: exact columns.
                                                          correction_briefs table (if exists): columns.
                                                          What follow_up_scan_at column exists?
                                                          What resolved_at, persists_at columns?
                                                          What status enum values are allowed?
Read app/api/cron/                                      — ls. All existing cron routes. Understand
                                                          the standard cron route pattern — the
                                                          follow-up cron follows the same pattern.
Read lib/services/sov-seed.ts                           — How does the SOV scan work? The
                                                          correction follow-up re-scan uses a
                                                          subset of this logic (targeted to one
                                                          specific query/model combo).
Read app/dashboard/proof-timeline/                      — The Proof Timeline page. The follow-up
                                                          scan result writes an entry here.
Read lib/services/weekly-digest.service.ts              — Sprint K: weekly digest pattern.
                                                          Correction follow-up notification
                                                          follows a similar email dispatch pattern.
```

**Specifically understand before writing any code:**

- **AI model configuration plumbing:** The `tracked_models[]` setting in Settings tells the SOV cron which models to scan. Before writing the settings form, understand how the SOV cron currently picks which models to query. If it's hardcoded (e.g., `['chatgpt', 'perplexity', 'gemini']`), the setting needs to persist to `org_settings.tracked_models` and the cron needs to read it. If the cron already reads from a config table, understand the existing schema. Do not create a parallel configuration system — integrate with whatever already exists.

- **SSE streaming pattern:** The on-demand AI preview streams responses using Server-Sent Events (SSE). Check whether any existing API routes in `app/api/` already use SSE or streaming. If so, use the same pattern. If not, use Next.js Route Handler streaming: `new Response(readable, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } })`. The client uses `EventSource` or `fetch` with `ReadableStream`.

- **AI provider client reuse:** Before writing any provider-specific code, check `lib/services/` for existing OpenAI, Perplexity, or Gemini clients. The SOV cron and hallucination detection features already call these providers — reuse their clients. If no clients exist, use the official SDKs: `openai` npm package for ChatGPT, `@perplexity-ai/sdk` or direct `fetch` for Perplexity, `@google/generative-ai` for Gemini.

- **Correction follow-up cron trigger:** Two options: (1) a dedicated cron job that runs daily and finds all `verifying` corrections where `follow_up_at <= now()`, or (2) a webhook triggered when the correction brief is submitted. Option 1 is simpler and more reliable — a daily cron is already the pattern for other background work in the codebase. Option 2 requires a delayed job queue (probably not in the stack). Use Option 1.

- **Plan gating for on-demand preview:** Check `lib/plan-enforcer.ts`. The on-demand AI preview is a premium feature — trial users may get 1 free preview, Starter may get 5/month, Growth unlimited. Or it may be unlimited for all paid plans. Read plan-enforcer to understand whether any query credit system exists. If not, keep it simple: the on-demand preview is available to all paid plans (starter/growth/agency), not available on trial. Implement a simple plan check in the API route — do not build a full credit system in this sprint (that's N1, the Nice-to-Have).

---

## 🏗️ Architecture — What to Build

---

### Feature 1: Settings Page Expansion — H2

**The user's real question:** "I want to control how LocalVector works for me."

**Current experience:** Settings has 5 sections. AI model selection, scan day, webhook URL, and competitor management are not in Settings. Users who want these controls either can't find them (competitor management is buried in the Compete page) or can't access them at all (model selection, scan day, webhook).

**After Sprint N:** Three new settings sections added to `SettingsForm.tsx`:
- **Scan Preferences** — AI model checkboxes + scan day picker
- **Competitors** — shortcut card to AddCompetitorForm flow
- **Integrations** — Webhook URL field for alert notifications

#### Step 1: Migration (if needed) — `supabase/migrations/[timestamp]_add_org_settings.sql`

```sql
-- Only run if org_settings or equivalent doesn't already exist.
-- Check prod_schema.sql first: grep -A 20 "CREATE TABLE.*org_settings\|settings\|preferences" supabase/prod_schema.sql

CREATE TABLE IF NOT EXISTS public.org_settings (
  org_id        uuid PRIMARY KEY REFERENCES public.orgs(id) ON DELETE CASCADE,
  -- AI models to include in scans (array of model IDs matching SOV cron's model enum)
  -- Default: all models tracked
  tracked_models text[]   DEFAULT ARRAY['chatgpt', 'perplexity', 'gemini', 'copilot', 'claude'],
  -- Day of week for weekly scan: 0=Sunday, 1=Monday, ... 6=Saturday
  scan_day_of_week integer DEFAULT 0 CHECK (scan_day_of_week BETWEEN 0 AND 6),
  -- Webhook URL for hallucination alert notifications (agency feature)
  webhook_url   text,
  -- Extra notification prefs (JSON for future extensibility)
  notification_prefs jsonb DEFAULT '{}',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Backfill existing orgs with default settings:
INSERT INTO public.org_settings (org_id)
SELECT id FROM public.orgs
ON CONFLICT (org_id) DO NOTHING;

COMMENT ON TABLE public.org_settings IS 'User-configurable scan and notification preferences per org.';
```

**Read `prod_schema.sql` completely before running this migration.** If an `org_settings` table or equivalent already exists, adapt the migration to add only the missing columns (`ADD COLUMN IF NOT EXISTS`).

#### Step 2: Server action — `app/dashboard/settings/actions.ts` (add or update)

```typescript
/**
 * updateScanPreferences — saves tracked_models and scan_day_of_week
 * updateWebhookUrl — saves webhook_url
 * Both are server actions following the existing settings action pattern.
 */

'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';

// Model IDs must match the values the SOV cron uses — read sov/route.ts to confirm
const VALID_MODELS = ['chatgpt', 'perplexity', 'gemini', 'copilot', 'claude'] as const;
type ModelId = typeof VALID_MODELS[number];

const ScanPreferencesSchema = z.object({
  tracked_models: z.array(z.enum(VALID_MODELS)).min(1, 'Select at least one AI model'),
  scan_day_of_week: z.coerce.number().int().min(0).max(6),
});

const WebhookSchema = z.object({
  webhook_url: z.string().url('Must be a valid URL').or(z.literal('')).optional(),
});

export async function updateScanPreferences(formData: FormData) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };

    const { data: org } = await supabase.from('orgs').select('id').eq('owner_id', user.id).single();
    if (!org) return { error: 'Org not found' };

    const parsed = ScanPreferencesSchema.safeParse({
      tracked_models: formData.getAll('tracked_models'),
      scan_day_of_week: formData.get('scan_day_of_week'),
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };

    const { error } = await supabase
      .from('org_settings')
      .upsert({ org_id: org.id, ...parsed.data, updated_at: new Date().toISOString() });

    if (error) {
      Sentry.captureException(error, { tags: { action: 'updateScanPreferences' } });
      return { error: 'Failed to save preferences' };
    }

    revalidatePath('/dashboard/settings');
    return { success: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'updateScanPreferences' } });
    return { error: 'Unexpected error' };
  }
}

export async function updateWebhookUrl(formData: FormData) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };

    const { data: org } = await supabase.from('orgs').select('id').eq('owner_id', user.id).single();
    if (!org) return { error: 'Org not found' };

    const parsed = WebhookSchema.safeParse({ webhook_url: formData.get('webhook_url') ?? '' });
    if (!parsed.success) return { error: parsed.error.issues[0].message };

    const { error } = await supabase
      .from('org_settings')
      .upsert({ org_id: org.id, webhook_url: parsed.data.webhook_url || null, updated_at: new Date().toISOString() });

    if (error) {
      Sentry.captureException(error, { tags: { action: 'updateWebhookUrl' } });
      return { error: 'Failed to save webhook URL' };
    }

    revalidatePath('/dashboard/settings');
    return { success: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'updateWebhookUrl' } });
    return { error: 'Unexpected error' };
  }
}
```

#### Step 3: New settings sections in `SettingsForm.tsx`

Read the current `SettingsForm.tsx` completely. Match the exact pattern used by existing sections (card layout, form submit pattern, success/error toast). Add three new sections after the existing Notifications section and before the Danger Zone:

**Section A — Scan Preferences:**

```tsx
{/* === Scan Preferences === */}
<section className="space-y-4" aria-labelledby="scan-prefs-heading">
  <div>
    <h2 id="scan-prefs-heading" className="text-base font-semibold text-foreground">
      Scan Preferences
    </h2>
    <p className="mt-0.5 text-sm text-muted-foreground">
      Choose which AI models LocalVector tracks and when your weekly scan runs.
    </p>
  </div>

  <form action={updateScanPreferences} className="rounded-lg border border-border bg-card p-6 space-y-6">

    {/* AI Model Selection */}
    <fieldset>
      <legend className="text-sm font-medium text-foreground">AI models to track</legend>
      <p className="mt-0.5 text-xs text-muted-foreground">
        LocalVector queries each selected model during your weekly scan.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="model-checkboxes">
        {[
          { id: 'chatgpt',    label: 'ChatGPT',        description: 'OpenAI GPT-4o' },
          { id: 'perplexity', label: 'Perplexity',     description: 'Perplexity AI' },
          { id: 'gemini',     label: 'Gemini',          description: 'Google Gemini' },
          { id: 'copilot',    label: 'Copilot',         description: 'Microsoft Copilot' },
          { id: 'claude',     label: 'Claude',          description: 'Anthropic Claude' },
        ].map(model => (
          <label
            key={model.id}
            className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-3 hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            data-testid={`model-checkbox-label-${model.id}`}
          >
            <input
              type="checkbox"
              name="tracked_models"
              value={model.id}
              defaultChecked={currentSettings?.tracked_models?.includes(model.id) ?? true}
              className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
              data-testid={`model-checkbox-${model.id}`}
            />
            <div>
              <p className="text-sm font-medium text-foreground">{model.label}</p>
              <p className="text-[11px] text-muted-foreground">{model.description}</p>
            </div>
          </label>
        ))}
      </div>
    </fieldset>

    {/* Scan Day */}
    <div>
      <label htmlFor="scan_day_of_week" className="text-sm font-medium text-foreground">
        Weekly scan day
      </label>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Your Reality Score updates the morning after this day's scan completes.
      </p>
      <select
        id="scan_day_of_week"
        name="scan_day_of_week"
        defaultValue={currentSettings?.scan_day_of_week ?? 0}
        className="mt-2 block w-48 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        data-testid="scan-day-select"
      >
        {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((day, i) => (
          <option key={day} value={i}>{day}</option>
        ))}
      </select>
    </div>

    <SettingsSaveButton label="Save scan preferences" data-testid="save-scan-prefs" />
  </form>
</section>
```

**Section B — Competitors shortcut:**

```tsx
{/* === Competitors === */}
<section className="space-y-4" aria-labelledby="competitors-heading">
  <div>
    <h2 id="competitors-heading" className="text-base font-semibold text-foreground">Competitors</h2>
    <p className="mt-0.5 text-sm text-muted-foreground">
      Manage the competitors LocalVector tracks in your AI visibility comparisons.
    </p>
  </div>
  <div className="rounded-lg border border-border bg-card p-6 flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-foreground">
        {competitorCount} competitor{competitorCount !== 1 ? 's' : ''} tracked
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Add or remove competitors in the Competitor Analysis page.
      </p>
    </div>
    <a
      href="/dashboard/compete"
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted/50 transition-colors"
      data-testid="manage-competitors-link"
    >
      Manage competitors
      <ArrowRight className="h-3.5 w-3.5" />
    </a>
  </div>
</section>
```

**Section C — Webhook URL (plan-gated for Agency):**

```tsx
{/* === Integrations / Webhook === */}
{canAccessWebhooks(currentPlan) && (
  <section className="space-y-4" aria-labelledby="webhook-heading">
    <div>
      <h2 id="webhook-heading" className="text-base font-semibold text-foreground">Alert Webhook</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Send hallucination alerts to Slack, Zapier, or any endpoint that accepts POST requests.
      </p>
    </div>
    <form action={updateWebhookUrl} className="rounded-lg border border-border bg-card p-6 space-y-4">
      <div>
        <label htmlFor="webhook_url" className="text-sm font-medium text-foreground">Webhook URL</label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          LocalVector will POST a JSON payload when a new hallucination alert is detected.
        </p>
        <input
          id="webhook_url"
          name="webhook_url"
          type="url"
          placeholder="https://hooks.slack.com/services/..."
          defaultValue={currentSettings?.webhook_url ?? ''}
          className="mt-2 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          data-testid="webhook-url-input"
        />
      </div>
      <SettingsSaveButton label="Save webhook URL" data-testid="save-webhook" />
    </form>
  </section>
)}
```

**Additional notification toggles** — add to the existing Notifications section:

```tsx
{/* Add to existing notification toggle list: */}
<NotificationToggle
  label="Reality Score drops"
  description="Alert when your Reality Score drops more than 10 points in a week"
  name="notify_score_drop"
  defaultChecked={currentSettings?.notification_prefs?.score_drop ?? true}
  data-testid="toggle-score-drop"
/>
<NotificationToggle
  label="New competitor detected"
  description="Alert when a new competitor appears in your AI visibility results"
  name="notify_new_competitor"
  defaultChecked={currentSettings?.notification_prefs?.new_competitor ?? false}
  data-testid="toggle-new-competitor"
/>
```

#### Step 4: Read `org_settings` in the Settings page server component

```typescript
// In app/dashboard/settings/page.tsx (or wherever settings data is loaded):
const { data: currentSettings } = await supabase
  .from('org_settings')
  .select('tracked_models, scan_day_of_week, webhook_url, notification_prefs')
  .eq('org_id', org.id)
  .maybeSingle();

const competitorCount = (await supabase
  .from('competitors')          // Adjust to actual table name
  .select('id', { count: 'exact', head: true })
  .eq('org_id', org.id)).count ?? 0;
```

---

### Feature 2: On-Demand AI Answer Preview — N2

**The user's real question:** "What does ChatGPT actually say about my business right now?"

**Current experience:** Responses are only available from the weekly cron scan. No way to run a query on demand. The AI Responses page shows stored data; the AI Assistant is general-purpose chat.

**After Sprint N:** A dedicated widget where users type any query ("best hookah bar for private events in Alpharetta") and see live responses from ChatGPT, Perplexity, and Gemini simultaneously, streamed in real time.

#### Step 1: `app/api/ai-preview/route.ts` — SSE streaming endpoint

```typescript
/**
 * POST /api/ai-preview
 *
 * Queries three AI models with the user's question and streams responses
 * back via Server-Sent Events (SSE). Responses are interleaved — each
 * model streams independently as chunks arrive.
 *
 * Auth: Supabase session required. Plan check: starter/growth/agency only.
 * Rate limit: 10 preview queries per org per day (stored in org_settings or
 *             a simple Redis/Supabase counter). If no rate limit infra exists,
 *             use a lightweight Supabase upsert-based counter.
 *
 * AI_RULES §75: On-demand AI previews are always attributed to the model
 * that produced them. Never display a response without its model label.
 * Preview results are NOT stored as hallucination_alerts automatically —
 * they are ephemeral. Users must manually escalate a preview result to an
 * alert if it reveals a problem.
 *
 * Event format (SSE):
 *   data: {"model":"chatgpt","chunk":"text here","done":false}
 *   data: {"model":"chatgpt","chunk":"","done":true}
 *   data: {"model":"perplexity","chunk":"text here","done":false}
 *   ...
 *   data: {"type":"complete"}
 */

import { createClient } from '@/lib/supabase/server';
import * as Sentry from '@sentry/nextjs';
import { NextRequest } from 'next/server';
import { checkPlanAccess } from '@/lib/plan-enforcer';

// Read lib/services/ before finalizing these imports.
// Use existing provider clients if they exist.
// If not, use the patterns below as a starting point.

const MODELS = ['chatgpt', 'perplexity', 'gemini'] as const;
type PreviewModel = typeof MODELS[number];

const DAILY_PREVIEW_LIMIT = 10;

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  // Plan check — trial users cannot use on-demand preview
  const { data: org } = await supabase.from('orgs').select('id, plan').eq('owner_id', user.id).single();
  if (!org) return new Response('Org not found', { status: 404 });

  if (org.plan === 'trial') {
    return new Response('On-demand preview is not available on the Free Trial. Upgrade to a paid plan.', { status: 403 });
  }

  // Rate limit check — 10 previews/day per org
  const today = new Date().toISOString().split('T')[0];
  const { data: usage } = await supabase
    .from('org_settings')
    .select('notification_prefs')   // Reuse notification_prefs JSONB or create a separate counter column
    .eq('org_id', org.id)
    .maybeSingle();

  // If rate limit not implemented yet, skip and add TODO in DEVLOG
  // Simple approach: store {preview_date: "2026-03-01", preview_count: 3} in org_settings.notification_prefs
  const previewMeta = (usage?.notification_prefs as Record<string, unknown>)?.preview ?? { date: '', count: 0 };
  const previewCount = (previewMeta as { date: string; count: number }).date === today
    ? (previewMeta as { date: string; count: number }).count
    : 0;

  if (previewCount >= DAILY_PREVIEW_LIMIT) {
    return new Response('Daily preview limit reached (10/day). Limit resets at midnight.', { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const query = typeof body?.query === 'string' ? body.query.trim() : '';
  if (!query || query.length < 3) return new Response('Query too short', { status: 400 });
  if (query.length > 500) return new Response('Query too long (max 500 chars)', { status: 400 });

  // Increment usage counter
  const newCount = previewCount + 1;
  await supabase.from('org_settings').upsert({
    org_id: org.id,
    notification_prefs: {
      ...(usage?.notification_prefs as Record<string, unknown> ?? {}),
      preview: { date: today, count: newCount },
    },
    updated_at: new Date().toISOString(),
  });

  // Build SSE stream — all three models run in parallel
  const readable = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();

      function send(data: object) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        // Run all three model queries concurrently
        await Promise.allSettled([
          streamModel('chatgpt',    query, send),
          streamModel('perplexity', query, send),
          streamModel('gemini',     query, send),
        ]);
        send({ type: 'complete' });
      } catch (err) {
        Sentry.captureException(err, { tags: { route: 'ai-preview' } });
        send({ type: 'error', message: 'An error occurred during preview generation.' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// ── Model streaming functions ─────────────────────────────────────────────────
// READ lib/services/ BEFORE writing these. Use existing provider clients if available.
// The patterns below assume direct API calls — adapt to whatever SDK/client exists.

async function streamModel(model: PreviewModel, query: string, send: (d: object) => void) {
  try {
    if (model === 'chatgpt')    await streamOpenAI(query, send);
    if (model === 'perplexity') await streamPerplexity(query, send);
    if (model === 'gemini')     await streamGemini(query, send);
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'ai-preview', model } });
    send({ model, chunk: '', done: true, error: `${getModelLabel(model)} is temporarily unavailable.` });
  }
}

function getModelLabel(model: PreviewModel): string {
  return { chatgpt: 'ChatGPT', perplexity: 'Perplexity', gemini: 'Gemini' }[model];
}

async function streamOpenAI(query: string, send: (d: object) => void) {
  // Requires OPENAI_API_KEY in process.env
  // Use existing OpenAI client from lib/services/ if one exists
  // Otherwise use the openai npm package:
  const { OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const stream = await client.chat.completions.create({
    model: 'gpt-4o-mini',   // Use a cost-efficient model for previews
    messages: [{ role: 'user', content: query }],
    stream: true,
    max_tokens: 400,        // Keep previews concise
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? '';
    if (text) send({ model: 'chatgpt', chunk: text, done: false });
  }
  send({ model: 'chatgpt', chunk: '', done: true });
}

async function streamPerplexity(query: string, send: (d: object) => void) {
  // Requires PERPLEXITY_API_KEY in process.env
  // Perplexity uses OpenAI-compatible API — same SDK, different baseURL
  const { OpenAI } = await import('openai');
  const client = new OpenAI({
    apiKey: process.env.PERPLEXITY_API_KEY,
    baseURL: 'https://api.perplexity.ai',
  });

  const stream = await client.chat.completions.create({
    model: 'sonar',
    messages: [{ role: 'user', content: query }],
    stream: true,
    max_tokens: 400,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? '';
    if (text) send({ model: 'perplexity', chunk: text, done: false });
  }
  send({ model: 'perplexity', chunk: '', done: true });
}

async function streamGemini(query: string, send: (d: object) => void) {
  // Requires GOOGLE_AI_API_KEY in process.env
  // Use existing Gemini client from lib/services/ if one exists
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const client = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY ?? '');
  const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });  // cost-efficient

  const result = await model.generateContentStream(query);
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) send({ model: 'gemini', chunk: text, done: false });
  }
  send({ model: 'gemini', chunk: '', done: true });
}
```

**Adapt all model calls to use existing provider clients in `lib/services/` if they exist.** Do not import or instantiate provider SDKs in the route itself if wrapper clients already exist elsewhere.

#### Step 2: `AiAnswerPreview` — `app/dashboard/ai-responses/_components/AiAnswerPreview.tsx`

```tsx
'use client';

/**
 * AiAnswerPreview
 *
 * On-demand query widget. User types a query; clicking "Run" opens an
 * SSE connection to /api/ai-preview and streams responses model-by-model.
 *
 * Layout: Query input + Run button at top. Three model response cards below,
 * filling in as content streams. Each card shows the model name as a header
 * and streams text in real time.
 *
 * AI_RULES §75: Every response card displays its model label prominently.
 * Responses are NOT automatically saved as alerts — manual escalation only.
 */

import { useState, useRef, useCallback } from 'react';
import { Play, Square, Loader2, AlertCircle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type ModelId = 'chatgpt' | 'perplexity' | 'gemini';

interface ModelState {
  content: string;
  done: boolean;
  error?: string;
}

const MODEL_CONFIG: Record<ModelId, { label: string; color: string; bgColor: string; borderColor: string }> = {
  chatgpt:    { label: 'ChatGPT',    color: 'text-emerald-700', bgColor: 'bg-emerald-50',  borderColor: 'border-emerald-200' },
  perplexity: { label: 'Perplexity', color: 'text-blue-700',    bgColor: 'bg-blue-50',     borderColor: 'border-blue-200'    },
  gemini:     { label: 'Gemini',     color: 'text-violet-700',  bgColor: 'bg-violet-50',   borderColor: 'border-violet-200'  },
};

const EXAMPLE_QUERIES = [
  'Best hookah lounge for a birthday party near Alpharetta',
  'Hookah bar with live music open late in Alpharetta GA',
  'Private event space with hookah near me',
];

export function AiAnswerPreview() {
  const [query, setQuery] = useState('');
  const [running, setRunning] = useState(false);
  const [models, setModels] = useState<Partial<Record<ModelId, ModelState>>>({});
  const [complete, setComplete] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const runPreview = useCallback(async () => {
    if (!query.trim() || running) return;

    setRunning(true);
    setModels({});
    setComplete(false);
    setGlobalError(null);

    let cancelled = false;

    try {
      const response = await fetch('/api/ai-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        setGlobalError(errorText || 'Preview failed. Please try again.');
        return;
      }

      abortRef.current = () => { cancelled = true; };

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        if (cancelled) break;
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';  // Keep incomplete last line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const event = JSON.parse(raw);

            if (event.type === 'complete') {
              setComplete(true);
            } else if (event.type === 'error') {
              setGlobalError(event.message ?? 'An error occurred.');
            } else if (event.model) {
              const model = event.model as ModelId;
              setModels(prev => ({
                ...prev,
                [model]: {
                  content: (prev[model]?.content ?? '') + (event.chunk ?? ''),
                  done: event.done === true,
                  error: event.error,
                },
              }));
            }
          } catch {
            // Malformed SSE line — skip
          }
        }
      }
    } catch (err) {
      if (!cancelled) setGlobalError('Connection failed. Check your network and try again.');
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [query, running]);

  function stopPreview() {
    abortRef.current?.();
    setRunning(false);
  }

  const hasAnyContent = Object.values(models).some(m => m?.content);

  return (
    <div className="space-y-4" data-testid="ai-answer-preview">

      {/* Query input */}
      <div className="space-y-2">
        <label htmlFor="preview-query" className="text-sm font-medium text-foreground">
          Ask a question about your business
        </label>
        <div className="flex gap-2">
          <input
            id="preview-query"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) runPreview(); }}
            placeholder="best hookah bar for private events in Alpharetta…"
            maxLength={500}
            disabled={running}
            className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
            data-testid="preview-query-input"
          />
          <button
            type="button"
            onClick={running ? stopPreview : runPreview}
            disabled={!query.trim() && !running}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors',
              running
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50',
            )}
            data-testid="preview-run-btn"
          >
            {running ? (
              <><Square className="h-3.5 w-3.5" aria-hidden="true" /> Stop</>
            ) : (
              <><Play className="h-3.5 w-3.5" aria-hidden="true" /> Run</>
            )}
          </button>
        </div>

        {/* Example queries */}
        {!hasAnyContent && !running && (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground">Try:</span>
            {EXAMPLE_QUERIES.map(q => (
              <button
                key={q}
                type="button"
                onClick={() => setQuery(q)}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                data-testid="example-query"
              >
                {q}
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Global error */}
      {globalError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert" data-testid="preview-error">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {globalError}
        </div>
      )}

      {/* Model response cards — shown as soon as a model starts */}
      {(hasAnyContent || running) && (
        <div className="grid gap-4 sm:grid-cols-3" data-testid="model-response-grid">
          {(['chatgpt', 'perplexity', 'gemini'] as ModelId[]).map(modelId => {
            const cfg = MODEL_CONFIG[modelId];
            const state = models[modelId];
            const isStreaming = running && !state?.done;

            return (
              <div
                key={modelId}
                className={cn(
                  'rounded-xl border p-4 space-y-2 transition-opacity',
                  cfg.borderColor,
                  cfg.bgColor,
                  !state && running ? 'opacity-50' : 'opacity-100',
                )}
                data-testid={`model-card-${modelId}`}
              >
                {/* Model header */}
                <div className="flex items-center justify-between">
                  <span className={cn('text-xs font-bold uppercase tracking-wide', cfg.color)}>
                    {cfg.label}
                  </span>
                  {isStreaming && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-hidden="true" />}
                </div>

                {/* Response content */}
                {state?.error ? (
                  <p className="text-xs text-red-600">{state.error}</p>
                ) : state?.content ? (
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed" data-testid={`model-response-${modelId}`}>
                    {state.content}
                    {isStreaming && <span className="inline-block w-1 h-4 ml-0.5 bg-current animate-pulse" aria-hidden="true" />}
                  </p>
                ) : running ? (
                  <p className="text-xs text-muted-foreground italic">Waiting for response…</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Completion note */}
      {complete && (
        <p className="text-xs text-muted-foreground" data-testid="preview-complete-note">
          These responses were generated live and are not automatically saved as alerts.
          If you see something incorrect, open the Alerts page to log a hallucination.
        </p>
      )}
    </div>
  );
}
```

#### Step 3: Add `AiAnswerPreview` to the AI Responses page

Read `app/dashboard/ai-responses/page.tsx` completely. Add `<AiAnswerPreview />` at the top of the page content, above the stored responses list, with a clear heading:

```tsx
<section className="space-y-4">
  <div>
    <h2 className="text-base font-semibold text-foreground">Live AI Preview</h2>
    <p className="mt-0.5 text-sm text-muted-foreground">
      Ask a question and see what ChatGPT, Perplexity, and Gemini say about your business right now.
      Results are not stored automatically.
    </p>
  </div>
  <AiAnswerPreview />
</section>

<div className="my-8 border-t border-border" />

{/* Existing stored AI responses below */}
```

---

### Feature 3: Correction Follow-Up Scan — N3

**The user's real question (14 days after submitting a correction):** "Did my fix work?"

**Current experience:** Alert status goes to `verifying`. Nothing ever updates it. Users never find out.

**After Sprint N:** A daily cron checks for corrections that are ready for follow-up (14+ days since correction submitted), runs a targeted re-scan on that specific model + query combination, updates the alert status to `resolved` or `persists`, adds a Proof Timeline entry, and sends a notification email.

#### Step 1: Migration — add follow-up columns to `hallucination_alerts`

```sql
-- supabase/migrations/[timestamp]_add_correction_followup.sql
-- Only add columns that don't already exist. Read prod_schema.sql first.

ALTER TABLE public.hallucination_alerts
  ADD COLUMN IF NOT EXISTS correction_submitted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_scan_at        timestamptz,   -- When to run follow-up (submitted_at + 14 days)
  ADD COLUMN IF NOT EXISTS follow_up_completed_at   timestamptz,   -- When it was actually run
  ADD COLUMN IF NOT EXISTS follow_up_result         jsonb;         -- Raw result of the follow-up scan

-- Status enum may need 'resolved' and 'persists' added if not present:
-- Read the current status column type. If it's an enum:
--   ALTER TYPE hallucination_alert_status ADD VALUE IF NOT EXISTS 'resolved';
--   ALTER TYPE hallucination_alert_status ADD VALUE IF NOT EXISTS 'persists';
-- If it's a text column, no migration needed — just use the new values.

COMMENT ON COLUMN public.hallucination_alerts.follow_up_scan_at IS
  'Scheduled time for correction follow-up re-scan (correction_submitted_at + 14 days).';
COMMENT ON COLUMN public.hallucination_alerts.follow_up_result IS
  'Raw result from the follow-up scan — did the AI model change its answer?';
```

#### Step 2: Update `CorrectionPanel.tsx` (or its server action) to set follow-up columns

```typescript
// When a correction brief is submitted, set the follow-up schedule:
// In the correction submission server action (read CorrectionPanel.tsx to find where this is):
const submittedAt = new Date();
const followUpAt = new Date(submittedAt.getTime() + 14 * 24 * 60 * 60 * 1000);

await supabase
  .from('hallucination_alerts')
  .update({
    status: 'verifying',
    correction_submitted_at: submittedAt.toISOString(),
    follow_up_scan_at: followUpAt.toISOString(),
  })
  .eq('id', alertId);
```

#### Step 3: `app/api/cron/correction-followup/route.ts` — new daily cron

```typescript
/**
 * GET /api/cron/correction-followup
 *
 * Runs daily. Finds all hallucination_alerts where:
 *   status = 'verifying'
 *   AND follow_up_scan_at <= now()
 *   AND follow_up_completed_at IS NULL
 *
 * For each: runs a targeted re-scan on the original model + query,
 * compares result to known_correct data, updates status to 'resolved'
 * or 'persists', writes a Proof Timeline entry, sends notification.
 *
 * Vercel cron: schedule in vercel.json ("0 6 * * *" = 6am UTC daily)
 */

import { createClient } from '@/lib/supabase/server';
import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Cron secret guard — same pattern as other cron routes
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();

  // Find all corrections due for follow-up
  const { data: due, error: fetchErr } = await supabase
    .from('hallucination_alerts')
    .select(`
      id, org_id, model, alert_type, original_query,
      correct_value, wrong_value,
      correction_submitted_at, follow_up_scan_at
    `)
    .eq('status', 'verifying')
    .lte('follow_up_scan_at', new Date().toISOString())
    .is('follow_up_completed_at', null)
    .limit(50);  // Process at most 50 per run to stay within Vercel timeout

  if (fetchErr) {
    Sentry.captureException(fetchErr, { tags: { cron: 'correction-followup' } });
    return NextResponse.json({ error: 'Failed to fetch pending follow-ups' }, { status: 500 });
  }

  if (!due || due.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  let resolved = 0;
  let persists = 0;
  let errors = 0;

  for (const alert of due) {
    try {
      const result = await runFollowUpScan(alert);
      const newStatus = result.isResolved ? 'resolved' : 'persists';

      // Update alert status
      await supabase
        .from('hallucination_alerts')
        .update({
          status: newStatus,
          follow_up_completed_at: new Date().toISOString(),
          follow_up_result: result.raw,
        })
        .eq('id', alert.id);

      // Write Proof Timeline entry
      await supabase.from('proof_timeline').insert({  // Adjust table name from prod_schema.sql
        org_id: alert.org_id,
        alert_id: alert.id,
        event_type: newStatus === 'resolved' ? 'correction_verified' : 'correction_failed',
        description: newStatus === 'resolved'
          ? `${getModelLabel(alert.model)} now gives the correct answer after your correction.`
          : `${getModelLabel(alert.model)} still gives an incorrect answer — your correction may need more time.`,
        created_at: new Date().toISOString(),
      });

      // Send notification (same pattern as weekly digest — use existing email service)
      await sendFollowUpNotification({ alert, resolved: result.isResolved }).catch(notifyErr => {
        Sentry.captureException(notifyErr, { tags: { cron: 'correction-followup', step: 'notify' } });
        // Notification failure doesn't fail the whole follow-up
      });

      if (result.isResolved) resolved++;
      else persists++;

    } catch (err) {
      errors++;
      Sentry.captureException(err, {
        tags: { cron: 'correction-followup', alert_id: alert.id },
        extra: { alert },
      });

      // Mark as attempted even if failed, so it doesn't retry endlessly
      await supabase
        .from('hallucination_alerts')
        .update({ follow_up_completed_at: new Date().toISOString() })
        .eq('id', alert.id)
        .catch(() => {});
    }
  }

  return NextResponse.json({ processed: due.length, resolved, persists, errors });
}

// ── Follow-up scan logic ───────────────────────────────────────────────────────

interface FollowUpAlert {
  id: string;
  org_id: string;
  model: string;
  alert_type: string;
  original_query?: string;
  correct_value?: string;
  wrong_value?: string;
}

interface FollowUpResult {
  isResolved: boolean;
  raw: Record<string, unknown>;
}

/**
 * Run a targeted AI query on the original model and determine if it's now correct.
 * Uses the same provider call pattern as the SOV cron.
 * READ sov/route.ts and the existing provider clients before implementing this.
 */
async function runFollowUpScan(alert: FollowUpAlert): Promise<FollowUpResult> {
  const query = alert.original_query
    ?? buildFollowUpQuery(alert);  // Reconstruct query if original not stored

  // Call the specific AI model that had the hallucination
  const response = await queryAiModel(alert.model, query);

  // Determine if resolved: does the response now match correct_value?
  // This is a fuzzy match — exact string matching will fail due to phrasing variations
  const isResolved = alert.correct_value
    ? responseContainsCorrectInfo(response, alert.correct_value)
    : false;   // If no correct_value stored, we can't auto-verify — mark as 'persists'

  return { isResolved, raw: { query, response, model: alert.model } };
}

function buildFollowUpQuery(alert: FollowUpAlert): string {
  // Reconstruct a sensible follow-up query from alert_type if original_query is missing.
  // Read hallucination_alerts table to understand what data is available.
  const queryByType: Record<string, string> = {
    wrong_hours: 'What are the hours for this business?',
    wrong_location: 'Where is this business located?',
    wrong_phone: 'What is the phone number for this business?',
    missing_from_results: 'Tell me about this local business.',
  };
  return queryByType[alert.alert_type] ?? 'Tell me about this local business.';
}

async function queryAiModel(model: string, query: string): Promise<string> {
  // Use existing provider clients from lib/services/ if they exist.
  // This is a simplified non-streaming version — we just need the full response.
  // Read lib/services/ before implementing to avoid duplicating provider setup.

  if (model === 'chatgpt') {
    const { OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: query }],
      max_tokens: 300,
    });
    return res.choices[0]?.message?.content ?? '';
  }

  if (model === 'perplexity') {
    const { OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: process.env.PERPLEXITY_API_KEY, baseURL: 'https://api.perplexity.ai' });
    const res = await client.chat.completions.create({
      model: 'sonar',
      messages: [{ role: 'user', content: query }],
      max_tokens: 300,
    });
    return res.choices[0]?.message?.content ?? '';
  }

  if (model === 'gemini') {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const ai = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY ?? '');
    const m = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const res = await m.generateContent(query);
    return res.response.text();
  }

  throw new Error(`Unknown model: ${model}`);
}

/**
 * Fuzzy check: does the AI response now contain the correct information?
 * This is deliberately permissive — we want to avoid false "still wrong" results
 * when the AI changed its phrasing but got the facts right.
 */
function responseContainsCorrectInfo(response: string, correctValue: string): boolean {
  const respNorm = response.toLowerCase().replace(/[^a-z0-9:]/g, ' ');
  const valNorm = correctValue.toLowerCase().replace(/[^a-z0-9:]/g, ' ');
  // Check if key tokens from correctValue appear in response
  const tokens = valNorm.split(/\s+/).filter(t => t.length > 2);
  const matchCount = tokens.filter(t => respNorm.includes(t)).length;
  return matchCount >= Math.ceil(tokens.length * 0.7);  // 70% token match = resolved
}

function getModelLabel(model: string): string {
  const labels: Record<string, string> = { chatgpt: 'ChatGPT', perplexity: 'Perplexity', gemini: 'Gemini', claude: 'Claude' };
  return labels[model] ?? model;
}

async function sendFollowUpNotification(params: { alert: FollowUpAlert; resolved: boolean }): Promise<void> {
  // Use the same email dispatch pattern as lib/services/weekly-digest.service.ts
  // Read that file before implementing this.
  // Subject: "Your correction to {model} {resolved ? 'worked' : 'needs more time'}"
  // Read the org's email from the orgs table (needs an extra query).
  // This function is intentionally a stub — implement after reading the digest service pattern.
}
```

#### Step 4: Register cron in `vercel.json`

```json
// In vercel.json crons array:
{
  "path": "/api/cron/correction-followup",
  "schedule": "0 6 * * *"   // 6am UTC daily
}
```

---

## 🧪 Testing

### Test File 1: `src/__tests__/unit/settings-expansion.test.tsx` — 14 tests

```
describe('updateScanPreferences server action')
  1.  Valid models + valid day → upserts org_settings; returns { success: true }
  2.  Empty models array → returns { error: 'Select at least one AI model' }
  3.  Invalid scan_day_of_week (7) → validation error
  4.  Unauthenticated call → returns { error: 'Unauthorized' }
  5.  Supabase upsert failure → Sentry called; returns { error: 'Failed to save' }

describe('updateWebhookUrl server action')
  6.  Valid URL → upserts webhook_url; returns { success: true }
  7.  Empty string → clears webhook_url to null; returns { success: true }
  8.  Invalid URL (not https://) → returns { error: 'Must be a valid URL' }
  9.  Unauthenticated call → returns { error: 'Unauthorized' }

describe('SettingsForm — new sections')
  10. AI model checkboxes render (data-testid="model-checkboxes")
  11. All 5 model checkboxes present (chatgpt, perplexity, gemini, copilot, claude)
  12. Scan day select renders (data-testid="scan-day-select") with 7 options
  13. Manage competitors link present (data-testid="manage-competitors-link")
  14. Webhook URL input present when plan allows (data-testid="webhook-url-input")
```

### Test File 2: `src/__tests__/unit/ai-answer-preview.test.tsx` — 12 tests

```
describe('AiAnswerPreview component')
  1.  data-testid="ai-answer-preview" present
  2.  data-testid="preview-query-input" present; accepts text
  3.  data-testid="preview-run-btn" present; disabled when query is empty
  4.  Run button enabled when query is not empty
  5.  Example query buttons render (data-testid="example-query")
  6.  Clicking example query sets input value
  7.  On successful fetch + SSE: model-response-chatgpt shows content
  8.  On successful fetch + SSE: model-response-perplexity shows content
  9.  On successful fetch + SSE: model-response-gemini shows content
  10. On 403 response (trial plan): data-testid="preview-error" renders with plan message
  11. On 429 response (rate limit hit): preview-error renders with limit message
  12. After complete event: data-testid="preview-complete-note" visible

describe('/api/ai-preview route')
  13. Trial plan → 403 response
  14. Rate limit exceeded (count >= 10) → 429 response
  15. Query shorter than 3 chars → 400 response
  16. Query longer than 500 chars → 400 response
  17. Missing OPENAI_API_KEY → Sentry called; graceful error per model card
```

**Target: 17 tests (component) + route tests via integration**

### Test File 3: `src/__tests__/unit/correction-followup.test.ts` — 12 tests

```
describe('responseContainsCorrectInfo()')
  1.  Response containing 70%+ of correct value tokens → true
  2.  Response missing most tokens → false
  3.  Exact match → true
  4.  Case-insensitive match → true
  5.  Correct value tokens < 3 chars filtered out (stop words) → match on remaining

describe('buildFollowUpQuery()')
  6.  alert_type='wrong_hours' → returns hours-related query
  7.  alert_type='wrong_location' → returns location-related query
  8.  Unknown alert_type → returns fallback query (no crash)

describe('correction-followup cron route')
  9.  No CRON_SECRET header → 401
  10. 0 due corrections → returns { processed: 0 }
  11. Alert with isResolved=true → status updated to 'resolved'; proof_timeline entry written
  12. Alert with isResolved=false → status updated to 'persists'; proof_timeline entry written
  13. queryAiModel failure for one alert → error count incremented; other alerts still processed
  14. Sentry called when queryAiModel throws
```

### E2E Test File: `src/__tests__/e2e/sprint-n-smoke.spec.ts` — 20 tests

```
describe('Sprint N — New Capability E2E')

  Settings Expansion:
  1.  /dashboard/settings: model checkboxes visible (5 models)
  2.  Uncheck 'gemini', submit → saved; on reload gemini is unchecked
  3.  Change scan day to 'Monday', submit → saved; on reload Monday selected
  4.  Manage competitors link navigates to /dashboard/compete
  5.  Webhook URL input visible for Agency plan; hidden for Starter (plan-gated)
  6.  Valid webhook URL submitted → success toast; URL persists on reload
  7.  Invalid webhook URL → error message shown inline

  AI Answer Preview:
  8.  /dashboard/ai-responses: data-testid="ai-answer-preview" visible
  9.  Preview not visible for trial plan users (blocked at API level — page shows upgrade prompt)
  10. Type query + click Run → at least one model-card renders
  11. All three model cards visible after Run (chatgpt, perplexity, gemini)
  12. Each model card has its label ("ChatGPT", "Perplexity", "Gemini")
  13. preview-complete-note visible after all models finish
  14. Clicking Stop mid-stream → running stops; partial content preserved

  Correction Follow-Up:
  15. CorrectionPanel submission sets status to 'verifying'
  16. After submission: correction_submitted_at and follow_up_scan_at visible in DB
      (or verifiable via admin/direct Supabase query in test)
  17. Simulated cron run (POST to /api/cron/correction-followup with CRON_SECRET):
      processed count > 0 when due corrections exist
  18. After simulated cron: proof timeline entry with 'correction_verified' or
      'correction_failed' event_type present
  19. After cron: alert status updated from 'verifying' to 'resolved' or 'persists'
  20. Cron without CRON_SECRET header → 401 response
```

### Run commands

```bash
npx vitest run src/__tests__/unit/settings-expansion.test.tsx
npx vitest run src/__tests__/unit/ai-answer-preview.test.tsx
npx vitest run src/__tests__/unit/correction-followup.test.ts
npx vitest run                                                      # ALL Sprints A–N — 0 regressions
npx playwright test src/__tests__/e2e/sprint-n-smoke.spec.ts
npx tsc --noEmit                                                    # 0 new type errors
```

---

## 📂 Files to Create / Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `supabase/migrations/[ts]_add_org_settings.sql` | **CREATE (if needed)** | `org_settings` table; tracked_models, scan_day, webhook_url |
| 2 | `supabase/migrations/[ts]_add_correction_followup.sql` | **CREATE (if needed)** | Follow-up columns on hallucination_alerts |
| 3 | `app/dashboard/settings/actions.ts` | **CREATE/MODIFY** | `updateScanPreferences`, `updateWebhookUrl` server actions |
| 4 | `app/dashboard/settings/_components/SettingsForm.tsx` | **MODIFY** | Add 3 new sections: Scan Preferences, Competitors, Webhook |
| 5 | `app/dashboard/settings/page.tsx` | **MODIFY** | Load `org_settings` and competitor count; pass to form |
| 6 | `app/api/ai-preview/route.ts` | **CREATE** | SSE streaming endpoint; plan check; rate limit; 3-model parallel |
| 7 | `app/dashboard/ai-responses/_components/AiAnswerPreview.tsx` | **CREATE** | SSE client; query input; 3 model cards; streaming render |
| 8 | `app/dashboard/ai-responses/page.tsx` | **MODIFY** | Add `AiAnswerPreview` above stored responses list |
| 9 | `app/api/cron/correction-followup/route.ts` | **CREATE** | Daily cron; targeted re-scan; status update; proof timeline; notify |
| 10 | `app/dashboard/_components/CorrectionPanel.tsx` (or its action) | **MODIFY** | Set `correction_submitted_at` and `follow_up_scan_at` on submit |
| 11 | `vercel.json` | **MODIFY** | Add correction-followup cron schedule (`0 6 * * *`) |
| 12 | `src/__tests__/unit/settings-expansion.test.tsx` | **CREATE** | 14 tests |
| 13 | `src/__tests__/unit/ai-answer-preview.test.tsx` | **CREATE** | 17 tests |
| 14 | `src/__tests__/unit/correction-followup.test.ts` | **CREATE** | 14 tests |
| 15 | `src/__tests__/e2e/sprint-n-smoke.spec.ts` | **CREATE** | 20 E2E tests |

**New API routes:** 2 (`/api/ai-preview`, `/api/cron/correction-followup`)
**New migrations:** 0–2 (conditional on existing schema)

---

## 🧠 Edge Cases to Handle

1. **`tracked_models[]` and SOV cron integration.** The settings form saves `tracked_models` to `org_settings`. The SOV cron must READ this value when determining which models to scan for each org. Before implementing, verify whether the cron already reads per-org model config. If it uses a hardcoded list, update it to query `org_settings.tracked_models` for each org. If no `org_settings` row exists for an org (e.g., orgs created before this migration), default to all models.

2. **AI preview SSE — browser `EventSource` vs `fetch`.** The implementation above uses `fetch` with `ReadableStream` (not `EventSource`). This is necessary because `EventSource` only supports GET requests, and the preview needs to POST the query body. The `fetch` + streaming approach requires the browser to support `ReadableStream` (all modern browsers do). For the Stop button, the abort is done via a flag (`cancelled = true`) rather than `AbortController` — using AbortController would close the SSE connection cleanly but the streaming is already done client-side from the response body. Test the Stop button behavior carefully.

3. **AI preview rate limit storage.** The rate limit counter is stored in `org_settings.notification_prefs` JSONB as `{ preview: { date: "2026-03-01", count: 3 } }`. This is a quick implementation that avoids a new table. The downside is a race condition: two concurrent preview requests could both read count=3, both increment to 4, and both write 4 — effectively allowing count=4 on a day where it should max at 3. For the initial implementation this is acceptable (the limit is 10/day, not 1/day). If abuse becomes a problem, move to a proper atomic counter in Sprint O.

4. **AI preview — model API availability.** Any of the three provider APIs can be unavailable. The `streamModel()` function wraps each model's stream in a try/catch and sends a per-model error event if it fails. The overall SSE response continues — one model failing doesn't cancel the others. The client renders the error per-model-card. Do not fail the entire request if one model is down.

5. **`responseContainsCorrectInfo()` false positives.** The 70% token match is deliberately loose. A response like "The hookah bar is open until midnight on Fridays and Saturdays" would correctly match `correct_value = "11pm-midnight"` even though the phrasing differs. But it could also match incorrectly if `correct_value = "closed"` appears in a response like "not closed at midnight." Document this limitation in DEVLOG. In a future sprint, this could be replaced with a semantic similarity check using embeddings.

6. **Correction follow-up — `original_query` may not be stored.** The `hallucination_alerts` table may not have an `original_query` column if it wasn't part of the initial schema. The `buildFollowUpQuery()` function reconstructs a sensible query from `alert_type` in this case. Verify whether `original_query` exists in `prod_schema.sql` — if it does, use it; if not, the fallback is used.

7. **Follow-up scan on models that changed.** If an org changes their `tracked_models` setting to remove a model (e.g., removes Perplexity), and then a correction follow-up tries to scan Perplexity, it should still run — the follow-up is about the original model that had the hallucination, not the current tracked list. The cron uses `alert.model` directly, not `org_settings.tracked_models`.

8. **Vercel timeout on cron with many due corrections.** The `limit(50)` in the cron query caps the batch size. Vercel cron functions have a timeout (typically 10 seconds on Hobby, 60 seconds on Pro). Each `queryAiModel()` call may take 3–5 seconds. With 50 corrections and 3–5 seconds each, this would exceed even Pro limits. Reduce the limit to 10 if each correction requires multiple model calls. Consider parallelizing the model calls within each correction (same `Promise.allSettled` pattern as the preview).

9. **Settings form model checkboxes — at least one must be selected.** The `updateScanPreferences` action validates `min(1)` on the models array. But the form needs client-side enforcement too — if a user unchecks all models and submits, the error comes back from the server. Add a client-side check that disables the save button when no models are checked, or shows an inline warning.

10. **AI preview in sample data mode.** If `SampleDataBanner` is showing (new user, no scan data), the AI preview should still work — it's a live call, not dependent on scan data. No special handling needed. The preview page shows the banner if applicable and the preview widget below — they coexist independently.

11. **Proof Timeline table name.** The cron inserts into `proof_timeline` — verify the actual table name against `prod_schema.sql`. It might be `proof_timelines`, `timeline_events`, or something different. Use the actual table name.

12. **Webhook URL validation in settings.** The `WebhookSchema` accepts HTTPS URLs or empty string. It does not validate that the webhook actually receives POST requests — that's the user's responsibility. Add a note in the UI: "LocalVector will send a test POST when you save." — but only implement the test POST if there's time; otherwise just save the URL and note the TODO in DEVLOG.

---

## 🚫 What NOT to Do

1. **DO NOT store AI preview responses as hallucination alerts automatically.** AI_RULES §75: preview results are ephemeral. Users must manually escalate. The `preview-complete-note` UI copy reinforces this: "If you see something incorrect, open the Alerts page to log a hallucination."
2. **DO NOT call all three AI providers in the settings form or on page load.** Model selection is configuration — it does not trigger a live scan. The tracked_models setting is only used when the SOV cron runs.
3. **DO NOT use EventSource for the SSE stream.** EventSource is GET-only; the preview POSTs a query body. Use `fetch` + `ReadableStream` as specified.
4. **DO NOT run the correction follow-up re-scan more than once per alert.** The `follow_up_completed_at IS NULL` condition prevents re-runs. But as a safety measure, the cron also sets `follow_up_completed_at` even when the scan fails (in the catch block) — preventing endless retry on broken alerts.
5. **DO NOT gate the correction follow-up by plan.** All paying customers who submit corrections get the follow-up scan. It's part of the hallucination correction workflow, not a premium add-on.
6. **DO NOT implement the full credit/usage system (N1) in this sprint.** The 10-preview/day rate limit is a simple daily counter stored in JSONB — good enough for Sprint N. If usage metering becomes a serious need, Sprint O scopes N1 properly.
7. **DO NOT modify existing notification toggles in SettingsForm.** The new toggles (score drop, new competitor) are additive. The existing three notification toggles (hallucination alerts, weekly digest, SOV alerts) are unchanged.
8. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12).
9. **DO NOT modify `middleware.ts`** (AI_RULES §6).
10. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).

---

## ✅ Definition of Done

**Settings Expansion:**
- [ ] `org_settings` table exists with `tracked_models`, `scan_day_of_week`, `webhook_url`, `notification_prefs`
- [ ] `updateScanPreferences` server action: validates, upserts, Sentry on failure
- [ ] `updateWebhookUrl` server action: URL validation, upserts null on empty
- [ ] SettingsForm: model checkboxes (5 models); scan day select (7 days); both save correctly
- [ ] Competitors section: shows count + link to /dashboard/compete
- [ ] Webhook section: plan-gated; input saves and persists
- [ ] `settings-expansion.test.tsx` — 14 tests passing

**AI Answer Preview:**
- [ ] `/api/ai-preview` route: plan check (403 for trial); rate limit (429 at 10/day); SSE streaming
- [ ] `streamOpenAI`, `streamPerplexity`, `streamGemini`: each model runs independently; errors per-model
- [ ] `AiAnswerPreview` component: query input, Run/Stop button, 3 model cards with labels
- [ ] Streaming renders in real time; typing cursor animation while streaming
- [ ] Example queries populate input; Enter key triggers run
- [ ] Complete note shows after all models finish
- [ ] Preview placed at top of ai-responses page
- [ ] `ai-answer-preview.test.tsx` — 17 tests passing

**Correction Follow-Up:**
- [ ] Migration adds `correction_submitted_at`, `follow_up_scan_at`, `follow_up_completed_at`, `follow_up_result` to `hallucination_alerts`
- [ ] `CorrectionPanel` (or its action) sets `correction_submitted_at` and `follow_up_scan_at` on submit
- [ ] `correction-followup` cron: auth guard, fetches due alerts, runs targeted scan, updates status
- [ ] `responseContainsCorrectInfo()`: 70% token match determines resolved vs. persists
- [ ] Proof Timeline entry written for both `resolved` and `persists` outcomes
- [ ] Notification sent after follow-up (stub OK if email service needs time)
- [ ] Cron registered in `vercel.json` at daily schedule
- [ ] `correction-followup.test.ts` — 14 tests passing

**All tests:**
- [ ] `npx vitest run` — ALL Sprints A–N passing, zero regressions
- [ ] `sprint-n-smoke.spec.ts` — 20 E2E tests passing
- [ ] `npx tsc --noEmit` — 0 new type errors

---

## 📓 DEVLOG Entry

```markdown
## [DATE] — Sprint N: New Capability — Settings, AI Preview, Correction Follow-Up (Completed)

**Settings Expansion (H2):**
- org_settings table: [already existed / created in this sprint]
- tracked_models column: [already existed / added]; default: ['chatgpt','perplexity','gemini','copilot','claude']
- SOV cron updated to read tracked_models per org: [yes / TODO — cron still hardcoded — document]
- Webhook URL plan gate: canAccessWebhooks('growth') = [true/false — verify from plan-enforcer]
- Competitor count query: from table [actual table name]

**AI Answer Preview (N2):**
- OPENAI_API_KEY: [present / added to .env.example]
- PERPLEXITY_API_KEY: [present / added]
- GOOGLE_AI_API_KEY: [present / added]
- Existing provider clients found in lib/services/: [list / none — created inline]
- Preview model used for ChatGPT: gpt-4o-mini (cost-efficient)
- Preview model used for Perplexity: sonar
- Preview model used for Gemini: gemini-1.5-flash
- Rate limit storage: org_settings.notification_prefs.preview (JSONB counter)
- Race condition acknowledged: acceptable at 10/day limit; N1 would fix with atomic counter
- Plan gate: trial → 403; starter/growth/agency → allowed

**Correction Follow-Up (N3):**
- hallucination_alerts table: original_query column [exists / missing — using buildFollowUpQuery fallback]
- Status enum values 'resolved' and 'persists': [added via migration / already existed as text]
- proof_timeline actual table name: [confirm from prod_schema.sql]
- Notification email: [implemented / stub — TODO in Sprint O]
- Cron batch limit: [10 / 50] (adjusted based on Vercel timeout testing)
- responseContainsCorrectInfo 70% threshold: [working well / too loose — noted for Sprint O tuning]

**Tests:** 45 Vitest + 20 Playwright; 0 regressions Sprints A–N
**Cumulative (A–N):** [N] Vitest + [N] Playwright

**Remaining items (Sprint O scope):**
- M4: Revenue config defaults (restaurant-specific)
- L3: Content Calendar ↔ Content Drafts flow clarity
- N4: Benchmark comparison (you vs. city average)
- N1: Full credit/usage system (if rate limit abuse materializes)
- responseContainsCorrectInfo tuning (if too many false resolved)
- Webhook test POST on save (if time allows)
```

---

## 🔮 AI_RULES Update

```markdown
## 75. 🔍 AI Answer Preview — Ephemeral, Attributed, Not Auto-Escalated (Sprint N)

The on-demand AI Answer Preview (/api/ai-preview) produces ephemeral results.

1. Every response card MUST display its model label (ChatGPT / Perplexity / Gemini) prominently.
   Never show a response without model attribution.
2. Preview results are NOT automatically saved as hallucination_alerts.
   Users must manually open the Alerts page to log an issue they discovered via preview.
3. The preview-complete-note UI copy MUST inform users that results are not stored.
4. Preview is NOT available to trial plan users (403 at the API route).
5. Rate limit is 10 previews/org/day. When the limit is hit, return 429 with a clear message
   including when the limit resets ("Limit resets at midnight").
6. All three models run in parallel (Promise.allSettled). One model failing does not
   cancel the others — the failing model's card shows a per-model error instead.

## 76. 🔁 Correction Follow-Up — Idempotent and Attributed (Sprint N)

The correction follow-up cron (daily, /api/cron/correction-followup) follows these rules:

1. A correction follow-up runs exactly ONCE per alert. follow_up_completed_at is set
   on completion (or failure) to prevent re-runs. Never run a follow-up twice.
2. follow_up_scan_at is always set at correction submit time (correction_submitted_at + 14 days).
   Never add follow-up columns retroactively to old corrections without a backfill migration.
3. responseContainsCorrectInfo() uses 70% token match. This is deliberate and documented.
   Do not tighten to exact match — it creates too many false "persists" results.
4. The follow-up re-scans the ORIGINAL model that had the hallucination (alert.model),
   not the org's current tracked_models setting. A model the org has since deselected
   still gets a follow-up if it was the source of the original hallucination.
5. Both resolved and persists outcomes write a Proof Timeline entry and trigger a notification.
   Neither outcome is silent — users always learn the result.
```

---

## 📚 Git Commit

```bash
git add -A
git commit -m "Sprint N: New Capability — Settings Expansion, AI Preview, Correction Follow-Up

Settings Expansion (H2):
- org_settings table: tracked_models[], scan_day_of_week, webhook_url, notification_prefs
- updateScanPreferences + updateWebhookUrl server actions with Zod validation + Sentry
- SettingsForm: model checkboxes, scan day select, competitors shortcut, webhook URL
- SOV cron updated to read tracked_models per org

AI Answer Preview (N2):
- /api/ai-preview: SSE streaming; plan check; 10/day rate limit; 3-model parallel execution
- streamOpenAI, streamPerplexity, streamGemini: independent streams, per-model error handling
- AiAnswerPreview component: query input, Run/Stop, 3 labeled model cards, streaming cursor
- Example queries, Enter-key trigger, complete note, rate limit error states
- ai-responses/page.tsx: AiAnswerPreview at top, stored responses below

Correction Follow-Up (N3):
- Migration: correction_submitted_at, follow_up_scan_at, follow_up_completed_at, follow_up_result
- CorrectionPanel: sets follow_up_scan_at = submitted_at + 14 days on submission
- /api/cron/correction-followup: daily cron; targeted re-scan; 70% token match resolution
- responseContainsCorrectInfo(): case-insensitive, stop-word filtered, 70% threshold
- Proof Timeline: correction_verified / correction_failed entries
- vercel.json: correction-followup cron at 0 6 * * *

Tests: 45 Vitest + 20 Playwright; 0 regressions Sprints A–N
AI_RULES: 75 (AI preview ephemeral + attributed), 76 (correction follow-up idempotent)"

git push origin main
```

---

## 🏁 Sprint Outcome

Sprint N is the first sprint that's purely additive. No debt paid, no repairs made. Three features that didn't exist before now do.

**Settings Expansion** — Users can now control how LocalVector works for them. AI model selection means a restaurant owner who doesn't care about Copilot can remove it and focus their scan time on the models their customers actually use. Scan day preference means a restaurant that's busiest Monday–Wednesday can schedule their scan for Thursday, so Monday's results are fresh when they need them most. The webhook URL gives agency customers the Slack integration they've been asking for. Competitor management is no longer buried — Settings links directly to the Compete page.

**AI Answer Preview** — The most viscerally compelling thing LocalVector can show a user. Type "best hookah bar for a bachelorette party in Alpharetta" and watch three AI models answer in real time, side by side. ChatGPT says you close at 9pm. You actually close at 1am. Perplexity says you don't do private events. You have a dedicated private room. Gemini doesn't mention you at all. That's three alerts, generated in 15 seconds, by the user themselves — before the Sunday cron even runs. This is the demo feature. This is what converts a trial user.

**Correction Follow-Up** — The feedback loop closes. A user who submitted a correction 14 days ago now gets an email: "Your correction to ChatGPT worked. ChatGPT now describes your hours correctly." Or: "Your correction still hasn't taken effect — it may need more time, or a stronger correction brief." Either way, the user knows. The Proof Timeline shows the event. The alert status updates. Users who see their corrections working don't churn. The product goes from "I submitted something and nothing happened" to "I fixed a problem and I can prove it."

**What's next — Sprint O:** The last sprint of the original analysis. Three smaller items that round out the product: M4 (revenue config defaults — restaurant-specific pre-fill for the Revenue Impact form), L3 (Content Calendar ↔ Drafts flow clarity — a breadcrumb linking where content was generated from), and N4 (benchmark comparison — "your Reality Score vs. average Alpharetta restaurant" — the first feature that requires aggregate data across multiple customers). Sprint O is the final sprint before the product is declared V1 complete.
