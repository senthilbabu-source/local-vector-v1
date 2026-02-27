'use client';

import { useState, useTransition } from 'react';
import type { ClusterMapResult, EngineFilter } from '@/lib/services/cluster-map.service';
import { getClusterMapData } from '../actions';
import EngineToggle from './EngineToggle';
import ClusterChart from './ClusterChart';
import HallucinationAlertCard from './HallucinationAlertCard';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ClusterMapWrapperProps {
  initialData: ClusterMapResult;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ClusterMapWrapper({ initialData }: ClusterMapWrapperProps) {
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  function handleFilterChange(filter: EngineFilter) {
    startTransition(async () => {
      const result = await getClusterMapData(filter);
      if (result.success) {
        setData(result.data);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Engine Toggle */}
      <EngineToggle
        availableEngines={data.availableEngines}
        activeFilter={data.activeFilter}
        onFilterChange={handleFilterChange}
        isLoading={isPending}
      />

      {/* Scatter Chart */}
      <div className={isPending ? 'opacity-60 transition-opacity' : ''}>
        <ClusterChart
          points={data.points}
          hallucinationZones={data.hallucinationZones}
          selfPoint={data.selfPoint}
        />
      </div>

      {/* Hallucination Alert Cards */}
      {data.hallucinationZones.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white mb-3">
            {data.hallucinationZones.length} Hallucination Zone{data.hallucinationZones.length !== 1 ? 's' : ''} Detected
          </h2>
          <div className="space-y-2">
            {data.hallucinationZones.map((zone) => (
              <HallucinationAlertCard key={zone.id} zone={zone} />
            ))}
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Competitors" value={String(data.stats.totalCompetitors)} />
        <StatCard label="Queries" value={String(data.stats.totalQueries)} />
        <StatCard label="Hallucinations" value={String(data.stats.hallucinationCount)} />
        <StatCard
          label="Dominant Engine"
          value={formatEngine(data.stats.dominantEngine)}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Card (inline)
// ---------------------------------------------------------------------------

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3 text-center">
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className="mt-1 text-lg font-bold text-white font-mono">{value}</p>
    </div>
  );
}

function formatEngine(engine: string | null): string {
  if (!engine) return '—';
  if (engine === 'openai') return 'ChatGPT';
  if (engine === 'perplexity') return 'Perplexity';
  if (engine === 'google') return 'Gemini';
  if (engine === 'copilot') return 'Copilot';
  return engine;
}
