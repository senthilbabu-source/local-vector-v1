// ---------------------------------------------------------------------------
// lib/schema-generator/medical-procedure-types.ts — Medical Procedure Catalog (Sprint 127)
//
// Builds the `availableService` array for MedicalClinic/Physician/Dentist
// JSON-LD schemas. Extends Sprint E's medical-types.ts without modifying it.
//
// PURE FUNCTION — no DB, no fetch, no side effects.
// AI_RULES §161
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Dental procedure catalog — 8 categories
// ---------------------------------------------------------------------------

export const DENTAL_PROCEDURE_CATEGORIES: Record<string, string[]> = {
  Preventive: [
    'Dental Cleaning',
    'Oral Exam',
    'Fluoride Treatment',
    'Dental X-Rays',
    'Sealants',
  ],
  Restorative: [
    'Fillings',
    'Crowns',
    'Bridges',
    'Dental Implants',
    'Dentures',
  ],
  Orthodontics: [
    'Braces',
    'Invisalign',
    'Retainers',
    'Space Maintainers',
  ],
  Cosmetic: [
    'Teeth Whitening',
    'Veneers',
    'Dental Bonding',
    'Smile Makeover',
  ],
  'Oral Surgery': [
    'Tooth Extraction',
    'Wisdom Teeth Removal',
    'Bone Grafting',
  ],
  Periodontics: [
    'Deep Cleaning',
    'Gum Disease Treatment',
    'Gum Grafting',
  ],
  Endodontics: ['Root Canal', 'Apicoectomy'],
  Pediatric: [
    "Children's Dentistry",
    'Pediatric Cleanings',
    'Fluoride Varnish',
  ],
};

// ---------------------------------------------------------------------------
// Medical specialty catalog — 7 categories
// ---------------------------------------------------------------------------

export const MEDICAL_SPECIALTY_CATEGORIES: Record<string, string[]> = {
  'Primary Care': [
    'Annual Physical',
    'Sick Visits',
    'Preventive Care',
    'Vaccinations',
    'Lab Work',
  ],
  'Urgent Care': [
    'Injury Treatment',
    'Illness Treatment',
    'X-Rays',
    'Stitches',
  ],
  Cardiology: [
    'EKG',
    'Echocardiogram',
    'Stress Test',
    'Heart Disease Management',
  ],
  Dermatology: [
    'Skin Exam',
    'Acne Treatment',
    'Mole Removal',
    'Eczema Treatment',
  ],
  Orthopedics: [
    'Joint Injections',
    'Fracture Care',
    'Physical Therapy',
    'Sports Medicine',
  ],
  Pediatrics: [
    'Well-Child Visits',
    'Immunizations',
    'Growth Monitoring',
  ],
  "Women's Health": [
    'Annual Exam',
    'Prenatal Care',
    'Family Planning',
    'Menopause Management',
  ],
};

// ---------------------------------------------------------------------------
// Dental category detection keywords
// ---------------------------------------------------------------------------

const DENTAL_KEYWORDS = [
  'dental',
  'dentist',
  'orthodont',
  'periodon',
  'endodont',
  'cosmetic dent',
  'oral surgery',
  'pediatric dent',
];

// ---------------------------------------------------------------------------
// Builder — pure function
// ---------------------------------------------------------------------------

export interface MedicalServiceEntry {
  '@type': 'MedicalProcedure' | 'MedicalTherapy';
  name: string;
}

/**
 * Checks if a tag matches any category in a catalog (case-insensitive).
 */
function matchesCatalog(
  tag: string,
  catalog: Record<string, string[]>,
): boolean {
  const lower = tag.toLowerCase();
  return Object.keys(catalog).some(
    (cat) =>
      cat.toLowerCase() === lower ||
      lower.includes(cat.toLowerCase()) ||
      cat.toLowerCase().includes(lower),
  );
}

/**
 * Builds an `availableService` array for MedicalClinic/Physician/Dentist schemas.
 * Maps specialty tags to procedures from the catalog. Pure function.
 *
 * @param specialtyTags — from locations.specialty_tags
 * @returns Capped at 20 entries, deduplicated by name
 */
export function buildAvailableServices(
  specialtyTags: string[],
): MedicalServiceEntry[] {
  if (!specialtyTags || specialtyTags.length === 0) return [];

  // Determine catalog: dental if any tag matches dental keywords OR dental categories
  const isDental =
    specialtyTags.some((tag) =>
      DENTAL_KEYWORDS.some((kw) => tag.toLowerCase().includes(kw)),
    ) ||
    specialtyTags.some((tag) => matchesCatalog(tag, DENTAL_PROCEDURE_CATEGORIES));
  const catalog = isDental
    ? DENTAL_PROCEDURE_CATEGORIES
    : MEDICAL_SPECIALTY_CATEGORIES;

  const services: MedicalServiceEntry[] = [];

  for (const tag of specialtyTags) {
    const lowerTag = tag.toLowerCase();
    // Find matching category
    const category = Object.keys(catalog).find(
      (cat) =>
        cat.toLowerCase() === lowerTag ||
        lowerTag.includes(cat.toLowerCase()) ||
        cat.toLowerCase().includes(lowerTag),
    );
    if (category) {
      for (const proc of catalog[category].slice(0, 5)) {
        services.push({ '@type': 'MedicalProcedure', name: proc });
      }
    }
  }

  // Deduplicate by name
  const seen = new Set<string>();
  return services
    .filter((s) => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    })
    .slice(0, 20);
}
