import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import SettingsForm from './_components/SettingsForm';

// ---------------------------------------------------------------------------
// SettingsPage — Server Component (Sprint 24B)
//
// Fetches user identity from getSafeAuthContext() and pre-fills the form.
// The form handles its own submit state via Server Actions (actions.ts).
// ---------------------------------------------------------------------------

export default async function SettingsPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) {
    redirect('/login');
  }

  const displayName = ctx.fullName ?? ctx.email.split('@')[0];

  return (
    <div className="max-w-2xl space-y-5">

      {/* ── Page header ───────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">Settings</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Manage your account, security, and organization preferences.
        </p>
      </div>

      <SettingsForm
        displayName={displayName}
        email={ctx.email}
        orgName={ctx.orgName ?? '—'}
        plan={ctx.plan}
      />

    </div>
  );
}
