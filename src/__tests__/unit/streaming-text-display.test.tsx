// ---------------------------------------------------------------------------
// Sprint 120: StreamingTextDisplay — 8 unit tests (RTL)
// ---------------------------------------------------------------------------

// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StreamingTextDisplay from '@/components/StreamingTextDisplay';

describe('StreamingTextDisplay — RTL', () => {
  it('renders placeholder when status="idle" and text=""', () => {
    render(
      <StreamingTextDisplay text="" status="idle" placeholder="Click to start" />,
    );
    const placeholder = screen.getByTestId('streaming-placeholder');
    expect(placeholder.textContent).toBe('Click to start');
  });

  it('renders "Generating..." when status="connecting"', () => {
    render(<StreamingTextDisplay text="" status="connecting" />);
    const display = screen.getByTestId('streaming-text-display');
    expect(display.textContent).toContain('Generating');
  });

  it('renders text content when provided', () => {
    render(
      <StreamingTextDisplay
        text="Hello world"
        status="streaming"
      />,
    );
    const display = screen.getByTestId('streaming-text-display');
    expect(display.textContent).toContain('Hello world');
  });

  it('shows blinking cursor (data-testid="streaming-cursor") when status="streaming"', () => {
    render(
      <StreamingTextDisplay text="Hello" status="streaming" />,
    );
    expect(screen.getByTestId('streaming-cursor')).toBeTruthy();
  });

  it('hides cursor when status="complete"', () => {
    render(
      <StreamingTextDisplay text="Hello world" status="complete" />,
    );
    expect(screen.queryByTestId('streaming-cursor')).toBeNull();
  });

  it('shows error styling when status="error"', () => {
    render(
      <StreamingTextDisplay
        text="Partial content"
        status="error"
      />,
    );
    const display = screen.getByTestId('streaming-text-display');
    expect(display.textContent).toContain('(Error)');
  });

  it('shows "(Cancelled)" suffix when status="cancelled"', () => {
    render(
      <StreamingTextDisplay
        text="Partial content"
        status="cancelled"
      />,
    );
    const display = screen.getByTestId('streaming-text-display');
    expect(display.textContent).toContain('(Cancelled)');
  });

  it('applies whitespace-pre-wrap for line break preservation', () => {
    render(
      <StreamingTextDisplay
        text="Line 1\nLine 2"
        status="streaming"
      />,
    );
    const display = screen.getByTestId('streaming-text-display');
    expect(display.className).toContain('whitespace-pre-wrap');
  });
});
