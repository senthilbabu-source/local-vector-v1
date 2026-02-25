// ---------------------------------------------------------------------------
// lib/useOnWindowResize.ts — Tremor Raw Window Resize Hook
//
// Used by chart components for responsive layout recalculation.
// Source: https://www.tremor.so/docs/getting-started/installation/next
// ---------------------------------------------------------------------------

// Tremor useOnWindowResize [v0.0.2]

import * as React from 'react';

export const useOnWindowResize = (handler: () => void) => {
  React.useEffect(() => {
    const handleResize = () => {
      handler();
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handler]);
};
