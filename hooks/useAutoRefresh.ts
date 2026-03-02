'use client';

import { useEffect } from 'react';

/**
 * Listens for 'localvector:refresh' CustomEvent on window.
 * Calls onRefresh() when event.detail.keys includes any of `keys`.
 *
 * onRefresh should be wrapped in useCallback at the call site to be stable.
 */
export function useAutoRefresh(keys: string[], onRefresh: () => void): void {
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ keys: string[] }>;
      const eventKeys = custom.detail?.keys ?? [];
      if (keys.some((k) => eventKeys.includes(k))) {
        onRefresh();
      }
    };

    window.addEventListener('localvector:refresh', handler);
    return () => {
      window.removeEventListener('localvector:refresh', handler);
    };
  }, [keys, onRefresh]);
}
