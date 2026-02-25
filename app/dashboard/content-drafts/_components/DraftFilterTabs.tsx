'use client';

import { useRouter, useSearchParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Filter tabs for content drafts page
// ---------------------------------------------------------------------------

const TABS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'approved', label: 'Approved' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
] as const;

export default function DraftFilterTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeStatus = searchParams.get('status') ?? '';

  function handleTabClick(status: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (status) {
      params.set('status', status);
    } else {
      params.delete('status');
    }
    router.push(`/dashboard/content-drafts?${params.toString()}`);
  }

  return (
    <div className="flex gap-1 rounded-lg bg-midnight-slate p-1" data-testid="draft-filter-tabs">
      {TABS.map((tab) => {
        const isActive = activeStatus === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => handleTabClick(tab.value)}
            className={[
              'rounded-md px-3 py-1.5 text-xs font-medium transition',
              isActive
                ? 'bg-white/10 text-white'
                : 'text-slate-500 hover:text-slate-300',
            ].join(' ')}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
