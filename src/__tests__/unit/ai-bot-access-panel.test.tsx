// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { BotActivity } from '@/lib/data/crawler-analytics';

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('@/components/ui/InfoTooltip', () => ({
  InfoTooltip: ({ content }: { content: string }) => (
    <button data-testid="info-tooltip-trigger" aria-label={content}>i</button>
  ),
}));

import AIBotAccessPanel from '@/app/dashboard/_components/panels/AIBotAccessPanel';

function makeBot(overrides: Partial<BotActivity> = {}): BotActivity {
  return {
    botType: 'gptbot',
    label: 'GPTBot',
    engine: 'ChatGPT',
    description: 'OpenAI crawler',
    visitCount: 100,
    lastVisitAt: '2026-02-25T10:00:00Z',
    status: 'active',
    ...overrides,
  };
}

describe('AIBotAccessPanel', () => {
  it('renders one row per bot in the bots array', () => {
    const bots = [
      makeBot({ botType: 'gptbot', label: 'GPTBot' }),
      makeBot({ botType: 'claudebot', label: 'ClaudeBot' }),
    ];
    render(<AIBotAccessPanel bots={bots} />);
    const rows = screen.getAllByTestId('ai-bot-row');
    expect(rows).toHaveLength(2);
  });

  it('blind_spot bots show red indicator', () => {
    render(<AIBotAccessPanel bots={[makeBot({ status: 'blind_spot' })]} />);
    const row = screen.getByTestId('ai-bot-row');
    expect(row.innerHTML).toContain('crimson');
  });

  it('active bots show green indicator', () => {
    render(<AIBotAccessPanel bots={[makeBot({ status: 'active' })]} />);
    const row = screen.getByTestId('ai-bot-row');
    expect(row.innerHTML).toContain('emerald');
  });

  it('blind_spot bots appear before active bots', () => {
    const bots = [
      makeBot({ botType: 'gptbot', label: 'GPTBot', status: 'active' }),
      makeBot({ botType: 'claudebot', label: 'ClaudeBot', status: 'blind_spot' }),
    ];
    render(<AIBotAccessPanel bots={bots} />);
    const rows = screen.getAllByTestId('ai-bot-row');
    // ClaudeBot (blind_spot) should be first
    expect(rows[0].textContent).toContain('ClaudeBot');
    expect(rows[1].textContent).toContain('GPTBot');
  });

  it('visit count rendered for each bot', () => {
    render(<AIBotAccessPanel bots={[makeBot({ visitCount: 1238 })]} />);
    const row = screen.getByTestId('ai-bot-row');
    expect(row.textContent).toContain('1,238');
  });

  it('renders empty state when no bots', () => {
    render(<AIBotAccessPanel bots={[]} />);
    expect(screen.getByTestId('ai-bot-access-empty')).toBeDefined();
  });

  it('panel links to /dashboard/crawler-analytics', () => {
    render(<AIBotAccessPanel bots={[makeBot()]} />);
    const panel = screen.getByTestId('ai-bot-access-panel');
    expect(panel.getAttribute('href')).toBe('/dashboard/crawler-analytics');
  });

  it('renders InfoTooltip trigger', () => {
    render(<AIBotAccessPanel bots={[makeBot()]} />);
    expect(screen.getByTestId('info-tooltip-trigger')).toBeDefined();
  });
});
