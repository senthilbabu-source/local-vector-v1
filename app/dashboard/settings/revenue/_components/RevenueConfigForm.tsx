'use client';

import { useState, useTransition } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { saveRevenueConfig } from '../actions';

interface RevenueConfigFormProps {
  config: {
    avg_ticket: number;
    monthly_searches: number;
    local_conversion_rate: number;
    walk_away_rate: number;
  } | null;
}

export default function RevenueConfigForm({ config }: RevenueConfigFormProps) {
  const [status, setStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveRevenueConfig(form);
      setStatus(
        result.success
          ? { success: true, message: 'Revenue inputs saved' }
          : { success: false, message: result.error },
      );
    });
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Settings
      </Link>

      <section className="rounded-2xl bg-surface-dark border border-white/5 p-6">
        <h2 className="text-sm font-semibold text-white mb-1">Revenue Inputs</h2>
        <p className="text-xs text-slate-500 mb-5">
          Customize the values used to estimate your monthly revenue leak from AI inaccuracies.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Average Ticket */}
          <div>
            <label htmlFor="avg_ticket" className="block text-xs font-medium text-slate-400 mb-1.5">
              Average Ticket ($)
            </label>
            <input
              id="avg_ticket"
              name="avg_ticket"
              type="number"
              step="0.01"
              min="1"
              max="10000"
              defaultValue={config?.avg_ticket ?? 45}
              required
              className="w-full rounded-xl bg-midnight-slate border border-white/10 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-signal-green"
            />
            <p className="mt-1 text-xs text-slate-600">Average customer spend per visit</p>
          </div>

          {/* Monthly Searches */}
          <div>
            <label htmlFor="monthly_searches" className="block text-xs font-medium text-slate-400 mb-1.5">
              Monthly AI Searches
            </label>
            <input
              id="monthly_searches"
              name="monthly_searches"
              type="number"
              step="1"
              min="0"
              max="1000000"
              defaultValue={config?.monthly_searches ?? 2000}
              required
              className="w-full rounded-xl bg-midnight-slate border border-white/10 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-signal-green"
            />
            <p className="mt-1 text-xs text-slate-600">Estimated AI-driven searches in your area per month</p>
          </div>

          {/* Local Conversion Rate */}
          <div>
            <label htmlFor="local_conversion_rate" className="block text-xs font-medium text-slate-400 mb-1.5">
              Local Conversion Rate (%)
            </label>
            <input
              id="local_conversion_rate"
              name="local_conversion_rate"
              type="number"
              step="0.001"
              min="0.1"
              max="100"
              defaultValue={Math.round((config?.local_conversion_rate ?? 0.03) * 100 * 10) / 10}
              required
              className="w-full rounded-xl bg-midnight-slate border border-white/10 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-signal-green"
            />
            <p className="mt-1 text-xs text-slate-600">% of searchers who become customers (typically 2–5%)</p>
          </div>

          {/* Walk-away Rate */}
          <div>
            <label htmlFor="walk_away_rate" className="block text-xs font-medium text-slate-400 mb-1.5">
              Walk-away Rate (%)
            </label>
            <input
              id="walk_away_rate"
              name="walk_away_rate"
              type="number"
              step="0.1"
              min="1"
              max="100"
              defaultValue={Math.round((config?.walk_away_rate ?? 0.65) * 100)}
              required
              className="w-full rounded-xl bg-midnight-slate border border-white/10 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-signal-green"
            />
            <p className="mt-1 text-xs text-slate-600">% of customers who leave when they encounter wrong AI info</p>
          </div>

          {status && (
            <p className={`text-xs ${status.success ? 'text-signal-green' : 'text-alert-crimson'}`}>
              {status.message}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-signal-green px-4 py-2 text-sm font-semibold text-deep-navy hover:bg-signal-green/90 disabled:opacity-60 transition"
          >
            {isPending ? 'Saving…' : 'Save revenue inputs'}
          </button>
        </form>
      </section>
    </div>
  );
}
