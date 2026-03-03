// ---------------------------------------------------------------------------
// lib/services/medical-faq-templates.ts — Medical FAQ Templates (Sprint 127)
//
// 15 medical/dental FAQ templates with placeholder substitution.
// Used by Sprint 128's dynamic FAQ generator when isMedicalCategory()=true.
//
// PURE FUNCTIONS — no DB, no fetch, no side effects.
// AI_RULES §161
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FAQTemplate {
  id: string;
  category:
    | 'insurance'
    | 'appointments'
    | 'procedures'
    | 'telehealth'
    | 'practice';
  question: string;
  answerTemplate: string;
  requiredFields: string[];
}

export interface FAQRenderData {
  businessName: string;
  city: string;
  phone?: string | null;
  insuranceList?: string;
  hoursString?: string;
  specialty?: string;
}

// ---------------------------------------------------------------------------
// Templates — 15 total
// ---------------------------------------------------------------------------

export const MEDICAL_FAQ_TEMPLATES: FAQTemplate[] = [
  // ── Insurance (3) ──────────────────────────────────────────────────────
  {
    id: 'med-faq-001',
    category: 'insurance',
    question: 'Does {businessName} accept my insurance?',
    answerTemplate:
      '{businessName} in {city} accepts {insuranceList}. Contact us to verify your specific plan.',
    requiredFields: ['insurance_types'],
  },
  {
    id: 'med-faq-002',
    category: 'insurance',
    question: 'What payment options does {businessName} offer?',
    answerTemplate:
      '{businessName} accepts insurance plans including {insuranceList}, plus cash and credit card payments.',
    requiredFields: ['insurance_types'],
  },
  {
    id: 'med-faq-003',
    category: 'insurance',
    question: 'Does {businessName} offer payment plans?',
    answerTemplate:
      'Contact {businessName} at {phone} to discuss payment plan options and financing for your care.',
    requiredFields: ['phone'],
  },

  // ── Appointments (3) ───────────────────────────────────────────────────
  {
    id: 'med-faq-004',
    category: 'appointments',
    question: 'Is {businessName} accepting new patients?',
    answerTemplate:
      'Yes, {businessName} is currently accepting new patients in {city}. Call {phone} to schedule your first appointment.',
    requiredFields: ['accepting_new_patients', 'phone'],
  },
  {
    id: 'med-faq-005',
    category: 'appointments',
    question: 'How do I schedule an appointment at {businessName}?',
    answerTemplate:
      'Call {phone} or visit our website to book an appointment at {businessName} in {city}.',
    requiredFields: ['phone'],
  },
  {
    id: 'med-faq-006',
    category: 'appointments',
    question: 'What should I bring to my first visit at {businessName}?',
    answerTemplate:
      'Please bring a valid photo ID, your insurance card, a list of current medications, and any relevant medical records to your first visit at {businessName}.',
    requiredFields: [],
  },

  // ── Telehealth (2) ─────────────────────────────────────────────────────
  {
    id: 'med-faq-007',
    category: 'telehealth',
    question: 'Does {businessName} offer telehealth visits?',
    answerTemplate:
      '{businessName} in {city} offers telehealth and virtual appointments. Contact us at {phone} to book a virtual visit.',
    requiredFields: ['telehealth_available', 'phone'],
  },
  {
    id: 'med-faq-008',
    category: 'telehealth',
    question: 'How do virtual appointments work at {businessName}?',
    answerTemplate:
      'Virtual appointments at {businessName} use a secure video platform. After scheduling, you will receive a link to join your appointment from home.',
    requiredFields: ['telehealth_available'],
  },

  // ── Procedures (3) ─────────────────────────────────────────────────────
  {
    id: 'med-faq-009',
    category: 'procedures',
    question: 'What services does {businessName} offer?',
    answerTemplate:
      '{businessName} in {city} offers a range of {specialty} services. Call {phone} for details on specific procedures.',
    requiredFields: ['specialty_tags', 'phone'],
  },
  {
    id: 'med-faq-010',
    category: 'procedures',
    question: 'Does {businessName} handle emergencies?',
    answerTemplate:
      'For dental or medical emergencies, call {businessName} at {phone}. For life-threatening emergencies, call 911.',
    requiredFields: ['phone'],
  },
  {
    id: 'med-faq-011',
    category: 'procedures',
    question: 'Do I need a referral to see {businessName}?',
    answerTemplate:
      'Many services at {businessName} do not require a referral. Contact us at {phone} to confirm for your specific needs.',
    requiredFields: ['phone'],
  },

  // ── Practice (4) ───────────────────────────────────────────────────────
  {
    id: 'med-faq-012',
    category: 'practice',
    question: "What are {businessName}'s hours?",
    answerTemplate:
      '{businessName} in {city} is open {hoursString}. Call {phone} for holiday hours.',
    requiredFields: ['hours_data', 'phone'],
  },
  {
    id: 'med-faq-013',
    category: 'practice',
    question: 'Where is {businessName} located?',
    answerTemplate:
      '{businessName} is located in {city}. Visit our website or call {phone} for directions and parking information.',
    requiredFields: ['phone'],
  },
  {
    id: 'med-faq-014',
    category: 'practice',
    question: 'Is there parking at {businessName}?',
    answerTemplate:
      '{businessName} in {city} has convenient parking available for patients. Contact us at {phone} for details.',
    requiredFields: ['phone'],
  },
  {
    id: 'med-faq-015',
    category: 'practice',
    question: 'What languages are spoken at {businessName}?',
    answerTemplate:
      'Contact {businessName} at {phone} to learn about language services and interpreter availability.',
    requiredFields: ['phone'],
  },
];

// ---------------------------------------------------------------------------
// Filtering — match templates to available data
// ---------------------------------------------------------------------------

/**
 * Returns templates whose requiredFields are all present and non-empty
 * in the provided location data.
 */
export function getApplicableTemplates(
  templates: FAQTemplate[],
  locationData: Record<string, unknown>,
): FAQTemplate[] {
  return templates.filter((t) =>
    t.requiredFields.every((field) => {
      const val = locationData[field];
      if (val === null || val === undefined) return false;
      if (val === false) return false; // accepting_new_patients=false means "not accepting"
      if (Array.isArray(val) && val.length === 0) return false;
      return true;
    }),
  );
}

// ---------------------------------------------------------------------------
// Rendering — placeholder substitution
// ---------------------------------------------------------------------------

/**
 * Substitutes placeholders in a template with actual data.
 * Falls back to sensible defaults for missing optional fields.
 */
export function renderFAQTemplate(
  template: FAQTemplate,
  data: FAQRenderData,
): { question: string; answer: string } | null {
  try {
    const replacePlaceholders = (text: string): string =>
      text
        .replace(/\{businessName\}/g, data.businessName)
        .replace(/\{city\}/g, data.city)
        .replace(/\{phone\}/g, data.phone ?? 'us')
        .replace(
          /\{insuranceList\}/g,
          data.insuranceList ?? 'most major insurance plans',
        )
        .replace(
          /\{hoursString\}/g,
          data.hoursString ?? 'during regular business hours',
        )
        .replace(/\{specialty\}/g, data.specialty ?? 'healthcare');

    return {
      question: replacePlaceholders(template.question),
      answer: replacePlaceholders(template.answerTemplate),
    };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'medical-faq-templates', sprint: '127' },
    });
    return null;
  }
}
