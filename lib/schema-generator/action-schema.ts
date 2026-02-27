// ---------------------------------------------------------------------------
// lib/schema-generator/action-schema.ts — ReserveAction + OrderAction JSON-LD
//
// Sprint 84: Action schema generators for AI agent readiness.
// PURE FUNCTIONS (§39) — no DB, no fetch, no side effects.
//
// These schemas enable AI agents (OpenAI Operator, Google Jarvis) to
// programmatically book reservations or place orders at the business.
// ---------------------------------------------------------------------------

// ── Input type ────────────────────────────────────────────────────────────

export interface ActionSchemaInput {
  businessName: string;
  websiteUrl: string;
  phone: string | null;
  address: {
    streetAddress: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

// ── ReserveAction ─────────────────────────────────────────────────────────

/**
 * Generate ReserveAction JSON-LD for restaurant reservations.
 * Links to the business's booking URL so AI agents can initiate reservations.
 */
export function generateReserveActionSchema(
  input: ActionSchemaInput,
  bookingUrl: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: input.businessName,
    url: input.websiteUrl,
    ...(input.phone ? { telephone: input.phone } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: input.address.streetAddress,
      addressLocality: input.address.city,
      addressRegion: input.address.state,
      postalCode: input.address.zip,
      addressCountry: input.address.country,
    },
    potentialAction: {
      '@type': 'ReserveAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: bookingUrl,
        actionPlatform: [
          'http://schema.org/DesktopWebPlatform',
          'http://schema.org/MobileWebPlatform',
        ],
      },
      result: {
        '@type': 'Reservation',
        name: `Reservation at ${input.businessName}`,
      },
    },
  };
}

// ── OrderAction ───────────────────────────────────────────────────────────

/**
 * Generate OrderAction JSON-LD for online food ordering.
 * Links to the business's ordering URL so AI agents can place orders.
 */
export function generateOrderActionSchema(
  input: ActionSchemaInput,
  orderingUrl: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: input.businessName,
    url: input.websiteUrl,
    ...(input.phone ? { telephone: input.phone } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: input.address.streetAddress,
      addressLocality: input.address.city,
      addressRegion: input.address.state,
      postalCode: input.address.zip,
      addressCountry: input.address.country,
    },
    potentialAction: {
      '@type': 'OrderAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: orderingUrl,
        actionPlatform: [
          'http://schema.org/DesktopWebPlatform',
          'http://schema.org/MobileWebPlatform',
        ],
      },
      deliveryMethod: [
        'http://purl.org/goodrelations/v1#DeliveryModePickUp',
        'http://purl.org/goodrelations/v1#DeliveryModeOwnFleet',
      ],
    },
  };
}
