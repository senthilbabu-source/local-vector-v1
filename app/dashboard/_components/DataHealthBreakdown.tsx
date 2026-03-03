'use client';

// ---------------------------------------------------------------------------
// DataHealthBreakdown.tsx — Sprint 124: DataHealth 5-Dimension Breakdown
//
// Displays the 5-dimension breakdown of the DataHealth score:
//   Core Identity (30), Hours (20), Amenities (20),
//   Category+Description (15), Menu/Services (15)
//
// Props come from deriveRealityScore() return value + computeDataHealth().
// data-testid="data-health-breakdown"
// AI_RULES §158
// ---------------------------------------------------------------------------

interface DataHealthBreakdownProps {
  score: number;
  coreIdentity?: number;
  hours?: number;
  amenities?: number;
  categoryDescription?: number;
  menuServices?: number;
  gbpImportSource?: boolean;
}

interface DimensionConfig {
  label: string;
  value: number;
  max: number;
  note?: string;
}

function getBarColor(value: number, max: number): string {
  const pct = max > 0 ? value / max : 0;
  if (pct >= 0.8) return 'bg-truth-emerald';
  if (pct >= 0.5) return 'bg-amber-400';
  return 'bg-red-400';
}

export default function DataHealthBreakdown({
  score,
  coreIdentity,
  hours,
  amenities,
  categoryDescription,
  menuServices,
  gbpImportSource,
}: DataHealthBreakdownProps) {
  // If no breakdown data, show just the total
  const hasBreakdown =
    coreIdentity !== undefined ||
    hours !== undefined ||
    amenities !== undefined ||
    categoryDescription !== undefined ||
    menuServices !== undefined;

  if (!hasBreakdown) return null;

  const dimensions: DimensionConfig[] = [
    { label: 'Core identity', value: coreIdentity ?? 0, max: 30 },
    { label: 'Hours', value: hours ?? 0, max: 20 },
    {
      label: 'Amenities',
      value: amenities ?? 0,
      max: 20,
      note: gbpImportSource ? 'GBP Import — auto-scored' : undefined,
    },
    {
      label: 'Category & description',
      value: categoryDescription ?? 0,
      max: 15,
    },
    { label: 'Menu / services', value: menuServices ?? 0, max: 15 },
  ];

  return (
    <div
      data-testid="data-health-breakdown"
      className="mt-3 space-y-2 border-t border-white/5 pt-3"
    >
      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
        Data Health: {score}/100
      </p>

      {dimensions.map((dim) => {
        const pctWidth = dim.max > 0 ? (dim.value / dim.max) * 100 : 0;
        return (
          <div key={dim.label} className="flex items-center gap-2">
            <span className="w-[130px] shrink-0 text-[11px] text-slate-400 truncate">
              {dim.label}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getBarColor(dim.value, dim.max)}`}
                style={{ width: `${Math.min(100, pctWidth)}%` }}
              />
            </div>
            <span className="w-10 text-right text-[10px] tabular-nums text-slate-500">
              {dim.value}/{dim.max}
            </span>
          </div>
        );
      })}

      {gbpImportSource && (
        <p className="text-[10px] text-amber-400/70 mt-1">
          GBP Import — amenities not scored
        </p>
      )}
    </div>
  );
}
