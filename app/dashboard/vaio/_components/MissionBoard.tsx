'use client';

// ---------------------------------------------------------------------------
// MissionBoard — Shows the top 3 VAIO missions (Sprint 2)
//
// First mission (highest pts_gain) is expanded by default.
// Done missions show a collapsed checkmark state.
// ---------------------------------------------------------------------------

import type { Mission } from '@/lib/vaio/types';
import { MissionCard, type MissionCardProfile } from './MissionCard';

interface VoiceQueryRow {
  id: string;
  query_text: string;
  query_category: string;
  citation_rate: number | null;
}

interface MissionBoardProps {
  missions: Mission[];
  profile: MissionCardProfile;
  queries: VoiceQueryRow[];
  /** §210 — mission IDs that just became 'done' after a scan (pulse green) */
  justCompletedMissions?: Set<string>;
}

export function MissionBoard({ missions, profile, queries, justCompletedMissions }: MissionBoardProps) {
  const topMissions = missions.slice(0, 3);

  if (topMissions.length === 0) return null;

  const openCount = topMissions.filter((m) => m.status === 'open').length;
  const totalPts = topMissions
    .filter((m) => m.status === 'open')
    .reduce((sum, m) => sum + m.pts_gain, 0);

  return (
    <div data-testid="vaio-mission-board">
      {/* Board header */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Your Next Moves</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {openCount > 0
              ? `${openCount} action${openCount !== 1 ? 's' : ''} · up to +${totalPts} pts available`
              : 'All missions complete — run Voice Check to find new gaps'}
          </p>
        </div>
      </div>

      {/* Mission cards */}
      <div className="space-y-3">
        {topMissions.map((mission, i) => (
          <MissionCard
            key={mission.id}
            mission={mission}
            profile={profile}
            queries={queries}
            defaultOpen={i === 0 && mission.status === 'open'}
            pulseGreen={justCompletedMissions?.has(mission.id) ?? false}
            data-testid={`mission-card-${i}`}
          />
        ))}
      </div>
    </div>
  );
}
