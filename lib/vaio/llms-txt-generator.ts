// ---------------------------------------------------------------------------
// lib/vaio/llms-txt-generator.ts — Voice-optimized llms.txt generator
//
// Generates llms.txt and llms-full.txt for a location from Ground Truth data.
// Pure functions — all DB reads happen in vaio-service.ts before calling these.
//
// Sprint 109: VAIO
// ---------------------------------------------------------------------------

import type { GroundTruthForVAIO, LlmsTxtContent, LlmsPageUrl } from './types';

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export function generateLlmsTxt(
  groundTruth: GroundTruthForVAIO,
  topReviewKeywords: string[],
  pageUrls: LlmsPageUrl[],
): LlmsTxtContent {
  return {
    standard: buildStandardLlmsTxt(groundTruth, pageUrls),
    full: buildFullLlmsTxt(groundTruth, pageUrls, topReviewKeywords),
    generated_at: new Date().toISOString(),
    version: 1,
  };
}

// ---------------------------------------------------------------------------
// Standard llms.txt (~300–500 words)
// ---------------------------------------------------------------------------

export function buildStandardLlmsTxt(
  gt: GroundTruthForVAIO,
  pageUrls: LlmsPageUrl[],
): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${gt.name}`);
  lines.push(`> ${gt.name} is a ${gt.categories[0] ?? 'local business'} in ${gt.city}, ${gt.state}, located at ${gt.address}.`);
  if (gt.description) {
    const firstSentence = gt.description.split(/[.!?]/)[0];
    if (firstSentence) lines.push(`> ${firstSentence.trim()}.`);
  }
  lines.push('');

  // Key Facts
  lines.push('## Key Facts');
  if (gt.hours) {
    lines.push(`- **Hours:** ${formatHoursForVoice(gt.hours)}`);
  }
  if (gt.phone) {
    lines.push(`- **Phone:** ${gt.phone}`);
  }
  lines.push(`- **Address:** ${gt.address}, ${gt.city}, ${gt.state} ${gt.zip}`);

  const topAmenities = Object.entries(gt.amenities)
    .filter(([, v]) => v === true)
    .map(([k]) => formatAmenityName(k))
    .slice(0, 5);
  if (topAmenities.length > 0) {
    lines.push(`- **Specialties:** ${topAmenities.join(', ')}`);
  }
  lines.push('');

  // Sections from page URLs
  const sectionMap = groupPageUrls(pageUrls);

  if (sectionMap.menu) {
    lines.push('## Menu & Services');
    lines.push(`- [Menu](${sectionMap.menu.url}): ${sectionMap.menu.description}`);
    lines.push('');
  }

  if (sectionMap.events) {
    lines.push('## Events & Entertainment');
    lines.push(`- [Events](${sectionMap.events.url}): ${sectionMap.events.description}`);
    lines.push('');
  }

  if (sectionMap.faq) {
    lines.push('## FAQ');
    lines.push(`- [Frequently Asked Questions](${sectionMap.faq.url}): ${sectionMap.faq.description}`);
    lines.push('');
  }

  // Location & Contact
  lines.push('## Location & Contact');
  if (sectionMap.contact) {
    lines.push(`- [Contact](${sectionMap.contact.url}): ${gt.address}, ${gt.city}, ${gt.state}`);
  } else {
    lines.push(`- ${gt.address}, ${gt.city}, ${gt.state} ${gt.zip}`);
    if (gt.phone) lines.push(`- Phone: ${gt.phone}`);
    if (gt.website) lines.push(`- Website: ${gt.website}`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Full llms-full.txt (~800–1200 words)
// ---------------------------------------------------------------------------

export function buildFullLlmsTxt(
  gt: GroundTruthForVAIO,
  pageUrls: LlmsPageUrl[],
  topReviewKeywords: string[],
): string {
  const standard = buildStandardLlmsTxt(gt, pageUrls);
  const extra: string[] = [standard, ''];

  // About section
  if (gt.description) {
    extra.push('## About');
    extra.push(gt.description);
    extra.push('');
  }

  // All amenities
  const allAmenities = Object.entries(gt.amenities)
    .filter(([, v]) => v === true)
    .map(([k]) => formatAmenityName(k));
  if (allAmenities.length > 0) {
    extra.push('## Features & Amenities');
    for (const amenity of allAmenities) {
      extra.push(`- ${amenity}`);
    }
    extra.push('');
  }

  // Categories
  if (gt.categories.length > 0) {
    extra.push('## Business Categories');
    extra.push(gt.categories.join(', '));
    extra.push('');
  }

  // Review keywords
  if (topReviewKeywords.length > 0) {
    extra.push('## What Customers Say');
    extra.push(`Customers frequently mention: ${topReviewKeywords.slice(0, 10).join(', ')}.`);
    extra.push('');
  }

  // Detailed hours
  if (gt.hours) {
    extra.push('## Detailed Hours');
    for (const day of DAY_ORDER) {
      const h = gt.hours[day];
      if (!h) {
        extra.push(`- ${DAY_LABELS[day]}: Closed`);
      } else {
        extra.push(`- ${DAY_LABELS[day]}: ${h.open}–${h.close}`);
      }
    }
    extra.push('');
  }

  // Additional pages
  const otherPages = pageUrls.filter((p) =>
    !['homepage', 'menu', 'events', 'faq', 'contact'].includes(p.page_type),
  );
  if (otherPages.length > 0) {
    extra.push('## Additional Pages');
    for (const page of otherPages) {
      extra.push(`- [${page.description}](${page.url})`);
    }
    extra.push('');
  }

  extra.push('---');
  extra.push(`Generated by LocalVector.ai on ${new Date().toISOString().slice(0, 10)}`);

  return extra.join('\n');
}

// ---------------------------------------------------------------------------
// Hours formatting
// ---------------------------------------------------------------------------

export function formatHoursForVoice(
  hours: Record<string, { open: string; close: string } | null>,
): string {
  // Group consecutive days with same hours into ranges
  const ranges: Array<{ days: string[]; open: string; close: string }> = [];

  for (const day of DAY_ORDER) {
    const h = hours[day];
    if (!h) continue;

    const lastRange = ranges[ranges.length - 1];
    if (lastRange && lastRange.open === h.open && lastRange.close === h.close) {
      lastRange.days.push(DAY_LABELS[day]);
    } else {
      ranges.push({ days: [DAY_LABELS[day]], open: h.open, close: h.close });
    }
  }

  if (ranges.length === 0) return 'Hours not available';

  return ranges.map((r) => {
    const dayStr = r.days.length === 1
      ? r.days[0]
      : `${r.days[0]}–${r.days[r.days.length - 1]}`;
    return `${dayStr} ${formatTime12h(r.open)}–${formatTime12h(r.close)}`;
  }).join(', ');
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function formatTime12h(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  if (h === 0) return `12:${m} AM`;
  if (h < 12) return `${h}:${m} AM`;
  if (h === 12) return `12:${m} PM`;
  return `${h - 12}:${m} PM`;
}

function formatAmenityName(key: string): string {
  const labels: Record<string, string> = {
    has_outdoor_seating: 'Outdoor Seating',
    serves_alcohol: 'Full Bar',
    has_hookah: 'Hookah Lounge',
    is_kid_friendly: 'Kid-Friendly',
    takes_reservations: 'Reservations',
    has_live_music: 'Live Music',
    has_dj: 'DJ Nights',
    has_private_rooms: 'Private Rooms',
  };
  return labels[key] ?? key.replace(/^(has_|is_|serves_)/, '').replace(/_/g, ' ');
}

function groupPageUrls(pageUrls: LlmsPageUrl[]): Record<string, LlmsPageUrl | undefined> {
  const map: Record<string, LlmsPageUrl | undefined> = {};
  for (const page of pageUrls) {
    map[page.page_type] = page;
  }
  return map;
}
