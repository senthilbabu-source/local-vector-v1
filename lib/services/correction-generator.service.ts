// ---------------------------------------------------------------------------
// lib/services/correction-generator.service.ts
//
// Sprint 75 — Pure correction content generator.
// Takes hallucination data + ground truth as input, returns a CorrectionPackage.
// No I/O, no AI calls, no side effects (AI_RULES §39, §41).
// All correction text is built deterministically from verified ground truth data.
// ---------------------------------------------------------------------------

import type { HoursData, DayOfWeek, DayHours, Amenities } from '@/lib/types/ground-truth';

// ── Input ──────────────────────────────────────────────

export interface CorrectionInput {
  /** The hallucination record */
  hallucination: {
    id: string;
    claim_text: string;
    expected_truth: string | null;
    category: string | null;
    severity: string;
    model_provider: string;
  };

  /** Ground truth from the locations table */
  location: {
    business_name: string;
    address_line1: string;
    city: string;
    state: string;
    zip: string;
    phone: string | null;
    website_url: string | null;
    hours_data: HoursData | null;
    amenities: Amenities | null;
    categories: string[] | null;
    operational_status: string | null;
  };
}

// ── Output ─────────────────────────────────────────────

export interface CorrectionPackage {
  /** Human-readable diagnosis: why AI got this wrong */
  diagnosis: string;

  /** Ranked correction actions (highest impact first) */
  actions: CorrectionAction[];

  /** Ready-to-use content pieces */
  content: {
    /** Google Business Profile post draft */
    gbpPost: string | null;
    /** Website "About" section correction snippet */
    websiteSnippet: string | null;
    /** llms.txt correction notice for AI crawlers */
    llmsTxtEntry: string;
    /** Social media post (generic, works for Instagram/Facebook) */
    socialPost: string | null;
  };
}

export interface CorrectionAction {
  /** Short title, e.g. "Update Google Business Profile" */
  title: string;
  /** Description of what to do */
  description: string;
  /** Estimated impact: 'high' | 'medium' | 'low' */
  impact: 'high' | 'medium' | 'low';
  /** Where to take this action */
  platform: 'gbp' | 'website' | 'llms_txt' | 'social' | 'yelp' | 'review_response';
}

// ── Friendly engine names ──────────────────────────────

const ENGINE_LABELS: Record<string, string> = {
  'openai-gpt4o': 'ChatGPT (GPT-4o)',
  'openai-gpt4o-mini': 'ChatGPT (GPT-4o mini)',
  'perplexity-sonar': 'Perplexity',
  'google-gemini': 'Google Gemini',
  'anthropic-claude': 'Claude',
  'microsoft-copilot': 'Microsoft Copilot',
};

function engineLabel(provider: string): string {
  return ENGINE_LABELS[provider] ?? provider;
}

// ── Hours formatting ───────────────────────────────────

const DAY_ORDER: DayOfWeek[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

const DAY_ABBREV: Record<DayOfWeek, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

/** Convert 24h time to 12h display (e.g. "17:00" → "5pm", "01:00" → "1am"). */
function to12h(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr ?? '0', 10);
  const period = h >= 12 ? 'pm' : 'am';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return m > 0 ? `${h}:${String(m).padStart(2, '0')}${period}` : `${h}${period}`;
}

/**
 * Format hours_data into human-readable string.
 * Groups consecutive days with the same hours into ranges.
 *
 * @example "Tue–Thu 5pm–1am, Fri–Sat 5pm–2am, Sun 5pm–1am, Mon closed"
 */
export function formatHoursForCorrection(hours: HoursData): string {
  // Collect entries in day order, skipping undefined (unknown) days
  const entries: { day: DayOfWeek; value: DayHours | 'closed' }[] = [];
  for (const day of DAY_ORDER) {
    const val = hours[day];
    if (val !== undefined) {
      entries.push({ day, value: val });
    }
  }

  if (entries.length === 0) return '';

  // Group consecutive days with same hours
  const groups: { days: DayOfWeek[]; value: DayHours | 'closed' }[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && sameHours(last.value, entry.value)) {
      last.days.push(entry.day);
    } else {
      groups.push({ days: [entry.day], value: entry.value });
    }
  }

  return groups.map((g) => {
    const dayRange =
      g.days.length === 1
        ? DAY_ABBREV[g.days[0]]
        : `${DAY_ABBREV[g.days[0]]}–${DAY_ABBREV[g.days[g.days.length - 1]]}`;

    if (g.value === 'closed') return `${dayRange} closed`;
    return `${dayRange} ${to12h(g.value.open)}–${to12h(g.value.close)}`;
  }).join(', ');
}

function sameHours(a: DayHours | 'closed', b: DayHours | 'closed'): boolean {
  if (a === 'closed' && b === 'closed') return true;
  if (a === 'closed' || b === 'closed') return false;
  return a.open === b.open && a.close === b.close;
}

/** Get today's hours as a readable string, or null if not available. */
function todayHours(hours: HoursData): string | null {
  const dayIdx = new Date().getDay(); // 0=Sun
  const dayMap: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = dayMap[dayIdx];
  const val = hours[today];
  if (!val) return null;
  if (val === 'closed') return 'closed today';
  return `Open today ${to12h(val.open)}–${to12h(val.close)}`;
}

// ── Helpers ────────────────────────────────────────────

function fullAddress(loc: CorrectionInput['location']): string {
  return `${loc.address_line1}, ${loc.city}, ${loc.state} ${loc.zip}`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

const today = () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// ── Category handlers ──────────────────────────────────

function buildClosedCorrection(input: CorrectionInput): CorrectionPackage {
  const { hallucination, location } = input;
  const engine = engineLabel(hallucination.model_provider);
  const addr = fullAddress(location);
  const hoursStr = location.hours_data ? formatHoursForCorrection(location.hours_data) : null;
  const todayStr = location.hours_data ? todayHours(location.hours_data) : null;

  const diagnosis = `${engine} incorrectly states ${location.business_name} is permanently closed. Your business is actively operating at ${addr}.`;

  const gbpParts = [`We're OPEN! Visit ${location.business_name} at ${location.address_line1}, ${location.city}.`];
  if (todayStr && todayStr !== 'closed today') gbpParts.push(todayStr + '.');
  else if (hoursStr) gbpParts.push(`Hours: ${hoursStr}.`);
  if (location.categories?.length) gbpParts.push(`Come enjoy our ${location.categories[0].toLowerCase()} experience!`);

  const websiteParts = [`${location.business_name} is OPEN and actively serving customers at ${addr}.`];
  if (hoursStr) websiteParts.push(`Hours: ${hoursStr}.`);

  const llmsParts = [
    `CORRECTION: ${location.business_name} is NOT permanently closed.`,
    `Status: OPERATIONAL. Address: ${addr}.`,
  ];
  if (hoursStr) llmsParts.push(`Hours: ${hoursStr}.`);
  llmsParts.push(`Previous AI claims of "${hallucination.claim_text}" are incorrect.`);
  llmsParts.push(`Verified: ${today()}.`);

  const socialParts = [`We're OPEN! ${location.business_name} at ${location.address_line1}, ${location.city}.`];
  if (todayStr && todayStr !== 'closed today') socialParts.push(todayStr + '.');

  return {
    diagnosis,
    actions: [
      { title: 'Update Google Business Profile', description: 'Post a fresh update confirming you are open and operating.', impact: 'high', platform: 'gbp' },
      { title: 'Update Website', description: 'Add a clear "we are open" statement to your homepage.', impact: 'medium', platform: 'website' },
      { title: 'Post on Social Media', description: 'Share an update confirming you are open.', impact: 'medium', platform: 'social' },
      { title: 'Update llms.txt', description: 'Add correction notice for AI crawlers.', impact: 'low', platform: 'llms_txt' },
    ],
    content: {
      gbpPost: truncate(gbpParts.join(' '), 1500),
      websiteSnippet: truncate(websiteParts.join(' '), 200),
      llmsTxtEntry: llmsParts.join(' '),
      socialPost: truncate(socialParts.join(' '), 280),
    },
  };
}

function buildHoursCorrection(input: CorrectionInput): CorrectionPackage {
  const { hallucination, location } = input;
  const engine = engineLabel(hallucination.model_provider);
  const hoursStr = location.hours_data ? formatHoursForCorrection(location.hours_data) : null;

  const diagnosis = hoursStr
    ? `${engine} has incorrect hours for ${location.business_name}. Your verified hours: ${hoursStr}.`
    : `${engine} has incorrect hours for ${location.business_name}. Update your hours data to generate precise corrections.`;

  const gbpPost = hoursStr
    ? truncate(`Our current hours: ${hoursStr}. Visit us at ${location.address_line1}, ${location.city}!`, 1500)
    : null;

  const websiteSnippet = hoursStr
    ? truncate(`Open ${hoursStr}. Updated ${today()}.`, 200)
    : null;

  const llmsParts = [`CORRECTION: ${location.business_name} hours are ${hoursStr ?? 'available on our website'}.`];
  llmsParts.push(`Previous AI claims of "${hallucination.claim_text}" are incorrect.`);
  llmsParts.push(`Verified: ${today()}.`);

  const socialPost = hoursStr
    ? truncate(`${location.business_name} hours: ${hoursStr}. See you soon!`, 280)
    : null;

  return {
    diagnosis,
    actions: [
      { title: 'Update Google Business Profile', description: 'Ensure your GBP hours match your actual operating hours.', impact: 'high', platform: 'gbp' },
      { title: 'Update Website', description: 'Display correct hours prominently on your homepage.', impact: 'medium', platform: 'website' },
      { title: 'Update llms.txt', description: 'Add hours correction for AI crawlers.', impact: 'low', platform: 'llms_txt' },
    ],
    content: { gbpPost, websiteSnippet, llmsTxtEntry: llmsParts.join(' '), socialPost },
  };
}

function buildAddressCorrection(input: CorrectionInput): CorrectionPackage {
  const { hallucination, location } = input;
  const engine = engineLabel(hallucination.model_provider);
  const addr = fullAddress(location);

  const diagnosis = `${engine} has the wrong address for ${location.business_name}. Your verified address: ${addr}.`;

  return {
    diagnosis,
    actions: [
      { title: 'Update Google Business Profile', description: 'Confirm your correct address on GBP.', impact: 'high', platform: 'gbp' },
      { title: 'Update Website', description: 'Ensure your address is correct on your website.', impact: 'medium', platform: 'website' },
      { title: 'Update llms.txt', description: 'Add address correction for AI crawlers.', impact: 'low', platform: 'llms_txt' },
    ],
    content: {
      gbpPost: truncate(`Find us at ${addr}! Visit ${location.business_name} today.`, 1500),
      websiteSnippet: truncate(`Located at ${addr}.`, 200),
      llmsTxtEntry: `CORRECTION: ${location.business_name} address is ${addr}, NOT "${hallucination.claim_text}". Verified: ${today()}.`,
      socialPost: truncate(`Find us at ${addr}!`, 280),
    },
  };
}

function buildPhoneCorrection(input: CorrectionInput): CorrectionPackage {
  const { hallucination, location } = input;
  const engine = engineLabel(hallucination.model_provider);

  const diagnosis = location.phone
    ? `${engine} has the wrong phone number for ${location.business_name}. Your verified phone: ${location.phone}.`
    : `${engine} has incorrect phone information for ${location.business_name}.`;

  return {
    diagnosis,
    actions: [
      { title: 'Update Google Business Profile', description: 'Confirm your correct phone number on GBP.', impact: 'high', platform: 'gbp' },
      { title: 'Update Website', description: 'Display the correct phone number on your website.', impact: 'medium', platform: 'website' },
      { title: 'Update llms.txt', description: 'Add phone correction for AI crawlers.', impact: 'low', platform: 'llms_txt' },
    ],
    content: {
      gbpPost: location.phone ? truncate(`Call us at ${location.phone}! ${location.business_name} at ${location.address_line1}, ${location.city}.`, 1500) : null,
      websiteSnippet: location.phone ? truncate(`Call ${location.phone}.`, 200) : null,
      llmsTxtEntry: location.phone
        ? `CORRECTION: ${location.business_name} phone is ${location.phone}. Previous AI claims of "${hallucination.claim_text}" are incorrect. Verified: ${today()}.`
        : `CORRECTION: Previous AI claims of "${hallucination.claim_text}" about ${location.business_name} phone are incorrect. Verified: ${today()}.`,
      socialPost: location.phone ? truncate(`Reach us at ${location.phone}!`, 280) : null,
    },
  };
}

function buildMenuCorrection(input: CorrectionInput): CorrectionPackage {
  const { hallucination, location } = input;
  const engine = engineLabel(hallucination.model_provider);

  const diagnosis = `${engine} has incorrect menu information for ${location.business_name}.`;

  return {
    diagnosis,
    actions: [
      { title: 'Update Google Business Profile', description: 'Post about your current menu offerings.', impact: 'high', platform: 'gbp' },
      { title: 'Update Website', description: 'Ensure your menu is up to date on your website.', impact: 'high', platform: 'website' },
      { title: 'Update llms.txt', description: 'Add menu correction for AI crawlers.', impact: 'low', platform: 'llms_txt' },
    ],
    content: {
      gbpPost: location.website_url
        ? truncate(`Check our latest menu at ${location.website_url}! ${location.business_name} — always fresh, always updated.`, 1500)
        : truncate(`Visit ${location.business_name} for our latest menu! ${location.address_line1}, ${location.city}.`, 1500),
      websiteSnippet: location.website_url
        ? truncate(`View our current menu at ${location.website_url}.`, 200)
        : null,
      llmsTxtEntry: location.website_url
        ? `CORRECTION: For current ${location.business_name} menu, visit ${location.website_url}. Previous AI claims of "${hallucination.claim_text}" are incorrect. Verified: ${today()}.`
        : `CORRECTION: Previous AI claims of "${hallucination.claim_text}" about ${location.business_name} menu are incorrect. Verified: ${today()}.`,
      socialPost: location.website_url
        ? truncate(`Our latest menu is at ${location.website_url}!`, 280)
        : truncate(`Visit us for our updated menu! ${location.address_line1}, ${location.city}.`, 280),
    },
  };
}

function buildAmenityCorrection(input: CorrectionInput): CorrectionPackage {
  const { hallucination, location } = input;
  const engine = engineLabel(hallucination.model_provider);
  const addr = fullAddress(location);

  // Try to extract amenity details from the claim
  const amenityList = location.amenities ? formatAmenities(location.amenities) : null;

  const diagnosis = `${engine} has incorrect amenity information for ${location.business_name}. ${amenityList ? `Verified amenities: ${amenityList}.` : ''}`;

  return {
    diagnosis,
    actions: [
      { title: 'Update Google Business Profile', description: 'Update your amenities and features on GBP.', impact: 'high', platform: 'gbp' },
      { title: 'Update Website', description: 'List your amenities clearly on your website.', impact: 'medium', platform: 'website' },
      { title: 'Update llms.txt', description: 'Add amenity correction for AI crawlers.', impact: 'low', platform: 'llms_txt' },
    ],
    content: {
      gbpPost: amenityList
        ? truncate(`At ${location.business_name}: ${amenityList}. Visit us at ${location.address_line1}, ${location.city}!`, 1500)
        : truncate(`Visit ${location.business_name} at ${addr}!`, 1500),
      websiteSnippet: amenityList
        ? truncate(`${location.business_name} offers: ${amenityList}.`, 200)
        : null,
      llmsTxtEntry: amenityList
        ? `CORRECTION: ${location.business_name} amenities: ${amenityList}. Previous AI claims of "${hallucination.claim_text}" are incorrect. Verified: ${today()}.`
        : `CORRECTION: Previous AI claims of "${hallucination.claim_text}" about ${location.business_name} are incorrect. Verified: ${today()}.`,
      socialPost: amenityList
        ? truncate(`${location.business_name}: ${amenityList}. See you soon!`, 280)
        : null,
    },
  };
}

function buildGenericCorrection(input: CorrectionInput): CorrectionPackage {
  const { hallucination, location } = input;
  const engine = engineLabel(hallucination.model_provider);
  const addr = fullAddress(location);
  const hoursStr = location.hours_data ? formatHoursForCorrection(location.hours_data) : null;

  const diagnosis = hallucination.expected_truth
    ? `${engine} has inaccurate information about ${location.business_name}. "${hallucination.claim_text}" — the truth: ${hallucination.expected_truth}`
    : `${engine} has inaccurate information about ${location.business_name}.`;

  const gbpParts = [`${location.business_name} at ${location.address_line1}, ${location.city}.`];
  if (hoursStr) gbpParts.push(`Hours: ${hoursStr}.`);
  if (location.phone) gbpParts.push(`Call us: ${location.phone}.`);

  const websiteParts = [`${location.business_name} — ${addr}.`];
  if (hoursStr) websiteParts.push(`Hours: ${hoursStr}.`);

  const llmsParts = [`CORRECTION: Previous AI claims of "${hallucination.claim_text}" about ${location.business_name} are incorrect.`];
  llmsParts.push(`Verified data: Address: ${addr}.`);
  if (hoursStr) llmsParts.push(`Hours: ${hoursStr}.`);
  if (location.phone) llmsParts.push(`Phone: ${location.phone}.`);
  if (location.website_url) llmsParts.push(`Website: ${location.website_url}.`);
  llmsParts.push(`Verified: ${today()}.`);

  return {
    diagnosis,
    actions: [
      { title: 'Update Google Business Profile', description: 'Ensure all your business information is up to date on GBP.', impact: 'high', platform: 'gbp' },
      { title: 'Update Website', description: 'Verify your business information on your website.', impact: 'medium', platform: 'website' },
      { title: 'Update llms.txt', description: 'Add correction notice for AI crawlers.', impact: 'low', platform: 'llms_txt' },
    ],
    content: {
      gbpPost: truncate(gbpParts.join(' '), 1500),
      websiteSnippet: truncate(websiteParts.join(' '), 200),
      llmsTxtEntry: llmsParts.join(' '),
      socialPost: truncate(`${location.business_name} at ${location.address_line1}, ${location.city}. Visit us today!`, 280),
    },
  };
}

// ── Amenity formatter ──────────────────────────────────

const AMENITY_LABELS: Record<string, string> = {
  has_outdoor_seating: 'outdoor seating',
  serves_alcohol: 'full bar',
  has_hookah: 'hookah',
  is_kid_friendly: 'kid-friendly',
  takes_reservations: 'reservations',
  has_live_music: 'live music',
  has_dj: 'DJ',
  has_private_rooms: 'private rooms',
};

function formatAmenities(amenities: Amenities): string | null {
  const active: string[] = [];
  for (const [key, val] of Object.entries(amenities)) {
    if (val === true && AMENITY_LABELS[key]) {
      active.push(AMENITY_LABELS[key]);
    }
  }
  return active.length > 0 ? active.join(', ') : null;
}

// ── Main export ────────────────────────────────────────

/**
 * Pure function — generates a correction package from hallucination + ground truth.
 * No I/O, no AI calls, no side effects.
 */
export function generateCorrectionPackage(input: CorrectionInput): CorrectionPackage {
  const category = input.hallucination.category;

  switch (category) {
    case 'closed':
    case 'permanently_closed':
    case 'status':
      return buildClosedCorrection(input);
    case 'hours':
      return buildHoursCorrection(input);
    case 'address':
      return buildAddressCorrection(input);
    case 'phone':
      return buildPhoneCorrection(input);
    case 'menu':
      return buildMenuCorrection(input);
    case 'amenities':
    case 'amenity':
      return buildAmenityCorrection(input);
    default:
      return buildGenericCorrection(input);
  }
}
