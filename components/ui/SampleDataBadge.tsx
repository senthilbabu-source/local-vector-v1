// ---------------------------------------------------------------------------
// SampleDataBadge — Sprint B (C4)
//
// Overlays a "SAMPLE DATA" indicator on dashboard cards showing sample data.
// Placed inside a `relative` parent container with `absolute` positioning.
// Does NOT block interaction with the card underneath (pointer-events-none).
// ---------------------------------------------------------------------------

export function SampleDataBadge() {
  return (
    <div
      className="absolute top-2 right-2 z-10 pointer-events-none"
      aria-label="This card is showing sample data"
      data-testid="sample-data-badge"
    >
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200 select-none">
        Sample Data
      </span>
    </div>
  );
}
