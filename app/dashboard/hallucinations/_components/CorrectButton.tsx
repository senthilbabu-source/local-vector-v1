'use client';

// ---------------------------------------------------------------------------
// CorrectButton — Sprint 121: Mark hallucination as corrected
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { CheckCircle } from 'lucide-react';

interface CorrectButtonProps {
  hallucinationId: string;
  claimText: string;
  onCorrected?: () => void;
}

export default function CorrectButton({
  hallucinationId,
  claimText,
  onCorrected,
}: CorrectButtonProps) {
  const [showForm, setShowForm] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (success) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-medium text-signal-green"
        data-testid="correction-success-msg"
      >
        <CheckCircle className="h-3.5 w-3.5" />
        Marked as corrected. A correction brief is being generated.
      </span>
    );
  }

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="inline-flex items-center gap-1 rounded-md bg-signal-green/10 px-3 py-1.5 text-xs font-medium text-signal-green hover:bg-signal-green/20 transition-colors"
        data-testid="correct-hallucination-btn"
      >
        <CheckCircle className="h-3 w-3" />
        Mark Corrected
      </button>
    );
  }

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/hallucinations/${hallucinationId}/correct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to mark as corrected');
      }
      setSuccess(true);
      onCorrected?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Optional notes — what was corrected and how?"
        className="w-full rounded-md border border-white/10 bg-surface-dark px-3 py-2 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary"
        rows={2}
        data-testid="correction-notes-input"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading}
          className="rounded-md bg-signal-green px-3 py-1.5 text-xs font-medium text-white hover:bg-signal-green/90 transition-colors disabled:opacity-50"
          data-testid="confirm-correction-btn"
        >
          {loading ? 'Saving...' : 'Confirm Correction'}
        </button>
        <button
          type="button"
          onClick={() => { setShowForm(false); setNotes(''); }}
          className="rounded-md px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          data-testid="cancel-correction-btn"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-alert-crimson">{error}</p>}
    </div>
  );
}
