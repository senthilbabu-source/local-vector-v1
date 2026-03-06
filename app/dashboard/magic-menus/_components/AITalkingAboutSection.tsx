'use client';

import { TrendingUp, Flame, Sparkles } from 'lucide-react';

// ---------------------------------------------------------------------------
// "What AI Is Talking About" — top menu items mentioned by AI engines.
// Shown on the main Magic Menu page when at least 1 item has mentions.
// ---------------------------------------------------------------------------

export interface AITalkingItem {
  item_id: string;
  item_name: string;
  mention_count: number;
  category_name: string | null;
}

interface AITalkingAboutSectionProps {
  items: AITalkingItem[];
}

function getMentionLabel(count: number): string {
  if (count >= 10) return 'Trending';
  if (count >= 5) return 'Popular';
  return 'Mentioned';
}

function getMentionColor(count: number): string {
  if (count >= 10) return 'text-orange-400';
  if (count >= 5) return 'text-emerald-400';
  return 'text-violet-400';
}

function getMentionBg(count: number): string {
  if (count >= 10) return 'bg-orange-500/10 border-orange-500/20';
  if (count >= 5) return 'bg-emerald-500/10 border-emerald-500/20';
  return 'bg-violet-500/10 border-violet-500/20';
}

function getMentionIcon(count: number) {
  if (count >= 10) return <Flame className="h-4 w-4 text-orange-400" aria-hidden="true" />;
  if (count >= 5) return <Sparkles className="h-4 w-4 text-emerald-400" aria-hidden="true" />;
  return <TrendingUp className="h-4 w-4 text-violet-400" aria-hidden="true" />;
}

export default function AITalkingAboutSection({ items }: AITalkingAboutSectionProps) {
  const topItems = items
    .filter((i) => i.mention_count > 0)
    .sort((a, b) => b.mention_count - a.mention_count)
    .slice(0, 5);

  if (topItems.length === 0) return null;

  return (
    <section
      className="rounded-2xl bg-surface-dark border border-white/5 px-6 py-5"
      data-testid="ai-talking-about-section"
    >
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-violet-400" aria-hidden="true" />
        <h2 className="text-base font-semibold text-white">What AI Is Talking About</h2>
        <span className="text-xs text-slate-500 ml-auto">Last 90 days</span>
      </div>

      <p className="text-sm text-slate-400 mb-4">
        These menu items are being mentioned most by AI engines like ChatGPT, Perplexity, and Google.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {topItems.map((item) => (
          <div
            key={item.item_id}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${getMentionBg(item.mention_count)}`}
            data-testid="ai-talking-item"
          >
            <div className="mt-0.5">{getMentionIcon(item.mention_count)}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{item.item_name}</p>
              {item.category_name && (
                <p className="text-xs text-slate-500 truncate">{item.category_name}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs font-semibold ${getMentionColor(item.mention_count)}`}>
                  {item.mention_count}&times; mentioned
                </span>
                <span className={`text-[10px] font-medium uppercase tracking-wider ${getMentionColor(item.mention_count)}`}>
                  {getMentionLabel(item.mention_count)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
