'use client';

// ---------------------------------------------------------------------------
// S33: EntityHealthTabs — tab switcher for Platforms / Sources / Citations
// ---------------------------------------------------------------------------

import { useRouter, useSearchParams } from 'next/navigation';

const TABS = [
  { key: 'platforms', label: 'Platforms' },
  { key: 'sources', label: 'Sources' },
  { key: 'citations', label: 'Citations' },
] as const;

export type EntityTab = (typeof TABS)[number]['key'];

export default function EntityHealthTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = (searchParams.get('tab') as EntityTab) ?? 'platforms';

  function switchTab(tab: EntityTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'platforms') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    const qs = params.toString();
    router.push(`/dashboard/entity-health${qs ? `?${qs}` : ''}`);
  }

  return (
    <div className="flex items-center gap-1 rounded-lg bg-surface-dark border border-white/5 p-0.5" data-testid="entity-health-tabs">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => switchTab(tab.key)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
            currentTab === tab.key
              ? 'bg-white/10 text-white'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
          data-testid={`tab-${tab.key}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
