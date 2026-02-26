// ---------------------------------------------------------------------------
// lib/tools/visibility-tools.ts — AI Chat Tool Definitions
//
// Surgery 6: Tools that the AI assistant can call during a chat session.
// Each tool queries Supabase for org-scoped data and returns structured
// results that the Chat component renders as rich UI cards.
//
// These tools are used by the streamText() call in /api/chat/route.ts.
// They receive orgId from the route handler (derived from auth context).
//
// Spec: Surgical Integration Plan §Surgery 6
// ---------------------------------------------------------------------------

import { tool } from 'ai';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { zodSchema } from '@/lib/ai/schemas';

// ---------------------------------------------------------------------------
// Tool: getVisibilityScore
// ---------------------------------------------------------------------------

export function makeVisibilityTools(orgId: string) {
    return {
        getVisibilityScore: tool({
            description: 'Get the current AI visibility score, share-of-voice, and reality score for this business.',
            parameters: zodSchema(z.object({})),
            execute: async () => {
                const supabase = createServiceRoleClient();

                const { data: vis } = await supabase
                    .from('visibility_analytics')
                    .select('share_of_voice, citation_rate, snapshot_date')
                    .eq('org_id', orgId)
                    .order('snapshot_date', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                const { count: openCount } = await supabase
                    .from('ai_hallucinations')
                    .select('*', { count: 'exact', head: true })
                    .eq('org_id', orgId)
                    .eq('correction_status', 'open');

                const { count: fixedCount } = await supabase
                    .from('ai_hallucinations')
                    .select('*', { count: 'exact', head: true })
                    .eq('org_id', orgId)
                    .eq('correction_status', 'fixed');

                const sov = vis?.share_of_voice != null ? Math.round(vis.share_of_voice * 100) : null;
                const accuracy = (openCount ?? 0) === 0 ? 100 : Math.max(40, 100 - (openCount ?? 0) * 15);
                const realityScore = sov != null ? Math.round(sov * 0.4 + accuracy * 0.4 + 100 * 0.2) : null;

                return {
                    type: 'visibility_score' as const,
                    share_of_voice: sov,
                    citation_rate: vis?.citation_rate != null ? Math.round(vis.citation_rate * 100) : null,
                    accuracy_score: accuracy,
                    reality_score: realityScore,
                    open_hallucinations: openCount ?? 0,
                    fixed_hallucinations: fixedCount ?? 0,
                    last_snapshot: vis?.snapshot_date ?? null,
                };
            },
        }),

        // -----------------------------------------------------------------------
        // Tool: getSOVTrend
        // -----------------------------------------------------------------------

        getSOVTrend: tool({
            description: 'Get the share-of-voice trend over time showing how AI visibility has changed.',
            parameters: zodSchema(z.object({
                limit: z.number().min(1).max(52).default(12).describe('Number of data points'),
            })),
            execute: async ({ limit }) => {
                const supabase = createServiceRoleClient();

                const { data: snapshots } = await supabase
                    .from('visibility_analytics')
                    .select('share_of_voice, citation_rate, snapshot_date')
                    .eq('org_id', orgId)
                    .order('snapshot_date', { ascending: true })
                    .limit(limit);

                return {
                    type: 'sov_trend' as const,
                    data: (snapshots ?? []).map((s: any) => ({
                        date: s.snapshot_date,
                        sov: Math.round((s.share_of_voice ?? 0) * 100),
                        citationRate: Math.round((s.citation_rate ?? 0) * 100),
                    })),
                };
            },
        }),

        // -----------------------------------------------------------------------
        // Tool: getHallucinations
        // -----------------------------------------------------------------------

        getHallucinations: tool({
            description: 'Get AI hallucinations (lies) detected about this business. Shows what AI models are getting wrong.',
            parameters: zodSchema(z.object({
                status: z.enum(['open', 'fixed', 'all']).default('open').describe('Filter: open, fixed, or all'),
            })),
            execute: async ({ status }) => {
                const supabase = createServiceRoleClient();

                let query = supabase
                    .from('ai_hallucinations')
                    .select('model_provider, severity, category, claim_text, expected_truth, correction_status, occurrence_count')
                    .eq('org_id', orgId)
                    .order('last_seen_at', { ascending: false })
                    .limit(10);

                if (status !== 'all') {
                    query = query.eq('correction_status', status);
                }

                const { data } = await query;

                return {
                    type: 'hallucinations' as const,
                    filter: status,
                    total: (data ?? []).length,
                    items: (data ?? []).map((h: any) => ({
                        model: h.model_provider,
                        severity: h.severity,
                        category: h.category,
                        claim: h.claim_text,
                        truth: h.expected_truth,
                        status: h.correction_status,
                        occurrences: h.occurrence_count,
                    })),
                };
            },
        }),

        // -----------------------------------------------------------------------
        // Tool: getCompetitorComparison
        // -----------------------------------------------------------------------

        getCompetitorComparison: tool({
            description: 'Get competitor analysis showing how this business compares to competitors in AI mentions.',
            parameters: zodSchema(z.object({})),
            execute: async () => {
                const supabase = createServiceRoleClient();

                const { data: intercepts } = await supabase
                    .from('competitor_intercepts')
                    .select('competitor_name, gap_analysis, suggested_action')
                    .eq('org_id', orgId)
                    .order('created_at', { ascending: false })
                    .limit(20);

                const byCompetitor: Record<string, { count: number; gap: any; rec: string }> = {};
                for (const i of intercepts ?? []) {
                    if (!byCompetitor[i.competitor_name]) {
                        byCompetitor[i.competitor_name] = { count: 0, gap: i.gap_analysis, rec: i.suggested_action ?? '' };
                    }
                    byCompetitor[i.competitor_name].count += 1;
                }

                return {
                    type: 'competitor_comparison' as const,
                    competitors: Object.entries(byCompetitor).map(([name, d]) => ({
                        name,
                        analyses: d.count,
                        gap: d.gap,
                        recommendation: d.rec,
                    })),
                };
            },
        }),
    };
}
