# Sprint 78 — Weekly "AI Snapshot" Email with CTAs

> **Claude Code Prompt — First-Pass Ready**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`

---

## 🎯 Objective

Build the **Weekly AI Snapshot Email** — a Resend + React Email digest sent every Monday morning to each org's owner. The email is the product for restaurant owners who won't log into a dashboard regularly. It shows AI Health Score trend, new issues (hallucinations), wins (new SOV mentions), opportunities (top recommendation from Sprint 72), and CTAs that link back to the dashboard.

**Why the email IS the product:** Many restaurant owners won't log into a dashboard weekly. This email keeps them engaged, shows value every 7 days, and drives them back to the dashboard. Every email is a renewal justification. "I did what LocalVector told me and my visibility went up 58%."

**Architecture:** Cron route → Inngest fan-out → per-org data gather → React Email render → Resend send. Respects `notify_weekly_digest` preference (opt-out). No AI calls — all content is deterministic from existing data.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read docs/AI_RULES.md                          — All engineering rules (esp §17, §18, §30)
Read CLAUDE.md                                 — Project context + architecture
Read supabase/prod_schema.sql                  — Canonical schema (§1)
Read lib/supabase/database.types.ts            — TypeScript DB types (§38)
Read src/__fixtures__/golden-tenant.ts          — Golden Tenant fixtures (§4)
Read lib/inngest/client.ts                     — Inngest client + EventSchemas
Read lib/inngest/events.ts                     — Typed event definitions
Read lib/inngest/functions/sov-cron.ts         — Reference Inngest function pattern (§30)
Read app/api/inngest/route.ts                  — Function registration via serve()
Read app/api/cron/sov/route.ts                 — Reference cron route dispatcher pattern (§30.1)
Read lib/services/ai-health-score.service.ts   — computeHealthScore (Sprint 72)
Read lib/data/ai-health-score.ts               — fetchHealthScore data layer (Sprint 72)
Read lib/services/cron-logger.ts               — Cron logging (§37.1)
Read emails/                                   — Existing React Email templates (read all files)
```

---

## 🏗️ Architecture — What to Build

### Flow

```
Monday 8am UTC (Vercel Cron)
    │
    ▼
GET /api/cron/weekly-digest
    │ Auth: CRON_SECRET
    │ Kill switch: STOP_DIGEST_CRON
    │
    ├─ Primary: inngest.send({ name: 'cron/digest.weekly' })
    │
    └─ Fallback: runInlineDigest()
         │
         ▼
    Inngest function: weekly-digest-cron
         │
         ├─ Step 1: Fetch all orgs with notify_weekly_digest=true
         │
         └─ Step 2 (fan-out per org): Gather data → Render email → Send via Resend
              │
              ├─ fetchDigestData(orgId) — parallel queries
              ├─ buildDigestPayload(data) — pure function
              ├─ render(<WeeklyDigestEmail payload={...} />) — React Email
              └─ resend.emails.send({ to, subject, react: ... })
```

---

### Component 1: Email Data Gatherer — `lib/services/weekly-digest.service.ts`

**Pure functions** that assemble digest content from raw data. No I/O, no Resend calls.

```typescript
// ── Input: Raw data gathered from multiple tables ──────

export interface DigestDataInput {
  org: {
    id: string;
    name: string;
  };
  owner: {
    email: string;
    full_name: string | null;
  };
  location: {
    business_name: string;
    city: string;
    state: string;
  };

  /** Current week's AI Health Score (Sprint 72) */
  currentHealthScore: number | null;
  /** Previous week's AI Health Score (for delta) */
  previousHealthScore: number | null;

  /** Current SOV percentage */
  currentSov: number | null;
  /** Previous SOV percentage */
  previousSov: number | null;

  /** New hallucinations detected this week */
  newHallucinations: Array<{
    claim_text: string;
    severity: string;
    model_provider: string;
  }>;

  /** Hallucinations resolved this week */
  resolvedHallucinations: number;

  /** New SOV wins this week (first-time mentions) */
  sovWins: Array<{
    query_text: string;
    engine: string;
  }>;

  /** Top recommendation from AI Health Score (Sprint 72) */
  topRecommendation: {
    title: string;
    description: string;
    href: string;
    estimatedImpact: number;
  } | null;

  /** Bot activity summary (Sprint 73) */
  botVisitsThisWeek: number;
  newBlindSpots: number;
}

// ── Output: Rendered digest payload ────────────────────

export interface DigestPayload {
  recipientEmail: string;
  recipientName: string;
  businessName: string;
  subject: string;

  /** AI Health Score section */
  healthScore: {
    current: number | null;
    delta: number | null;        // positive = improvement
    trend: 'up' | 'down' | 'flat' | 'new';
  };

  /** SOV section */
  sov: {
    currentPercent: number | null;
    delta: number | null;
    trend: 'up' | 'down' | 'flat' | 'new';
  };

  /** Issues section — new hallucinations this week */
  issues: Array<{
    emoji: string;
    text: string;
    cta: { label: string; href: string };
  }>;

  /** Wins section — positive changes */
  wins: Array<{
    emoji: string;
    text: string;
  }>;

  /** Opportunities — actions the user can take */
  opportunities: Array<{
    emoji: string;
    text: string;
    cta: { label: string; href: string };
  }>;

  /** Bot activity summary line */
  botSummary: string | null;

  /** Dashboard CTA URL */
  dashboardUrl: string;

  /** Unsubscribe URL */
  unsubscribeUrl: string;
}

/**
 * Pure function — builds the digest email payload from raw data.
 * No I/O, no side effects.
 */
export function buildDigestPayload(input: DigestDataInput): DigestPayload { ... }
```

#### Build Logic

```typescript
export function buildDigestPayload(input: DigestDataInput): DigestPayload {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.localvector.ai';

  // ── Subject line ──
  // Dynamic: includes score + trend
  const scorePart = input.currentHealthScore !== null
    ? `AI Health: ${input.currentHealthScore}`
    : 'Your AI Snapshot';
  const deltaPart = input.currentHealthScore !== null && input.previousHealthScore !== null
    ? ` (${input.currentHealthScore >= input.previousHealthScore ? '+' : ''}${input.currentHealthScore - input.previousHealthScore})`
    : '';
  const subject = `${scorePart}${deltaPart} — ${input.location.business_name} Weekly`;

  // ── Health Score trend ──
  const healthDelta = (input.currentHealthScore !== null && input.previousHealthScore !== null)
    ? input.currentHealthScore - input.previousHealthScore
    : null;
  const healthTrend = input.currentHealthScore === null ? 'new' as const
    : healthDelta === null ? 'new' as const
    : healthDelta > 0 ? 'up' as const
    : healthDelta < 0 ? 'down' as const
    : 'flat' as const;

  // ── SOV trend ──
  const sovDelta = (input.currentSov !== null && input.previousSov !== null)
    ? (input.currentSov - input.previousSov) * 100
    : null;
  const sovTrend = input.currentSov === null ? 'new' as const
    : sovDelta === null ? 'new' as const
    : sovDelta > 0 ? 'up' as const
    : sovDelta < 0 ? 'down' as const
    : 'flat' as const;

  // ── Issues ──
  const issues = input.newHallucinations.map(h => ({
    emoji: h.severity === 'critical' ? '🔴' : h.severity === 'high' ? '🟠' : '🟡',
    text: `${formatProvider(h.model_provider)} claims: "${truncate(h.claim_text, 60)}"`,
    cta: { label: 'Fix This →', href: `${baseUrl}/dashboard` },
  }));

  // ── Wins ──
  const wins: DigestPayload['wins'] = [];
  if (input.resolvedHallucinations > 0) {
    wins.push({
      emoji: '✅',
      text: `${input.resolvedHallucinations} hallucination${input.resolvedHallucinations > 1 ? 's' : ''} resolved this week`,
    });
  }
  for (const w of input.sovWins) {
    wins.push({
      emoji: '🟢',
      text: `${formatEngine(w.engine)} now mentions you for "${truncate(w.query_text, 50)}" — first time!`,
    });
  }
  if (healthDelta !== null && healthDelta > 0) {
    wins.push({
      emoji: '📈',
      text: `AI Health Score improved by ${healthDelta} points`,
    });
  }

  // ── Opportunities ──
  const opportunities: DigestPayload['opportunities'] = [];
  if (input.topRecommendation) {
    opportunities.push({
      emoji: '💡',
      text: `${input.topRecommendation.title} — est. +${input.topRecommendation.estimatedImpact} pts`,
      cta: { label: 'Take Action →', href: `${baseUrl}${input.topRecommendation.href}` },
    });
  }
  if (input.newBlindSpots > 0) {
    opportunities.push({
      emoji: '🔍',
      text: `${input.newBlindSpots} AI engine${input.newBlindSpots > 1 ? 's' : ''} can't see your content`,
      cta: { label: 'View Blind Spots →', href: `${baseUrl}/dashboard/crawler-analytics` },
    });
  }

  // ── Bot summary ──
  const botSummary = input.botVisitsThisWeek > 0
    ? `🤖 ${input.botVisitsThisWeek} AI bot visit${input.botVisitsThisWeek > 1 ? 's' : ''} this week`
    : null;

  return {
    recipientEmail: input.owner.email,
    recipientName: input.owner.full_name ?? input.owner.email.split('@')[0],
    businessName: input.location.business_name,
    subject,
    healthScore: { current: input.currentHealthScore, delta: healthDelta, trend: healthTrend },
    sov: { currentPercent: input.currentSov !== null ? input.currentSov * 100 : null, delta: sovDelta, trend: sovTrend },
    issues,
    wins,
    opportunities,
    botSummary,
    dashboardUrl: `${baseUrl}/dashboard`,
    unsubscribeUrl: `${baseUrl}/dashboard/settings`,
  };
}
```

**Helpers:**

```typescript
function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}

function formatProvider(provider: string): string {
  const map: Record<string, string> = {
    'openai-gpt4o': 'GPT-4o',
    'openai-gpt4o-mini': 'GPT-4o mini',
    'perplexity-sonar': 'Perplexity',
    'google-gemini': 'Gemini',
    'anthropic-claude': 'Claude',
  };
  return map[provider] ?? provider;
}

function formatEngine(engine: string): string {
  const map: Record<string, string> = {
    perplexity: 'Perplexity',
    openai: 'ChatGPT',
    google: 'Google AI Overview',
  };
  return map[engine] ?? engine;
}
```

---

### Component 2: React Email Template — `emails/weekly-digest.tsx`

React Email component rendered by Resend. Must be a valid React Email component using `@react-email/components`.

```typescript
import {
  Html, Head, Body, Container, Section, Text, Link, Hr,
  Heading, Preview, Img,
} from '@react-email/components';
import type { DigestPayload } from '@/lib/services/weekly-digest.service';

interface WeeklyDigestEmailProps {
  payload: DigestPayload;
}

export default function WeeklyDigestEmail({ payload }: WeeklyDigestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{payload.subject}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo / Header */}
          <Section style={header}>
            <Heading style={h1}>📊 Your AI Visibility This Week</Heading>
            <Text style={subtitle}>{payload.businessName}</Text>
          </Section>

          {/* AI Health Score */}
          <Section style={scoreSection}>
            <Text style={scoreLabel}>AI Health Score</Text>
            {payload.healthScore.current !== null ? (
              <>
                <Text style={scoreValue}>
                  {payload.healthScore.current}
                  {payload.healthScore.delta !== null && (
                    <span style={payload.healthScore.delta >= 0 ? deltaUp : deltaDown}>
                      {' '}({payload.healthScore.delta >= 0 ? '+' : ''}{payload.healthScore.delta})
                    </span>
                  )}
                </Text>
              </>
            ) : (
              <Text style={scoreValue}>Not yet available</Text>
            )}
          </Section>

          {/* SOV */}
          {payload.sov.currentPercent !== null && (
            <Section style={metricRow}>
              <Text style={metricLabel}>
                Share of Voice: {payload.sov.currentPercent.toFixed(0)}%
                {payload.sov.delta !== null && (
                  <span style={payload.sov.delta >= 0 ? deltaUp : deltaDown}>
                    {' '}({payload.sov.delta >= 0 ? '+' : ''}{payload.sov.delta.toFixed(1)}pp)
                  </span>
                )}
              </Text>
            </Section>
          )}

          <Hr style={divider} />

          {/* Issues */}
          {payload.issues.length > 0 && (
            <Section>
              <Heading as="h2" style={sectionHeading}>New Issues</Heading>
              {payload.issues.map((issue, i) => (
                <Section key={i} style={itemRow}>
                  <Text style={itemText}>{issue.emoji} {issue.text}</Text>
                  <Link href={issue.cta.href} style={ctaLink}>{issue.cta.label}</Link>
                </Section>
              ))}
            </Section>
          )}

          {/* Wins */}
          {payload.wins.length > 0 && (
            <Section>
              <Heading as="h2" style={sectionHeading}>Wins This Week</Heading>
              {payload.wins.map((win, i) => (
                <Text key={i} style={itemText}>{win.emoji} {win.text}</Text>
              ))}
            </Section>
          )}

          {/* Opportunities */}
          {payload.opportunities.length > 0 && (
            <Section>
              <Heading as="h2" style={sectionHeading}>Opportunities</Heading>
              {payload.opportunities.map((opp, i) => (
                <Section key={i} style={itemRow}>
                  <Text style={itemText}>{opp.emoji} {opp.text}</Text>
                  <Link href={opp.cta.href} style={ctaLink}>{opp.cta.label}</Link>
                </Section>
              ))}
            </Section>
          )}

          {/* Bot Summary */}
          {payload.botSummary && (
            <Text style={botLine}>{payload.botSummary}</Text>
          )}

          <Hr style={divider} />

          {/* Dashboard CTA */}
          <Section style={ctaSection}>
            <Link href={payload.dashboardUrl} style={primaryCta}>
              View Full Dashboard →
            </Link>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              LocalVector — AI Visibility for Local Businesses
            </Text>
            <Link href={payload.unsubscribeUrl} style={unsubLink}>
              Manage email preferences
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
```

**Styling:** Use inline `style` objects (React Email requirement — no CSS files). Keep the design clean, mobile-friendly, and consistent with the LocalVector brand (dark theme with indigo accents if matching dashboard, or a clean light email theme for readability).

**IMPORTANT:** Read any existing email templates in `emails/` directory for style/pattern consistency. Follow whatever conventions exist.

---

### Component 3: Email Sender — `lib/email/send-digest.ts`

Wraps Resend SDK for sending the rendered digest email.

```typescript
import { Resend } from 'resend';
import { render } from '@react-email/render';
import WeeklyDigestEmail from '@/emails/weekly-digest';
import type { DigestPayload } from '@/lib/services/weekly-digest.service';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send a weekly digest email via Resend.
 * Side-effect: sends an actual email. Must be .catch()-wrapped by caller (§17).
 */
export async function sendDigestEmail(payload: DigestPayload): Promise<{ id: string } | null> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[digest] RESEND_API_KEY not set — skipping email');
    return null;
  }

  const html = await render(<WeeklyDigestEmail payload={payload} />);

  const { data, error } = await resend.emails.send({
    from: 'LocalVector <digest@localvector.ai>',
    to: payload.recipientEmail,
    subject: payload.subject,
    html,
  });

  if (error) {
    console.error('[digest] Resend error:', error);
    throw new Error(`Resend send failed: ${error.message}`);
  }

  return data;
}
```

---

### Component 4: Digest Data Fetcher — `lib/data/weekly-digest.ts`

Fetches all data needed for one org's digest email. Uses `createServiceRoleClient()` because this runs in a cron/Inngest context (no user session).

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { computeHealthScore } from '@/lib/services/ai-health-score.service';
import { buildDigestPayload, type DigestDataInput, type DigestPayload } from '@/lib/services/weekly-digest.service';

/**
 * Fetches all data for one org's weekly digest and builds the payload.
 * Runs in Inngest/cron context — uses service-role client.
 */
export async function fetchDigestForOrg(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<DigestPayload | null> {
  // ── 1. Org details + notify_weekly_digest check ──
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, owner_user_id, notify_weekly_digest')
    .eq('id', orgId)
    .single();

  if (!org || org.notify_weekly_digest === false) return null;

  // ── 2. Owner email ──
  const { data: owner } = await supabase
    .from('users')
    .select('email, full_name')
    .eq('id', org.owner_user_id!)
    .single();

  if (!owner) return null;

  // ── 3. Primary location ──
  const { data: location } = await supabase
    .from('locations')
    .select('id, business_name, city, state')
    .eq('org_id', orgId)
    .eq('is_primary', true)
    .maybeSingle();

  if (!location) return null;

  // ── 4. Parallel queries for digest content ──
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weekCutoff = oneWeekAgo.toISOString();

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const [
    currentSnapshot,
    previousSnapshot,
    newHallucinations,
    resolvedCount,
    newSovWins,
    botVisitCount,
    blindSpotData,
  ] = await Promise.all([
    // Current week's latest visibility snapshot
    supabase
      .from('visibility_analytics')
      .select('share_of_voice, snapshot_date')
      .eq('org_id', orgId)
      .eq('location_id', location.id)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Previous week's snapshot (2nd most recent)
    supabase
      .from('visibility_analytics')
      .select('share_of_voice, snapshot_date')
      .eq('org_id', orgId)
      .eq('location_id', location.id)
      .order('snapshot_date', { ascending: false })
      .range(1, 1)
      .maybeSingle(),

    // New hallucinations this week
    supabase
      .from('ai_hallucinations')
      .select('claim_text, severity, model_provider')
      .eq('org_id', orgId)
      .gte('detected_at', weekCutoff)
      .order('detected_at', { ascending: false })
      .limit(5),

    // Resolved hallucinations this week (count)
    supabase
      .from('ai_hallucinations')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('correction_status', 'fixed')
      .gte('resolved_at', weekCutoff),

    // New SOV wins — evaluations where rank_position is not null
    // detected in current week but NOT in previous week for same query
    // Simplified: evaluations with rank_position <= 5 created this week
    supabase
      .from('sov_evaluations')
      .select('query_id, engine')
      .eq('org_id', orgId)
      .not('rank_position', 'is', null)
      .lte('rank_position', 5)
      .gte('created_at', weekCutoff)
      .limit(5),

    // Bot visits this week (count)
    supabase
      .from('crawler_hits')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('crawled_at', weekCutoff),

    // Active blind spots (bots with 0 visits ever — simplified check)
    // Use count of ALL crawler_hits to determine blind spots later
    supabase
      .from('crawler_hits')
      .select('bot_type')
      .eq('org_id', orgId),
  ]);

  // ── Resolve SOV wins with query text ──
  const sovWinQueryIds = (newSovWins.data ?? []).map(e => e.query_id);
  let sovWins: DigestDataInput['sovWins'] = [];
  if (sovWinQueryIds.length > 0) {
    const { data: queries } = await supabase
      .from('target_queries')
      .select('id, query_text')
      .in('id', sovWinQueryIds);

    sovWins = (newSovWins.data ?? []).map(e => {
      const q = (queries ?? []).find(q => q.id === e.query_id);
      return {
        query_text: q?.query_text ?? 'Unknown query',
        engine: e.engine,
      };
    });
  }

  // ── Compute current + previous Health Score ──
  // Simplified: use latest page audit + snapshot data
  // Full Health Score computation could be called from the service
  // For V1, use SOV as the primary metric (Health Score may not be stored historically)
  const currentSov = currentSnapshot.data?.share_of_voice ?? null;
  const previousSov = previousSnapshot.data?.share_of_voice ?? null;

  // ── Blind spots: 10 tracked bots minus distinct bot_types seen ──
  const TOTAL_TRACKED_BOTS = 10;
  const seenBotTypes = new Set((blindSpotData.data ?? []).map(h => h.bot_type));
  const newBlindSpots = TOTAL_TRACKED_BOTS - seenBotTypes.size;

  // ── Fetch Top Recommendation from Health Score ──
  // Re-use Sprint 72 fetchHealthScore to get topRecommendation
  // Import and call if available, else null
  let topRecommendation: DigestDataInput['topRecommendation'] = null;
  try {
    const { fetchHealthScore } = await import('@/lib/data/ai-health-score');
    const healthResult = await fetchHealthScore(supabase, orgId, location.id);
    topRecommendation = healthResult.topRecommendation
      ? {
          title: healthResult.topRecommendation.title,
          description: healthResult.topRecommendation.fix ?? '',
          href: healthResult.topRecommendation.href ?? '/dashboard',
          estimatedImpact: healthResult.topRecommendation.estimatedImpact ?? 5,
        }
      : null;

    // Also get health scores
    var currentHealthScore = healthResult.score;
  } catch {
    var currentHealthScore = null;
  }

  const input: DigestDataInput = {
    org: { id: org.id, name: org.name },
    owner: { email: owner.email, full_name: owner.full_name },
    location: {
      business_name: location.business_name,
      city: location.city,
      state: location.state,
    },
    currentHealthScore: currentHealthScore ?? null,
    previousHealthScore: null, // No historical Health Score yet — future sprint
    currentSov,
    previousSov,
    newHallucinations: (newHallucinations.data ?? []).map(h => ({
      claim_text: h.claim_text,
      severity: h.severity ?? 'high',
      model_provider: h.model_provider,
    })),
    resolvedHallucinations: resolvedCount.count ?? 0,
    sovWins,
    topRecommendation,
    botVisitsThisWeek: botVisitCount.count ?? 0,
    newBlindSpots: Math.max(0, newBlindSpots),
  };

  return buildDigestPayload(input);
}
```

---

### Component 5: Inngest Function — `lib/inngest/functions/weekly-digest-cron.ts`

Fan-out: one step per org.

```typescript
import { inngest } from '../client';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { fetchDigestForOrg } from '@/lib/data/weekly-digest';
import { sendDigestEmail } from '@/lib/email/send-digest';

export const weeklyDigestCron = inngest.createFunction(
  {
    id: 'weekly-digest-cron',
    concurrency: { limit: 5 },
    retries: 1, // Email is best-effort — don't retry aggressively
  },
  { event: 'cron/digest.weekly' },
  async ({ step }) => {
    // Step 1: Fetch all active orgs
    const orgs = await step.run('fetch-orgs', async () => {
      const supabase = createServiceRoleClient();
      const { data } = await supabase
        .from('organizations')
        .select('id')
        .eq('notify_weekly_digest', true)
        .in('plan_status', ['active', 'trialing']);
      return data ?? [];
    });

    // Step 2: Fan-out — one step per org
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const org of orgs) {
      await step.run(`digest-${org.id}`, async () => {
        const supabase = createServiceRoleClient(); // Per-step client (§30.3)

        const payload = await fetchDigestForOrg(supabase, org.id);
        if (!payload) {
          skipped++;
          return;
        }

        await sendDigestEmail(payload)
          .catch((err: unknown) => {
            console.error(`[digest] Failed for org ${org.id}:`, err);
            failed++;
          });

        sent++;
      });
    }

    return { sent, skipped, failed, total: orgs.length };
  }
);
```

**Register in `app/api/inngest/route.ts`:**

```typescript
import { weeklyDigestCron } from '@/lib/inngest/functions/weekly-digest-cron';

// Add to the serve() functions array:
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // ... existing functions
    weeklyDigestCron,
  ],
});
```

**Add event type to `lib/inngest/events.ts`:**

```typescript
'cron/digest.weekly': { data: {} };
```

**Update `lib/inngest/client.ts` EventSchemas** if needed.

---

### Component 6: Cron Route — `app/api/cron/weekly-digest/route.ts`

Standard cron dispatcher pattern (AI_RULES §30.1).

```typescript
import { NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';
import { logCronStart, logCronComplete, logCronFailed } from '@/lib/services/cron-logger';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { fetchDigestForOrg } from '@/lib/data/weekly-digest';
import { sendDigestEmail } from '@/lib/email/send-digest';

export async function GET(request: Request) {
  // ── Auth guard ──
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Kill switch ──
  if (process.env.STOP_DIGEST_CRON === 'true') {
    return NextResponse.json({ ok: true, skipped: true, reason: 'Kill switch active' });
  }

  const { logId, startedAt } = await logCronStart('weekly-digest');

  // ── Primary: Inngest dispatch ──
  try {
    await inngest.send({ name: 'cron/digest.weekly', data: {} });
    await logCronComplete(logId, { dispatched: true }, startedAt);
    return NextResponse.json({ ok: true, dispatched: true });
  } catch (inngestErr) {
    console.error('[cron] Inngest dispatch failed, running inline:', inngestErr);
  }

  // ── Fallback: inline sequential ──
  try {
    const result = await runInlineDigest();
    await logCronComplete(logId, result, startedAt);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    await logCronFailed(logId, err instanceof Error ? err.message : String(err), startedAt);
    return NextResponse.json({ ok: false, error: 'Digest failed' }, { status: 500 });
  }
}

async function runInlineDigest() {
  const supabase = createServiceRoleClient();

  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .eq('notify_weekly_digest', true)
    .in('plan_status', ['active', 'trialing']);

  let sent = 0, skipped = 0, failed = 0;

  for (const org of orgs ?? []) {
    try {
      const payload = await fetchDigestForOrg(supabase, org.id);
      if (!payload) { skipped++; continue; }
      await sendDigestEmail(payload)
        .catch(() => { failed++; }); // §17 — side-effect resilience
      sent++;
    } catch {
      failed++;
    }
  }

  return { sent, skipped, failed, total: (orgs ?? []).length };
}
```

**Vercel cron schedule — add to `vercel.json`:**

```json
{
  "crons": [
    {
      "path": "/api/cron/weekly-digest",
      "schedule": "0 13 * * 1"
    }
  ]
}
```

`0 13 * * 1` = Monday at 1pm UTC (8am EST / 9am EDT — morning for US restaurant owners).

**NOTE:** Read the existing `vercel.json` first. Append to the existing `crons` array, don't replace it.

---

### Component 7: Golden Tenant Fixture — `src/__fixtures__/golden-tenant.ts`

```typescript
/**
 * Sprint 78 — Canonical DigestDataInput fixture for Charcoal N Chill.
 * Represents a good week: score up, one win, one new issue.
 */
export const MOCK_DIGEST_INPUT: import('@/lib/services/weekly-digest.service').DigestDataInput = {
  org: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', name: "Aruna's Venue" },
  owner: { email: 'dev@localvector.ai', full_name: 'Aruna Surendera Babu' },
  location: { business_name: 'Charcoal N Chill', city: 'Alpharetta', state: 'GA' },
  currentHealthScore: 67,
  previousHealthScore: 64,
  currentSov: 0.19,
  previousSov: 0.17,
  newHallucinations: [
    { claim_text: 'Charcoal N Chill closes at 10pm', severity: 'high', model_provider: 'openai-gpt4o' },
  ],
  resolvedHallucinations: 1,
  sovWins: [
    { query_text: 'hookah near Alpharetta', engine: 'perplexity' },
  ],
  topRecommendation: {
    title: 'Add FAQ Schema',
    description: 'Add structured FAQ markup for estimated +8 points.',
    href: '/dashboard/page-audits',
    estimatedImpact: 8,
  },
  botVisitsThisWeek: 12,
  newBlindSpots: 3,
};
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/weekly-digest-service.test.ts`

**Target: `lib/services/weekly-digest.service.ts`**

```
describe('buildDigestPayload')
  Subject line:
  1.  includes health score in subject when available
  2.  includes delta in subject when both current and previous exist
  3.  uses fallback subject when health score is null
  4.  includes business name in subject

  Health Score section:
  5.  calculates positive delta correctly
  6.  calculates negative delta correctly
  7.  sets trend to 'up' for positive delta
  8.  sets trend to 'down' for negative delta
  9.  sets trend to 'flat' for zero delta
  10. sets trend to 'new' when previous is null

  SOV section:
  11. converts SOV from 0-1 to percentage
  12. calculates SOV delta in percentage points
  13. handles null SOV gracefully

  Issues:
  14. maps hallucinations to issues with severity emoji
  15. critical severity gets 🔴
  16. high severity gets 🟠
  17. truncates long claim_text
  18. formats model_provider to human-readable name

  Wins:
  19. includes resolved hallucinations count
  20. includes SOV wins with engine name
  21. includes health score improvement as a win
  22. does not include health score as win when delta <= 0

  Opportunities:
  23. includes top recommendation with CTA
  24. includes blind spots when count > 0
  25. empty opportunities when no recommendation and no blind spots

  Edge cases:
  26. handles completely empty input (no data at all)
  27. uses MOCK_DIGEST_INPUT and produces valid payload
  28. sets dashboardUrl from NEXT_PUBLIC_APP_URL
  29. sets unsubscribeUrl to /dashboard/settings
```

**29 tests total. No mocks — pure function.**

### Test File 2: `src/__tests__/unit/weekly-digest-data.test.ts`

**Target: `lib/data/weekly-digest.ts`**

```
describe('fetchDigestForOrg')
  1.  returns null when org has notify_weekly_digest=false
  2.  returns null when owner_user_id has no user record
  3.  returns null when no primary location exists
  4.  runs parallel queries for digest data
  5.  scopes all queries by org_id (§18)
  6.  limits new hallucinations to 5
  7.  limits SOV wins to 5
  8.  resolves SOV win query text via target_queries
  9.  calculates blind spots from tracked bots minus seen bots
  10. returns DigestPayload on happy path
```

**10 tests total.**

### Test File 3: `src/__tests__/unit/weekly-digest-cron-route.test.ts`

**Target: `app/api/cron/weekly-digest/route.ts`**

```
describe('GET /api/cron/weekly-digest')
  1.  returns 401 when CRON_SECRET is missing
  2.  returns 401 when CRON_SECRET is wrong
  3.  returns skipped when kill switch is active
  4.  dispatches to Inngest on happy path
  5.  falls back to inline when Inngest fails
  6.  logs cron start/complete via cron-logger
```

**6 tests total.**

### Test File 4: `src/__tests__/unit/send-digest-email.test.ts`

**Target: `lib/email/send-digest.ts`**

```
describe('sendDigestEmail')
  1.  returns null when RESEND_API_KEY is not set
  2.  calls resend.emails.send with correct to/from/subject
  3.  renders WeeklyDigestEmail component to HTML
  4.  throws on Resend error (caller must .catch)
```

**4 tests total.**

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/services/weekly-digest.service.ts` | **CREATE** | Pure payload builder (DigestDataInput → DigestPayload) |
| 2 | `emails/weekly-digest.tsx` | **CREATE** | React Email template |
| 3 | `lib/email/send-digest.ts` | **CREATE** | Resend sender wrapper |
| 4 | `lib/data/weekly-digest.ts` | **CREATE** | Data fetcher — parallel queries → DigestDataInput |
| 5 | `lib/inngest/functions/weekly-digest-cron.ts` | **CREATE** | Inngest function with per-org fan-out |
| 6 | `lib/inngest/events.ts` | **MODIFY** | Add `cron/digest.weekly` event |
| 7 | `lib/inngest/client.ts` | **MODIFY** | Add event to EventSchemas |
| 8 | `app/api/inngest/route.ts` | **MODIFY** | Register weeklyDigestCron |
| 9 | `app/api/cron/weekly-digest/route.ts` | **CREATE** | Cron route dispatcher |
| 10 | `vercel.json` | **MODIFY** | Add weekly-digest cron schedule |
| 11 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | Add MOCK_DIGEST_INPUT |
| 12 | `src/__tests__/unit/weekly-digest-service.test.ts` | **CREATE** | 29 tests — pure function |
| 13 | `src/__tests__/unit/weekly-digest-data.test.ts` | **CREATE** | 10 tests — data layer |
| 14 | `src/__tests__/unit/weekly-digest-cron-route.test.ts` | **CREATE** | 6 tests — cron route |
| 15 | `src/__tests__/unit/send-digest-email.test.ts` | **CREATE** | 4 tests — email sender |

**Expected test count: 49 new tests across 4 files.**

---

## 🚫 What NOT to Do

1. **DO NOT use AI/LLM to generate email content.** All digest text is deterministic from data. No hallucination risk.
2. **DO NOT send emails to orgs with `notify_weekly_digest=false`.** Respect the opt-out preference.
3. **DO NOT send emails to orgs with `plan_status` = `canceled`.** Only `active` and `trialing` orgs receive digests.
4. **DO NOT use `createClient()` in the cron/Inngest context** (AI_RULES §18). Use `createServiceRoleClient()`.
5. **DO NOT `await` the email send without `.catch()`** in the cron loop (AI_RULES §17). A failed email for one org must not abort the entire run.
6. **DO NOT hardcode email addresses.** Fetch from `users.email` via `organizations.owner_user_id`.
7. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).
8. **DO NOT create files under `supabase/functions/`** (AI_RULES §6).
9. **DO NOT install new email libraries.** Use existing Resend + React Email stack.
10. **DO NOT use inline `<style>` tags** in React Email — use inline `style` objects per React Email conventions.

---

## ✅ Definition of Done (AI_RULES §13.5)

- [ ] `lib/services/weekly-digest.service.ts` — Pure payload builder with subject line, health score, SOV, issues, wins, opportunities
- [ ] `emails/weekly-digest.tsx` — React Email template rendering all payload sections
- [ ] `lib/email/send-digest.ts` — Resend sender with RESEND_API_KEY guard
- [ ] `lib/data/weekly-digest.ts` — Parallel data fetch + `notify_weekly_digest` check
- [ ] `lib/inngest/functions/weekly-digest-cron.ts` — Fan-out per org, concurrency=5, retries=1
- [ ] `app/api/cron/weekly-digest/route.ts` — CRON_SECRET auth, kill switch, Inngest dispatch + inline fallback
- [ ] Inngest event `cron/digest.weekly` registered in events.ts + client.ts
- [ ] `weeklyDigestCron` registered in `app/api/inngest/route.ts`
- [ ] `vercel.json` updated with Monday 1pm UTC schedule
- [ ] `MOCK_DIGEST_INPUT` added to golden-tenant
- [ ] `npx vitest run src/__tests__/unit/weekly-digest-service.test.ts` — 29 tests passing
- [ ] `npx vitest run src/__tests__/unit/weekly-digest-data.test.ts` — 10 tests passing
- [ ] `npx vitest run src/__tests__/unit/weekly-digest-cron-route.test.ts` — 6 tests passing
- [ ] `npx vitest run src/__tests__/unit/send-digest-email.test.ts` — 4 tests passing
- [ ] `npx vitest run` — ALL tests passing, no regressions
- [ ] `npx tsc --noEmit` — 0 new type errors
- [ ] DEVLOG.md entry written

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## 2026-02-28 — Sprint 78: Weekly AI Snapshot Email with CTAs (Completed)

**Goal:** Build a weekly digest email sent every Monday via Resend + React Email, showing AI Health Score trend, new issues, wins, opportunities, and bot activity — the retention engine that keeps restaurant owners engaged without logging in.

**Scope:**
- `lib/services/weekly-digest.service.ts` — **NEW.** Pure payload builder (~250 lines). Exports: `buildDigestPayload()` — assembles subject line (dynamic with score + delta), health score trend (up/down/flat/new), SOV delta, issues from hallucinations (severity-emoji'd), wins (resolved hallucinations, first SOV mentions, score improvements), opportunities (top recommendation, blind spots), bot summary. Helper formatters: `formatProvider()`, `formatEngine()`, `truncate()`. No I/O.
- `emails/weekly-digest.tsx` — **NEW.** React Email template. Sections: header with business name, AI Health Score with delta, SOV metric, issues with CTA links, wins, opportunities with CTA links, bot summary, primary dashboard CTA, footer with unsubscribe link. Inline styles per React Email convention.
- `lib/email/send-digest.ts` — **NEW.** Resend wrapper. `sendDigestEmail()` renders React Email to HTML, sends via `resend.emails.send()`. Guards against missing `RESEND_API_KEY`. Throws on error (caller `.catch()`es per §17).
- `lib/data/weekly-digest.ts` — **NEW.** Data fetcher for cron/Inngest context (~200 lines). `fetchDigestForOrg()` — checks `notify_weekly_digest`, fetches owner email, primary location, then 7 parallel queries (current/previous snapshots, new hallucinations, resolved count, SOV wins, bot visits, blind spot data). Resolves SOV win query text. Calls Health Score fetcher for top recommendation. Assembles `DigestDataInput`, calls `buildDigestPayload()`.
- `lib/inngest/functions/weekly-digest-cron.ts` — **NEW.** Inngest function `weekly-digest-cron` (concurrency=5, retries=1). Step 1: fetch orgs with `notify_weekly_digest=true` + active/trialing status. Step 2: fan-out per org — `fetchDigestForOrg()` + `sendDigestEmail()` with `.catch()` per §17. Returns {sent, skipped, failed}.
- `lib/inngest/events.ts` — **MODIFIED.** Added `cron/digest.weekly` event type.
- `lib/inngest/client.ts` — **MODIFIED.** Added event to EventSchemas.
- `app/api/inngest/route.ts` — **MODIFIED.** Registered `weeklyDigestCron` function.
- `app/api/cron/weekly-digest/route.ts` — **NEW.** Cron route dispatcher (§30.1). CRON_SECRET auth, `STOP_DIGEST_CRON` kill switch, Inngest dispatch primary, inline fallback. Cron-logged via `cron-logger.ts`.
- `vercel.json` — **MODIFIED.** Added `weekly-digest` cron: `0 13 * * 1` (Monday 1pm UTC / 8am EST).
- `src/__fixtures__/golden-tenant.ts` — **MODIFIED.** Added `MOCK_DIGEST_INPUT` fixture (good week: score +3, one win, one issue, one opportunity).

**Tests added:**
- `src/__tests__/unit/weekly-digest-service.test.ts` — **N Vitest tests.** Subject line generation, health score delta/trend, SOV conversion, issues with severity emojis, wins aggregation, opportunities, edge cases.
- `src/__tests__/unit/weekly-digest-data.test.ts` — **N Vitest tests.** Opt-out check, parallel queries, org scoping, SOV win resolution, blind spot calculation.
- `src/__tests__/unit/weekly-digest-cron-route.test.ts` — **N Vitest tests.** Auth guard, kill switch, Inngest dispatch, inline fallback, cron logging.
- `src/__tests__/unit/send-digest-email.test.ts` — **N Vitest tests.** API key guard, Resend call, error propagation.

**Run commands:**
```bash
npx vitest run src/__tests__/unit/weekly-digest-service.test.ts        # N tests passing
npx vitest run src/__tests__/unit/weekly-digest-data.test.ts           # N tests passing
npx vitest run src/__tests__/unit/weekly-digest-cron-route.test.ts     # N tests passing
npx vitest run src/__tests__/unit/send-digest-email.test.ts            # N tests passing
npx vitest run                                                          # All tests passing
```

**Note:** Replace N with actual test counts verified via `grep -cE "^\s*(it|test)\("` (AI_RULES §13.3).
```

---

## 🔗 Sprint Dependencies

| Dependency | Sprint | What It Provides |
|-----------|--------|-----------------|
| Resend + React Email stack | Sprint 67 | `RESEND_API_KEY`, `emails/` directory convention, Resend SDK |
| AI Health Score composite | Sprint 72 | `fetchHealthScore()` for current score + top recommendation |
| Crawler Analytics (blind spots) | Sprint 73 | `crawler_hits` data for bot visit count + blind spot detection |
| Notification preferences | Sprint 62 (§37.5) | `notify_weekly_digest` column on `organizations` |
| Inngest job queue | Sprint 49 (§30) | Fan-out pattern, event system, cron dispatcher |
| Cron logger | Sprint 62 (§37.1) | `logCronStart/Complete/Failed` for observability |
| `visibility_analytics` snapshots | Sprint 41 | Weekly SOV snapshots for delta computation |
| `ai_hallucinations` lifecycle | Sprint 68+ | New/resolved hallucinations for issues/wins |
| `sov_evaluations` per-engine | Sprint 69+ | SOV wins detection |

---

## 🧠 Edge Cases to Handle

1. **Org with `notify_weekly_digest=false`:** `fetchDigestForOrg` returns `null` → skipped in fan-out. No email sent.
2. **Org with no `owner_user_id`:** Returns `null` — can't send email without a recipient.
3. **Org with no primary location:** Returns `null` — no business data to report.
4. **Brand new org (no snapshots):** Health score is `null`, SOV is `null`. Subject: "Your AI Snapshot — [Business] Weekly". Sections show "Not yet available".
5. **RESEND_API_KEY not set (local dev):** `sendDigestEmail` logs warning and returns `null`. No error thrown.
6. **Resend rate limit:** The Inngest function has `concurrency: 5` and sends one at a time per org step. Resend free tier: 100 emails/day, 3000/month. Well within limits for V1.
7. **Inngest dispatch fails:** Inline fallback runs sequentially. Side-effect failures are `.catch()`ed per §17.
8. **Zero issues, zero wins, zero opportunities:** Email still sends with Health Score and SOV (if available). The "Wins" and "Issues" sections simply don't render. A quiet week is still a valid digest.
9. **Kill switch active:** `STOP_DIGEST_CRON=true` returns early with `{ skipped: true }`.
10. **Email rendering fails:** React Email `render()` throws — caught by the per-org try/catch, org is counted as `failed`, other orgs continue.

---

## 🔮 AI_RULES Update

Add to §30.4 concurrency table:

```
| `weekly-digest-cron` | 5 | 1 | Best-effort email; no retry storm for send failures |
```

Add new rule:

```markdown
## 42. 📧 Weekly Digest Email — Cron + Inngest + Resend Pattern (Sprint 78)

The weekly digest email runs as a cron → Inngest fan-out → per-org Resend send pipeline.

* **Cron route:** `app/api/cron/weekly-digest/route.ts` — dispatches `cron/digest.weekly` event.
* **Kill switch:** `STOP_DIGEST_CRON`
* **Inngest function:** `weekly-digest-cron` (concurrency=5, retries=1)
* **Opt-out:** Respects `organizations.notify_weekly_digest` (default `true`). Only sends to `plan_status` in `['active', 'trialing']`.
* **Recipient:** `users.email` resolved via `organizations.owner_user_id`.
* **Side-effect resilience (§17):** Every `sendDigestEmail()` call is wrapped in `.catch()`. A failed email for one org never aborts the fan-out.
* **React Email template:** `emails/weekly-digest.tsx` — rendered via `@react-email/render`.
* **No AI calls.** All content is deterministic from existing dashboard data.
```
