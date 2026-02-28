// ---------------------------------------------------------------------------
// src/__tests__/unit/scenario-descriptions.test.ts — Sprint J
// Tests for agent readiness scenario description translation layer
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  SCENARIO_DESCRIPTIONS,
  getScenarioText,
  type CapabilityId,
} from '@/lib/agent-readiness/scenario-descriptions';

const ALL_CAPABILITIES: CapabilityId[] = [
  'structured_hours',
  'menu_schema',
  'reserve_action',
  'order_action',
  'accessible_ctas',
  'captcha_free',
];

const ALL_STATUSES: Array<'active' | 'partial' | 'missing'> = [
  'active',
  'partial',
  'missing',
];

describe('SCENARIO_DESCRIPTIONS', () => {
  it('has an entry for every capability ID', () => {
    for (const cap of ALL_CAPABILITIES) {
      expect(SCENARIO_DESCRIPTIONS[cap]).toBeDefined();
    }
  });

  it('every entry has all required fields', () => {
    for (const cap of ALL_CAPABILITIES) {
      const desc = SCENARIO_DESCRIPTIONS[cap];
      expect(desc.scenario).toBeTruthy();
      expect(desc.whenActive).toBeTruthy();
      expect(desc.whenPartial).toBeTruthy();
      expect(desc.whenMissing).toBeTruthy();
    }
  });

  it('no description contains banned jargon', () => {
    const banned = [
      'JSON-LD',
      'schema.org',
      'structured data',
      'action schema',
      'reservation schema',
      'microdata',
      'RDF',
      'ontology',
      'agentic',
      'OpeningHoursSpecification',
      'ReserveAction',
      'OrderAction',
    ];

    for (const cap of ALL_CAPABILITIES) {
      const desc = SCENARIO_DESCRIPTIONS[cap];
      const allText = [
        desc.scenario,
        desc.whenActive,
        desc.whenPartial,
        desc.whenMissing,
      ].join(' ');

      for (const word of banned) {
        expect(allText).not.toContain(word);
      }
    }
  });

  it('structured_hours scenario is phrased as a customer question', () => {
    expect(SCENARIO_DESCRIPTIONS.structured_hours.scenario).toContain(
      'Are you open right now',
    );
  });

  it('menu_schema scenario asks about menu', () => {
    expect(SCENARIO_DESCRIPTIONS.menu_schema.scenario).toContain('menu');
  });

  it('reserve_action scenario asks about booking', () => {
    expect(SCENARIO_DESCRIPTIONS.reserve_action.scenario).toContain('reservation');
  });

  it('order_action scenario asks about ordering', () => {
    expect(SCENARIO_DESCRIPTIONS.order_action.scenario).toContain('order');
  });

  it('captcha_free scenario mentions blocking', () => {
    expect(SCENARIO_DESCRIPTIONS.captcha_free.scenario).toContain('blocked');
  });

  it('accessible_ctas scenario mentions buttons', () => {
    expect(SCENARIO_DESCRIPTIONS.accessible_ctas.scenario).toContain('buttons');
  });
});

describe('getScenarioText', () => {
  it('returns correct text for each capability+status combination', () => {
    for (const cap of ALL_CAPABILITIES) {
      for (const status of ALL_STATUSES) {
        const result = getScenarioText(cap, status);
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
      }
    }
  });

  it('returns active text for active status', () => {
    const result = getScenarioText('structured_hours', 'active');
    expect(result).toContain('accurately');
  });

  it('returns partial text for partial status', () => {
    const result = getScenarioText('menu_schema', 'partial');
    expect(result).toContain('format');
  });

  it('returns missing text for missing status', () => {
    const result = getScenarioText('reserve_action', 'missing');
    expect(result).toContain('can\'t');
  });

  it('returns empty string for unknown capability', () => {
    const result = getScenarioText('nonexistent', 'active');
    expect(result).toBe('');
  });
});
