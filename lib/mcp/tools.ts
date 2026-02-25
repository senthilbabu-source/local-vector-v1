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

// ---------------------------------------------------------------------------
// Helper: resolve org by business name
// ---------------------------------------------------------------------------

async function resolveOrgId(businessName: string): Promise<string | null> {
    const supabase = createServiceRoleClient();

    const { data } = await (supabase as any)
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

            const { data: vis } = await (supabase as any)
                .from('visibility_analytics')
                .select('share_of_voice, citation_rate, snapshot_date')
                .eq('org_id', orgId)
                .order('snapshot_date', { ascending: false })
                .limit(1)
                .maybeSingle();

            const { count: openCount } = await (supabase as any)
                .from('ai_hallucinations')
                .select('*', { count: 'exact', head: true })
                .eq('org_id', orgId)
                .eq('correction_status', 'open');

            const sov = vis?.share_of_voice != null ? Math.round(vis.share_of_voice * 100) : null;
            const accuracy = (openCount ?? 0) === 0 ? 100 : Math.max(40, 100 - (openCount ?? 0) * 15);
            const realityScore = sov != null ? Math.round(sov * 0.4 + accuracy * 0.4 + 100 * 0.2) : null;

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
        'Get a Share of Voice report showing AI visibility trend over time. Returns historical SOV snapshots and query-level citation data.',
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

            const { data: snapshots } = await (supabase as any)
                .from('visibility_analytics')
                .select('share_of_voice, citation_rate, snapshot_date')
                .eq('org_id', orgId)
                .order('snapshot_date', { ascending: false })
                .limit(limit);

            const { data: evals } = await (supabase as any)
                .from('sov_evaluations')
                .select('engine, rank_position, mentioned_competitors, created_at, target_queries(query_text)')
                .eq('org_id', orgId)
                .order('created_at', { ascending: false })
                .limit(20);

            const result = {
                business_name,
                trend: (snapshots ?? []).map((s: any) => ({
                    date: s.snapshot_date,
                    sov: `${Math.round((s.share_of_voice ?? 0) * 100)}%`,
                    citation_rate: `${Math.round((s.citation_rate ?? 0) * 100)}%`,
                })),
                recent_evaluations: (evals ?? []).map((e: any) => ({
                    query: e.target_queries?.query_text ?? 'Unknown',
                    engine: e.engine,
                    rank: e.rank_position ?? 'Not cited',
                    competitors: e.mentioned_competitors ?? [],
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

            let query = (supabase as any)
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
                hallucinations: (hallucinations ?? []).map((h: any) => ({
                    model: h.model_provider,
                    severity: h.severity,
                    category: h.category,
                    claim: h.claim_text,
                    truth: h.expected_truth,
                    status: h.correction_status,
                    occurrences: h.occurrence_count,
                    first_seen: h.first_detected_at,
                    last_seen: h.last_seen_at,
                })),
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

            const { data: intercepts } = await (supabase as any)
                .from('competitor_intercepts')
                .select('competitor_name, gap_analysis, recommendation, created_at')
                .eq('org_id', orgId)
                .order('created_at', { ascending: false })
                .limit(20);

            const byCompetitor: Record<string, { analyses: number; latestGap: any; recommendation: string }> = {};
            for (const i of intercepts ?? []) {
                if (!byCompetitor[i.competitor_name]) {
                    byCompetitor[i.competitor_name] = {
                        analyses: 0,
                        latestGap: i.gap_analysis,
                        recommendation: i.recommendation ?? '',
                    };
                }
                byCompetitor[i.competitor_name].analyses += 1;
            }

            const result = {
                business_name,
                total_intercepts: (intercepts ?? []).length,
                competitors: Object.entries(byCompetitor).map(([name, data]) => ({
                    name,
                    analyses_run: data.analyses,
                    gap_analysis: data.latestGap,
                    recommendation: data.recommendation,
                })),
            };

            return {
                content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
            };
        }
    );
}
