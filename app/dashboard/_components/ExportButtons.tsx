'use client';

// ---------------------------------------------------------------------------
// app/dashboard/_components/ExportButtons.tsx — Export CSV + PDF buttons
//
// Sprint 95 — Client component for triggering file downloads.
// Uses window.location.href (NOT fetch) to trigger browser download dialog.
// Visible but disabled for Starter/Trial plan users.
// ---------------------------------------------------------------------------

interface ExportButtonsProps {
  canExport: boolean;
  showCSV?: boolean;
  showPDF?: boolean;
}

export default function ExportButtons({
  canExport,
  showCSV = true,
  showPDF = true,
}: ExportButtonsProps) {
  const handleExportCSV = () => {
    if (!canExport) return;
    window.location.href = '/api/exports/hallucinations';
  };

  const handleExportPDF = () => {
    if (!canExport) return;
    window.location.href = '/api/exports/audit-report';
  };

  return (
    <div className="flex items-center gap-2">
      {showCSV && (
        <div className="relative group">
          <button
            data-testid="export-csv-btn"
            onClick={handleExportCSV}
            disabled={!canExport}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              canExport
                ? 'bg-electric-indigo/10 text-electric-indigo hover:bg-electric-indigo/20 border border-electric-indigo/20'
                : 'bg-white/5 text-slate-500 cursor-not-allowed opacity-50 border border-white/5'
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export CSV
          </button>
          {!canExport && (
            <span
              data-testid="export-csv-upgrade-tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded bg-slate-800 px-2.5 py-1 text-xs text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Requires Growth plan or higher
            </span>
          )}
        </div>
      )}

      {showPDF && (
        <div className="relative group">
          <button
            data-testid="export-pdf-btn"
            onClick={handleExportPDF}
            disabled={!canExport}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              canExport
                ? 'bg-electric-indigo/10 text-electric-indigo hover:bg-electric-indigo/20 border border-electric-indigo/20'
                : 'bg-white/5 text-slate-500 cursor-not-allowed opacity-50 border border-white/5'
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            Export PDF
          </button>
          {!canExport && (
            <span
              data-testid="export-pdf-upgrade-tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded bg-slate-800 px-2.5 py-1 text-xs text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Requires Growth plan or higher
            </span>
          )}
        </div>
      )}
    </div>
  );
}
