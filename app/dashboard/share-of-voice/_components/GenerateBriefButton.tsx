'use client';

import { useState } from 'react';
import { generateContentBrief } from '../brief-actions';
import { useRouter } from 'next/navigation';

interface GenerateBriefButtonProps {
  queryId: string;
  queryText: string;
  /** Whether a draft already exists for this query */
  hasDraft: boolean;
}

export default function GenerateBriefButton({ queryId, queryText, hasDraft }: GenerateBriefButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (hasDraft) {
    return (
      <a
        href="/dashboard/content-drafts"
        className="text-xs text-electric-indigo hover:underline"
        data-testid={`view-draft-${queryId}`}
      >
        View Draft →
      </a>
    );
  }

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const result = await generateContentBrief(queryId);
      if (result.success && result.draftId) {
        router.push('/dashboard/content-drafts');
      } else if (!result.success) {
        setError(result.error ?? 'Failed to generate brief');
      }
    } catch {
      setError('Failed to generate brief');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-1 rounded-md bg-electric-indigo px-2.5 py-1 text-xs font-medium text-white transition hover:brightness-110 disabled:opacity-50"
        data-testid={`generate-brief-${queryId}`}
      >
        {loading ? (
          <>
            <svg
              className="h-3 w-3 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating…
          </>
        ) : (
          'Generate Brief →'
        )}
      </button>
      {error && <p className="mt-1 text-[10px] text-alert-crimson">{error}</p>}
    </div>
  );
}
