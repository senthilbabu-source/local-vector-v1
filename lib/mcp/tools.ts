// ---------------------------------------------------------------------------
// lib/mcp/tools.ts — MCP Tool Definitions for LocalVector
//
// Surgery 5: Exposes LocalVector's core data as MCP tools.
// Any MCP-compatible AI assistant (Claude, ChatGPT, Cursor, etc.) can
// query a client's AI visibility data natively.
//
// Tools:
//   get_visibility_score  — Current SOV % and reality score
//   get_sov_report        — SOV trend over time with query breakdown
//   get_hallucinations    — Active/fixed AI hallucinations by model
//   get_competitor_analysis — Competitor intercept comparison
//
// Spec: Surgical Integration Plan §Surgery 5
// ---------------------------------------------------------------------------

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v3';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
    computeRealityScore,
    aggregateCompetitors,
    mapSnapshotToTrend,
    mapHallucination,
    type VisibilitySnapshot,
    type HallucinationRecord,
    type CompetitorIntercept,
} from '@/lib/tools/shared-query-helpers';

// ---------------------------------------------------------------------------
// Helper: resolve org by business name
// ---------------------------------------------------------------------------

async function resolveOrgId(businessName: string): Promise<string | null> {
    const supabase = createServiceRoleClient();

    const { data } = await supabase
        .from('locations')
        .select('org_id')
        .ilike('business_name', `%${businessName}%`)
        .limit(1)
        .maybeSingle();

    return data?.org_id ?? null;
}

// ---------------------------------------------------------------------------
// Register all tools on an MCP server instance
// ---------------------------------------------------------------------------

export function registerLocalVectorTools(server: McpServer) {
    // ── Tool 1: get_visibility_score ──────────────────────────────────────
    server.tool(
        'get_visibility_score',
        'Get the current AI visibility score and reality score for a business. Returns share-of-voice percentage, accuracy score, and overall reality score.',
        {
            business_name: z.string().describe('Business name to look up (e.g. "Charcoal N Chill")'),
        },
        async ({ business_name }) => {
            const orgId = await resolveOrgId(business_name);
            if (!orgId) {
                return {
                    content: [{ type: 'text' as const, text: `No business found matching "${business_name}".` }],
                };
            }

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

            const { sov, accuracy, realityScore } = computeRealityScore(
                vis?.share_of_voice ?? null,
                openCount ?? 0,
            );

            const result = {
                business_name,
                share_of_voice: sov != null ? `${sov}%` : 'No data yet',
                citation_rate: vis?.citation_rate != null ? `${Math.round(vis.citation_rate * 100)}%` : 'No data yet',
                accuracy_score: accuracy,
                reality_score: realityScore ?? 'Pending first SOV scan',
                open_hallucinations: openCount ?? 0,
                last_snapshot: vis?.snapshot_date ?? 'Never',
            };

            return {
                content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
            };
        }
    );

    // ── Tool 2: get_sov_report ────────────────────────────────────────────
    server.tool(
        'get_sov_report',
        'Get an AI Mentions report showing AI visibility trend over time. Returns historical SOV snapshots and query-level citation data.',
        {
            business_name: z.string().describe('Business name to look up'),
            limit: z.number().int().min(1).max(52).default(12).describe('Number of snapshots to return (default 12)'),
        },
        async ({ business_name, limit }) => {
            const orgId = await resolveOrgId(business_name);
            if (!orgId) {
                return {
                    content: [{ type: 'text' as const, text: `No business found matching "${business_name}".` }],
                };
            }

            const supabase = createServiceRoleClient();

            const { data: snapshots } = await supabase
                .from('visibility_analytics')
                .select('share_of_voice, citation_rate, snapshot_date')
                .eq('org_id', orgId)
                .order('snapshot_date', { ascending: false })
                .limit(limit);

            const { data: evals } = await supabase
                .from('sov_evaluations')
                .select('engine, rank_position, mentioned_competitors, created_at, target_queries(query_text)')
                .eq('org_id', orgId)
                .order('created_at', { ascending: false })
                .limit(20);

            const result = {
                business_name,
                trend: (snapshots ?? []).map((s: VisibilitySnapshot) => {
                    const t = mapSnapshotToTrend(s);
                    return { date: t.date, sov: `${t.sov}%`, citation_rate: `${t.citationRate}%` };
                }),
                recent_evaluations: (evals ?? []).map((e) => ({
                    query: (e.target_queries as { query_text?: string } | null)?.query_text ?? 'Unknown',
                    engine: e.engine,
                    rank: e.rank_position ?? 'Not cited',
                    competitors: (Array.isArray(e.mentioned_competitors) ? e.mentioned_competitors : []) as string[],
                    date: e.created_at,
                })),
            };

            return {
                content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
            };
        }
    );

    // ── Tool 3: get_hallucinations ────────────────────────────────────────
    server.tool(
        'get_hallucinations',
        'Get AI hallucinations detected about a business. Shows what AI models are saying wrong, severity, and status.',
        {
            business_name: z.string().describe('Business name to look up'),
            status: z.enum(['open', 'fixed', 'all']).default('open').describe('Filter by status: open, fixed, or all'),
        },
        async ({ business_name, status }) => {
            const orgId = await resolveOrgId(business_name);
            if (!orgId) {
                return {
                    content: [{ type: 'text' as const, text: `No business found matching "${business_name}".` }],
                };
            }

            const supabase = createServiceRoleClient();

            let query = supabase
                .from('ai_hallucinations')
                .select('model_provider, severity, category, claim_text, expected_truth, correction_status, first_detected_at, last_seen_at, occurrence_count')
                .eq('org_id', orgId)
                .order('last_seen_at', { ascending: false })
                .limit(50);

            if (status !== 'all') {
                query = query.eq('correction_status', status);
            }

            const { data: hallucinations } = await query;

            const byModel: Record<string, number> = {};
            for (const h of hallucinations ?? []) {
                byModel[h.model_provider] = (byModel[h.model_provider] ?? 0) + 1;
            }

            const result = {
                business_name,
                filter: status,
                total: (hallucinations ?? []).length,
                by_model: byModel,
                hallucinations: (hallucinations ?? []).map((h: HallucinationRecord) => mapHallucination(h)),
            };

            return {
                content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
            };
        }
    );

    // ── Tool 4: get_competitor_analysis ───────────────────────────────────
    server.tool(
        'get_competitor_analysis',
        'Get competitor intercept analysis showing how your business compares to competitors in AI mentions.',
        {
            business_name: z.string().describe('Business name to look up'),
        },
        async ({ business_name }) => {
            const orgId = await resolveOrgId(business_name);
            if (!orgId) {
                return {
                    content: [{ type: 'text' as const, text: `No business found matching "${business_name}".` }],
                };
            }

            const supabase = createServiceRoleClient();

            const { data: intercepts } = await supabase
                .from('competitor_intercepts')
                .select('competitor_name, gap_analysis, suggested_action, created_at')
                .eq('org_id', orgId)
                .order('created_at', { ascending: false })
                .limit(20);

            const byCompetitor = aggregateCompetitors(
                (intercepts ?? []) as CompetitorIntercept[],
            );

            const result = {
                business_name,
                total_intercepts: (intercepts ?? []).length,
                competitors: Object.entries(byCompetitor).map(([name, d]) => ({
                    name,
                    analyses_run: d.count,
                    gap_analysis: d.latestGap,
                    recommendation: d.recommendation,
                })),
            };

            return {
                content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
            };
        }
    );
}
