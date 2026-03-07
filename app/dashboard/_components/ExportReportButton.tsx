'use client';

import { useState } from 'react';
import { Download, FileText, Table } from 'lucide-react';
import type { ExportableReport } from '@/lib/services/report-exporter';
import { exportReportAsText, exportReportAsCSV } from '@/lib/services/report-exporter';

// ---------------------------------------------------------------------------
// S49: ExportReportButton — Download AI report as text or CSV
// ---------------------------------------------------------------------------

interface ExportReportButtonProps {
  report: ExportableReport | null;
}

export default function ExportReportButton({ report }: ExportReportButtonProps) {
  const [showMenu, setShowMenu] = useState(false);

  if (!report) return null;

  const handleExport = (format: 'text' | 'csv') => {
    const content = format === 'csv'
      ? exportReportAsCSV(report)
      : exportReportAsText(report);

    const mimeType = format === 'csv' ? 'text/csv' : 'text/plain';
    const ext = format === 'csv' ? 'csv' : 'txt';
    const filename = `ai-health-report-${new Date().toISOString().slice(0, 10)}.${ext}`;

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowMenu(false);
  };

  return (
    <div className="relative" data-testid="export-report">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10"
        data-testid="export-report-button"
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        Export Report
      </button>

      {showMenu && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-white/10 bg-[#0F1629] shadow-lg"
          data-testid="export-menu"
        >
          <button
            onClick={() => handleExport('text')}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition-colors rounded-t-lg"
            data-testid="export-text"
          >
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            Download as Text
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition-colors rounded-b-lg"
            data-testid="export-csv"
          >
            <Table className="h-3.5 w-3.5" aria-hidden="true" />
            Download as CSV
          </button>
        </div>
      )}
    </div>
  );
}
