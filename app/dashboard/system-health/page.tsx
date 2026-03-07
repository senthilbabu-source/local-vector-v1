// ---------------------------------------------------------------------------
// S35: System Status moved to Admin — redirect non-admins to dashboard
// Admins can access via /admin/system-health
// ---------------------------------------------------------------------------

import { redirect } from 'next/navigation';

export const metadata = { title: 'System Status | LocalVector.ai' };

export default function SystemHealthRedirect() {
  redirect('/dashboard');
}
