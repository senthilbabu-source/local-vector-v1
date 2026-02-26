'use client';

// ---------------------------------------------------------------------------
// DeleteOrgModal — Danger-zone confirmation for soft-deleting an organization
// Sprint 62 — Sub-task E: Settings Completeness
//
// User must type the org name to confirm deletion.
// Calls softDeleteOrganization() server action → sets plan_status='canceled'.
// ---------------------------------------------------------------------------

import { useState, useTransition } from 'react';
import { softDeleteOrganization } from '../actions';

interface DeleteOrgModalProps {
  orgName: string;
}

export default function DeleteOrgModal({ orgName }: DeleteOrgModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isConfirmed = confirmation === orgName;

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await softDeleteOrganization();
      if (!result.success) {
        setError(result.error);
      }
      // On success, the server action redirects to /login
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-xl border border-alert-crimson/30 px-4 py-2 text-sm font-semibold text-alert-crimson hover:bg-alert-crimson/10 transition"
      >
        Delete organization
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !isPending && setIsOpen(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-md rounded-2xl bg-surface-dark border border-alert-crimson/20 p-6">
            <h3 className="text-lg font-semibold text-white mb-2">
              Delete organization
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              This will cancel your subscription and deactivate your account.
              All data will be retained for 30 days before permanent deletion.
            </p>

            <p className="text-sm text-slate-300 mb-2">
              Type <strong className="text-white">{orgName}</strong> to confirm:
            </p>
            <input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={orgName}
              className="w-full rounded-xl bg-midnight-slate border border-white/10 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-alert-crimson mb-4"
            />

            {error && (
              <p className="text-xs text-alert-crimson mb-3">{error}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!isConfirmed || isPending}
                className="rounded-xl bg-alert-crimson px-4 py-2 text-sm font-semibold text-white hover:bg-alert-crimson/90 disabled:opacity-40 transition"
              >
                {isPending ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
