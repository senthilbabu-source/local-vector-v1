// ---------------------------------------------------------------------------
// FirstMoverCard — First Mover Opportunity Alert (Doc 06 §8.3)
//
// Client Component: action buttons need interactivity.
// Displays a single First Mover opportunity from content_drafts where
// trigger_type = 'first_mover'. Shows rocket icon, query text, and CTA.
//
// Design tokens: surface-dark, signal-green, amber-400.
// ---------------------------------------------------------------------------

'use client';

interface FirstMoverCardProps {
  id: string;
  queryText: string;       // from target_prompt
  createdAt: string;       // ISO timestamp
}

export default function FirstMoverCard({ id, queryText, createdAt }: FirstMoverCardProps) {
  const dateLabel = new Date(createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      className="rounded-xl bg-surface-dark border border-white/5 p-4"
      data-testid={`first-mover-${id}`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {/* Rocket icon */}
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/10" aria-hidden>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4 text-amber-400"
          >
            <path d="M4.606 12.97a.75.75 0 0 1-.134 1.051 2.494 2.494 0 0 0-.93 2.437 2.494 2.494 0 0 0 2.437-.93.75.75 0 1 1 1.186.918 3.995 3.995 0 0 1-4.482 1.332.75.75 0 0 1-.461-.461 3.994 3.994 0 0 1 1.332-4.482.75.75 0 0 1 1.052.134Z" />
            <path d="M15.948 1.186a.75.75 0 0 0-.528-.22c-2.09 0-4.1.833-5.577 2.313l-.98.98a7.752 7.752 0 0 0-1.566 2.524c-.467.125-.905.293-1.307.498L3.49 9.781a.75.75 0 0 0 .23 1.327l2.247.749a8.408 8.408 0 0 0 1.13 1.956l-.018.019a.75.75 0 1 0 1.06 1.06l.019-.018a8.422 8.422 0 0 0 1.956 1.13l.749 2.246a.75.75 0 0 0 1.327.231l2.5-2.5c.205-.402.373-.84.498-1.307a7.752 7.752 0 0 0 2.524-1.565l.98-.98c1.48-1.478 2.312-3.488 2.312-5.578a.75.75 0 0 0-.22-.528l-3.836-3.836Zm-2.513 6.378a1.5 1.5 0 1 1-2.121-2.121 1.5 1.5 0 0 1 2.121 2.121Z" />
          </svg>
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white leading-snug">
            &ldquo;{queryText}&rdquo;
          </p>
          <p className="text-xs text-slate-500 mt-1">
            AI isn&apos;t recommending anyone for this query &middot; {dateLabel}
          </p>
        </div>
      </div>

      {/* Action row */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          className="rounded-lg bg-signal-green/10 px-3 py-1.5 text-xs font-semibold text-signal-green hover:bg-signal-green/20 transition-colors"
          onClick={() => {
            // Future: navigate to content creation
            console.log(`[FirstMover] Create content for draft ${id}`);
          }}
        >
          Create Content
        </button>
        <button
          type="button"
          className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-white/10 transition-colors"
          onClick={() => {
            // Future: dismiss the alert
            console.log(`[FirstMover] Dismiss draft ${id}`);
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
