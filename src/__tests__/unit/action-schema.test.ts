// ---------------------------------------------------------------------------
// action-schema.test.ts — Unit tests for ReserveAction + OrderAction generators
//
// Sprint 84: 10 tests — pure functions, no mocks needed.
//
// Run:
//   npx vitest run src/__tests__/unit/action-schema.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  generateReserveActionSchema,
  generateOrderActionSchema,
  type ActionSchemaInput,
} from '@/lib/schema-generator/action-schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_INPUT: ActionSchemaInput = {
  businessName: 'Charcoal N Chill',
  websiteUrl: 'https://charcoalnchill.com',
  phone: '(770) 555-1234',
  address: {
    streetAddress: '11950 Jones Bridge Road Ste 103',
    city: 'Alpharetta',
    state: 'GA',
    zip: '30005',
    country: 'US',
  },
};

// ---------------------------------------------------------------------------
// generateReserveActionSchema
// ---------------------------------------------------------------------------

describe('generateReserveActionSchema', () => {
  it('returns object with @type Restaurant', () => {
    const schema = generateReserveActionSchema(
      BASE_INPUT,
      'https://resy.com/charcoal',
    );
    expect(schema['@type']).toBe('Restaurant');
  });

  it('includes ReserveAction in potentialAction', () => {
    const schema = generateReserveActionSchema(
      BASE_INPUT,
      'https://resy.com/charcoal',
    );
    const action = schema.potentialAction as Record<string, unknown>;
    expect(action['@type']).toBe('ReserveAction');
  });

  it('sets booking URL as urlTemplate', () => {
    const url = 'https://resy.com/charcoal';
    const schema = generateReserveActionSchema(BASE_INPUT, url);
    const action = schema.potentialAction as Record<string, unknown>;
    const target = action.target as Record<string, unknown>;
    expect(target.urlTemplate).toBe(url);
  });

  it('includes PostalAddress', () => {
    const schema = generateReserveActionSchema(
      BASE_INPUT,
      'https://resy.com/charcoal',
    );
    const address = schema.address as Record<string, unknown>;
    expect(address['@type']).toBe('PostalAddress');
    expect(address.addressLocality).toBe('Alpharetta');
  });

  it('omits telephone when null', () => {
    const input: ActionSchemaInput = { ...BASE_INPUT, phone: null };
    const schema = generateReserveActionSchema(
      input,
      'https://resy.com/charcoal',
    );
    expect(schema).not.toHaveProperty('telephone');
  });
});

// ---------------------------------------------------------------------------
// generateOrderActionSchema
// ---------------------------------------------------------------------------

describe('generateOrderActionSchema', () => {
  it('returns object with @type Restaurant', () => {
    const schema = generateOrderActionSchema(
      BASE_INPUT,
      'https://order.charcoalnchill.com',
    );
    expect(schema['@type']).toBe('Restaurant');
  });

  it('includes OrderAction in potentialAction', () => {
    const schema = generateOrderActionSchema(
      BASE_INPUT,
      'https://order.charcoalnchill.com',
    );
    const action = schema.potentialAction as Record<string, unknown>;
    expect(action['@type']).toBe('OrderAction');
  });

  it('sets ordering URL as urlTemplate', () => {
    const url = 'https://order.charcoalnchill.com';
    const schema = generateOrderActionSchema(BASE_INPUT, url);
    const action = schema.potentialAction as Record<string, unknown>;
    const target = action.target as Record<string, unknown>;
    expect(target.urlTemplate).toBe(url);
  });

  it('includes deliveryMethod', () => {
    const schema = generateOrderActionSchema(
      BASE_INPUT,
      'https://order.charcoalnchill.com',
    );
    const action = schema.potentialAction as Record<string, unknown>;
    expect(action.deliveryMethod).toBeInstanceOf(Array);
    expect(action.deliveryMethod).toHaveLength(2);
  });

  it('includes address from input', () => {
    const schema = generateOrderActionSchema(
      BASE_INPUT,
      'https://order.charcoalnchill.com',
    );
    const address = schema.address as Record<string, unknown>;
    expect(address.streetAddress).toBe('11950 Jones Bridge Road Ste 103');
    expect(address.addressRegion).toBe('GA');
    expect(address.postalCode).toBe('30005');
  });
});
