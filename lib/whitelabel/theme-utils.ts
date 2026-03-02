/**
 * Theme Utilities — Sprint 115
 *
 * Pure utility functions for color manipulation, font URLs,
 * CSS custom property generation, and logo path construction.
 * Zero API calls. Zero DB calls. Fully testable with zero mocks.
 */

import type { OrgTheme, ThemeCssProps, FontFamily } from './types';
import { GOOGLE_FONT_FAMILIES } from './types';

// ---------------------------------------------------------------------------
// Color validation
// ---------------------------------------------------------------------------

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

/** Returns true if color matches /^#[0-9a-fA-F]{6}$/ */
export function validateHexColor(color: string): boolean {
  return HEX_COLOR_REGEX.test(color);
}

/**
 * Sanitizes user input into a valid lowercase hex color string.
 * Returns null if the input cannot be sanitized to a valid hex.
 */
export function sanitizeHexColor(color: string): string | null {
  let trimmed = color.trim();
  if (!trimmed.startsWith('#')) {
    trimmed = '#' + trimmed;
  }
  trimmed = trimmed.toLowerCase();
  if (!validateHexColor(trimmed)) return null;
  return trimmed;
}

// ---------------------------------------------------------------------------
// Text contrast computation (WCAG)
// ---------------------------------------------------------------------------

/**
 * Determines whether white or black text has better contrast on the given background.
 * Uses the WCAG 2.1 relative luminance formula.
 */
export function computeTextOnPrimary(hexColor: string): '#ffffff' | '#000000' {
  const r = parseInt(hexColor.slice(1, 3), 16) / 255;
  const g = parseInt(hexColor.slice(3, 5), 16) / 255;
  const b = parseInt(hexColor.slice(5, 7), 16) / 255;

  const linearize = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  const R = linearize(r);
  const G = linearize(g);
  const B = linearize(b);

  const L = 0.2126 * R + 0.7152 * G + 0.0722 * B;

  // Contrast ratio with white (luminance 1.0)
  const contrastWhite = (1.0 + 0.05) / (L + 0.05);
  // Contrast ratio with black (luminance 0.0)
  const contrastBlack = (L + 0.05) / (0.0 + 0.05);

  return contrastWhite > contrastBlack ? '#ffffff' : '#000000';
}

// ---------------------------------------------------------------------------
// CSS custom property builders
// ---------------------------------------------------------------------------

/** Builds ThemeCssProps from an OrgTheme. Pure function. */
export function buildThemeCssProps(theme: Pick<OrgTheme, 'primary_color' | 'accent_color' | 'text_on_primary' | 'font_family'>): ThemeCssProps {
  const fontStack =
    theme.font_family === 'Inter'
      ? 'Inter, system-ui, sans-serif'
      : `'${theme.font_family}', Inter, system-ui, sans-serif`;

  return {
    '--brand-primary': theme.primary_color,
    '--brand-accent': theme.accent_color,
    '--brand-text-on-primary': theme.text_on_primary,
    '--brand-font-family': fontStack,
  };
}

/** Converts ThemeCssProps to inline CSS style string. */
export function cssPropsToStyleString(props: ThemeCssProps): string {
  return Object.entries(props)
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ');
}

/** Converts ThemeCssProps to a React CSSProperties object. */
export function cssPropsToObject(props: ThemeCssProps): React.CSSProperties {
  return props as unknown as React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Color manipulation
// ---------------------------------------------------------------------------

/** Lightens a hex color by blending with white. amount: 0.0 (no change) to 1.0 (white). */
export function lightenColor(hexColor: string, amount: number): string {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);

  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Logo storage path
// ---------------------------------------------------------------------------

const SUPPORTED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'svg']);

/**
 * Builds the Supabase Storage path for an org logo.
 * Returns null if the file extension is not supported.
 */
export function buildLogoStoragePath(orgId: string, filename: string): string | null {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1) return null;

  const ext = filename.slice(dotIndex + 1).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) return null;

  return `${orgId}/logo.${ext}`;
}

/** Returns true if the given font is in the allowed list. */
export function isValidFontFamily(font: string): font is FontFamily {
  return (GOOGLE_FONT_FAMILIES as readonly string[]).includes(font);
}
