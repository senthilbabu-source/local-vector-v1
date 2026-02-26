// ---------------------------------------------------------------------------
// PageAuditCardWrapper — Sprint 58B + Sprint 70 + Sprint 71: Binds server actions
//
// Sprint 71: Updated prop types for nullable dimension scores
// ---------------------------------------------------------------------------

'use client';

import PageAuditCard from './PageAuditCard';
import { reauditPage } from '../actions';
import { generateSchemaFixes } from '../schema-actions';
import type { PageAuditRecommendation } from '@/lib/page-audit/auditor';

interface Props {
  pageUrl: string;
  pageType: string;
  overallScore: number;
  answerFirstScore: number | null;
  schemaCompletenessScore: number | null;
  faqSchemaPresent: boolean;
  faqSchemaScore: number | null;
  keywordDensityScore: number | null;
  entityClarityScore: number | null;
  recommendations: PageAuditRecommendation[];
  lastAuditedAt: string;
}

export default function PageAuditCardWrapper(props: Props) {
  return (
    <PageAuditCard
      {...props}
      onReaudit={reauditPage}
      onGenerateSchema={generateSchemaFixes}
    />
  );
}
