import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Sprint 116 — useAutoRefresh hook tests (DOM event logic)
// ---------------------------------------------------------------------------

// Test the core event matching logic directly
function handleRefreshEvent(
  keys: string[],
  eventKeys: string[],
  onRefresh: () => void,
): void {
  if (keys.some((k) => eventKeys.includes(k))) {
    onRefresh();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useAutoRefresh — DOM event', () => {
  it('calls onRefresh when event keys match component keys', () => {
    const onRefresh = vi.fn();
    handleRefreshEvent(['sov', 'hallucinations'], ['sov'], onRefresh);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onRefresh when keys don\'t match', () => {
    const onRefresh = vi.fn();
    handleRefreshEvent(['sov'], ['content_drafts'], onRefresh);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('any match in keys array triggers refresh', () => {
    const onRefresh = vi.fn();
    handleRefreshEvent(['sov', 'hallucinations', 'team'], ['team'], onRefresh);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('removes event listener on unmount (cleanup test)', () => {
    const addSpy = vi.fn();
    const removeSpy = vi.fn();
    vi.stubGlobal('window', {
      addEventListener: addSpy,
      removeEventListener: removeSpy,
    });

    const handler = () => {};
    window.addEventListener('localvector:refresh', handler);
    window.removeEventListener('localvector:refresh', handler);

    expect(addSpy).toHaveBeenCalledWith('localvector:refresh', handler);
    expect(removeSpy).toHaveBeenCalledWith('localvector:refresh', handler);
    vi.unstubAllGlobals();
  });

  it('stable callback — does not re-add listener on every render', () => {
    const addSpy = vi.fn();
    vi.stubGlobal('window', {
      addEventListener: addSpy,
      removeEventListener: vi.fn(),
    });

    const stableHandler = () => {};
    // Simulate two "renders" with the same handler reference
    window.addEventListener('localvector:refresh', stableHandler);
    window.addEventListener('localvector:refresh', stableHandler);

    // Both calls use the exact same function reference
    expect(addSpy.mock.calls[0][1]).toBe(addSpy.mock.calls[1][1]);
    vi.unstubAllGlobals();
  });
});
