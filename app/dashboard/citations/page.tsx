// ---------------------------------------------------------------------------
// S33: Citations merged into Entity Health — redirect
// Old URL preserved via redirect (not 404).
// ---------------------------------------------------------------------------

import { redirect } from 'next/navigation';

export const metadata = { title: 'Platforms | LocalVector.ai' };

export default function CitationsRedirect() {
  redirect('/dashboard/entity-health?tab=citations');
}
