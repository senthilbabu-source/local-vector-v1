// ---------------------------------------------------------------------------
// InfoTooltip — Sprint B (H1)
//
// A composable "?" info icon with a popover for metric explanations.
// Opens on hover (mouse) and click/Enter (keyboard/touch).
// Uses @radix-ui/react-popover for reliable multi-line content display.
//
// Usage:
//   <div className="flex items-center gap-1.5">
//     <h3 className="text-sm font-medium">Reality Score</h3>
//     <InfoTooltip content="A 0-100 measure of how accurately AI models..." />
//   </div>
// ---------------------------------------------------------------------------

'use client';

import { useState, useRef, useCallback } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { HelpCircle } from 'lucide-react';

interface InfoTooltipProps {
  /** The tooltip content. Can be a string or JSX. */
  content: React.ReactNode;
  /** Screen-reader label for the trigger button. Default: "More information" */
  label?: string;
  /** Popover alignment relative to the trigger. Default: "start" */
  align?: 'start' | 'center' | 'end';
}

export function InfoTooltip({ content, label = 'More information', align = 'start' }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  }, []);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-500/60 transition-colors hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-surface-dark"
          aria-label={label}
          data-testid="info-tooltip-trigger"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="bottom"
          align={align}
          sideOffset={6}
          className="z-50 max-w-xs rounded-lg border border-white/10 bg-midnight-slate px-3 py-2.5 shadow-xl animate-in fade-in-0 zoom-in-95"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          data-testid="info-tooltip-content"
        >
          {typeof content === 'string' ? (
            <p className="text-sm text-slate-300 leading-relaxed">{content}</p>
          ) : (
            content
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
