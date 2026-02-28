// ---------------------------------------------------------------------------
// lib/tooltip-content.tsx — Sprint B (H1)
//
// All tooltip text in one place. Prevents inline copy that drifts across
// components. Each entry has: what it is, how it's calculated, and what to do.
//
// Content reviewed for accuracy against the service files that compute
// each metric. Do not change without verifying the underlying logic.
// ---------------------------------------------------------------------------

import React from 'react';

interface TooltipDef {
  title: string;
  what: string;
  how: string;
  action: string;
}

function TooltipBody({ title, what, how, action }: TooltipDef) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-white">{title}</p>
      <p className="text-xs text-slate-300 leading-relaxed">{what}</p>
      <p className="text-xs text-slate-400 leading-relaxed">
        <span className="font-medium text-slate-300">How:</span> {how}
      </p>
      <p className="text-xs text-slate-400 leading-relaxed">
        <span className="font-medium text-signal-green">Action:</span> {action}
      </p>
    </div>
  );
}

export const TOOLTIP_CONTENT = {

  realityScore: (
    <TooltipBody
      title="Reality Score"
      what="A 0-100 measure of how accurately AI models represent your business right now."
      how="Weighted average: Visibility (40%) + Accuracy (40%) + Data Health (20%)."
      action="Fix open hallucination alerts to improve your Accuracy score."
    />
  ),

  aiVisibility: (
    <TooltipBody
      title="AI Visibility"
      what="How often your business appears in AI-generated answers to local search queries."
      how="Percent of monitored queries where at least one AI model mentions your business."
      action="Add more structured data and citation sources to increase mentions."
    />
  ),

  openAlerts: (
    <TooltipBody
      title="Open Alerts"
      what="Confirmed hallucinations — cases where an AI model said something factually wrong about your business."
      how="Each alert is a distinct wrong fact verified across multiple query runs."
      action="Generate a correction brief and distribute the correct info to citation sources."
    />
  ),

  interceptCount: (
    <TooltipBody
      title="Intercept Analyses"
      what="The number of times we've analyzed what AI models say about searches for businesses like yours."
      how="Each intercept is one AI model responding to one of your monitored query templates."
      action="Upgrade your query list in Settings to increase coverage."
    />
  ),

  shareOfVoice: (
    <TooltipBody
      title="Share of Voice"
      what="Your business's percentage of AI mentions compared to competitors in your category."
      how="Count of queries mentioning you / total monitored queries x 100."
      action="Outperform competitors by fixing hallucinations and adding fresh citation sources."
    />
  ),

  hallucinationsByModel: (
    <TooltipBody
      title="Hallucinations by Model"
      what="Which AI models are generating incorrect information about your business."
      how="Each bar shows hallucination counts per AI model."
      action="Models with the most hallucinations are your highest-priority correction targets."
    />
  ),

  visibilityComponent: (
    <TooltipBody
      title="Visibility"
      what="How often AI includes your business in relevant local search results."
      how="40% of your overall Reality Score."
      action="Build more online citations and mentions to increase visibility."
    />
  ),

  accuracyComponent: (
    <TooltipBody
      title="Accuracy"
      what="How correctly AI models describe your business facts (hours, address, phone, services)."
      how="40% of your overall Reality Score. Reduced by each open hallucination."
      action="Resolve open hallucination alerts to directly improve this score."
    />
  ),

  structureComponent: (
    <TooltipBody
      title="Structure"
      what="How complete your business's schema markup and structured data is."
      how="10% of your overall Reality Score."
      action="Generate and publish your business schema via the Magic Menu."
    />
  ),

  freshnessComponent: (
    <TooltipBody
      title="Freshness"
      what="How recently AI models have updated their knowledge about your business."
      how="10% of your overall Reality Score."
      action="Publish fresh content regularly and update your Google Business Profile."
    />
  ),

} as const;

export type TooltipKey = keyof typeof TOOLTIP_CONTENT;
