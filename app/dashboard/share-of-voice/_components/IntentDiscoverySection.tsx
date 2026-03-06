// ---------------------------------------------------------------------------
// IntentDiscoverySection — S16 (Wave 1, AI_RULES §216)
//
// Shows top intent discovery opportunities on the AI Mentions page.
// Surfaces top-3 high-opportunity prompts from intent_discoveries for
// Starter+ plans (not agency-only like the full page).
//
// Rules:
//   - Hidden when no discoveries exist
//   - Shows at most 3 rows (sorted by opportunity_score desc)
//   - "See all" link to /dashboard/intent-discovery
//   - data-testid="intent-discovery-section"
// ---------------------------------------------------------------------------

import Link from 'next/link';
import { TrendingUp } from 'lucide-react';

interface IntentDiscoveryItem {
  id: string;
  prompt: string;
  opportunity_score: number;
  theme: string | null;
}

interface IntentDiscoverySectionProps {
  items: IntentDiscoveryItem[];
}

function OpportunityBar({ score }: { score: number }) {
  const pct = Math.round(Math.min(100, Math.max(0, score)));
  return (
    <div className="h-1 w-16 rounded-full bg-white/10 overflow-hidden">
      <div
        className="h-full rounded-full bg-electric-indigo/70"
        style={{ width: `${pct}%` }}
        aria-label={`${pct}% opportunity score`}
      />
    </div>
  );
}

export default function IntentDiscoverySection({ items }: IntentDiscoverySectionProps) {
  if (items.length === 0) return null;

  const top3 = items.slice(0, 3);

  return (
    <section data-testid="intent-discovery-section">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white tracking-tight">
          Questions Customers Ask That You Don&apos;t Answer
        </h2>
        <Link
          href="/dashboard/intent-discovery"
          className="text-xs text-electric-indigo hover:text-electric-indigo/80 transition-colors whitespace-nowrap"
          data-testid="intent-discovery-see-all"
        >
          See all →
        </Link>
      </div>

      <div className="space-y-2" data-testid="intent-discovery-list">
        {top3.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-xl border border-white/5 bg-surface-dark px-4 py-3"
            data-testid={`intent-discovery-item-${item.id}`}
          >
            <TrendingUp className="h-4 w-4 shrink-0 text-electric-indigo/70" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm text-foreground">{item.prompt}</p>
              {item.theme && (
                <p className="truncate text-[11px] text-slate-500 capitalize">{item.theme}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <OpportunityBar score={item.opportunity_score} />
              <span className="text-[10px] text-slate-500 tabular-nums">
                {Math.round(item.opportunity_score)}% opp
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
