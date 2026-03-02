// ---------------------------------------------------------------------------
// lib/vaio/vaio-service.ts — VAIO orchestrator
//
// Runs the full Voice & Conversational AI Optimization scan for a location.
// Follows the same pattern as nap-sync-service.ts and schema-expansion-service.ts.
//
// Sprint 109: VAIO
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type {
  VAIORunResult,
  GroundTruthForVAIO,
  AICrawlerAuditResult,
  VoiceGap,
  VoiceContentIssue,
  LlmsPageUrl,
  VOICE_SCORE_WEIGHTS as ScoreWeightsType,
} from './types';
import { VOICE_SCORE_WEIGHTS } from './types';
import { seedVoiceQueriesForLocation, getVoiceQueriesForLocation } from './voice-query-library';
import { scoreVoiceContent } from './voice-content-scorer';
import { auditAICrawlerAccess } from './ai-crawler-auditor';
import { generateLlmsTxt } from './llms-txt-generator';
import { detectVoiceGaps, triggerVoiceGapDrafts } from './voice-gap-detector';
import { planSatisfies } from '@/lib/plan-enforcer';

// ---------------------------------------------------------------------------
// Single location
// ---------------------------------------------------------------------------

export async function runVAIO(
  supabase: SupabaseClient<Database>,
  locationId: string,
  orgId: string,
): Promise<VAIORunResult> {
  const errors: string[] = [];
  const runAt = new Date().toISOString();

  try {
    // ── 1. Fetch location data ─────────────────────────────────────────
    const { data: loc } = await supabase
      .from('locations')
      .select('business_name, address_line1, city, state, zip, phone, website_url, categories, amenities, hours_data')
      .eq('id', locationId)
      .single();

    if (!loc) {
      return makeErrorResult(locationId, orgId, runAt, ['Location not found']);
    }

    const groundTruth: GroundTruthForVAIO = {
      location_id: locationId,
      org_id: orgId,
      name: loc.business_name,
      address: loc.address_line1 ?? '',
      city: loc.city ?? '',
      state: loc.state ?? '',
      zip: loc.zip ?? '',
      phone: loc.phone,
      website: loc.website_url,
      categories: (loc.categories as string[]) ?? [],
      amenities: (loc.amenities as Record<string, boolean | undefined>) ?? {},
      hours: parseHoursData(loc.hours_data),
    };

    // ── 2. Fetch org plan for gating ───────────────────────────────────
    const { data: org } = await supabase
      .from('organizations')
      .select('plan')
      .eq('id', orgId)
      .single();
    const planTier = org?.plan ?? 'trial';

    // ── 3. Seed voice queries ──────────────────────────────────────────
    let voiceQueriesSeeded = 0;
    try {
      const seedResult = await seedVoiceQueriesForLocation(
        supabase, groundTruth, locationId, orgId, planTier,
      );
      voiceQueriesSeeded = seedResult.seeded;
    } catch (err) {
      errors.push('Voice query seeding failed');
      Sentry.captureException(err, { tags: { component: 'vaio', step: 'seed' } });
    }

    // ── 4. Fetch voice query citation rates ────────────────────────────
    const voiceQueries = await getVoiceQueriesForLocation(supabase, locationId);
    const totalVoiceQueries = voiceQueries.length;
    const citedQueries = voiceQueries.filter((q) => q.citation_rate !== null && q.citation_rate > 0);
    const avgCitationRate = totalVoiceQueries > 0
      ? citedQueries.reduce((sum, q) => sum + (q.citation_rate ?? 0), 0) / totalVoiceQueries
      : 0;

    // ── 5. Audit AI crawler access ─────────────────────────────────────
    let crawlerAudit: AICrawlerAuditResult | null = null;
    if (groundTruth.website) {
      try {
        crawlerAudit = await auditAICrawlerAccess(groundTruth.website);
      } catch (err) {
        errors.push('AI crawler audit failed');
        Sentry.captureException(err, { tags: { component: 'vaio', step: 'crawler-audit' } });
      }
    }
    const crawlerHealth = crawlerAudit?.overall_health ?? 'unknown';

    // ── 6. Generate llms.txt ───────────────────────────────────────────
    let llmsTxtGenerated = false;
    let llmsTxtStatus: 'generated' | 'stale' | 'not_generated' = 'not_generated';
    let llmsTxtStandard: string | null = null;
    let llmsTxtFull: string | null = null;

    try {
      // Fetch page URLs from page_schemas
      const { data: pageSchemas } = await supabase
        .from('page_schemas')
        .select('page_type, page_url')
        .eq('location_id', locationId)
        .eq('status', 'published');

      const pageUrls: LlmsPageUrl[] = (pageSchemas ?? []).map((ps) => ({
        page_type: ps.page_type as LlmsPageUrl['page_type'],
        url: ps.page_url,
        description: `${ps.page_type} page`,
      }));

      // Fetch top review keywords (if reviews table exists)
      const topReviewKeywords: string[] = [];

      const llmsTxt = generateLlmsTxt(groundTruth, topReviewKeywords, pageUrls);
      llmsTxtStandard = llmsTxt.standard;
      llmsTxtFull = llmsTxt.full;
      llmsTxtGenerated = true;
      llmsTxtStatus = 'generated';
    } catch (err) {
      errors.push('llms.txt generation failed');
      Sentry.captureException(err, { tags: { component: 'vaio', step: 'llms-txt' } });
    }

    // ── 7. Detect voice gaps ───────────────────────────────────────────
    let voiceGaps: VoiceGap[] = [];
    let autopilotDraftsTriggered = 0;
    try {
      voiceGaps = await detectVoiceGaps(supabase, groundTruth, locationId, orgId);
      if (voiceGaps.length > 0) {
        autopilotDraftsTriggered = await triggerVoiceGapDrafts(
          supabase, orgId, locationId, voiceGaps,
        );
      }
    } catch (err) {
      errors.push('Voice gap detection failed');
      Sentry.captureException(err, { tags: { component: 'vaio', step: 'gaps' } });
    }

    // ── 8. Score voice content ─────────────────────────────────────────
    let avgContentScore = 0;
    const topIssues: VoiceContentIssue[] = [];
    try {
      const { data: drafts } = await supabase
        .from('content_drafts')
        .select('draft_content')
        .eq('location_id', locationId)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(5);

      if (drafts && drafts.length > 0) {
        let totalScore = 0;
        for (const draft of drafts) {
          const result = scoreVoiceContent(
            draft.draft_content, groundTruth.name, groundTruth.city, 'gbp_post',
          );
          totalScore += result.overall_score;
          for (const issue of result.issues) {
            if (topIssues.length < 5 && !topIssues.some((i) => i.type === issue.type)) {
              topIssues.push(issue);
            }
          }
        }
        avgContentScore = totalScore / drafts.length;
      }
    } catch (err) {
      errors.push('Content scoring failed');
      Sentry.captureException(err, { tags: { component: 'vaio', step: 'content-score' } });
    }

    // ── 9. Compute voice readiness score ───────────────────────────────
    const voiceReadinessScore = computeVoiceReadinessScore(
      llmsTxtStatus, crawlerHealth, avgCitationRate, avgContentScore,
    );

    // ── 10. Upsert vaio_profiles ───────────────────────────────────────
    await supabase
      .from('vaio_profiles')
      .upsert({
        location_id: locationId,
        org_id: orgId,
        voice_readiness_score: voiceReadinessScore,
        llms_txt_standard: llmsTxtStandard,
        llms_txt_full: llmsTxtFull,
        llms_txt_generated_at: llmsTxtGenerated ? runAt : undefined,
        llms_txt_status: llmsTxtStatus,
        crawler_audit: crawlerAudit as unknown as Record<string, unknown>,
        voice_queries_tracked: totalVoiceQueries,
        voice_citation_rate: avgCitationRate,
        voice_gaps: voiceGaps as unknown as Record<string, unknown>[],
        top_content_issues: topIssues as unknown as Record<string, unknown>[],
        last_run_at: runAt,
      }, { onConflict: 'location_id' });

    // ── 11. Update locations ───────────────────────────────────────────
    await supabase
      .from('locations')
      .update({
        voice_readiness_score: voiceReadinessScore,
        vaio_last_run_at: runAt,
      })
      .eq('id', locationId);

    // ── 12. Return result ──────────────────────────────────────────────
    return {
      location_id: locationId,
      org_id: orgId,
      voice_readiness_score: voiceReadinessScore,
      voice_queries_seeded: voiceQueriesSeeded,
      voice_gaps_found: voiceGaps.length,
      autopilot_drafts_triggered: autopilotDraftsTriggered,
      llms_txt_generated: llmsTxtGenerated,
      crawler_health: crawlerHealth,
      errors,
      run_at: runAt,
    };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'vaio', sprint: '109' },
      extra: { locationId, orgId },
    });
    return makeErrorResult(locationId, orgId, runAt, [
      err instanceof Error ? err.message : 'Unknown error',
    ]);
  }
}

// ---------------------------------------------------------------------------
// Score computation (pure)
// ---------------------------------------------------------------------------

export function computeVoiceReadinessScore(
  llmsTxtStatus: 'generated' | 'stale' | 'not_generated',
  crawlerHealth: 'healthy' | 'partial' | 'blocked' | 'unknown',
  avgVoiceCitationRate: number,
  avgContentScore: number,
): number {
  // llms.txt score (max 25)
  let llmsScore = 0;
  if (llmsTxtStatus === 'generated') llmsScore = VOICE_SCORE_WEIGHTS.llms_txt;
  else if (llmsTxtStatus === 'stale') llmsScore = Math.round(VOICE_SCORE_WEIGHTS.llms_txt * 0.48);

  // Crawler access score (max 25)
  let crawlerScore = 0;
  if (crawlerHealth === 'healthy') crawlerScore = VOICE_SCORE_WEIGHTS.crawler_access;
  else if (crawlerHealth === 'partial') crawlerScore = Math.round(VOICE_SCORE_WEIGHTS.crawler_access * 0.48);
  else if (crawlerHealth === 'unknown') crawlerScore = Math.round(VOICE_SCORE_WEIGHTS.crawler_access * 0.4);

  // Voice citation score (max 30)
  const citationScore = Math.round(avgVoiceCitationRate * VOICE_SCORE_WEIGHTS.voice_citation);

  // Content quality score (max 20)
  const contentScore = Math.round((avgContentScore / 100) * VOICE_SCORE_WEIGHTS.content_quality);

  return Math.min(100, llmsScore + crawlerScore + citationScore + contentScore);
}

// ---------------------------------------------------------------------------
// Batch function (for cron)
// ---------------------------------------------------------------------------

export async function runVAIOForAllLocations(
  supabase: SupabaseClient<Database>,
): Promise<{ processed: number; total_score_avg: number; errors: number }> {
  // Fetch all Growth+ orgs
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, plan')
    .in('plan_status', ['active', 'trialing']);

  if (!orgs) return { processed: 0, total_score_avg: 0, errors: 0 };

  const growthOrgs = orgs.filter((o) => planSatisfies(o.plan, 'growth'));
  let processed = 0;
  let totalScore = 0;
  let errorCount = 0;

  for (const org of growthOrgs) {
    const { data: locations } = await supabase
      .from('locations')
      .select('id')
      .eq('org_id', org.id)
      .eq('is_archived', false);

    if (!locations) continue;

    for (const loc of locations) {
      try {
        const result = await runVAIO(supabase, loc.id, org.id);
        totalScore += result.voice_readiness_score;
        if (result.errors.length > 0) errorCount++;
        processed++;
      } catch (err) {
        errorCount++;
        Sentry.captureException(err, {
          tags: { component: 'vaio', scope: 'all-locations', sprint: '109' },
          extra: { orgId: org.id, locationId: loc.id },
        });
      }

      // 1s sleep between locations
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return {
    processed,
    total_score_avg: processed > 0 ? Math.round(totalScore / processed) : 0,
    errors: errorCount,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function makeErrorResult(
  locationId: string,
  orgId: string,
  runAt: string,
  errors: string[],
): VAIORunResult {
  return {
    location_id: locationId,
    org_id: orgId,
    voice_readiness_score: 0,
    voice_queries_seeded: 0,
    voice_gaps_found: 0,
    autopilot_drafts_triggered: 0,
    llms_txt_generated: false,
    crawler_health: 'unknown',
    errors,
    run_at: runAt,
  };
}

function parseHoursData(
  hoursData: unknown,
): Record<string, { open: string; close: string } | null> | null {
  if (!hoursData || typeof hoursData !== 'object') return null;

  const result: Record<string, { open: string; close: string } | null> = {};
  const data = hoursData as Record<string, unknown>;

  for (const [day, value] of Object.entries(data)) {
    if (value === 'closed' || value === null) {
      result[day] = null;
    } else if (typeof value === 'object' && value !== null) {
      const h = value as Record<string, string>;
      result[day] = { open: h.open ?? '00:00', close: h.close ?? '00:00' };
    }
  }

  return result;
}
