// ---------------------------------------------------------------------------
// lib/corrections/correction-service.ts — Sprint 121: Full correction lifecycle
//
// AI_RULES §59: generateCorrectionBrief() never throws. Always void fire-and-forget.
// Correction rescan LIMIT 20 per run. 3-way result: cleared/persists/inconclusive.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { generateText } from 'ai';
import { getModel } from '@/lib/ai/providers';
import {
  buildCorrectionBriefPrompt,
  buildCorrectionDraftTitle,
} from './correction-brief-prompt';
import type { CorrectionFollowUp, CorrectionResult } from './types';
import { getRevenueImpactBySeverity } from '@/lib/hallucinations/fix-guidance';
import { createHallucinationWin } from '@/lib/services/wins.service';

// ---------------------------------------------------------------------------
// markHallucinationCorrected
// ---------------------------------------------------------------------------

export async function markHallucinationCorrected(
  supabase: SupabaseClient<Database>,
  hallucinationId: string,
  orgId: string,
  notes?: string,
): Promise<CorrectionResult> {
  // 1. Fetch hallucination — verify ownership
  const { data: hallucination, error: fetchErr } = await supabase
    .from('ai_hallucinations')
    .select('id, claim_text, expected_truth, correction_status, org_id, severity, category')
    .eq('id', hallucinationId)
    .eq('org_id', orgId)
    .maybeSingle();

  if (fetchErr || !hallucination) {
    throw new Error('hallucination_not_found');
  }

  // 2. Check if already corrected
  if (hallucination.correction_status === 'corrected') {
    throw new Error('already_corrected');
  }

  // S14: Snapshot revenue impact at fix time so the recovery counter never drifts
  const revenueRecovered = getRevenueImpactBySeverity(
    (hallucination as unknown as { severity: string }).severity,
  );

  // S14: fix_guidance_category maps category → FIX_GUIDANCE lookup key
  const rawCategory = (hallucination as unknown as { category: string | null }).category;
  const fixGuidanceCategory = rawCategory ? rawCategory.toLowerCase() : null;

  // 3. Update status to corrected
  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('ai_hallucinations')
    .update({
      correction_status: 'corrected',
      corrected_at: now,
      // S14: fixed_at records when user submitted the correction; cleared if recurring
      fixed_at: now,
      // S14: snapshotted at fix time — never recomputed after this point
      revenue_recovered_monthly: revenueRecovered > 0 ? revenueRecovered : null,
      fix_guidance_category: fixGuidanceCategory,
      resolution_notes: notes ?? null,
    } as never)
    .eq('id', hallucinationId);

  if (updateErr) {
    throw new Error(`update_failed: ${updateErr.message}`);
  }

  // 4. Insert correction_follow_ups
  const rescanDueAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: followUp, error: insertErr } = await supabase
    .from('correction_follow_ups' as never)
    .insert({
      hallucination_id: hallucinationId,
      org_id: orgId,
      rescan_due_at: rescanDueAt,
    } as never)
    .select('*')
    .single();

  if (insertErr || !followUp) {
    throw new Error(`follow_up_insert_failed: ${insertErr?.message}`);
  }

  const typedFollowUp = followUp as unknown as CorrectionFollowUp;

  // 5. Fire-and-forget brief generation
  const orgResult = await supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .maybeSingle();
  const orgName = (orgResult.data as { name: string } | null)?.name ?? 'Your Business';

  void generateCorrectionBrief(
    supabase,
    {
      id: hallucinationId,
      claim_text: hallucination.claim_text,
      expected_truth: hallucination.expected_truth,
    },
    orgId,
    orgName,
    notes,
  );

  // S20: Record this fix as a win (fire-and-forget, never blocks correction flow)
  void createHallucinationWin(
    supabase,
    orgId,
    hallucination.claim_text,
    revenueRecovered > 0 ? revenueRecovered : null,
  ).catch((err) => {
    Sentry.captureException(err, { tags: { fn: 'createHallucinationWin', sprint: 'S20' } });
  });

  return {
    follow_up: typedFollowUp,
    brief_id: null,
  };
}

// ---------------------------------------------------------------------------
// generateCorrectionBrief — NEVER THROWS (AI_RULES §59)
// ---------------------------------------------------------------------------

export async function generateCorrectionBrief(
  supabase: SupabaseClient<Database>,
  hallucination: { id: string; claim_text: string; expected_truth: string | null },
  orgId: string,
  orgName: string,
  notes?: string,
): Promise<void> {
  try {
    const correctInfo = notes ?? hallucination.expected_truth ?? 'the correct information';

    const { systemPrompt, userPrompt } = buildCorrectionBriefPrompt({
      claim_text: hallucination.claim_text,
      org_name: orgName,
      correct_info: correctInfo,
      content_type: 'factual correction article',
    });

    const { text } = await generateText({
      model: getModel('streaming-preview'),
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 512,
    });

    const title = buildCorrectionDraftTitle(hallucination.claim_text, orgName);

    // Insert content draft with trigger_type='hallucination_correction'
    const { data: draft } = await supabase
      .from('content_drafts')
      .insert({
        org_id: orgId,
        trigger_type: 'hallucination_correction',
        trigger_id: hallucination.id,
        title,
        body: text,
        status: 'draft',
        content_type: 'blog_post',
      } as never)
      .select('id')
      .single();

    if (draft) {
      // Update correction_follow_ups with brief id
      await supabase
        .from('correction_follow_ups' as never)
        .update({ correction_brief_id: (draft as { id: string }).id } as never)
        .eq('hallucination_id' as never, hallucination.id as never);
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { sprint: '121', phase: 'correction-brief' },
      extra: { hallucinationId: hallucination.id, orgId },
    });
    console.warn('[correction-service] Brief generation failed (non-critical):', err);
  }
}

// ---------------------------------------------------------------------------
// runCorrectionRescan
// ---------------------------------------------------------------------------

export async function runCorrectionRescan(
  supabase: SupabaseClient<Database>,
  followUp: CorrectionFollowUp,
): Promise<void> {
  // 1. Fetch hallucination claim_text
  const { data: hall } = await supabase
    .from('ai_hallucinations')
    .select('claim_text')
    .eq('id', followUp.hallucination_id)
    .maybeSingle();

  if (!hall) {
    console.warn(`[correction-rescan] Hallucination ${followUp.hallucination_id} not found`);
    return;
  }

  const claimText = (hall as { claim_text: string }).claim_text;

  // 2. Ask AI if claim appears accurate
  const { text: aiResponse } = await generateText({
    model: getModel('streaming-preview'),
    prompt: `${claimText}\n\nIs this statement true? Answer concisely.`,
    maxTokens: 256,
  });

  // 3. Heuristic classification
  const lower = aiResponse.toLowerCase();
  let rescanStatus: 'cleared' | 'persists' | 'inconclusive';

  if (
    lower.includes('no longer') ||
    lower.includes('not accurate') ||
    lower.includes('false') ||
    lower.includes('incorrect') ||
    lower.includes('not true')
  ) {
    rescanStatus = 'cleared';
  } else if (
    lower.includes('yes') ||
    lower.includes('accurate') ||
    lower.includes('true') ||
    lower.includes('correct')
  ) {
    rescanStatus = 'persists';
  } else {
    rescanStatus = 'inconclusive';
  }

  // 4. Update correction_follow_ups
  await supabase
    .from('correction_follow_ups' as never)
    .update({
      rescan_status: rescanStatus,
      rescan_completed_at: new Date().toISOString(),
      rescan_ai_response: aiResponse,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id' as never, followUp.id as never);
}

// ---------------------------------------------------------------------------
// getCorrectionEffectivenessScore
// ---------------------------------------------------------------------------

export async function getCorrectionEffectivenessScore(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<{ cleared: number; total_rescanned: number; score: number | null }> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows } = await supabase
    .from('correction_follow_ups' as never)
    .select('rescan_status' as never)
    .eq('org_id' as never, orgId as never)
    .in('rescan_status' as never, ['cleared', 'persists'] as never)
    .gte('rescan_completed_at' as never, thirtyDaysAgo as never);

  const typedRows = (rows ?? []) as unknown as { rescan_status: string }[];
  const cleared = typedRows.filter((r) => r.rescan_status === 'cleared').length;
  const total = typedRows.length;

  return {
    cleared,
    total_rescanned: total,
    score: total > 0 ? Math.round((cleared / total) * 100) : null,
  };
}
