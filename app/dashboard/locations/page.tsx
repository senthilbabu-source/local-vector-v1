import { redirect } from 'next/navigation';

// ---------------------------------------------------------------------------
// Redirect: /dashboard/locations → /dashboard/settings/locations (Sprint 100)
//
// Location management moved to settings. This redirect preserves old bookmarks.
// ---------------------------------------------------------------------------

export default function LocationsPage() {
  redirect('/dashboard/settings/locations');
}
