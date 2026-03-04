// ---------------------------------------------------------------------------
// GuidedTour — Sprint 62B: Post-Onboarding Guided Tour
//
// Custom tooltip approach. No react-joyride. No framer-motion.
// Uses data-testid attributes on sidebar nav items as anchor targets.
// localStorage key: lv_tour_completed
//
// Constraint: must not block page interaction (pointer-events-none overlay).
// Only renders on lg+ screens (sidebar hidden on mobile).
// ---------------------------------------------------------------------------

'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'lv_tour_completed';

interface TourStep {
  targetTestId: string;
  title: string;
  description: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    targetTestId: 'nav-dashboard',
    title: 'Your Dashboard',
    description:
      'See your AI health, recent issues, and what needs attention at a glance.',
  },
  {
    targetTestId: 'nav-alerts',
    title: 'AI Mistakes',
    description:
      'When AI apps get facts wrong about your business, we catch it here.',
  },
  {
    targetTestId: 'nav-menu',
    title: 'Your AI-Ready Menu',
    description:
      'Upload your menu and we make it readable by ChatGPT, Google, and other AI apps.',
  },
  {
    targetTestId: 'nav-compete',
    title: 'You vs Competitors',
    description:
      'See how competitors are showing up in AI answers compared to you.',
  },
  {
    targetTestId: 'nav-content',
    title: 'Posts Ready for Review',
    description:
      'We draft posts to improve how AI talks about your business. Review and publish them here.',
  },
  // Sprint E — 3 new tour steps (M2)
  {
    targetTestId: 'nav-share-of-voice',
    title: 'How Often AI Mentions You',
    description:
      'Track how often AI apps mention your business vs. your competitors when customers search.',
  },
  {
    targetTestId: 'nav-citations',
    title: 'Your Platforms',
    description:
      'These are the websites that teach AI about your business. More quality listings = better AI answers.',
  },
  {
    targetTestId: 'nav-revenue-impact',
    title: 'What This Costs You',
    description:
      'See how much money you might be losing because AI is giving customers wrong information.',
  },
];

export default function GuidedTour() {
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const [isLargeScreen, setIsLargeScreen] = useState(false);

  // Check screen size — only show tour on lg+ screens where sidebar is visible
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsLargeScreen(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsLargeScreen(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Check localStorage on mount — only start tour on first visit
  useEffect(() => {
    if (typeof window === 'undefined' || !isLargeScreen) return;
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // Delay to ensure sidebar has rendered
      const timer = setTimeout(() => setCurrentStep(0), 800);
      return () => clearTimeout(timer);
    }
  }, [isLargeScreen]);

  // Position tooltip relative to target element
  const positionTooltip = useCallback((stepIndex: number) => {
    const step = TOUR_STEPS[stepIndex];
    if (!step) return;
    const el = document.querySelector(`[data-testid="${step.targetTestId}"]`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setTooltipPos({
      top: rect.top + rect.height / 2 - 40,
      left: rect.right + 16,
    });
  }, []);

  useEffect(() => {
    if (currentStep === null) return;
    positionTooltip(currentStep);
    const handler = () => positionTooltip(currentStep);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [currentStep, positionTooltip]);

  // Highlight the current target element
  useEffect(() => {
    if (currentStep === null) return;
    const step = TOUR_STEPS[currentStep];
    if (!step) return;
    const el = document.querySelector(`[data-testid="${step.targetTestId}"]`);
    if (el) {
      el.classList.add(
        'ring-2',
        'ring-signal-green',
        'ring-offset-2',
        'ring-offset-surface-dark',
        'rounded-lg',
        'z-40',
        'relative',
      );
    }
    return () => {
      if (el) {
        el.classList.remove(
          'ring-2',
          'ring-signal-green',
          'ring-offset-2',
          'ring-offset-surface-dark',
          'rounded-lg',
          'z-40',
          'relative',
        );
      }
    };
  }, [currentStep]);

  function handleNext() {
    if (currentStep === null) return;
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleDismiss();
    }
  }

  function handleDismiss() {
    setCurrentStep(null);
    localStorage.setItem(STORAGE_KEY, 'true');
  }

  if (currentStep === null || !isLargeScreen) return null;

  const step = TOUR_STEPS[currentStep];
  if (!step) return null;

  const isLast = currentStep === TOUR_STEPS.length - 1;

  return (
    <>
      {/* Overlay — pointer-events-none so it does not block interaction */}
      <div className="fixed inset-0 z-30 bg-black/40 pointer-events-none" />

      {/* Tooltip */}
      <div
        className="fixed z-50 w-72 rounded-xl bg-surface-dark border border-white/10 p-4 shadow-2xl"
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
      >
        {/* Step indicator */}
        <p className="text-xs text-slate-400 mb-1.5">
          Step {currentStep + 1} of {TOUR_STEPS.length}
        </p>
        <h3 className="text-sm font-semibold text-white mb-1">{step.title}</h3>
        <p className="text-xs text-slate-400 leading-relaxed mb-4">
          {step.description}
        </p>

        <div className="flex items-center justify-between">
          <button
            onClick={handleDismiss}
            className="text-xs text-slate-400 hover:text-white transition"
          >
            Skip tour
          </button>
          <button
            onClick={handleNext}
            className="rounded-lg bg-signal-green px-3 py-1.5 text-xs font-semibold text-deep-navy hover:bg-signal-green/90 transition"
          >
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>

        {/* Arrow pointing left toward the sidebar item */}
        <div className="absolute -left-2 top-10 h-3 w-3 rotate-45 bg-surface-dark border-l border-b border-white/10" />
      </div>
    </>
  );
}
