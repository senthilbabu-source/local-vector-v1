'use client';

// ---------------------------------------------------------------------------
// MenuSearch — Semantic search box for public /m/[slug] page (Sprint 119)
// ---------------------------------------------------------------------------

import { useState, type FormEvent } from 'react';

type MenuSearchResult = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  category: string | null;
  similarity: number;
};

type SearchState = 'idle' | 'loading' | 'results' | 'empty' | 'error';

export default function MenuSearch({ menuSlug }: { menuSlug: string }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState>('idle');
  const [results, setResults] = useState<MenuSearchResult[]>([]);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    setState('loading');
    try {
      const res = await fetch(
        `/api/public/menu/search?slug=${encodeURIComponent(menuSlug)}&q=${encodeURIComponent(trimmed)}`,
      );

      if (!res.ok) {
        setState('error');
        return;
      }

      const data = await res.json();
      const items: MenuSearchResult[] = data.results ?? [];

      if (items.length === 0) {
        setResults([]);
        setState('empty');
      } else {
        setResults(items);
        setState('results');
      }
    } catch (_err) {
      setState('error');
    }
  }

  function handleClear() {
    setQuery('');
    setResults([]);
    setState('idle');
  }

  function formatPrice(price: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  }

  return (
    <div className="rounded-2xl bg-surface-dark border border-white/5 px-6 py-5">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          data-testid="menu-search-input"
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value === '') handleClear();
          }}
          placeholder="Search the menu..."
          className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-electric-indigo"
          disabled={state === 'loading'}
        />
        <button
          data-testid="menu-search-btn"
          type="submit"
          disabled={state === 'loading' || query.trim().length < 2}
          className="rounded-lg bg-electric-indigo px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-electric-indigo/90 transition"
        >
          {state === 'loading' ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Results */}
      {state === 'results' && results.length > 0 && (
        <div data-testid="menu-search-results" className="mt-4 space-y-3">
          {results.map((item) => (
            <div
              key={item.id}
              data-testid={`menu-search-result-${item.id}`}
              className="flex items-start justify-between gap-4 rounded-lg bg-white/5 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-medium text-white">{item.name}</h4>
                {item.description && (
                  <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">
                    {item.description}
                  </p>
                )}
                <span className="mt-1 inline-block text-xs text-slate-500">
                  {Math.round(item.similarity * 100)}% match
                  {item.category && ` · ${item.category}`}
                </span>
              </div>
              {item.price !== null && (
                <span className="shrink-0 font-mono text-sm font-semibold text-electric-indigo tabular-nums">
                  {formatPrice(item.price)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {state === 'empty' && (
        <p data-testid="menu-search-empty" className="mt-4 text-sm text-slate-400 text-center">
          No matches found for &ldquo;{query}&rdquo;. Try a different search.
        </p>
      )}

      {/* Error state */}
      {state === 'error' && (
        <p data-testid="menu-search-error" className="mt-4 text-sm text-slate-400 text-center">
          Search unavailable. Browse the full menu below.
        </p>
      )}
    </div>
  );
}
