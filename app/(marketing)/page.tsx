// ---------------------------------------------------------------------------
// Landing Page — LocalVector.ai (Light Theme Redesign)
//
// Website Content Strategy v2.0 — Phase 1: Homepage
// 11 sections, code-split via next/dynamic.
// HeroSection statically imported (above fold).
// Marketing layout wrapper at app/(marketing)/layout.tsx provides fonts.
//
// Old dark sections preserved in app/_sections/ for reference.
// ---------------------------------------------------------------------------

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import HeroSection from './_sections/HeroSection';

const ScrollReveal = dynamic(() => import('./_components/ScrollReveal'));
const RevenueLeak = dynamic(() => import('./_sections/RevenueLeak'));
const SelfAudit = dynamic(() => import('./_sections/SelfAudit'));
const EnginesSection = dynamic(() => import('./_sections/EnginesSection'));
const ComparisonSection = dynamic(() => import('./_sections/ComparisonSection'));
const CaseStudy = dynamic(() => import('./_sections/CaseStudy'));
const DashboardPreview = dynamic(() => import('./_sections/DashboardPreview'));
const PricingTeaser = dynamic(() => import('./_sections/PricingTeaser'));
const FaqSection = dynamic(() => import('./_sections/FaqSection'));
const CtaFooter = dynamic(() => import('./_sections/CtaFooter'));

export const metadata: Metadata = {
  title: 'LocalVector.ai — AI Hallucination Detection for Local Businesses',
  description:
    'ChatGPT, Gemini, and Perplexity are answering questions about your business right now. ' +
    'Is the information correct? LocalVector detects AI hallucinations, fixes wrong answers, ' +
    'and tracks your AI visibility automatically.',
  openGraph: {
    title: 'Is AI Lying About Your Business? Find Out Free in 8 Seconds.',
    images: ['/og-image.png'],
  },
  keywords: [
    'ai hallucination local business',
    'ai visibility for local business',
    'chatgpt wrong business hours',
    'ai seo for local business',
    'answer engine optimization',
    'geo for local business',
    'ai hallucination restaurant',
    'ai hallucination dentist',
    'ai hallucination salon',
  ],
};

export default function RootPage() {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <HeroSection />
      <ScrollReveal>
        <RevenueLeak />
        <hr className="m-section-divider" />
        <SelfAudit />
        <EnginesSection />
        <hr className="m-section-divider" />
        <ComparisonSection />
        <CaseStudy />
        <hr className="m-section-divider" />
        <DashboardPreview />
        <PricingTeaser />
        <FaqSection />
        <CtaFooter />
      </ScrollReveal>
    </main>
  );
}
