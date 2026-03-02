// ---------------------------------------------------------------------------
// lib/onboarding/types.ts — Onboarding Types (Sprint 117)
//
// Per-org onboarding checklist types. Steps are org-scoped — any member
// completing a step marks it done for all members.
// ---------------------------------------------------------------------------

export type OnboardingStepId =
  | 'business_profile'
  | 'first_scan'
  | 'first_draft'
  | 'invite_teammate'
  | 'connect_domain';

export interface OnboardingStep {
  id: OnboardingStepId;
  label: string;
  description: string;
  action_label: string;
  action_url: string;
  /** Can this step be auto-completed by the system (vs requires user action)? */
  auto_completable: boolean;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'business_profile',
    label: 'Complete your business profile',
    description: 'Add your business name, industry, and first location.',
    action_label: 'Set up profile',
    action_url: '/dashboard/settings/profile',
    auto_completable: false,
  },
  {
    id: 'first_scan',
    label: 'Run your first AI visibility scan',
    description: 'See how AI models answer questions about your business.',
    action_label: 'View your score',
    action_url: '/dashboard/visibility',
    auto_completable: true,
  },
  {
    id: 'first_draft',
    label: 'Review your first content recommendation',
    description: 'LocalVector has generated content to improve your AI presence.',
    action_label: 'Review drafts',
    action_url: '/dashboard/content',
    auto_completable: true,
  },
  {
    id: 'invite_teammate',
    label: 'Invite a teammate',
    description: 'Collaborate with your team on AI visibility strategy.',
    action_label: 'Invite team',
    action_url: '/dashboard/team',
    auto_completable: false,
  },
  {
    id: 'connect_domain',
    label: 'Connect your custom domain',
    description: 'White-label LocalVector under your own brand.',
    action_label: 'Set up domain',
    action_url: '/dashboard/settings/domain',
    auto_completable: false,
  },
];

export interface OnboardingStepState {
  step_id: OnboardingStepId;
  completed: boolean;
  completed_at: string | null;
  completed_by_user_id: string | null;
}

export interface OnboardingState {
  org_id: string;
  steps: OnboardingStepState[];
  total_steps: number;
  completed_steps: number;
  /** All 5 steps done */
  is_complete: boolean;
  /** true if < 2 steps complete AND org < 7 days old */
  show_interstitial: boolean;
  /** true if first_scan step is complete */
  has_real_data: boolean;
}
