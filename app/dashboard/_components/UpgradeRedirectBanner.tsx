'use client';

// ---------------------------------------------------------------------------
// app/dashboard/_components/UpgradeRedirectBanner.tsx — P1-FIX-07
//
// Shown on the dashboard when a user is redirected from a plan-locked page
// (e.g. /dashboard?upgrade=team). Dismissible banner that explains why they
// were redirected and links to billing.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { X } from 'lucide-react';
import { UpgradePlanPrompt } from '@/components/ui/UpgradePlanPrompt';

const UPGRADE_FEATURE_MAP: Record<string, { feature: string; requiredPlan: string }> = {
  team: { feature: 'Team Management', requiredPlan: 'Brand Fortress' },
  domain: { feature: 'Custom Domain', requiredPlan: 'Brand Fortress' },
  playbooks: { feature: 'Improvement Plans', requiredPlan: 'Brand Fortress' },
  widget: { feature: 'Website Chat', requiredPlan: 'AI Shield' },
  intent: { feature: 'Missing Questions', requiredPlan: 'Brand Fortress' },
  voice: { feature: 'Voice Search', requiredPlan: 'AI Shield' },
};

interface UpgradeRedirectBannerProps {
  upgradeKey: string;
}

export default function UpgradeRedirectBanner({ upgradeKey }: UpgradeRedirectBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const config = UPGRADE_FEATURE_MAP[upgradeKey];

  if (!config || dismissed) return null;

  return (
    <div data-testid="upgrade-redirect-banner" className="relative mb-4">
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-white transition"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <UpgradePlanPrompt feature={config.feature} requiredPlan={config.requiredPlan} />
    </div>
  );
}
