'use client';

// ---------------------------------------------------------------------------
// CustomerActions — Sprint §204 (Admin Write Operations)
//
// Client component rendering action forms for a specific org.
// Uses server actions from lib/admin/admin-actions.ts.
// ---------------------------------------------------------------------------

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  adminOverridePlan,
  adminCancelSubscription,
  adminGrantCredits,
  adminStartImpersonation,
} from '@/lib/admin/admin-actions';

interface CustomerActionsProps {
  orgId: string;
  currentPlan: string;
  orgName: string;
  hasStripeSubscription: boolean;
}

export default function CustomerActions({
  orgId,
  currentPlan,
  orgName,
  hasStripeSubscription,
}: CustomerActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form state
  const [newPlan, setNewPlan] = useState(currentPlan);
  const [planReason, setPlanReason] = useState('');
  const [creditAmount, setCreditAmount] = useState(50);
  const [cancelImmediate, setCancelImmediate] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Result state
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  function showResult(type: 'success' | 'error', message: string) {
    setResult({ type, message });
    setTimeout(() => setResult(null), 5000);
  }

  // ── Change Plan ──────────────────────────────────────────────────────────
  function handleChangePlan() {
    if (newPlan === currentPlan) {
      showResult('error', 'New plan is the same as current plan');
      return;
    }
    startTransition(async () => {
      const res = await adminOverridePlan(orgId, newPlan, planReason || 'Admin override');
      if (res.success) {
        showResult('success', `Plan changed to ${newPlan}`);
        setPlanReason('');
        router.refresh();
      } else {
        showResult('error', res.error);
      }
    });
  }

  // ── Cancel Subscription ─────────────────────────────────────────────────
  function handleCancelSubscription() {
    startTransition(async () => {
      const res = await adminCancelSubscription(orgId, cancelImmediate);
      if (res.success) {
        showResult('success', cancelImmediate ? 'Subscription canceled immediately' : 'Subscription will cancel at period end');
        setShowCancelConfirm(false);
        router.refresh();
      } else {
        showResult('error', res.error);
      }
    });
  }

  // ── Grant Credits ───────────────────────────────────────────────────────
  function handleGrantCredits() {
    startTransition(async () => {
      const res = await adminGrantCredits(orgId, creditAmount);
      if (res.success) {
        showResult('success', `Granted ${creditAmount} credits`);
        router.refresh();
      } else {
        showResult('error', res.error);
      }
    });
  }

  // ── Impersonate ─────────────────────────────────────────────────────────
  function handleImpersonate() {
    startTransition(async () => {
      const res = await adminStartImpersonation(orgId);
      if (res.success && res.redirectTo) {
        router.push(res.redirectTo);
      } else if (!res.success) {
        showResult('error', res.error);
      }
    });
  }

  return (
    <div className="space-y-6" data-testid="customer-actions">
      {/* Result toast */}
      {result && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            result.type === 'success'
              ? 'bg-signal-green/10 text-signal-green border border-signal-green/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}
          data-testid="action-result"
        >
          {result.message}
        </div>
      )}

      {/* ── Change Plan ─────────────────────────────────────────────── */}
      <div className="rounded-lg border border-white/10 bg-surface-dark p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Change Plan</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="new-plan" className="block text-xs text-slate-400 mb-1">
              New Plan
            </label>
            <select
              id="new-plan"
              value={newPlan}
              onChange={(e) => setNewPlan(e.target.value)}
              className="rounded-md bg-midnight-slate border border-white/10 text-sm text-white px-3 py-1.5"
              data-testid="plan-select"
            >
              <option value="trial">Trial</option>
              <option value="starter">Starter</option>
              <option value="growth">Growth</option>
              <option value="agency">Agency</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="plan-reason" className="block text-xs text-slate-400 mb-1">
              Reason
            </label>
            <input
              id="plan-reason"
              type="text"
              value={planReason}
              onChange={(e) => setPlanReason(e.target.value)}
              placeholder="e.g., Customer support request"
              className="w-full rounded-md bg-midnight-slate border border-white/10 text-sm text-white px-3 py-1.5 placeholder:text-slate-500"
              data-testid="plan-reason"
            />
          </div>
          <button
            onClick={handleChangePlan}
            disabled={isPending || newPlan === currentPlan}
            className="rounded-md bg-electric-indigo px-4 py-1.5 text-sm font-medium text-white hover:bg-electric-indigo/80 disabled:opacity-50 disabled:cursor-not-allowed transition"
            data-testid="change-plan-btn"
          >
            {isPending ? 'Saving...' : 'Change Plan'}
          </button>
        </div>
      </div>

      {/* ── Grant Credits ───────────────────────────────────────────── */}
      <div className="rounded-lg border border-white/10 bg-surface-dark p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Grant Credits</h3>
        <div className="flex items-end gap-3">
          <div>
            <label htmlFor="credit-amount" className="block text-xs text-slate-400 mb-1">
              Amount
            </label>
            <input
              id="credit-amount"
              type="number"
              min={1}
              max={10000}
              value={creditAmount}
              onChange={(e) => setCreditAmount(parseInt(e.target.value, 10) || 0)}
              className="w-32 rounded-md bg-midnight-slate border border-white/10 text-sm text-white px-3 py-1.5 tabular-nums"
              data-testid="credit-amount"
            />
          </div>
          <button
            onClick={handleGrantCredits}
            disabled={isPending || creditAmount <= 0}
            className="rounded-md bg-signal-green px-4 py-1.5 text-sm font-medium text-deep-navy hover:bg-signal-green/80 disabled:opacity-50 disabled:cursor-not-allowed transition"
            data-testid="grant-credits-btn"
          >
            {isPending ? 'Granting...' : 'Grant Credits'}
          </button>
        </div>
      </div>

      {/* ── Cancel Subscription ─────────────────────────────────────── */}
      <div className="rounded-lg border border-red-500/20 bg-surface-dark p-4">
        <h3 className="text-sm font-semibold text-red-400 mb-3">Cancel Subscription</h3>
        {!showCancelConfirm ? (
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="rounded-md bg-red-500/10 border border-red-500/30 px-4 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/20 transition"
            data-testid="cancel-sub-btn"
          >
            Cancel Subscription...
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              Cancel subscription for <span className="font-semibold text-white">{orgName}</span>?
              {hasStripeSubscription
                ? ' This will cancel via Stripe.'
                : ' This org has no Stripe subscription — plan will be set to trial.'}
            </p>
            <div className="flex items-center gap-2">
              <input
                id="cancel-immediate"
                type="checkbox"
                checked={cancelImmediate}
                onChange={(e) => setCancelImmediate(e.target.checked)}
                className="rounded border-white/20"
                data-testid="cancel-immediate-checkbox"
              />
              <label htmlFor="cancel-immediate" className="text-sm text-slate-300">
                Cancel immediately (no grace period)
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCancelSubscription}
                disabled={isPending}
                className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition"
                data-testid="confirm-cancel-btn"
              >
                {isPending ? 'Canceling...' : 'Confirm Cancel'}
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="rounded-md bg-white/5 px-4 py-1.5 text-sm text-slate-300 hover:bg-white/10 transition"
              >
                Go Back
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Impersonate ─────────────────────────────────────────────── */}
      <div className="rounded-lg border border-amber-500/20 bg-surface-dark p-4">
        <h3 className="text-sm font-semibold text-amber-400 mb-3">Impersonate</h3>
        <p className="text-xs text-slate-400 mb-3">
          View the dashboard as this customer. A temporary viewer membership will be created.
        </p>
        <button
          onClick={handleImpersonate}
          disabled={isPending}
          className="rounded-md bg-amber-500/10 border border-amber-500/30 px-4 py-1.5 text-sm font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 transition"
          data-testid="impersonate-btn"
        >
          {isPending ? 'Starting...' : 'View as this customer'}
        </button>
      </div>
    </div>
  );
}
