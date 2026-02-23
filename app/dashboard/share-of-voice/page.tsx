import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import SovCard, { type QueryWithEvals } from './_components/SovCard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LocationRow = {
  id: string;
  business_name: string;
  city: string | null;
  state: string | null;
};

type QueryRow = {
  id: string;
  location_id: string;
  query_text: string;
};

type SovEvalRow = {
  id: string;
  query_id: string;
  engine: string;
  rank_position: number | null;
  mentioned_competitors: string[];
  created_at: string;
};

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchPageData(): Promise<{
  locations: LocationRow[];
  queries: QueryRow[];
  evaluations: SovEvalRow[];
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const [locResult, queryResult, evalResult] = await Promise.all([
    supabase
      .from('locations')
      .select('id, business_name, city, state')
      .order('created_at', { ascending: true }),

    supabase
      .from('target_queries')
      .select('id, location_id, query_text')
      .order('created_at', { ascending: true }),

    // Ordered newest-first so the first match per (query, engine) is the latest
    supabase
      .from('sov_evaluations')
      .select('id, query_id, engine, rank_position, mentioned_competitors, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  return {
    locations: (locResult.data as LocationRow[]) ?? [],
    queries: (queryResult.data as QueryRow[]) ?? [],
    evaluations: (evalResult.data as SovEvalRow[]) ?? [],
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ShareOfVoicePage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) {
    redirect('/login');
  }

  const { locations, queries, evaluations } = await fetchPageData();

  return (
    <div className="space-y-8">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">AI Share of Voice</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Track how often AI engines mention your business vs. competitors when
          answering relevant local search queries.
        </p>
      </div>

      {/* ── Cards ────────────────────────────────────────────────────────── */}
      {locations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-white px-6 py-12 text-center shadow-sm ring-1 ring-slate-900/5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mx-auto h-10 w-10 text-slate-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
            />
          </svg>
          <p className="mt-3 text-sm font-medium text-slate-500">No locations yet</p>
          <p className="mt-1 text-xs text-slate-400">
            Add a location first to start tracking AI share of voice.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {locations.map((location) => {
            const locationLabel = [location.business_name, location.city, location.state]
              .filter(Boolean)
              .join(', ');

            // Queries for this location, preserving insertion order
            const locationQueries = queries.filter((q) => q.location_id === location.id);

            // For each query, find the latest eval per engine (evaluations is
            // already ordered newest-first so find() always returns the latest).
            const queriesWithEvals: QueryWithEvals[] = locationQueries.map((q) => ({
              id: q.id,
              query_text: q.query_text,
              openaiEval:
                (evaluations.find(
                  (e) => e.query_id === q.id && e.engine === 'openai'
                ) as QueryWithEvals['openaiEval']) ?? null,
              perplexityEval:
                (evaluations.find(
                  (e) => e.query_id === q.id && e.engine === 'perplexity'
                ) as QueryWithEvals['perplexityEval']) ?? null,
            }));

            return (
              <SovCard
                key={location.id}
                locationId={location.id}
                locationLabel={locationLabel}
                queries={queriesWithEvals}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
