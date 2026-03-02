'use client';

// ---------------------------------------------------------------------------
// SimilarQueriesWidget — Shows semantically similar SOV queries (Sprint 119)
// ---------------------------------------------------------------------------

import { useState, useEffect } from 'react';

type SimilarQuery = {
  id: string;
  query_text: string;
  similarity: number;
};

export default function SimilarQueriesWidget({
  queryId,
  queryText,
  locationId,
}: {
  queryId: string;
  queryText: string;
  locationId: string;
}) {
  const [results, setResults] = useState<SimilarQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch('/api/sov/similar-queries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query_text: queryText, location_id: locationId }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        // Filter out the source query itself
        const filtered = (data.results ?? []).filter(
          (r: SimilarQuery) => r.id !== queryId,
        );
        setResults(filtered);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [queryId, queryText, locationId]);

  return (
    <div
      data-testid="similar-queries-widget"
      className="rounded-xl bg-surface-dark border border-white/5 p-4"
    >
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
        Similar Queries
      </h3>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 rounded bg-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <p className="text-xs text-slate-500">Unable to load similar queries.</p>
      )}

      {/* Empty */}
      {!loading && !error && results.length === 0 && (
        <p className="text-xs text-slate-500">No similar queries found.</p>
      )}

      {/* Results */}
      {!loading && !error && results.length > 0 && (
        <ul className="space-y-2">
          {results.map((r) => (
            <li
              key={r.id}
              data-testid={`similar-query-${r.id}`}
              className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"
            >
              <span className="text-sm text-white truncate mr-2">
                {r.query_text}
              </span>
              <span className="shrink-0 text-xs font-medium text-slate-400 tabular-nums">
                {Math.round(r.similarity * 100)}% similar
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
