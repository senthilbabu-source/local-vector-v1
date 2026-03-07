// ---------------------------------------------------------------------------
// S34: Crawler Analytics merged into Website Checkup — redirect
// Old URL preserved via redirect (not 404).
// ---------------------------------------------------------------------------

import { redirect } from 'next/navigation';

export const metadata = { title: 'Site Visitors | LocalVector.ai' };

export default function CrawlerAnalyticsRedirect() {
  redirect('/dashboard/page-audits#bots');
}
