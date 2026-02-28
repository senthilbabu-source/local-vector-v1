// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// src/__tests__/unit/agent-readiness-verdict-panel.test.tsx — Sprint J
// Tests for AgentReadinessVerdictPanel component
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentReadinessVerdictPanel } from '@/app/dashboard/agent-readiness/_components/AgentReadinessVerdictPanel';
import type { AgentReadinessResult } from '@/lib/services/agent-readiness.service';

// Mock InfoTooltip
vi.mock('@/components/ui/InfoTooltip', () => ({
  InfoTooltip: ({ content }: { content: string }) => (
    <span data-testid="info-tooltip">{content}</span>
  ),
}));

function makeResult(overrides: Partial<AgentReadinessResult> = {}): AgentReadinessResult {
  return {
    score: 40,
    level: 'partially_ready',
    levelLabel: 'Partially Ready',
    activeCount: 2,
    totalCount: 6,
    capabilities: [],
    topPriority: null,
    summary: '2 of 6 agent capabilities are machine-accessible.',
    ...overrides,
  };
}

describe('AgentReadinessVerdictPanel', () => {
  it('renders verdict panel container', () => {
    render(<AgentReadinessVerdictPanel result={makeResult()} />);
    expect(screen.getByTestId('agent-readiness-verdict-panel')).toBeDefined();
  });

  it('shows score in ring', () => {
    render(<AgentReadinessVerdictPanel result={makeResult({ score: 40 })} />);
    expect(screen.getByTestId('agent-readiness-score').textContent).toBe('40');
  });

  it('shows active/total count badge', () => {
    render(<AgentReadinessVerdictPanel result={makeResult({ activeCount: 3, totalCount: 6 })} />);
    expect(screen.getByTestId('agent-readiness-level').textContent).toBe('3/6 ready');
  });

  // Agent ready level
  it('agent_ready level shows positive verdict', () => {
    render(<AgentReadinessVerdictPanel result={makeResult({
      score: 75,
      level: 'agent_ready',
      activeCount: 4,
      totalCount: 6,
    })} />);
    expect(screen.getByTestId('agent-readiness-verdict-text').textContent).toContain(
      'most customer interactions',
    );
  });

  it('agent_ready with gaps shows remaining count', () => {
    render(<AgentReadinessVerdictPanel result={makeResult({
      score: 75,
      level: 'agent_ready',
      activeCount: 4,
      totalCount: 6,
    })} />);
    expect(screen.getByTestId('agent-readiness-verdict-text').textContent).toContain(
      '2 remaining',
    );
  });

  // Partially ready level
  it('partially_ready shows gap count', () => {
    render(<AgentReadinessVerdictPanel result={makeResult({
      score: 50,
      level: 'partially_ready',
      activeCount: 3,
      totalCount: 6,
    })} />);
    const verdict = screen.getByTestId('agent-readiness-verdict-text').textContent!;
    expect(verdict).toContain('3 gap');
  });

  // Not ready level
  it('not_ready shows urgent message', () => {
    render(<AgentReadinessVerdictPanel result={makeResult({
      score: 20,
      level: 'not_ready',
      activeCount: 1,
      totalCount: 6,
    })} />);
    const verdict = screen.getByTestId('agent-readiness-verdict-text').textContent!;
    expect(verdict).toContain('1 of 6');
    expect(verdict).toContain('incomplete or incorrect');
  });

  // No jargon
  it('verdict text contains no banned jargon', () => {
    const banned = ['JSON-LD', 'schema', 'agentic', 'structured data', 'action schema'];
    const levels: AgentReadinessResult['level'][] = ['agent_ready', 'partially_ready', 'not_ready'];

    for (const level of levels) {
      const { unmount } = render(
        <AgentReadinessVerdictPanel result={makeResult({ level, score: level === 'agent_ready' ? 75 : level === 'partially_ready' ? 50 : 20 })} />,
      );
      const text = screen.getByTestId('agent-readiness-verdict-panel').textContent!;
      for (const word of banned) {
        expect(text).not.toContain(word);
      }
      unmount();
    }
  });
});
