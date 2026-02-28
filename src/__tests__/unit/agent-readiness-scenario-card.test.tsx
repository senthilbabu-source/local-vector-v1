// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// src/__tests__/unit/agent-readiness-scenario-card.test.tsx — Sprint J
// Tests for AgentReadinessScenarioCard component
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentReadinessScenarioCard } from '@/app/dashboard/agent-readiness/_components/AgentReadinessScenarioCard';
import type { AgentCapability } from '@/lib/services/agent-readiness.service';
import {
  SCENARIO_DESCRIPTIONS,
  type CapabilityId,
} from '@/lib/agent-readiness/scenario-descriptions';

function makeCapability(overrides: Partial<AgentCapability> = {}): AgentCapability {
  return {
    id: 'reserve_action',
    name: 'ReserveAction Schema',
    description: 'AI booking agents can reserve a table directly',
    status: 'missing',
    maxPoints: 25,
    earnedPoints: 0,
    statusDetail: 'No reservation capability detected',
    fixGuide: 'Set up online reservations and add ReserveAction schema.',
    schemaAction: 'reserve_action',
    ...overrides,
  };
}

describe('AgentReadinessScenarioCard', () => {
  it('renders scenario card with testid', () => {
    render(<AgentReadinessScenarioCard capability={makeCapability()} />);
    expect(screen.getByTestId('scenario-card-reserve_action')).toBeDefined();
  });

  it('shows scenario question instead of technical name', () => {
    render(<AgentReadinessScenarioCard capability={makeCapability()} />);
    // Should show "Can AI book a reservation?" not "ReserveAction Schema"
    expect(screen.getByText(/Can AI book a reservation/)).toBeDefined();
    expect(screen.queryByText('ReserveAction Schema')).toBeNull();
  });

  it('shows customer-consequence text for missing status', () => {
    render(<AgentReadinessScenarioCard capability={makeCapability()} />);
    expect(screen.getByText(/can't book reservations/)).toBeDefined();
  });

  it('shows customer-consequence text for active status', () => {
    render(<AgentReadinessScenarioCard capability={makeCapability({
      status: 'active',
      earnedPoints: 25,
    })} />);
    expect(screen.getByText(/book a table/)).toBeDefined();
  });

  it('shows customer-consequence text for partial status', () => {
    render(<AgentReadinessScenarioCard capability={makeCapability({
      status: 'partial',
      earnedPoints: 13,
    })} />);
    expect(screen.getByText(/booking system/)).toBeDefined();
  });

  it('shows fix guide for non-active capabilities', () => {
    render(<AgentReadinessScenarioCard capability={makeCapability()} />);
    expect(screen.getByText(/Set up online reservations/)).toBeDefined();
  });

  it('hides fix guide for active capabilities', () => {
    render(<AgentReadinessScenarioCard capability={makeCapability({
      status: 'active',
      earnedPoints: 25,
      fixGuide: null,
    })} />);
    expect(screen.queryByText(/Set up online/)).toBeNull();
  });

  it('shows points badge', () => {
    render(<AgentReadinessScenarioCard capability={makeCapability({ earnedPoints: 13, maxPoints: 25 })} />);
    expect(screen.getByText('13/25 pts')).toBeDefined();
  });

  it('shows fix button when schemaAction exists', () => {
    render(<AgentReadinessScenarioCard capability={makeCapability()} />);
    expect(screen.getByTestId('generate-reserve_action')).toBeDefined();
  });

  it('uses scenario text for hours capability', () => {
    render(<AgentReadinessScenarioCard capability={makeCapability({
      id: 'structured_hours',
      name: 'Structured Hours',
      status: 'active',
      earnedPoints: 15,
      maxPoints: 15,
      fixGuide: null,
      schemaAction: null,
    })} />);
    expect(screen.getByText(/Are you open right now/)).toBeDefined();
  });

  it('uses scenario text for menu capability', () => {
    render(<AgentReadinessScenarioCard capability={makeCapability({
      id: 'menu_schema',
      name: 'Menu Schema',
      status: 'missing',
      earnedPoints: 0,
      maxPoints: 15,
    })} />);
    expect(screen.getByText(/Can AI show customers your menu/)).toBeDefined();
  });

  it('scenario label and consequence text contain no banned jargon', () => {
    // Note: fixGuide text comes from the service layer and may contain technical terms.
    // Sprint J only rewrites the scenario label and consequence text (whenActive/whenPartial/whenMissing).
    const banned = ['JSON-LD', 'schema.org', 'structured data'];
    const ids: CapabilityId[] = [
      'structured_hours', 'menu_schema', 'reserve_action', 'order_action', 'accessible_ctas', 'captcha_free',
    ];

    for (const id of ids) {
      const desc = SCENARIO_DESCRIPTIONS[id];
      const allScenarioText = [desc.scenario, desc.whenActive, desc.whenPartial, desc.whenMissing].join(' ');
      for (const word of banned) {
        expect(allScenarioText).not.toContain(word);
      }
    }
  });
});
