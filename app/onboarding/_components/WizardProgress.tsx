'use client';

// ---------------------------------------------------------------------------
// WizardProgress — Sprint 91
//
// Accessible 5-step progress indicator for the onboarding wizard.
// Renders filled/active/inactive dots with step labels.
// ---------------------------------------------------------------------------

export type WizardStep = 1 | 2 | 3 | 4 | 5;

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Business',
  2: 'Hours',
  3: 'Competitors',
  4: 'Queries',
  5: 'Launch',
};

const ALL_STEPS: WizardStep[] = [1, 2, 3, 4, 5];

interface WizardProgressProps {
  currentStep: WizardStep;
  completedSteps: WizardStep[];
}

export default function WizardProgress({
  currentStep,
  completedSteps,
}: WizardProgressProps) {
  return (
    <div
      data-testid="wizard-progress"
      role="progressbar"
      aria-label="Onboarding progress"
      aria-valuenow={currentStep}
      aria-valuemin={1}
      aria-valuemax={5}
      className="mb-8"
    >
      {/* Step counter text */}
      <p className="text-xs text-slate-400 text-center mb-4">
        Step {currentStep} of 5
      </p>

      {/* Progress dots with connecting lines */}
      <div className="flex items-center justify-center gap-0">
        {ALL_STEPS.map((step, i) => {
          const isCompleted = completedSteps.includes(step);
          const isCurrent = currentStep === step;
          const isFuture = !isCompleted && !isCurrent;

          return (
            <div key={step} className="flex items-center">
              {/* Connecting line (before dot, except first) */}
              {i > 0 && (
                <div
                  className={[
                    'w-8 h-0.5 sm:w-12',
                    isCompleted || isCurrent
                      ? 'bg-signal-green'
                      : 'bg-slate-700',
                  ].join(' ')}
                />
              )}

              {/* Step dot + label */}
              <div className="flex flex-col items-center">
                <div
                  data-testid={`step-indicator-${step}`}
                  className={[
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                    isCurrent
                      ? 'bg-signal-green text-deep-navy'
                      : isCompleted
                        ? 'bg-signal-green/20 text-signal-green'
                        : 'bg-slate-800 text-slate-500',
                  ].join(' ')}
                >
                  {isCompleted ? (
                    <span aria-label={`Step ${step} completed`}>&#10003;</span>
                  ) : (
                    step
                  )}
                </div>
                <span
                  className={[
                    'mt-1.5 text-[10px] font-medium',
                    isCurrent
                      ? 'text-signal-green'
                      : isCompleted
                        ? 'text-signal-green/70'
                        : isFuture
                          ? 'text-slate-500'
                          : 'text-slate-400',
                  ].join(' ')}
                >
                  {STEP_LABELS[step]}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
