// ---------------------------------------------------------------------------
// GET /api/sov/model-scores — Per-Model Aggregate SOV Percentages
//
// Sprint 123: Returns per-model SOV% computed across all queries for an org.
// Auth: org member required.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { SOV_MODEL_CONFIGS, type SOVModelId } from '@/lib/config/sov-models';
import * as Sentry from '@sentry/nextjs';

export async function GET(request: NextRequest) {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = await createClient();
    const url = new URL(request.url);
    const weekOfParam = url.searchParams.get('week_of');

    // If no week_of specified, find the most recent week
    let weekOf: string;
    if (weekOfParam) {
      weekOf = weekOfParam;
    } else {
      const { data: latestRow } = await supabase
        .from('sov_model_results')
        .select('week_of')
        .eq('org_id', ctx.orgId)
        .order('week_of', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestRow) {
        return NextResponse.json({ scores: [], week_of: null });
      }
      weekOf = latestRow.week_of;
    }

    // Fetch all model results for this org and week, grouped by model_provider
    const { data: allResults, error } = await supabase
      .from('sov_model_results')
      .select('model_provider, cited')
      .eq('org_id', ctx.orgId)
      .eq('week_of', weekOf);

    if (error) {
      throw error;
    }

    // Aggregate per model
    const modelStats = new Map<string, { total: number; cited: number }>();
    for (const row of allResults ?? []) {
      const existing = modelStats.get(row.model_provider) ?? { total: 0, cited: 0 };
      existing.total++;
      if (row.cited) existing.cited++;
      modelStats.set(row.model_provider, existing);
    }

    const scores = Array.from(modelStats.entries())
      .map(([provider, stats]) => {
        const config = SOV_MODEL_CONFIGS[provider as SOVModelId];
        return {
          model_provider: provider,
          display_name: config?.display_name ?? provider,
          sov_percent: stats.total > 0
            ? Math.round((stats.cited / stats.total) * 1000) / 10
            : 0,
          cited_count: stats.cited,
          total_queries: stats.total,
        };
      })
      .sort((a, b) => a.model_provider.localeCompare(b.model_provider));

    return NextResponse.json({ scores, week_of: weekOf });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { sprint: '123', route: 'model-scores' },
      extra: { orgId: ctx.orgId },
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
