// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// wave2-s20-wins-feed.test.tsx — S20: Wins Feed
// AI_RULES §220
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
import { createHallucinationWin, getRecentWins } from '@/lib/services/wins.service';
import WinCard from '@/app/dashboard/_components/WinCard';
import RecentWinsSection from '@/app/dashboard/_components/RecentWinsSection';
import type { WinRow } from '@/lib/services/wins.service';

// ---------------------------------------------------------------------------
// Service: createHallucinationWin
// ---------------------------------------------------------------------------

function makeInsertSupabase(error: object | null = null) {
  const insert = vi.fn().mockResolvedValue({ error });
  return {
    from: vi.fn().mockReturnValue({ insert }),
    _insert: insert,
  };
}

describe('createHallucinationWin', () => {
  it('inserts a win record with correct win_type', async () => {
    const sb = makeInsertSupabase();
    await createHallucinationWin(sb as never, 'org1', 'Wrong hours listed');
    expect(sb._insert).toHaveBeenCalledWith(
      expect.objectContaining({ win_type: 'hallucination_fixed', org_id: 'org1' }),
    );
  });

  it('includes detail from claim_text', async () => {
    const sb = makeInsertSupabase();
    await createHallucinationWin(sb as never, 'org1', 'Wrong phone number shown');
    expect(sb._insert).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Wrong phone number shown' }),
    );
  });

  it('truncates claim_text longer than 120 chars', async () => {
    const sb = makeInsertSupabase();
    const longText = 'A'.repeat(130);
    await createHallucinationWin(sb as never, 'org1', longText);
    const call = sb._insert.mock.calls[0][0] as { detail: string };
    expect(call.detail.length).toBeLessThanOrEqual(120);
    expect(call.detail.endsWith('…')).toBe(true);
  });

  it('includes revenue_impact when positive', async () => {
    const sb = makeInsertSupabase();
    await createHallucinationWin(sb as never, 'org1', 'Wrong address', 45);
    expect(sb._insert).toHaveBeenCalledWith(
      expect.objectContaining({ revenue_impact: 45 }),
    );
  });

  it('sets revenue_impact to null when 0', async () => {
    const sb = makeInsertSupabase();
    await createHallucinationWin(sb as never, 'org1', 'Wrong address', 0);
    expect(sb._insert).toHaveBeenCalledWith(
      expect.objectContaining({ revenue_impact: null }),
    );
  });

  it('sets revenue_impact to null when undefined', async () => {
    const sb = makeInsertSupabase();
    await createHallucinationWin(sb as never, 'org1', 'Wrong address');
    expect(sb._insert).toHaveBeenCalledWith(
      expect.objectContaining({ revenue_impact: null }),
    );
  });

  it('throws when DB returns an error', async () => {
    const sb = makeInsertSupabase({ message: 'insert failed' });
    await expect(createHallucinationWin(sb as never, 'org1', 'claim')).rejects.toThrow('insert failed');
  });
});

// ---------------------------------------------------------------------------
// Service: getRecentWins
// ---------------------------------------------------------------------------

function makeSelectSupabase(data: WinRow[] | null) {
  const limit = vi.fn().mockResolvedValue({ data });
  const order = vi.fn().mockReturnValue({ limit });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  return { from: vi.fn().mockReturnValue({ select }) };
}

describe('getRecentWins', () => {
  it('returns wins array from DB', async () => {
    const wins: WinRow[] = [
      { id: 'w1', org_id: 'org1', win_type: 'hallucination_fixed', title: 'Fixed!', detail: null, revenue_impact: null, created_at: '2026-03-01T00:00:00Z' },
    ];
    const sb = makeSelectSupabase(wins);
    const result = await getRecentWins(sb as never, 'org1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('w1');
  });

  it('returns empty array when data is null', async () => {
    const sb = makeSelectSupabase(null);
    const result = await getRecentWins(sb as never, 'org1');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Component: WinCard
// ---------------------------------------------------------------------------

const SAMPLE_WIN: WinRow = {
  id: 'w1',
  org_id: 'org1',
  win_type: 'hallucination_fixed',
  title: 'Fixed an AI mistake',
  detail: 'Wrong hours listed on AI search',
  revenue_impact: 55,
  created_at: new Date().toISOString(),
};

describe('WinCard', () => {
  it('renders win title', () => {
    render(<WinCard win={SAMPLE_WIN} />);
    expect(screen.getByText('Fixed an AI mistake')).toBeTruthy();
  });

  it('renders detail text', () => {
    render(<WinCard win={SAMPLE_WIN} />);
    expect(screen.getByText('Wrong hours listed on AI search')).toBeTruthy();
  });

  it('renders revenue impact when positive', () => {
    render(<WinCard win={SAMPLE_WIN} />);
    expect(screen.getByText(/\$55\/mo recovered/)).toBeTruthy();
  });

  it('hides revenue impact when null', () => {
    render(<WinCard win={{ ...SAMPLE_WIN, revenue_impact: null }} />);
    expect(screen.queryByText(/recovered/)).toBeNull();
  });

  it('renders testid', () => {
    render(<WinCard win={SAMPLE_WIN} />);
    expect(screen.getByTestId('win-card')).toBeTruthy();
  });

  it('shows "Today" for a win created just now', () => {
    render(<WinCard win={{ ...SAMPLE_WIN, created_at: new Date().toISOString() }} />);
    expect(screen.getByText('Today')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Component: RecentWinsSection
// ---------------------------------------------------------------------------

describe('RecentWinsSection', () => {
  it('renders nothing when wins is empty', () => {
    const { container } = render(<RecentWinsSection wins={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders wins section when wins are present', () => {
    render(<RecentWinsSection wins={[SAMPLE_WIN]} />);
    expect(screen.getByTestId('recent-wins-section')).toBeTruthy();
  });

  it('renders "Recent Wins" heading', () => {
    render(<RecentWinsSection wins={[SAMPLE_WIN]} />);
    expect(screen.getByText('Recent Wins')).toBeTruthy();
  });

  it('renders "See all →" link to /dashboard/wins', () => {
    render(<RecentWinsSection wins={[SAMPLE_WIN]} />);
    const link = screen.getByText('See all →');
    expect(link.closest('a')?.getAttribute('href')).toBe('/dashboard/wins');
  });

  it('renders multiple WinCards', () => {
    const wins = [
      { ...SAMPLE_WIN, id: 'w1' },
      { ...SAMPLE_WIN, id: 'w2' },
    ];
    render(<RecentWinsSection wins={wins} />);
    expect(screen.getAllByTestId('win-card')).toHaveLength(2);
  });
});
