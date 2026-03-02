/**
 * Branded Login Page — Sprint 115
 *
 * Public server component — no auth required.
 * Route: /login/{slug} where slug matches organizations.slug
 *
 * Resolves the org by slug, fetches theme, and renders a branded login form.
 * If slug not found, redirects to default /login.
 */

import { redirect } from 'next/navigation';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getOrgContextFromHeaders } from '@/lib/whitelabel/get-org-context-from-headers';
import { getOrgThemeOrDefault } from '@/lib/whitelabel/theme-service';
import BrandedLoginForm from './BrandedLoginForm';

interface BrandedLoginPageProps {
  params: Promise<{ slug: string }>;
}

export default async function BrandedLoginPage({ params }: BrandedLoginPageProps) {
  const { slug } = await params;
  const serviceClient = createServiceRoleClient();

  // Try OrgContext from headers first (set by middleware for subdomain access)
  let orgId: string | null = null;
  let orgName: string = '';

  const orgContext = await getOrgContextFromHeaders();

  if (orgContext) {
    orgId = orgContext.org_id;
    orgName = orgContext.org_name;
  } else {
    // Fallback: resolve org by slug from URL param
    const { data: org } = await serviceClient
      .from('organizations')
      .select('id, name')
      .eq('slug', slug)
      .maybeSingle();

    if (!org) {
      redirect('/login');
    }

    orgId = org.id;
    orgName = org.name ?? slug;
  }

  // Fetch theme
  const theme = await getOrgThemeOrDefault(serviceClient, orgId);

  return (
    <div
      data-testid="branded-login-page"
      className="flex min-h-screen items-center justify-center bg-[#050A15] px-4"
    >
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        {theme.logo_url && (
          <div className="flex justify-center" data-testid="org-logo">
            <img
              src={theme.logo_url}
              alt={orgName}
              style={{ maxWidth: '150px', maxHeight: '60px', objectFit: 'contain' }}
            />
          </div>
        )}

        {/* Org name */}
        <h1
          data-testid="org-name-heading"
          className="text-center text-2xl font-bold text-white"
        >
          {orgName}
        </h1>

        {/* Sign in form */}
        <div className="rounded-lg border border-white/10 bg-[#0A1628] p-8">
          <h2 className="mb-6 text-center text-lg text-slate-300">
            Sign in to your account
          </h2>
          <BrandedLoginForm primaryColor={theme.primary_color} textOnPrimary={theme.text_on_primary} />
        </div>

        {/* Powered by footer */}
        {theme.show_powered_by && (
          <p
            data-testid="powered-by-footer"
            className="text-center text-xs text-slate-500"
          >
            Powered by{' '}
            <a
              href="https://localvector.ai"
              className="underline hover:text-slate-400"
              target="_blank"
              rel="noopener noreferrer"
            >
              LocalVector
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
