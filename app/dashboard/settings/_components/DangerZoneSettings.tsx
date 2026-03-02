'use client';

// ---------------------------------------------------------------------------
// DangerZoneSettings — Sprint 121: Destructive actions (owner only)
// AI_RULES §59: 5s countdown + exact text. Service role on server.
// ---------------------------------------------------------------------------

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface DangerZoneSettingsProps {
  orgSlug: string;
  isOwner: boolean;
}

export default function DangerZoneSettings({ orgSlug, isOwner }: DangerZoneSettingsProps) {
  if (!isOwner) return null;

  return (
    <div className="space-y-6 rounded-xl border border-alert-crimson/30 p-5" data-testid="danger-zone-section">
      <h3 className="text-sm font-semibold text-alert-crimson">Danger Zone</h3>

      <DeleteScanDataAction />
      <DeleteOrgAction orgSlug={orgSlug} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete Scan Data
// ---------------------------------------------------------------------------

function DeleteScanDataAction() {
  const [showModal, setShowModal] = useState(false);
  const [input, setInput] = useState('');
  const [countdown, setCountdown] = useState(5);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (showModal && countdown > 0) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [showModal, countdown]);

  function openModal() {
    setShowModal(true);
    setInput('');
    setCountdown(5);
    setError(null);
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/settings/danger/delete-scan-data', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmation: input }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? 'Delete failed');
        }
        setShowModal(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">Delete All Scan Data</p>
          <p className="text-xs text-slate-400">
            Permanently removes all AI visibility scans, hallucinations, and corrections.
          </p>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="rounded-md border border-alert-crimson/50 px-3 py-1.5 text-xs font-medium text-alert-crimson hover:bg-alert-crimson/10"
          data-testid="delete-scan-data-btn"
        >
          Delete Scan Data
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-card p-6 space-y-4">
            <h4 className="text-sm font-semibold text-white">Confirm Deletion</h4>
            <p className="text-xs text-slate-400">
              Type <span className="font-mono text-alert-crimson">DELETE</span> to confirm.
            </p>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white font-mono"
              data-testid="delete-scan-data-confirm-input"
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={input !== 'DELETE' || countdown > 0 || isPending}
                className="rounded-md bg-alert-crimson px-4 py-2 text-xs font-medium text-white hover:bg-alert-crimson/90 disabled:opacity-50"
                data-testid="confirm-delete-scan-data-btn"
              >
                {countdown > 0 ? `Wait ${countdown}s...` : isPending ? 'Deleting...' : 'Confirm Delete'}
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
            {error && <p className="text-xs text-alert-crimson">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Delete Organization
// ---------------------------------------------------------------------------

function DeleteOrgAction({ orgSlug }: { orgSlug: string }) {
  const [showModal, setShowModal] = useState(false);
  const [input, setInput] = useState('');
  const [countdown, setCountdown] = useState(5);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (showModal && countdown > 0) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [showModal, countdown]);

  function openModal() {
    setShowModal(true);
    setInput('');
    setCountdown(5);
    setError(null);
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/settings/danger/delete-org', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmation: input }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? 'Delete failed');
        }
        router.push('/');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">Delete Organization</p>
          <p className="text-xs text-slate-400">
            Permanently delete this organization and all its data. This cannot be undone.
          </p>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="rounded-md border border-alert-crimson/50 px-3 py-1.5 text-xs font-medium text-alert-crimson hover:bg-alert-crimson/10"
          data-testid="delete-org-btn"
        >
          Delete Organization
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-card p-6 space-y-4">
            <h4 className="text-sm font-semibold text-white">Confirm Organization Deletion</h4>
            <p className="text-xs text-slate-400">
              Type your org slug to confirm:{' '}
              <span className="font-mono text-alert-crimson">{orgSlug}</span>
            </p>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white font-mono"
              data-testid="delete-org-confirm-input"
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={input !== orgSlug || countdown > 0 || isPending}
                className="rounded-md bg-alert-crimson px-4 py-2 text-xs font-medium text-white hover:bg-alert-crimson/90 disabled:opacity-50"
                data-testid="confirm-delete-org-btn"
              >
                {countdown > 0 ? `Wait ${countdown}s...` : isPending ? 'Deleting...' : 'Delete Forever'}
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
            {error && <p className="text-xs text-alert-crimson">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
