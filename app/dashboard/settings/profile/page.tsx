import { redirect } from 'next/navigation';

// Redirect legacy /dashboard/settings/profile URL to the real business-info page.
// The onboarding checklist previously linked here before P0-FIX-02.
export default function ProfileRedirectPage() {
  redirect('/dashboard/settings/business-info');
}
