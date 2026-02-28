'use client';

// ---------------------------------------------------------------------------
// FirstVisitTooltip — Sprint E (M2)
//
// Shows a one-time informational banner on the first visit to a page.
// Uses localStorage key 'lv_visited_pages' (JSON array of page keys).
// Once dismissed, never shown again on that device.
//
// Usage:
//   <FirstVisitTooltip pageKey="entity-health" title="..." content="..." />
// ---------------------------------------------------------------------------

import { useState, useEffect } from 'react';
import { X, Info } from 'lucide-react';

interface FirstVisitTooltipProps {
  /** Unique key for this page — added to lv_visited_pages on dismiss */
  pageKey: string;
  /** Bold heading of the tooltip */
  title: string;
  /** Explanation of what this page does */
  content: string;
  /** Optional "Learn more" link */
  learnMoreHref?: string;
}

const STORAGE_KEY = 'lv_visited_pages';

export function hasVisited(pageKey: string): boolean {
  if (typeof window === 'undefined') return true; // SSR: don't show
  try {
    const visited: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return visited.includes(pageKey);
  } catch {
    return false;
  }
}

export function markVisited(pageKey: string): void {
  try {
    const visited: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!visited.includes(pageKey)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...visited, pageKey]));
    }
  } catch {
    // Non-critical — ignore storage errors
  }
}

export function FirstVisitTooltip({ pageKey, title, content, learnMoreHref }: FirstVisitTooltipProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only run client-side, after hydration
    setVisible(!hasVisited(pageKey));
  }, [pageKey]);

  if (!visible) return null;

  function handleDismiss() {
    markVisited(pageKey);
    setVisible(false);
  }

  return (
    <div
      className="mb-6 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3"
      role="status"
      aria-live="polite"
      data-testid={`first-visit-tooltip-${pageKey}`}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
      <div className="flex-1 text-sm text-blue-800">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-blue-700">{content}</p>
        {learnMoreHref && (
          <a
            href={learnMoreHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-xs text-blue-600 underline hover:text-blue-800"
          >
            Learn more →
          </a>
        )}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="ml-2 mt-0.5 rounded text-blue-500 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
        aria-label="Dismiss this tip"
        data-testid={`first-visit-dismiss-${pageKey}`}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
