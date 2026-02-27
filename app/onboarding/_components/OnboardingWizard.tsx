'use client';

// ---------------------------------------------------------------------------
// OnboardingWizard — Sprint 91
//
// Main wizard client component managing WizardState across 5 steps.
// Renders the appropriate step component based on current step index.
// Pure React state transitions — no URL navigation between steps.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import type { MappedLocationData } from '@/lib/gbp/gbp-data-mapper';
import type { HoursData } from '@/lib/types/ground-truth';
import type { PrimaryLocation } from '../page';
import type { TargetQueryRow } from '../actions';
import WizardProgress, { type WizardStep } from './WizardProgress';
import GBPImportInterstitial from './GBPImportInterstitial';
import TruthCalibrationForm from './TruthCalibrationForm';
import Step3Competitors from './Step3Competitors';
import Step4SOVQueries from './Step4SOVQueries';
import Step5Launch from './Step5Launch';

// ---------------------------------------------------------------------------
// GBP → TruthCalibrationForm amenity key mapping
// ---------------------------------------------------------------------------

const GBP_AMENITY_MAP: Record<string, string> = {
  outdoor_seating: 'has_outdoor_seating',
  alcohol: 'serves_alcohol',
  bar: 'serves_alcohol',
  reservations: 'takes_reservations',
  live_music: 'has_live_music',
};

function mapGBPAmenities(
  gbpAmenities: Record<string, boolean> | undefined,
): Partial<Record<string, boolean>> | null {
  if (!gbpAmenities) return null;
  const mapped: Record<string, boolean> = {};
  for (const [gbpKey, value] of Object.entries(gbpAmenities)) {
    const formKey = GBP_AMENITY_MAP[gbpKey];
    if (formKey && value) {
      mapped[formKey] = true;
    }
  }
  return Object.keys(mapped).length > 0 ? mapped : null;
}

// ---------------------------------------------------------------------------
// Wizard state
// ---------------------------------------------------------------------------

interface WizardState {
  step: WizardStep;
  businessSource: 'gbp' | 'manual' | null;
  gbpImported: boolean;
  mappedData: MappedLocationData | null;
}

// ---------------------------------------------------------------------------
// Props from server component
// ---------------------------------------------------------------------------

export interface OnboardingWizardProps {
  location: PrimaryLocation;
  hasGBPConnection: boolean;
  initialQueries: TargetQueryRow[];
  toastMessage: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OnboardingWizard({
  location,
  hasGBPConnection,
  initialQueries,
  toastMessage,
}: OnboardingWizardProps) {
  const [state, setState] = useState<WizardState>({
    step: 1,
    businessSource: null,
    gbpImported: false,
    mappedData: null,
  });

  const completedSteps: WizardStep[] = [];
  for (let i = 1; i < state.step; i++) {
    completedSteps.push(i as WizardStep);
  }

  function goToStep(step: WizardStep) {
    setState((prev) => ({ ...prev, step }));
  }

  // ── Step 1 handlers ────────────────────────────────────────────────────

  function handleGBPImportSuccess(mapped: MappedLocationData) {
    setState((prev) => ({
      ...prev,
      step: 2,
      businessSource: 'gbp',
      gbpImported: true,
      mappedData: mapped,
    }));
  }

  function handleSkipToManual() {
    setState((prev) => ({
      ...prev,
      step: 2,
      businessSource: 'manual',
      gbpImported: false,
      mappedData: null,
    }));
  }

  // ── Step 2 handler ─────────────────────────────────────────────────────

  function handleStep2Complete() {
    goToStep(3);
  }

  // ── Step 3 handler ─────────────────────────────────────────────────────

  function handleStep3Complete() {
    goToStep(4);
  }

  // ── Step 4 handler ─────────────────────────────────────────────────────

  function handleStep4Complete() {
    goToStep(5);
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-midnight-slate flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Toast message from GBP flow errors */}
        {toastMessage && state.step === 1 && (
          <div className="mb-6 rounded-lg border border-alert-amber/30 bg-alert-amber/10 px-4 py-3 text-sm text-alert-amber">
            {toastMessage}
          </div>
        )}

        {/* Header */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <img src="/logo.svg" alt="LocalVector" className="h-9 w-9" />
            <span className="text-lg font-semibold text-white tracking-tight">
              LocalVector<span className="text-signal-green">.ai</span>
            </span>
          </div>
        </div>

        {/* Progress indicator */}
        <WizardProgress
          currentStep={state.step}
          completedSteps={completedSteps}
        />

        {/* Step content */}
        <div className="rounded-2xl bg-surface-dark border border-white/5 p-6">
          {/* ── Step 1: Business Info ─────────────────────────────────── */}
          {state.step === 1 && (
            <div>
              {hasGBPConnection ? (
                <div>
                  <h2 className="text-base font-semibold text-white tracking-tight mb-1">
                    Import Your Business Data
                  </h2>
                  <p className="text-xs text-slate-400 mb-4">
                    Your Google Business Profile is connected. Import your hours,
                    address, and amenities automatically.
                  </p>
                  <GBPImportInterstitial
                    onImportSuccess={handleGBPImportSuccess}
                    onSkipToManual={handleSkipToManual}
                  />
                </div>
              ) : (
                <div>
                  <h2 className="text-base font-semibold text-white tracking-tight mb-1">
                    Tell us about your business
                  </h2>
                  <p className="text-xs text-slate-400 mb-4">
                    This sets the baseline the Fear Engine uses to catch
                    hallucinations.
                  </p>
                  <div data-testid="step1-manual-form" className="space-y-4">
                    <p className="text-sm text-slate-300">
                      We&apos;ll collect your business details in the next steps.
                    </p>
                    <button
                      data-testid="step1-next-btn"
                      type="button"
                      onClick={handleSkipToManual}
                      className="w-full rounded-lg bg-signal-green px-4 py-2.5 text-sm font-semibold text-deep-navy hover:brightness-110 transition"
                    >
                      Get Started
                    </button>
                    <a
                      href="/onboarding/connect"
                      className="block text-center text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      Have a Google Business Profile? Connect it first &rarr;
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Hours & Amenities ─────────────────────────────── */}
          {state.step === 2 && (
            <TruthCalibrationForm
              location={location}
              onSubmitSuccess={handleStep2Complete}
              prefillHours={state.mappedData?.hours_data as HoursData | undefined ?? null}
              prefillAmenities={mapGBPAmenities(state.mappedData?.amenities)}
              showPrefillBanner={state.gbpImported}
            />
          )}

          {/* ── Step 3: Competitors ───────────────────────────────────── */}
          {state.step === 3 && (
            <Step3Competitors
              onComplete={handleStep3Complete}
              onBack={() => goToStep(2)}
            />
          )}

          {/* ── Step 4: SOV Queries ───────────────────────────────────── */}
          {state.step === 4 && (
            <Step4SOVQueries
              initialQueries={initialQueries}
              onComplete={handleStep4Complete}
              onBack={() => goToStep(3)}
            />
          )}

          {/* ── Step 5: Launch ────────────────────────────────────────── */}
          {state.step === 5 && <Step5Launch />}
        </div>
      </div>
    </div>
  );
}
