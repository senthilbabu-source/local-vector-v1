'use client';

/**
 * SeatUsageCard — Sprint 113
 *
 * Shows seat usage, Stripe sync status, and cost breakdown on /dashboard/billing.
 * Fetches from GET /api/billing/seats.
 */

import { useState, useEffect } from 'react';
import { Users, RefreshCw, AlertTriangle } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import type { SeatState } from '@/lib/billing/types';

export default function SeatUsageCard() {
  const [state, setState] = useState<SeatState | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    fetch('/api/billing/seats')
      .then((r) => r.json())
      .then((data: SeatState) => {
        setState(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleForceSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/billing/seats/sync', { method: 'POST' });
      const data = await res.json();
      if (data.ok && data.success) {
        setSyncResult('success');
        // Refresh seat state
        const refreshRes = await fetch('/api/billing/seats');
        const refreshData = await refreshRes.json();
        setState(refreshData);
        setTimeout(() => setSyncResult(null), 3000);
      } else {
        setSyncResult('error');
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'SeatUsageCard', sprint: '113' } });
      setSyncResult('error');
    }
    setSyncing(false);
  }

  // Loading skeleton
  if (loading) {
    return (
      <div data-testid="seat-usage-card" className="rounded-2xl border border-white/5 bg-surface-dark p-6 animate-pulse">
        <div className="h-5 w-32 rounded bg-slate-700 mb-4" />
        <div className="h-8 w-48 rounded bg-slate-700 mx-auto mb-3" />
        <div className="h-2 rounded-full bg-slate-700 mb-4" />
        <div className="h-4 w-40 rounded bg-slate-700 mx-auto" />
      </div>
    );
  }

  if (!state) return null;

  const isAgency = state.plan_tier === 'agency';
  const additionalSeats = Math.max(0, state.current_seat_count - 1);
  const monthlyCostDollars = (state.monthly_seat_cost_cents / 100).toFixed(2);
  const perSeatDollars = (state.per_seat_price_cents / 100).toFixed(2);

  return (
    <div data-testid="seat-usage-card" className="rounded-2xl border border-white/5 bg-surface-dark p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-electric-indigo" />
        <h3 className="text-sm font-semibold text-white">Team Seats</h3>
      </div>

      {/* Non-Agency plan */}
      {!isAgency && (
        <p className="text-sm text-slate-400 text-center">
          Team seats are available on the Agency plan.
        </p>
      )}

      {/* Agency plan content */}
      {isAgency && (
        <>
          {/* Seat count */}
          <p data-testid="seat-count-text" className="text-center text-sm text-slate-300">
            <span className="text-lg font-bold text-white">{state.current_seat_count}</span>
            {' / '}
            <span className="text-lg font-bold text-white">{state.max_seats ?? '∞'}</span>
            {' seats used'}
          </p>

          {/* Progress bar */}
          <div data-testid="seat-usage-bar" className="h-2 rounded-full bg-slate-700">
            <div
              className={[
                'h-full rounded-full transition-all duration-300',
                state.usage_percent >= 100
                  ? 'bg-alert-crimson'
                  : state.usage_percent >= 80
                    ? 'bg-alert-amber'
                    : 'bg-electric-indigo',
              ].join(' ')}
              style={{ width: `${Math.min(100, state.usage_percent)}%` }}
            />
          </div>

          {/* Monthly cost */}
          <p data-testid="monthly-cost-text" className="text-xs text-slate-400 text-center">
            {additionalSeats > 0 ? (
              <>
                {additionalSeats} additional seat{additionalSeats > 1 ? 's' : ''} &times; ${perSeatDollars} = ${monthlyCostDollars}/mo
                <br />
                <span className="text-slate-500">(first seat included in Agency plan)</span>
              </>
            ) : (
              'First seat included in your Agency plan'
            )}
          </p>

          {/* Stripe sync status */}
          <div data-testid="stripe-sync-status" className="flex items-center justify-center gap-2 text-xs">
            {state.in_sync ? (
              <span className="text-truth-emerald">In sync</span>
            ) : (
              <span className="text-alert-amber">Out of sync</span>
            )}
          </div>

          {/* Force sync button — sync result */}
          {syncResult === 'success' && (
            <p className="text-xs text-truth-emerald text-center">Synced</p>
          )}
          {syncResult === 'error' && (
            <p className="text-xs text-alert-crimson text-center">Sync failed. Try again.</p>
          )}

          {/* Force sync button (shown when out of sync or always for owner) */}
          {!state.in_sync && (
            <div className="flex justify-center">
              <button
                data-testid="force-sync-btn"
                onClick={handleForceSync}
                disabled={syncing}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 transition hover:border-white/20 hover:text-white disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Force Sync'}
              </button>
            </div>
          )}

          {/* Overage banner */}
          {'seat_overage_flagged' in state && (state as SeatState & { seat_overage_flagged?: boolean }).seat_overage_flagged && (
            <div
              data-testid="seat-overage-banner"
              className="rounded-lg border border-alert-crimson/30 bg-alert-crimson/10 px-3 py-2 text-xs text-alert-crimson"
            >
              <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
              Your team exceeds the plan seat limit. Contact support.
            </div>
          )}
        </>
      )}
    </div>
  );
}
