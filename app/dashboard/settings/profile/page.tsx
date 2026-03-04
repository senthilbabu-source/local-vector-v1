import { redirect } from 'next/navigation';

export const metadata = { title: 'Profile | LocalVector.ai' };

// Redirect legacy /dashboard/settings/profile URL to the real business-info page.
// The onboarding checklist previously linked here before P0-FIX-02.
export default function ProfileRedirectPage() {
  redirect('/dashboard/settings/business-info');
}
