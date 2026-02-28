// ---------------------------------------------------------------------------
// DraftSourceTag — Sprint O (L3): Content Flow Clarity
//
// Small pill tag shown on drafts generated from the Content Calendar
// (Occasion Engine). Renders only when trigger_type='occasion'.
// Links back to the content calendar page.
// ---------------------------------------------------------------------------

import { CalendarDays } from 'lucide-react';
import Link from 'next/link';

interface DraftSourceTagProps {
  sourceOccasion: string;
}

export function DraftSourceTag({ sourceOccasion }: DraftSourceTagProps) {
  return (
    <Link
      href="/dashboard/content-calendar"
      className="inline-flex items-center gap-1.5 rounded-full bg-violet-400/10 border border-violet-400/20 px-2.5 py-0.5 text-[11px] font-medium text-violet-400 hover:bg-violet-400/20 transition-colors w-fit"
      data-testid="draft-source-tag"
    >
      <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" />
      Generated from calendar &middot; {sourceOccasion}
    </Link>
  );
}
