// ---------------------------------------------------------------------------
// Inline SVG logo mark — uses currentColor so parent controls the fill
// ---------------------------------------------------------------------------

import React from 'react';

export default function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 524.5 469.5"
      fill="currentColor"
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <path d="M185.5,13.8l76.8,138,13.4-20h65.7c-24.4,40.3-43,78-68.6,124-1.9,3.5-9.8,19.1-13.7,16.3l-110.3-200.4h-36.7l148.1,267.2L412.6,71.7h-104.7l32.3-57.9h172.6l-252.7,445.4L11.8,13.8h173.7Z" />
    </svg>
  );
}
