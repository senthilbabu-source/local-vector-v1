/**
 * DashboardFooter — Sprint 115
 *
 * Server component that shows/hides "Powered by LocalVector" based on org theme.
 * Reads OrgContext from headers; if absent (direct access), always shows branding.
 */

import { getOrgContextFromHeaders } from '@/lib/whitelabel/get-org-context-from-headers';
import { getOrgThemeOrDefault } from '@/lib/whitelabel/theme-service';
import { createServiceRoleClient } from '@/lib/supabase/server';

export default async function DashboardFooter() {
  let showPoweredBy = true;

  const orgContext = await getOrgContextFromHeaders();

  if (orgContext) {
    const serviceClient = createServiceRoleClient();
    const theme = await getOrgThemeOrDefault(serviceClient, orgContext.org_id);
    showPoweredBy = theme.show_powered_by;
  }

  return (
    <footer data-testid="dashboard-footer" className="py-4 text-center">
      {showPoweredBy ? (
        <a
          href="https://localvector.ai"
          data-testid="powered-by-link"
          className="text-xs text-slate-400 hover:text-slate-400 transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by LocalVector
        </a>
      ) : (
        <span className="text-xs text-transparent select-none" aria-hidden="true">
          &nbsp;
        </span>
      )}
    </footer>
  );
}
