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
      title="AI Health Score"
      what="A simple 0–100 score showing how well AI apps represent your business right now."
      how="Based on how often AI mentions you (40%), how accurate the info is (40%), and how complete your business details are (20%)."
      action="Fix the mistakes AI is making about your business to raise this score."
    />
  ),

  aiVisibility: (
    <TooltipBody
      title="How Often AI Mentions You"
      what="When customers ask AI for restaurant recommendations, how often does your business show up?"
      how="We check popular AI apps like ChatGPT, Google, and Perplexity to see if they mention you."
      action="Get listed on more platforms and keep your info up to date to appear more often."
    />
  ),

  openAlerts: (
    <TooltipBody
      title="Things AI Gets Wrong"
      what="These are things AI apps like ChatGPT or Google are getting wrong about your business — wrong hours, wrong address, wrong prices."
      how="Each item is a specific mistake we've confirmed AI is telling your customers."
      action="Click any mistake to see what's wrong and how to fix it."
    />
  ),

  interceptCount: (
    <TooltipBody
      title="Competitor Checks"
      what="How many times we've compared what AI says about businesses like yours."
      how="Each check looks at what one AI app says when a customer searches for your type of business."
      action="Add more search terms in Settings to get a fuller picture."
    />
  ),

  shareOfVoice: (
    <TooltipBody
      title="Your AI Mentions"
      what="Out of all the times customers ask AI about your type of business, how often do they mention you?"
      how="We count how often you come up vs. your competitors across AI apps."
      action="Fix AI mistakes and get listed on more platforms to get mentioned more often."
    />
  ),

  hallucinationsByModel: (
    <TooltipBody
      title="Mistakes by AI App"
      what="Which AI apps are getting the most things wrong about your business."
      how="Each bar shows how many mistakes that AI app is currently making."
      action="Focus on fixing mistakes from the AI apps your customers use most."
    />
  ),

  visibilityComponent: (
    <TooltipBody
      title="How Often You're Mentioned"
      what="How often AI includes your business when customers search for places like yours."
      how="This makes up 40% of your overall AI Health Score."
      action="Get listed on more platforms to appear in more AI answers."
    />
  ),

  accuracyComponent: (
    <TooltipBody
      title="How Accurate Your Info Is"
      what="When AI does mention your business, is the information correct? Hours, address, phone, menu — all the basics."
      how="This makes up 40% of your AI Health Score. Each mistake lowers it."
      action="Fix the mistakes listed in AI Mistakes to improve this score."
    />
  ),

  structureComponent: (
    <TooltipBody
      title="Your Website Data"
      what="How well your website is set up so AI apps can read and understand your business info."
      how="This makes up 10% of your AI Health Score."
      action="Use the Menu tool to create an AI-readable version of your offerings."
    />
  ),

  freshnessComponent: (
    <TooltipBody
      title="How Up-to-Date Your Info Is"
      what="How recently AI apps have checked and updated what they know about your business."
      how="This makes up 10% of your AI Health Score."
      action="Post new content regularly and keep your Google Business Profile updated."
    />
  ),

} as const;

export type TooltipKey = keyof typeof TOOLTIP_CONTENT;
