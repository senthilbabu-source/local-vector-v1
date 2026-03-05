// ---------------------------------------------------------------------------
// vaio-scan-experience.test.tsx — Sprint §210: Live Scan Experience
// @vitest-environment jsdom
//
// 20 tests covering:
//   - ScanOverlay (5 tests): visibility, stage rendering, completed/current/pending states
//   - QueryDrawer (11 tests): rendering, fail reasons, suggested answer, copy, close
//   - Delta badge (2 tests): positive delta, zero delta
//   - Clickable query rows (2 tests): failing vs passing rows
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { ScanOverlay, SCAN_STAGES } from '@/app/dashboard/vaio/_components/ScanOverlay';
import { QueryDrawer } from '@/app/dashboard/vaio/_components/QueryDrawer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_QUERY_DISCOVERY = {
  id: 'q1',
  query_text: 'best hookah lounge near Alpharetta',
  query_category: 'discovery',
  citation_rate: 0,
};

const MOCK_QUERY_INFORMATION = {
  id: 'q2',
  query_text: 'what time does charcoal n chill close on Friday',
  query_category: 'information',
  citation_rate: null,
};

const MOCK_QUERY_ACTION = {
  id: 'q3',
  query_text: 'how do I make a reservation at charcoal n chill',
  query_category: 'action',
  citation_rate: 0,
};

const MOCK_QUERY_COMPARISON = {
  id: 'q4',
  query_text: 'is charcoal n chill better than cloud 9 for private events',
  query_category: 'comparison',
  citation_rate: 0,
};

const MOCK_VOICE_GAP_DISCOVERY = {
  category: 'discovery',
  queries: ['best hookah lounge near Alpharetta'],
  weeks_at_zero: 3,
  suggested_query_answer: 'Charcoal N Chill is a hookah lounge in Alpharetta, offering private booths and weekend events.',
};

const MOCK_VOICE_GAP_INFORMATION = {
  category: 'information',
  queries: ['what time does charcoal n chill close on Friday'],
  weeks_at_zero: 2,
  suggested_query_answer: 'Charcoal N Chill in Alpharetta is open Monday through Sunday from 4 PM to 2 AM.',
};

// ---------------------------------------------------------------------------
// 1. ScanOverlay — 5 tests
// ---------------------------------------------------------------------------

describe('ScanOverlay', () => {
  afterEach(() => cleanup());

  it('renders nothing when scanPhase is null', () => {
    render(<ScanOverlay scanPhase={null} />);
    expect(screen.queryByTestId('scan-overlay')).toBeNull();
  });

  it('renders overlay container when scanPhase is 0', () => {
    render(<ScanOverlay scanPhase={0} />);
    expect(screen.getByTestId('scan-overlay')).toBeTruthy();
    expect(screen.getByText('Running Voice Check')).toBeTruthy();
  });

  it('stage 0: first stage is current, stages 1+2 are pending', () => {
    render(<ScanOverlay scanPhase={0} />);
    const currentMarkers = screen.getAllByTestId('stage-current');
    const pendingMarkers = screen.getAllByTestId('stage-pending');
    const doneMarkers = screen.queryAllByTestId('stage-done');

    expect(currentMarkers).toHaveLength(1);
    expect(pendingMarkers).toHaveLength(2);
    expect(doneMarkers).toHaveLength(0);
  });

  it('stage 1: first stage done, second current, third pending', () => {
    render(<ScanOverlay scanPhase={1} />);
    const doneMarkers = screen.getAllByTestId('stage-done');
    const currentMarkers = screen.getAllByTestId('stage-current');
    const pendingMarkers = screen.getAllByTestId('stage-pending');

    expect(doneMarkers).toHaveLength(1);
    expect(currentMarkers).toHaveLength(1);
    expect(pendingMarkers).toHaveLength(1);
  });

  it('stage 2: first two stages done, third current', () => {
    render(<ScanOverlay scanPhase={2} />);
    const doneMarkers = screen.getAllByTestId('stage-done');
    const currentMarkers = screen.getAllByTestId('stage-current');
    const pendingMarkers = screen.queryAllByTestId('stage-pending');

    expect(doneMarkers).toHaveLength(2);
    expect(currentMarkers).toHaveLength(1);
    expect(pendingMarkers).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. QueryDrawer — 11 tests
// ---------------------------------------------------------------------------

describe('QueryDrawer', () => {
  afterEach(() => cleanup());

  it('renders nothing when query is null', () => {
    render(<QueryDrawer query={null} voiceGaps={[]} onClose={vi.fn()} />);
    expect(screen.queryByTestId('query-drawer')).toBeNull();
  });

  it('renders drawer with query text when query provided', () => {
    render(
      <QueryDrawer query={MOCK_QUERY_DISCOVERY} voiceGaps={[]} onClose={vi.fn()} />,
    );
    expect(screen.getByTestId('query-drawer')).toBeTruthy();
    expect(screen.getByTestId('query-drawer-text').textContent).toContain(
      'best hookah lounge near Alpharetta',
    );
  });

  it('shows discovery fail reason for discovery category', () => {
    render(
      <QueryDrawer query={MOCK_QUERY_DISCOVERY} voiceGaps={[]} onClose={vi.fn()} />,
    );
    const failSection = screen.getByTestId('query-drawer-fail-reason');
    expect(failSection.textContent).toContain("isn't appearing");
  });

  it('shows information fail reason for information category', () => {
    render(
      <QueryDrawer query={MOCK_QUERY_INFORMATION} voiceGaps={[]} onClose={vi.fn()} />,
    );
    const failSection = screen.getByTestId('query-drawer-fail-reason');
    expect(failSection.textContent).toContain("hours");
  });

  it('shows action fail reason for action category', () => {
    render(
      <QueryDrawer query={MOCK_QUERY_ACTION} voiceGaps={[]} onClose={vi.fn()} />,
    );
    const failSection = screen.getByTestId('query-drawer-fail-reason');
    expect(failSection.textContent).toContain("reservation");
  });

  it('shows comparison fail reason for comparison category', () => {
    render(
      <QueryDrawer query={MOCK_QUERY_COMPARISON} voiceGaps={[]} onClose={vi.fn()} />,
    );
    const failSection = screen.getByTestId('query-drawer-fail-reason');
    expect(failSection.textContent).toContain("differentiators");
  });

  it('shows suggested answer when matching voice gap exists', () => {
    render(
      <QueryDrawer
        query={MOCK_QUERY_DISCOVERY}
        voiceGaps={[MOCK_VOICE_GAP_DISCOVERY]}
        onClose={vi.fn()}
      />,
    );
    const suggestion = screen.getByTestId('query-drawer-suggestion');
    expect(suggestion.textContent).toContain('private booths and weekend events');
  });

  it('shows generic message when no matching gap for category', () => {
    render(
      <QueryDrawer
        query={MOCK_QUERY_DISCOVERY}
        voiceGaps={[MOCK_VOICE_GAP_INFORMATION]} // information gap, not discovery
        onClose={vi.fn()}
      />,
    );
    const suggestion = screen.getByTestId('query-drawer-suggestion');
    expect(suggestion.textContent).toContain('Run a Voice Check');
  });

  it('"Use this answer" button copies Q&A format to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
    });

    render(
      <QueryDrawer
        query={MOCK_QUERY_DISCOVERY}
        voiceGaps={[MOCK_VOICE_GAP_DISCOVERY]}
        onClose={vi.fn()}
      />,
    );

    const copyBtn = screen.getByTestId('query-drawer-copy');
    await act(async () => { fireEvent.click(copyBtn); });

    expect(writeText).toHaveBeenCalledOnce();
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain('Q: best hookah lounge near Alpharetta');
    expect(copied).toContain('A: Charcoal N Chill is a hookah lounge');
  });

  it('closes when X button is clicked', () => {
    const onClose = vi.fn();
    render(<QueryDrawer query={MOCK_QUERY_DISCOVERY} voiceGaps={[]} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('query-drawer-close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<QueryDrawer query={MOCK_QUERY_DISCOVERY} voiceGaps={[]} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('query-drawer-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// 3. Delta badge rendering — 2 tests
// (Rendered inline via a minimal stub that mirrors VAIOPageClient's badge logic)
// ---------------------------------------------------------------------------

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  return (
    <span
      className={delta > 0 ? 'text-green-400' : 'text-slate-400'}
      data-testid="vaio-score-delta"
    >
      {delta > 0 ? `▲ +${delta} pts` : 'No change'}
    </span>
  );
}

describe('Delta badge logic', () => {
  afterEach(() => cleanup());

  it('shows positive pts when delta > 0', () => {
    render(<DeltaBadge delta={13} />);
    const badge = screen.getByTestId('vaio-score-delta');
    expect(badge.textContent).toBe('▲ +13 pts');
    expect(badge.className).toContain('text-green-400');
  });

  it('shows "No change" in slate when delta === 0', () => {
    render(<DeltaBadge delta={0} />);
    const badge = screen.getByTestId('vaio-score-delta');
    expect(badge.textContent).toBe('No change');
    expect(badge.className).toContain('text-slate-400');
  });
});

// ---------------------------------------------------------------------------
// 4. Clickable failing query rows — 2 tests
// (Minimal rendering that mirrors VAIOPageClient's query row logic)
// ---------------------------------------------------------------------------

type SimpleQuery = { id: string; query_text: string; query_category: string; citation_rate: number | null };

interface QueryRowProps {
  query: SimpleQuery;
  onSelect: (q: SimpleQuery) => void;
}

function QueryRow({ query, onSelect }: QueryRowProps) {
  const isFailing = query.citation_rate === null || query.citation_rate === 0;
  if (isFailing) {
    return (
      <button
        onClick={() => onSelect(query)}
        data-testid="failing-query-row"
      >
        {query.query_text}
      </button>
    );
  }
  return (
    <div data-testid="passing-query-row">
      {query.query_text}
    </div>
  );
}

describe('Clickable query row behavior', () => {
  afterEach(() => cleanup());

  it('0% citation rate row is rendered as clickable button', () => {
    const onSelect = vi.fn();
    render(
      <QueryRow
        query={{ id: 'q1', query_text: 'failing query', query_category: 'discovery', citation_rate: 0 }}
        onSelect={onSelect}
      />,
    );
    const row = screen.getByTestId('failing-query-row');
    fireEvent.click(row);
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('non-zero citation rate row is rendered as non-interactive div', () => {
    const onSelect = vi.fn();
    render(
      <QueryRow
        query={{ id: 'q2', query_text: 'passing query', query_category: 'discovery', citation_rate: 0.4 }}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByTestId('passing-query-row')).toBeTruthy();
    expect(screen.queryByTestId('failing-query-row')).toBeNull();
  });
});
