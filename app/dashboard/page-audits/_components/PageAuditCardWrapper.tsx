// ---------------------------------------------------------------------------
// PageAuditCardWrapper — Sprint 58B + Sprint 70: Binds server actions
// ---------------------------------------------------------------------------

'use client';

import PageAuditCard from './PageAuditCard';
import { reauditPage } from '../actions';
import { generateSchemaFixes } from '../schema-actions';

interface Props {
  pageUrl: string;
  pageType: string;
  overallScore: number;
  answerFirstScore: number;
  schemaCompletenessScore: number;
  faqSchemaPresent: boolean;
  faqSchemaScore: number;
  keywordDensityScore: number;
  entityClarityScore: number;
  recommendations: { issue: string; fix: string; impactPoints: number }[];
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
