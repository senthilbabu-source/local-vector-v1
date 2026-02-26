// ---------------------------------------------------------------------------
// Landing Page — LocalVector.ai
//
// Code-split into sections (Sub-task D, Sprint 62).
// HeroSection is statically imported (above fold). Everything below is
// dynamically imported via next/dynamic for faster initial paint.
//
// Section files live in app/_sections/.
// Design system: docs/DESIGN-SYSTEM.md tokens, animations, hard rules.
// ---------------------------------------------------------------------------

import dynamic from 'next/dynamic';
import HeroSection from './_sections/HeroSection';

const ProblemSection = dynamic(() => import('./_sections/ProblemSection'));
const CompareSection = dynamic(() => import('./_sections/CompareSection'));
const EnginesSection = dynamic(() => import('./_sections/EnginesSection'));
const PricingSection = dynamic(() => import('./_sections/PricingSection'));

export default function RootPage() {
  return (
    <div style={{ fontFamily: 'var(--font-outfit), sans-serif' }}>
      <main className="min-h-screen text-slate-300 overflow-x-hidden">
        <HeroSection />
        <ProblemSection />
        <CompareSection />
        <EnginesSection />
        <PricingSection />
      </main>
    </div>
  );
}
