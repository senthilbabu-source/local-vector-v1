// ---------------------------------------------------------------------------
// lib/services/occasion-engine.service.ts — Occasion Engine Core Logic
//
// Detects upcoming seasonal events and proactively creates content drafts
// so businesses can be AI-visible before peak dates.
//
// This module is a pure service — it never creates its own Supabase client.
// The SOV cron route passes in a service-role client.
//
// Spec: docs/16-OCCASION-ENGINE.md §3–§4
// ---------------------------------------------------------------------------

import { generateText } from 'ai';
import { getModel, hasApiKey } from '@/lib/ai/providers';
import { OccasionDraftSchema } from '@/lib/ai/schemas';
import { canRunOccasionEngine, type PlanTier } from '@/lib/plan-enforcer';
import { getRedis } from '@/lib/redis';
import type {
  LocalOccasionRow,
  OccasionAlert,
  OccasionSchedulerResult,
} from '@/lib/types/occasions';
import type { SOVQueryResult } from '@/lib/services/sov-engine.service';

// ---------------------------------------------------------------------------
// getDaysUntilPeak — Doc 16 §3.2
// ---------------------------------------------------------------------------

/**
 * Compute the number of days until the next occurrence of an occasion.
 *
 * - Fixed dates (MM-DD): calculates days to this year's date or next year's.
 * - Evergreen (null annual_date): returns `trigger_days_before` so it's
 *   always within the trigger window.
 */
export function getDaysUntilPeak(
  occasion: LocalOccasionRow,
  today: Date,
): number {
  if (!occasion.annual_date) {
    return occasion.trigger_days_before;
  }

  const [month, day] = occasion.annual_date.split('-').map(Number);
  const thisYear = new Date(today.getFullYear(), month - 1, day);
  const nextYear = new Date(today.getFullYear() + 1, month - 1, day);
  const msPerDay = 86_400_000;

  const daysToThisYear = Math.ceil(
    (thisYear.getTime() - today.getTime()) / msPerDay,
  );

  return daysToThisYear >= 0
    ? daysToThisYear
    : Math.ceil((nextYear.getTime() - today.getTime()) / msPerDay);
}

// ---------------------------------------------------------------------------
// getISOWeekNumber — for Redis dedup key
// ---------------------------------------------------------------------------

function getISOWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

// ---------------------------------------------------------------------------
// checkOccasionAlerts — Doc 16 §3.1
// ---------------------------------------------------------------------------

/**
 * Scan the occasion calendar and return alerts for this org+location.
 *
 * Checks:
 *   1. Occasion is active
 *   2. Within trigger window (0 <= daysUntilPeak <= trigger_days_before)
 *   3. Category relevance (location categories vs occasion categories)
 *   4. Redis dedup (occasion_alert:{orgId}:{occasionId}:{weekNumber})
 *   5. SOV citation check (is business already cited for occasion queries?)
 */
export async function checkOccasionAlerts(
  orgId: string,
  locationId: string,
  locationCategories: string[],
  sovResults: SOVQueryResult[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<{ alerts: OccasionAlert[]; skipped: number }> {
  const today = new Date();
  const weekNumber = getISOWeekNumber(today);

  // Fetch active occasions
  const { data: occasions, error } = await supabase
    .from('local_occasions')
    .select('*')
    .eq('is_active', true);

  if (error || !occasions?.length) {
    return { alerts: [], skipped: 0 };
  }

  const alerts: OccasionAlert[] = [];
  let skipped = 0;

  for (const occ of occasions as LocalOccasionRow[]) {
    const daysUntilPeak = getDaysUntilPeak(occ, today);

    // Only fire if within the trigger window and not past peak
    if (daysUntilPeak < 0 || daysUntilPeak > occ.trigger_days_before) {
      continue;
    }

    // Check category relevance
    const isRelevant = occ.relevant_categories.some((c) =>
      locationCategories.some((lc) =>
        lc.toLowerCase().includes(c.toLowerCase()),
      ),
    );
    if (!isRelevant) continue;

    // Redis dedup — AI_RULES §17: wrap in try/catch, degrade gracefully
    const dedupKey = `occasion_alert:${orgId}:${occ.id}:${weekNumber}`;
    try {
      const redis = getRedis();
      const existing = await redis.get(dedupKey);
      if (existing) {
        skipped++;
        continue;
      }
    } catch {
      // Redis unavailable — proceed without dedup
    }

    // Check SOV citation: does any recent SOV result match occasion query patterns?
    const citedForAnyQuery = sovResults.some((r) => {
      if (!r.ourBusinessCited) return false;
      return occ.peak_query_patterns.some((p) => {
        const pattern = p.query.toLowerCase().replace(/\{.*?\}/g, '');
        const queryText = r.queryText.toLowerCase();
        return queryText.includes(pattern.trim()) || pattern.trim().length === 0;
      });
    });

    alerts.push({
      occasionId: occ.id,
      occasionName: occ.name,
      occasionType: occ.occasion_type,
      daysUntilPeak,
      peakQueryPatterns: occ.peak_query_patterns,
      citedForAnyQuery,
      autoDraftTriggered: false,
      autoDraftId: null,
    });
  }

  return { alerts, skipped };
}

// ---------------------------------------------------------------------------
// Occasion draft prompt — Doc 16 §4.2
// ---------------------------------------------------------------------------

function buildOccasionDraftPrompt(
  occasionName: string,
  daysUntilPeak: number,
  businessName: string,
  city: string,
  state: string,
  category: string,
  queryPatterns: string[],
): string {
  return `You are an AEO content strategist. Generate a content brief for an occasion page targeting AI search queries about ${occasionName}.

Business: ${businessName}
Location: ${city}, ${state}
Category: ${category}
Occasion: ${occasionName} (${daysUntilPeak} days away)
Target queries: ${queryPatterns.join(', ')}

Generate JSON only:
{
  "title": "page title targeting the occasion queries",
  "content": "300-word Answer-First page content. Start with a direct answer to the most common query. Include: why this venue is ideal for ${occasionName}, specific details (atmosphere, menu items, booking), and a clear CTA. Mention ${city} naturally 2-3 times.",
  "estimated_aeo_score": 75,
  "target_keywords": ["array", "of", "5-8", "target", "phrases"]
}

Return only valid JSON. No markdown, no explanation outside the JSON object.`;
}

// ---------------------------------------------------------------------------
// generateOccasionDraft — Doc 16 §4.1
// ---------------------------------------------------------------------------

/**
 * Generate and insert an occasion content draft if all conditions are met:
 *   1. daysUntilPeak <= 21 (within 3-week window)
 *   2. citedForAnyQuery === false (business not yet cited)
 *   3. No existing draft for this occasion (idempotency)
 */
export async function generateOccasionDraft(
  alert: OccasionAlert,
  orgId: string,
  locationId: string,
  businessName: string,
  city: string,
  state: string,
  category: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<{ triggered: boolean; draftId: string | null }> {
  // Condition 1: within 3-week window
  if (alert.daysUntilPeak > 21) {
    return { triggered: false, draftId: null };
  }

  // Condition 2: not already cited
  if (alert.citedForAnyQuery) {
    return { triggered: false, draftId: null };
  }

  // Condition 3: no existing draft (idempotency)
  const { data: existing } = await supabase
    .from('content_drafts')
    .select('id')
    .eq('trigger_type', 'occasion')
    .eq('trigger_id', alert.occasionId)
    .in('status', ['draft', 'approved', 'published'])
    .limit(1);

  if (existing && existing.length > 0) {
    return { triggered: false, draftId: null };
  }

  // Generate draft content
  const queryPatterns = alert.peakQueryPatterns.map((p) =>
    p.query
      .replace(/\{city\}/g, city)
      .replace(/\{category\}/g, category),
  );

  let title: string;
  let content: string;
  let aeoScore: number;

  if (!hasApiKey('openai')) {
    // Mock draft when API key is absent
    title = `[MOCK] ${businessName} — ${alert.occasionName} in ${city}`;
    content = `[MOCK] This is a simulated occasion draft for ${alert.occasionName}. Configure OPENAI_API_KEY to generate real content.`;
    aeoScore = 75;
  } else {
    const prompt = buildOccasionDraftPrompt(
      alert.occasionName,
      alert.daysUntilPeak,
      businessName,
      city,
      state,
      category,
      queryPatterns,
    );

    const { text } = await generateText({
      model: getModel('greed-intercept'),
      prompt,
      temperature: 0.4,
    });

    try {
      const parsed = OccasionDraftSchema.parse(JSON.parse(text));
      title = parsed.title;
      content = parsed.content;
      aeoScore = parsed.estimated_aeo_score;
    } catch {
      // Unparseable AI response — use fallback
      title = `${businessName} — ${alert.occasionName} in ${city}`;
      content = text;
      aeoScore = 70;
    }
  }

  // Insert draft
  const { data: inserted } = await supabase
    .from('content_drafts')
    .insert({
      org_id: orgId,
      location_id: locationId,
      trigger_type: 'occasion',
      trigger_id: alert.occasionId,
      draft_title: title,
      draft_content: content,
      target_prompt: queryPatterns[0] ?? alert.occasionName,
      content_type: 'occasion_page',
      aeo_score: aeoScore,
      status: 'draft',
      human_approved: false,
    })
    .select('id')
    .single();

  return { triggered: true, draftId: inserted?.id ?? null };
}

// ---------------------------------------------------------------------------
// runOccasionScheduler — Top-level orchestrator (Doc 16 §3.1)
// ---------------------------------------------------------------------------

/**
 * Run the full Occasion Engine for a single org+location.
 *
 * Called from the SOV cron after writeSOVResults().
 * Non-critical: callers should wrap in try/catch.
 */
export async function runOccasionScheduler(
  orgId: string,
  locationId: string,
  locationCategories: string[],
  plan: PlanTier | string,
  sovResults: SOVQueryResult[],
  businessName: string,
  city: string,
  state: string,
  category: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<OccasionSchedulerResult> {
  const { alerts, skipped } = await checkOccasionAlerts(
    orgId,
    locationId,
    locationCategories,
    sovResults,
    supabase,
  );

  let draftsCreated = 0;

  // Generate drafts for eligible alerts (Growth/Agency only)
  if (canRunOccasionEngine(plan as PlanTier)) {
    for (const alert of alerts) {
      const { triggered, draftId } = await generateOccasionDraft(
        alert,
        orgId,
        locationId,
        businessName,
        city,
        state,
        category,
        supabase,
      );

      if (triggered) {
        alert.autoDraftTriggered = true;
        alert.autoDraftId = draftId;
        draftsCreated++;
      }
    }
  }

  // Set Redis dedup keys for all fired alerts
  const today = new Date();
  const weekNumber = getISOWeekNumber(today);
  for (const alert of alerts) {
    try {
      const redis = getRedis();
      const dedupKey = `occasion_alert:${orgId}:${alert.occasionId}:${weekNumber}`;
      await redis.set(dedupKey, '1', { ex: 8 * 86_400 }); // 8-day TTL
    } catch {
      // Redis unavailable — continue without dedup persistence
    }
  }

  return {
    orgId,
    locationId,
    alerts,
    alertsFired: alerts.length,
    alertsSkipped: skipped,
    draftsCreated,
  };
}
