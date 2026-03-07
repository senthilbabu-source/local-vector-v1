'use client';

// ---------------------------------------------------------------------------
// S32: ViewToggle — switches between List and Calendar views on content-drafts
// ---------------------------------------------------------------------------

import { useRouter, useSearchParams } from 'next/navigation';
import { List, CalendarDays } from 'lucide-react';

export default function ViewToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isCalendar = searchParams.get('view') === 'calendar';

  function toggle(view: 'list' | 'calendar') {
    const params = new URLSearchParams(searchParams.toString());
    if (view === 'calendar') {
      params.set('view', 'calendar');
    } else {
      params.delete('view');
    }
    router.push(`/dashboard/content-drafts?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1 rounded-lg bg-surface-dark border border-white/5 p-0.5" data-testid="view-toggle">
      <button
        onClick={() => toggle('list')}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
          !isCalendar
            ? 'bg-white/10 text-white'
            : 'text-slate-400 hover:text-white hover:bg-white/5'
        }`}
        data-testid="view-toggle-list"
      >
        <List className="h-3.5 w-3.5" />
        List
      </button>
      <button
        onClick={() => toggle('calendar')}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
          isCalendar
            ? 'bg-white/10 text-white'
            : 'text-slate-400 hover:text-white hover:bg-white/5'
        }`}
        data-testid="view-toggle-calendar"
      >
        <CalendarDays className="h-3.5 w-3.5" />
        Calendar
      </button>
    </div>
  );
}
