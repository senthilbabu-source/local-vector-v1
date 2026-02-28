import type { SupabaseClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import type { Database } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AIResponseEntry {
  queryId: string;
  queryText: string;
  queryCategory: string;
  engines: EngineResponse[];
  latestDate: string;
}

export interface EngineResponse {
  engine: string;
  rankPosition: number | null;
  rawResponse: string | null;
  mentionedCompetitors: string[];
  citedSources?: { url: string; title: string }[] | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Raw response display logic
// ---------------------------------------------------------------------------

export function parseDisplayText(rawResponse: string | null): string | null {
  if (!rawResponse) return null;

  try {
    const parsed = JSON.parse(rawResponse);
    if (parsed && typeof parsed === 'object' && 'businesses' in parsed) {
      return null;
    }
    return typeof parsed === 'string' ? parsed : null;
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'ai-responses.ts', sprint: 'A' } });
    return rawResponse;
  }
}

// ---------------------------------------------------------------------------
// Fetch function
// ---------------------------------------------------------------------------

export async function fetchAIResponses(
  orgId: string,
  supabase: SupabaseClient<Database>,
  locationId?: string | null,
): Promise<AIResponseEntry[]> {
  // Sprint 100: location-scoped queries for data isolation
  let queryBuilder = supabase
    .from('target_queries')
    .select('id, query_text, query_category')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });
  if (locationId) queryBuilder = queryBuilder.eq('location_id', locationId);

  let evalBuilder = supabase
    .from('sov_evaluations')
    .select('query_id, engine, rank_position, raw_response, mentioned_competitors, cited_sources, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (locationId) evalBuilder = evalBuilder.eq('location_id', locationId);

  const [queryResult, evalResult] = await Promise.all([
    queryBuilder,
    evalBuilder,
  ]);

  const queries = queryResult.data ?? [];
  const evals = evalResult.data ?? [];

  const evalsByQuery = new Map<string, EngineResponse[]>();

  for (const ev of evals) {
    if (!evalsByQuery.has(ev.query_id)) {
      evalsByQuery.set(ev.query_id, []);
    }
    const existing = evalsByQuery.get(ev.query_id)!;
    if (!existing.some((e) => e.engine === ev.engine)) {
      existing.push({
        engine: ev.engine,
        rankPosition: ev.rank_position,
        rawResponse: ev.raw_response,
        mentionedCompetitors: (ev.mentioned_competitors as string[]) ?? [],
        citedSources: ev.cited_sources as { url: string; title: string }[] | null,
        createdAt: ev.created_at,
      });
    }
  }

  return queries
    .map((q) => {
      const engines = evalsByQuery.get(q.id) ?? [];
      if (engines.length === 0) return null;

      const latestDate = engines
        .map((e) => e.createdAt)
        .sort()
        .reverse()[0] ?? '';

      return {
        queryId: q.id,
        queryText: q.query_text,
        queryCategory: q.query_category,
        engines,
        latestDate,
      };
    })
    .filter((entry): entry is AIResponseEntry => entry !== null);
}
