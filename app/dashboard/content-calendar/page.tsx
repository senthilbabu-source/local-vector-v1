// ---------------------------------------------------------------------------
// S32: Calendar merged into Posts page — redirect to content-drafts?view=calendar
// Old URL preserved via redirect (not 404).
// ---------------------------------------------------------------------------

import { redirect } from 'next/navigation';

export const metadata = { title: 'Calendar | LocalVector.ai' };

export default function ContentCalendarRedirect() {
  redirect('/dashboard/content-drafts?view=calendar');
}
