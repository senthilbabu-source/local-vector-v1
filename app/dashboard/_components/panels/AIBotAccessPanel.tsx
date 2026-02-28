/**
 * AIBotAccessPanel — "which AI crawlers can reach your site?"
 *
 * Shows the top 4 AI crawlers sorted by urgency (blind spots first).
 * Uses BotActivity data from crawler-analytics.
 *
 * Sprint G — Human-Readable Dashboard.
 */

import Link from 'next/link';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import type { BotActivity } from '@/lib/data/crawler-analytics';

interface AIBotAccessPanelProps {
  bots: BotActivity[];
}

function statusIndicator(status: BotActivity['status']) {
  switch (status) {
    case 'active':
      return {
        dot: 'bg-truth-emerald',
        label: 'Active',
        labelClass: 'text-truth-emerald',
      };
    case 'low':
      return {
        dot: 'bg-alert-amber',
        label: 'Low',
        labelClass: 'text-alert-amber',
      };
    case 'blind_spot':
      return {
        dot: 'bg-alert-crimson',
        label: 'Blind spot',
        labelClass: 'text-alert-crimson',
      };
  }
}

export default function AIBotAccessPanel({ bots }: AIBotAccessPanelProps) {
  // Sort: blind_spot first, then low, then active
  const STATUS_ORDER: Record<string, number> = {
    blind_spot: 0,
    low: 1,
    active: 2,
  };
  const sorted = [...bots]
    .sort(
      (a, b) =>
        (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3),
    )
    .slice(0, 4);

  return (
    <Link
      href="/dashboard/crawler-analytics"
      className="block rounded-xl border border-white/5 bg-surface-dark p-5 transition-colors hover:border-white/10"
      data-testid="ai-bot-access-panel"
    >
      <div className="mb-3 flex items-center gap-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          AI Bot Access
        </h3>
        <InfoTooltip content="AI crawlers visit your website to learn about your business. If they can't reach you, they rely on outdated or incorrect third-party sources instead." />
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-slate-500" data-testid="ai-bot-access-empty">
          No bot activity recorded yet
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map((bot) => {
            const indicator = statusIndicator(bot.status);
            return (
              <div
                key={bot.botType}
                className="flex items-center justify-between gap-2"
                data-testid="ai-bot-row"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${indicator.dot}`}
                    aria-hidden="true"
                  />
                  <span className="truncate text-sm text-white">
                    {bot.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-[10px] font-medium ${indicator.labelClass}`}
                  >
                    {indicator.label}
                  </span>
                  <span className="text-xs text-slate-500 font-mono tabular-nums w-12 text-right">
                    {bot.visitCount.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Link>
  );
}
