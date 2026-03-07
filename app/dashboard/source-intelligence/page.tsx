// ---------------------------------------------------------------------------
// S33: Source Intelligence merged into Entity Health — redirect
// Old URL preserved via redirect (not 404).
// ---------------------------------------------------------------------------

import { redirect } from 'next/navigation';

export const metadata = { title: 'Your Sources | LocalVector.ai' };

export default function SourceIntelligenceRedirect() {
  redirect('/dashboard/entity-health?tab=sources');
}
