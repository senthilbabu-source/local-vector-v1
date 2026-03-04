// ---------------------------------------------------------------------------
// HijackingFixModal — P8-FIX-37: Fix guidance modal per hijack_type.
//
// Shows actionable steps to correct a competitive hijacking event.
// AI_RULES §193.
// ---------------------------------------------------------------------------

'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

type HijackType = 'attribute_confusion' | 'competitor_citation' | 'address_mix';

interface Props {
  hijackType: HijackType;
  businessName: string;
  competitorName: string;
  onClose: () => void;
}

const FIX_GUIDANCE: Record<HijackType, { title: string; steps: string[] }> = {
  address_mix: {
    title: 'Fix Address Confusion',
    steps: [
      'Ensure your address is consistent across Google Business Profile, your website, and all citation sources.',
      'Check that your JSON-LD LocalBusiness schema has the correct address fields.',
      'Submit corrections on any directories showing the wrong address.',
      'Conflicting or outdated addresses are a top cause of AI confusion.',
    ],
  },
  competitor_citation: {
    title: 'Fix Competitor Citation',
    steps: [
      'Create content that clearly differentiates your business name and location from competitors.',
      'Include your exact city, category, and unique attributes in key pages.',
      'Add FAQ content answering "What makes [business] different from [competitor]?"',
      'Strengthen your Google Business Profile with complete, up-to-date information.',
    ],
  },
  attribute_confusion: {
    title: 'Fix Attribute Confusion',
    steps: [
      'Add structured data (JSON-LD) to your website that clearly lists your business attributes.',
      'Ensure your amenities, hours, and services are accurately listed on all platforms.',
      'Create dedicated pages for your unique features that AI models can reference.',
      'AI models rely heavily on schema markup — incomplete data leads to confusion.',
    ],
  },
};

export default function HijackingFixModal({ hijackType, businessName, competitorName, onClose }: Props) {
  const guidance = FIX_GUIDANCE[hijackType];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="hijack-fix-title"
      data-testid="hijacking-fix-modal"
    >
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-surface-dark p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <h3 id="hijack-fix-title" className="text-lg font-semibold text-white">
            {guidance.title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <p className="mb-4 text-sm text-[#94A3B8]">
          AI is confusing <strong className="text-white">{businessName}</strong> with{' '}
          <strong className="text-white">{competitorName}</strong>. Here&apos;s how to fix it:
        </p>

        <ol className="space-y-3" data-testid="fix-steps">
          {guidance.steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-[#94A3B8]">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
