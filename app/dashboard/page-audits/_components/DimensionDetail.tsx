// ---------------------------------------------------------------------------
// DimensionDetail — Sprint 71: Per-dimension explanation + recommendations
// ---------------------------------------------------------------------------

'use client';

import type { PageAuditRecommendation, DimensionKey } from '@/lib/page-audit/auditor';

const DIMENSION_EXPLANATIONS: Record<DimensionKey, string> = {
  answerFirst:
    'Measures whether your page leads with the answer — AI models read top-down and stop early. A high score means your opening text directly answers the most common query.',
  schemaCompleteness:
    'Measures JSON-LD structured data on the page. Schema markup tells AI exactly what your business is, where it\'s located, and what you offer.',
  faqSchema:
    'Checks for FAQPage schema with Q&A pairs. Pages with FAQ schema are 3.2x more likely to appear in AI Overviews and answer boxes.',
  keywordDensity:
    'Checks that your business name, location, and category terms appear naturally in the visible text — not just in schema or footers.',
  entityClarity:
    'Measures whether AI can extract your complete business identity (name, address, phone, hours) from the page content.',
};

interface Props {
  dimensionKey: DimensionKey;
  recommendations: PageAuditRecommendation[];
  onGenerateSchema?: (schemaType: string) => void;
}

export default function DimensionDetail({ dimensionKey, recommendations, onGenerateSchema }: Props) {
  const explanation = DIMENSION_EXPLANATIONS[dimensionKey];
  const filteredRecs = recommendations.filter((r) => r.dimensionKey === dimensionKey);

  return (
    <div className="mt-2 rounded-lg bg-white/[0.02] border border-white/5 p-3 space-y-3">
      <p className="text-xs text-slate-400 leading-relaxed">{explanation}</p>

      {filteredRecs.length > 0 && (
        <div className="space-y-2">
          {filteredRecs.map((rec, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium text-slate-300">{rec.issue}</p>
                <span className="shrink-0 inline-flex items-center rounded-full bg-alert-amber/10 px-2 py-0.5 text-[10px] font-bold text-alert-amber">
                  +{rec.impactPoints} pts
                </span>
              </div>
              <p className="text-xs text-slate-500">{rec.fix}</p>
              {rec.schemaType && onGenerateSchema && (
                <button
                  onClick={() => onGenerateSchema(rec.schemaType!)}
                  className="mt-1 inline-flex items-center rounded-md bg-electric-indigo/10 px-2.5 py-1 text-[11px] font-medium text-electric-indigo ring-1 ring-inset ring-electric-indigo/20 transition hover:bg-electric-indigo/20"
                >
                  Generate {rec.schemaType} &rarr;
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {filteredRecs.length === 0 && (
        <p className="text-xs text-truth-emerald">No issues found for this dimension.</p>
      )}
    </div>
  );
}
