import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminNav from './_components/AdminNav';

/**
 * Admin layout — Server Component.
 * Protects all /admin/* routes via ADMIN_EMAILS env var.
 * Sprint D (L1).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!adminEmails.includes(user.email?.toLowerCase() ?? '')) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-midnight-slate">
      <AdminNav email={user.email ?? ''} />
      <main className="mx-auto max-w-7xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
