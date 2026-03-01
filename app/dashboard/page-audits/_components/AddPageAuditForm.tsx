// ---------------------------------------------------------------------------
// AddPageAuditForm — Sprint 104: On-demand URL submission form
//
// Client component. Calls addPageAudit() server action on submit.
// Shows loading state, success message, and error inline.
// AI_RULES §5: action is user-triggered only.
// ---------------------------------------------------------------------------

'use client';

import { useState, useTransition } from 'react';
import { addPageAudit } from '../actions';

export default function AddPageAuditForm() {
  const [url, setUrl] = useState('');
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function handleSubmit() {
    if (!url.trim() || isPending) return;

    setMessage(null);
    startTransition(async () => {
      const result = await addPageAudit(url);
      if (result.success) {
        setMessage({ type: 'success', text: 'Audit complete — results updated.' });
        setUrl('');
      } else {
        setMessage({ type: 'error', text: result.error ?? 'Audit failed.' });
      }
    });
  }

  return (
    <div data-testid="add-page-audit-form">
      <div className="flex items-center gap-2">
        <input
          type="url"
          data-testid="audit-url-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
          placeholder="https://yoursite.com/about"
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-electric-indigo focus:ring-1 focus:ring-electric-indigo"
          disabled={isPending}
        />
        <button
          data-testid="audit-url-submit"
          onClick={handleSubmit}
          disabled={isPending || !url.trim()}
          className="shrink-0 rounded-lg bg-electric-indigo px-4 py-2 text-sm font-medium text-white transition hover:bg-electric-indigo/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Auditing...' : 'Audit Page'}
        </button>
      </div>
      {message && (
        <p
          className={`mt-2 text-xs ${message.type === 'success' ? 'text-signal-green' : 'text-alert-crimson'}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
