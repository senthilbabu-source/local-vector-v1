'use client';

// ---------------------------------------------------------------------------
// UploadState — Phase 14.5: 3-Tab Hybrid Upload UI
//
// ZERO-REGRESSION NOTES:
//   • The onParseComplete(menu: MenuWorkspaceData) callback contract is
//     unchanged. MenuWorkspace.tsx requires no modifications.
//   • Tab 1 (AI Magic Extract) is byte-for-byte the same UX as before.
//     The simulateAIParsing action and MSW mock intercepts are untouched.
//   • Tabs 2 and 3 call new Server Actions; all results flow through the
//     same onParseComplete callback into ReviewState.
// ---------------------------------------------------------------------------

import { useRef, useState } from 'react';
import type { MenuWorkspaceData } from '@/lib/types/menu';
import { simulateAIParsing, uploadLocalVectorCsv, uploadPosExport, uploadMenuFile } from '../actions';
import { getLocalVectorCsvTemplate } from '@/lib/utils/parseCsvMenu';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UploadStateProps {
  locationId:      string;
  locationName:    string;
  locationCity:    string | null;
  onParseComplete: (menu: MenuWorkspaceData) => void;
}

// ---------------------------------------------------------------------------
// Tab identifiers
// ---------------------------------------------------------------------------

type UploadTab = 'ai' | 'csv' | 'pos';

const TABS: { id: UploadTab; label: string; badge?: string }[] = [
  { id: 'ai',  label: 'AI Magic Extract' },
  { id: 'csv', label: 'Gold Standard CSV', badge: 'Fastest' },
  { id: 'pos', label: 'POS Export',        badge: 'AI Mapped' },
];

// ---------------------------------------------------------------------------
// UploadState
// ---------------------------------------------------------------------------

export default function UploadState({
  locationId,
  locationName,
  locationCity,
  onParseComplete,
}: UploadStateProps) {
  const [activeTab,  setActiveTab]  = useState<UploadTab>('ai');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isParsing,  setIsParsing]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // File-input refs
  const aiFileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const posInputRef = useRef<HTMLInputElement>(null);

  // ── Tab 1 — AI Magic Extract: file upload via GPT-4o Vision ───────────
  async function handleMenuFileUpload(file: File) {
    setError(null);
    setIsParsing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('locationId', locationId);
      const result = await uploadMenuFile(formData);
      if (result.success) {
        onParseComplete(result.menu);
      } else {
        setError(result.error);
      }
    } finally {
      setIsParsing(false);
    }
  }

  function handleAiFileDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleMenuFileUpload(file);
  }

  function handleAiFileSelect() {
    const file = aiFileInputRef.current?.files?.[0];
    if (file) handleMenuFileUpload(file);
  }

  // ── Tab 1 — AI simulation (demo fallback) ────────────────────────────
  async function handleSimulate() {
    setError(null);
    setIsParsing(true);
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 2000));
      const result = await simulateAIParsing(locationId);
      if (result.success) {
        onParseComplete(result.menu);
      } else {
        setError(result.error);
      }
    } finally {
      setIsParsing(false);
    }
  }

  // ── Tab 2 — Gold Standard CSV ──────────────────────────────────────────
  async function handleCsvUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = csvInputRef.current?.files?.[0];
    if (!file) { setError('Please select a CSV file.'); return; }

    setError(null);
    setIsParsing(true);
    try {
      const formData = new FormData();
      formData.append('file',       file);
      formData.append('locationId', locationId);
      const result = await uploadLocalVectorCsv(formData);
      if (result.success) {
        onParseComplete(result.menu);
      } else {
        setError(result.error);
      }
    } finally {
      setIsParsing(false);
    }
  }

  // ── Tab 3 — POS Export ─────────────────────────────────────────────────
  async function handlePosUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = posInputRef.current?.files?.[0];
    if (!file) { setError('Please select a CSV file.'); return; }

    setError(null);
    setIsParsing(true);
    try {
      const formData = new FormData();
      formData.append('file',       file);
      formData.append('locationId', locationId);
      const result = await uploadPosExport(formData);
      if (result.success) {
        onParseComplete(result.menu);
      } else {
        setError(result.error);
      }
    } finally {
      setIsParsing(false);
    }
  }

  // ── CSV template download (client-side blob, no server round-trip) ──────
  function handleDownloadTemplate() {
    const csv  = getLocalVectorCsvTemplate();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'localvector-menu-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">

      {/* ── Location context pill ──────────────────────────────────── */}
      <div className="inline-flex items-center gap-1.5 rounded-full bg-electric-indigo/10 border border-electric-indigo/20 px-3 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-electric-indigo" aria-hidden />
        <span className="text-xs font-medium text-electric-indigo">
          {locationName}
          {locationCity ? ` · ${locationCity}` : ''}
        </span>
      </div>

      {/* ── Tab switcher ───────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-xl bg-white/5 p-1" role="tablist" aria-label="Upload method">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => { setActiveTab(tab.id); setError(null); }}
            className={[
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition',
              activeTab === tab.id
                ? 'bg-electric-indigo text-white shadow'
                : 'text-slate-400 hover:text-slate-200',
            ].join(' ')}
          >
            {tab.label}
            {tab.badge && (
              <span
                className={[
                  'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                  activeTab === tab.id
                    ? 'bg-white/20 text-white'
                    : 'bg-white/10 text-slate-500',
                ].join(' ')}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab panels ─────────────────────────────────────────────── */}

      {/* TAB 1 — AI Magic Extract */}
      {activeTab === 'ai' && (
        <div className="space-y-4" role="tabpanel" aria-label="AI Magic Extract">

          {/* Drag-and-drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleAiFileDrop}
            onClick={() => !isParsing && aiFileInputRef.current?.click()}
            className={[
              'rounded-2xl border-2 border-dashed p-12 text-center transition cursor-pointer',
              isDragOver
                ? 'border-electric-indigo bg-electric-indigo/8'
                : 'border-white/10 bg-surface-dark hover:border-white/20',
              isParsing ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ')}
          >
            <UploadCloudIcon isDragOver={isDragOver} />
            <p className="mt-3 text-sm font-medium text-slate-300">
              Drop your menu PDF or image here
            </p>
            <p className="mt-1 text-xs text-slate-500">PDF, PNG, JPG, WebP up to 10 MB</p>
            <p className="mt-1.5 text-xs text-electric-indigo font-medium">
              or click to browse files
            </p>
            <input
              ref={aiFileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              disabled={isParsing}
              onChange={handleAiFileSelect}
              className="hidden"
            />
          </div>

          {isParsing && (
            <div className="flex items-center justify-center gap-2 py-2">
              <SpinnerIcon />
              <span className="text-sm font-medium text-electric-indigo">Extracting menu with AI…</span>
            </div>
          )}

          <Divider />

          {/* Simulate AI Parsing demo */}
          <div className="rounded-2xl bg-surface-dark border border-white/5 p-6 text-center space-y-3">
            <p className="text-sm font-medium text-slate-300">Or try the AI extraction demo</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Generates a realistic menu for {locationName} using mock AI extraction —
              confidence scores, categories, and all.
            </p>
            <ActionButton
              label="Simulate AI Parsing"
              loadingLabel="Analyzing with AI…"
              isParsing={isParsing}
              onClick={handleSimulate}
            />
          </div>
        </div>
      )}

      {/* TAB 2 — Gold Standard CSV */}
      {activeTab === 'csv' && (
        <div className="space-y-4" role="tabpanel" aria-label="Gold Standard CSV">

          {/* Explanation card */}
          <div className="rounded-2xl bg-surface-dark border border-white/5 p-5 space-y-2">
            <p className="text-sm font-semibold text-white">AEO-Ready CSV Template</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Fill in our 6-column template —{' '}
              <span className="text-slate-300 font-mono text-[11px]">
                Category, Item_Name, Description, Price, Dietary_Tags, Image_URL
              </span>{' '}
              — and every item will be auto-approved at 100% confidence. Owner-supplied data
              is ground truth.
            </p>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-electric-indigo hover:text-electric-indigo/80 transition"
            >
              <DownloadIcon />
              Download template (.csv)
            </button>
          </div>

          {/* Upload form */}
          <form
            onSubmit={handleCsvUpload}
            className="rounded-2xl bg-surface-dark border border-white/5 p-5 space-y-4"
          >
            <label className="block">
              <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Select your completed CSV
              </span>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                disabled={isParsing}
                className="block w-full text-xs text-slate-400
                  file:mr-3 file:rounded-lg file:border-0
                  file:bg-electric-indigo/10 file:px-3 file:py-1.5
                  file:text-xs file:font-semibold file:text-electric-indigo
                  hover:file:bg-electric-indigo/20 file:cursor-pointer
                  disabled:opacity-50"
              />
            </label>
            <ActionButton
              label="Import Gold Standard CSV →"
              loadingLabel="Importing…"
              isParsing={isParsing}
              type="submit"
            />
          </form>
        </div>
      )}

      {/* TAB 3 — POS Export */}
      {activeTab === 'pos' && (
        <div className="space-y-4" role="tabpanel" aria-label="POS Export">

          {/* AI mapping warning */}
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 flex gap-3">
            <span className="text-amber-400 shrink-0 mt-px" aria-hidden>⚠</span>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-amber-300">AI Column Mapping</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Upload your raw Toast, Square, or Clover export. GPT-4o will automatically
                identify your items — modifier rows and tax codes are ignored. Some items may
                need review before publishing.
              </p>
            </div>
          </div>

          {/* Supported POS systems */}
          <div className="rounded-2xl bg-surface-dark border border-white/5 p-5 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Supported POS Systems
            </p>
            <div className="flex flex-wrap gap-2">
              {['Toast', 'Square', 'Clover', 'Other CSV'].map((pos) => (
                <span
                  key={pos}
                  className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-400"
                >
                  {pos}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-600">
              Export the &ldquo;Menu Items&rdquo; or &ldquo;Product List&rdquo; report from your POS dashboard.
            </p>
          </div>

          {/* Upload form */}
          <form
            onSubmit={handlePosUpload}
            className="rounded-2xl bg-surface-dark border border-white/5 p-5 space-y-4"
          >
            <label className="block">
              <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Select your POS export CSV
              </span>
              <input
                ref={posInputRef}
                type="file"
                accept=".csv,text/csv"
                disabled={isParsing}
                className="block w-full text-xs text-slate-400
                  file:mr-3 file:rounded-lg file:border-0
                  file:bg-electric-indigo/10 file:px-3 file:py-1.5
                  file:text-xs file:font-semibold file:text-electric-indigo
                  hover:file:bg-electric-indigo/20 file:cursor-pointer
                  disabled:opacity-50"
              />
            </label>
            <ActionButton
              label="Map with AI →"
              loadingLabel="AI is mapping your menu…"
              isParsing={isParsing}
              type="submit"
            />
          </form>
        </div>
      )}

      {/* ── Shared error display ───────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-alert-crimson/20 bg-alert-crimson/5 px-4 py-3">
          <p className="text-xs text-alert-crimson">{error}</p>
        </div>
      )}

    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function ActionButton({
  label,
  loadingLabel,
  isParsing,
  onClick,
  type = 'button',
}: {
  label:        string;
  loadingLabel: string;
  isParsing:    boolean;
  onClick?:     () => void;
  type?:        'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isParsing}
      className={[
        'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition',
        isParsing
          ? 'bg-electric-indigo/40 text-white/50 cursor-not-allowed'
          : 'bg-electric-indigo text-white hover:bg-electric-indigo/90',
      ].join(' ')}
    >
      {isParsing ? (
        <>
          <SpinnerIcon />
          {loadingLabel}
        </>
      ) : (
        label
      )}
    </button>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-white/5" />
      <span className="text-xs text-slate-600">or</span>
      <div className="flex-1 h-px bg-white/5" />
    </div>
  );
}

function UploadCloudIcon({ isDragOver }: { isDragOver: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={[
        'mx-auto h-10 w-10 transition',
        isDragOver ? 'text-electric-indigo' : 'text-slate-600',
      ].join(' ')}
      aria-hidden
    >
      <path d="M12 16v-8m0 0-3 3m3-3 3 3" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path d="M8.75 2.75a.75.75 0 0 0-1.5 0v5.69L5.03 6.22a.75.75 0 0 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 0 0-1.06-1.06L8.75 8.44V2.75Z" />
      <path d="M3.5 9.75a.75.75 0 0 0-1.5 0v1.5A2.75 2.75 0 0 0 4.75 14h6.5A2.75 2.75 0 0 0 14 11.25v-1.5a.75.75 0 0 0-1.5 0v1.5c0 .69-.56 1.25-1.25 1.25h-6.5c-.69 0-1.25-.56-1.25-1.25v-1.5Z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
