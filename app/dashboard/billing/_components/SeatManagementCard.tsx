'use client';

// ---------------------------------------------------------------------------
// SeatManagementCard — Sprint 99
//
// Visible to owner only on Agency plan. Shows seat usage, add/remove buttons,
// overage warning, and past-due banner.
// ---------------------------------------------------------------------------

import { useState, useEffect } from 'react';
import { Users, Plus, Minus, AlertTriangle, CreditCard } from 'lucide-react';
import { addSeat, removeSeat, getSeatSummary } from '@/app/actions/seat-actions';

interface SeatSummary {
  seatLimit: number;
  currentMembers: number;
  seatsRemaining: number;
  seatOverage: number;
  plan: string;
  subscriptionStatus: string | null;
  monthlyCostPerSeat: number | null;
  isAgencyPlan: boolean;
}

export default function SeatManagementCard() {
  const [summary, setSummary] = useState<SeatSummary | null>(null);
  const [loading, setLoading] = useState<'idle' | 'adding' | 'removing'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSeatSummary()
      .then(setSummary)
      .catch(() => {});
  }, []);

  if (!summary || !summary.isAgencyPlan) return null;

  const usagePercent = summary.seatLimit > 0
    ? Math.min(100, Math.round((summary.currentMembers / summary.seatLimit) * 100))
    : 0;

  const canRemove =
    summary.currentMembers < summary.seatLimit && summary.seatLimit > 1;

  async function handleAddSeat() {
    setLoading('adding');
    setError(null);
    const result = await addSeat();
    if (result.success) {
      const updated = await getSeatSummary();
      setSummary(updated);
    } else {
      setError(result.error ?? 'Failed to add seat');
    }
    setLoading('idle');
  }

  async function handleRemoveSeat() {
    setLoading('removing');
    setError(null);
    const result = await removeSeat();
    if (result.success) {
      const updated = await getSeatSummary();
      setSummary(updated);
    } else {
      setError(
        result.error === 'would_create_overage'
          ? 'Cannot remove seat — all seats are in use. Remove a member first.'
          : result.error === 'below_minimum_seats'
            ? 'Cannot go below the minimum seat count.'
            : result.error ?? 'Failed to remove seat'
      );
    }
    setLoading('idle');
  }

  return (
    <div
      data-testid="seat-management-card"
      className="rounded-2xl border border-white/5 bg-surface-dark p-6 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-electric-indigo" />
        <h3 className="text-sm font-semibold text-white">Team Seats</h3>
      </div>

      {/* Seat count display */}
      <div data-testid="seat-count-display" className="text-center">
        <span className="text-2xl font-bold text-white">
          {summary.currentMembers}
        </span>
        <span className="text-lg text-slate-400"> of </span>
        <span className="text-2xl font-bold text-white">
          {summary.seatLimit}
        </span>
        <span className="text-sm text-slate-400 ml-1">seats used</span>
      </div>

      {/* Progress bar */}
      <div data-testid="seat-progress-bar" className="h-2 rounded-full bg-slate-700">
        <div
          className={[
            'h-full rounded-full transition-all duration-300',
            usagePercent >= 100 ? 'bg-alert-crimson' : usagePercent >= 80 ? 'bg-alert-amber' : 'bg-electric-indigo',
          ].join(' ')}
          style={{ width: `${usagePercent}%` }}
        />
      </div>

      {/* Seat cost */}
      {summary.monthlyCostPerSeat !== null ? (
        <p data-testid="seat-cost-display" className="text-xs text-slate-400 text-center">
          <CreditCard className="inline h-3 w-3 mr-1" />
          ${summary.monthlyCostPerSeat}/seat/month
        </p>
      ) : (
        <p data-testid="seat-cost-display" className="text-xs text-slate-500 text-center">
          Contact us for custom seat pricing
        </p>
      )}

      {/* Add / Remove buttons */}
      <div className="flex gap-3 justify-center">
        <button
          data-testid="seat-remove-btn"
          onClick={handleRemoveSeat}
          disabled={!canRemove || loading !== 'idle'}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 transition hover:border-white/20 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Minus className="h-3.5 w-3.5" />
          {loading === 'removing' ? 'Removing...' : 'Remove Seat'}
        </button>

        <button
          data-testid="seat-add-btn"
          onClick={handleAddSeat}
          disabled={loading !== 'idle'}
          className="flex items-center gap-1.5 rounded-lg bg-electric-indigo px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-electric-indigo/90 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Plus className="h-3.5 w-3.5" />
          {loading === 'adding' ? 'Adding...' : 'Add Seat'}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-alert-crimson text-center">{error}</p>
      )}

      {/* Overage warning banner */}
      {summary.seatOverage > 0 && (
        <div
          data-testid="seat-overage-banner"
          className="rounded-lg border border-alert-amber/30 bg-alert-amber/10 px-3 py-2 text-xs text-alert-amber"
        >
          <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
          You have {summary.seatOverage} member{summary.seatOverage > 1 ? 's' : ''} over your seat limit.{' '}
          <a href="/dashboard/settings/team" className="underline hover:no-underline">
            Remove member{summary.seatOverage > 1 ? 's' : ''}
          </a>{' '}
          or add seats.
        </div>
      )}

      {/* Past due warning */}
      {summary.subscriptionStatus === 'past_due' && (
        <div
          data-testid="seat-past-due-banner"
          className="rounded-lg border border-alert-crimson/30 bg-alert-crimson/10 px-3 py-2 text-xs text-alert-crimson"
        >
          <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
          Payment is past due. Update your payment method to avoid seat restrictions.
        </div>
      )}
    </div>
  );
}
