'use client';

// ---------------------------------------------------------------------------
// OccasionAlertFeed — Client wrapper for occasion alert cards on dashboard
//
// Manages optimistic dismissal state: when a card is dismissed or snoozed,
// it's removed immediately from the local list without waiting for server.
//
// Sprint 101
// ---------------------------------------------------------------------------

import { useState } from 'react';
import OccasionAlertCard from './OccasionAlertCard';
import type { DashboardOccasionAlert } from '@/lib/occasions/occasion-feed';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OccasionAlertFeedProps {
  alerts: DashboardOccasionAlert[];
  canCreateDraft: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OccasionAlertFeed({
  alerts: initialAlerts,
  canCreateDraft,
}: OccasionAlertFeedProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const visibleAlerts = initialAlerts.filter((a) => !dismissedIds.has(a.id));

  if (visibleAlerts.length === 0) {
    return <div data-testid="occasion-alert-feed-empty" className="hidden" />;
  }

  function handleDismiss(id: string) {
    setDismissedIds((prev) => new Set([...prev, id]));
  }

  return (
    <div data-testid="occasion-alert-feed" className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-300">Upcoming Occasions</h2>
      {visibleAlerts.map((alert) => (
        <OccasionAlertCard
          key={alert.id}
          alert={alert}
          canCreateDraft={canCreateDraft}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
}
