'use client';

// ---------------------------------------------------------------------------
// SchemaFixPanel — Sprint 70: Tabbed panel displaying generated JSON-LD schemas
// ---------------------------------------------------------------------------

import { useState } from 'react';
import type { GeneratedSchema } from '@/lib/schema-generator';
import SchemaCodeBlock from './SchemaCodeBlock';

interface Props {
  schemas: GeneratedSchema[];
  onClose: () => void;
}

const TAB_LABELS: Record<string, string> = {
  FAQPage: 'FAQ',
  OpeningHoursSpecification: 'Opening Hours',
  LocalBusiness: 'Local Business',
};

export default function SchemaFixPanel({ schemas, onClose }: Props) {
  const [activeTab, setActiveTab] = useState(schemas[0]?.schemaType ?? 'FAQPage');

  const activeSchema = schemas.find((s) => s.schemaType === activeTab) ?? schemas[0];

  if (!activeSchema) return null;

  return (
    <div className="mt-4 rounded-2xl bg-surface-dark border border-white/5 p-5 animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Schema Fixes Generated</h3>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Close schema panel"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {schemas.map((schema) => (
          <button
            key={schema.schemaType}
            onClick={() => setActiveTab(schema.schemaType)}
            className={[
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              activeTab === schema.schemaType
                ? 'bg-electric-indigo/15 text-electric-indigo ring-1 ring-inset ring-electric-indigo/25'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10',
            ].join(' ')}
          >
            {TAB_LABELS[schema.schemaType] ?? schema.schemaType}
          </button>
        ))}
      </div>

      {/* Active schema content */}
      <div className="space-y-3">
        {/* Description */}
        <p className="text-xs text-slate-300">{activeSchema.description}</p>

        {/* Impact badge */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-signal-green/10 px-2 py-0.5 text-[10px] font-semibold text-signal-green">
            {activeSchema.estimatedImpact}
          </span>
        </div>

        {/* Code block */}
        <SchemaCodeBlock code={activeSchema.jsonLdString} />

        {/* Instructions */}
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
          <p className="text-[10px] font-semibold text-electric-indigo uppercase tracking-wide mb-1">
            How to add
          </p>
          <p className="text-xs text-slate-400">
            Paste this JSON-LD inside a{' '}
            <code className="rounded bg-white/5 px-1 py-0.5 text-[10px] font-mono text-slate-300">
              {'<script type="application/ld+json">'}
            </code>{' '}
            tag on your homepage.
          </p>
        </div>
      </div>
    </div>
  );
}
