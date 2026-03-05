'use client';

// ---------------------------------------------------------------------------
// ExportDraftsButton — §205 Content Drafts CSV Export
//
// Growth+ plan gate via canExportData(). Calls exportDraftsAction() server
// action → triggers a client-side Blob download.
// Disabled with tooltip for trial/starter plans.
// ---------------------------------------------------------------------------

import { useTransition, useState } from 'react';
import { Download } from 'lucide-react';
import { canExportData } from '@/lib/plan-enforcer';
import { exportDraftsAction } from '../actions';

interface ExportDraftsButtonProps {
  plan: string;
  statusFilter?: string;
}

export default function ExportDraftsButton({ plan, statusFilter }: ExportDraftsButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const allowed = canExportData(plan as Parameters<typeof canExportData>[0]);

  if (!allowed) {
    return (
      <button
        type="button"
        disabled
        title="Upgrade to Growth to export drafts"
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-500 opacity-50 cursor-not-allowed"
        data-testid="export-drafts-btn-disabled"
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        Export CSV
      </button>
    );
  }

  function handleExport() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      if (statusFilter) {
        fd.set('status_filter', statusFilter);
      }
      const result = await exportDraftsAction(fd);
      if (!result.success) {
        setError(result.error);
        return;
      }
      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `content-drafts-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleExport}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-white/20 hover:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
        data-testid="export-drafts-btn"
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        {isPending ? 'Exporting…' : 'Export CSV'}
      </button>
      {error && (
        <p className="text-xs text-alert-crimson" data-testid="export-drafts-error">
          {error}
        </p>
      )}
    </div>
  );
}
