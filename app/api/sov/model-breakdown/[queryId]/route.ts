// ---------------------------------------------------------------------------
// GET /api/sov/model-breakdown/[queryId] — Per-Model Citation Results
//
// Sprint 123: Returns per-model citation results for a given target query.
// Auth: org member required. Query must belong to the authenticated org.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { SOV_MODEL_CONFIGS, type SOVModelId } from '@/lib/config/sov-models';
import * as Sentry from '@sentry/nextjs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ queryId: string }> },
) {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { queryId } = await params;

  // Validate queryId belongs to this org
  const supabase = await createClient();
  const { data: queryRow } = await supabase
    .from('target_queries')
    .select('id, query_text, org_id')
    .eq('id', queryId)
    .eq('org_id', ctx.orgId)
    .maybeSingle();

  if (!queryRow) {
    return NextResponse.json({ error: 'Query not found' }, { status: 404 });
  }

  try {
    // Parse optional week_of param
    const url = new URL(request.url);
    const weekOfParam = url.searchParams.get('week_of');

    let weekOf: string;
    if (weekOfParam) {
      weekOf = weekOfParam;
    } else {
      // Default to most recent week with data
      const { data: latestRow } = await supabase
        .from('sov_model_results')
        .select('week_of')
        .eq('query_id', queryId)
        .eq('org_id', ctx.orgId)
        .order('week_of', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestRow) {
        return NextResponse.json({
          query_id: queryId,
          query_text: queryRow.query_text,
          week_of: null,
          models: [],
          summary: { cited_by_count: 0, total_models_run: 0, all_models_agree: true },
        });
      }
      weekOf = latestRow.week_of;
    }

    // Fetch per-model results
    const { data: modelResults, error } = await supabase
      .from('sov_model_results')
      .select('model_provider, cited, citation_count, confidence, ai_response')
      .eq('query_id', queryId)
      .eq('org_id', ctx.orgId)
      .eq('week_of', weekOf)
      .order('model_provider');

    if (error) {
      throw error;
    }

    const models = (modelResults ?? []).map((r) => {
      const config = SOV_MODEL_CONFIGS[r.model_provider as SOVModelId];
      return {
        model_provider: r.model_provider,
        display_name: config?.display_name ?? r.model_provider,
        cited: r.cited,
        citation_count: r.citation_count,
        confidence: r.confidence,
        ai_response_excerpt: r.ai_response,
      };
    });

    const citedCount = models.filter((m) => m.cited).length;
    const totalModels = models.length;
    const allAgree =
      totalModels === 0 ||
      citedCount === 0 ||
      citedCount === totalModels;

    return NextResponse.json({
      query_id: queryId,
      query_text: queryRow.query_text,
      week_of: weekOf,
      models,
      summary: {
        cited_by_count: citedCount,
        total_models_run: totalModels,
        all_models_agree: allAgree,
      },
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { sprint: '123', route: 'model-breakdown' },
      extra: { queryId, orgId: ctx.orgId },
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
