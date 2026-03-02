/**
 * Sprint 115 — theme-utils.test.ts
 *
 * Pure function tests — zero mocks.
 * 27 tests for validateHexColor, sanitizeHexColor, computeTextOnPrimary,
 * buildThemeCssProps, cssPropsToStyleString, and buildLogoStoragePath.
 */

import { describe, it, expect } from 'vitest';
import {
  validateHexColor,
  sanitizeHexColor,
  computeTextOnPrimary,
  buildThemeCssProps,
  cssPropsToStyleString,
  buildLogoStoragePath,
} from '@/lib/whitelabel/theme-utils';
import type { OrgTheme } from '@/lib/whitelabel/types';

// ---------------------------------------------------------------------------
// validateHexColor
// ---------------------------------------------------------------------------

describe('validateHexColor — pure', () => {
  it('accepts valid 6-digit hex with #', () => {
    expect(validateHexColor('#6366f1')).toBe(true);
  });

  it('accepts uppercase hex', () => {
    expect(validateHexColor('#FFFFFF')).toBe(true);
  });

  it('rejects 3-char shorthand', () => {
    expect(validateHexColor('#fff')).toBe(false);
  });

  it('rejects missing # prefix', () => {
    expect(validateHexColor('6366f1')).toBe(false);
  });

  it('rejects 8-char hex with alpha', () => {
    expect(validateHexColor('#6366f1ff')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateHexColor('')).toBe(false);
  });

  it('rejects invalid hex characters', () => {
    expect(validateHexColor('#xyz123')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sanitizeHexColor
// ---------------------------------------------------------------------------

describe('sanitizeHexColor — pure', () => {
  it('trims whitespace and lowercases', () => {
    expect(sanitizeHexColor('  #6366F1  ')).toBe('#6366f1');
  });

  it('adds # prefix if missing', () => {
    expect(sanitizeHexColor('6366f1')).toBe('#6366f1');
  });

  it('returns null for invalid input', () => {
    expect(sanitizeHexColor('notacolor')).toBeNull();
  });

  it('returns null for shorthand hex', () => {
    expect(sanitizeHexColor('#fff')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeTextOnPrimary
// ---------------------------------------------------------------------------

describe('computeTextOnPrimary — pure', () => {
  it('returns black text on white background', () => {
    expect(computeTextOnPrimary('#ffffff')).toBe('#000000');
  });

  it('returns white text on black background', () => {
    expect(computeTextOnPrimary('#000000')).toBe('#ffffff');
  });

  it('returns black text on indigo (mid-range luminance)', () => {
    // #6366f1 has enough luminance that black text provides better contrast
    expect(computeTextOnPrimary('#6366f1')).toBe('#000000');
  });

  it('returns black text on amber/yellow (light color)', () => {
    expect(computeTextOnPrimary('#fbbf24')).toBe('#000000');
  });

  it('returns white text on deep navy', () => {
    expect(computeTextOnPrimary('#1a1a2e')).toBe('#ffffff');
  });
});

// ---------------------------------------------------------------------------
// buildThemeCssProps
// ---------------------------------------------------------------------------

describe('buildThemeCssProps — pure', () => {
  const theme: Pick<OrgTheme, 'primary_color' | 'accent_color' | 'text_on_primary' | 'font_family'> = {
    primary_color: '#1a1a2e',
    accent_color: '#e94560',
    text_on_primary: '#ffffff',
    font_family: 'Poppins',
  };

  it('returns all 4 CSS custom property keys', () => {
    const props = buildThemeCssProps(theme);
    expect(props).toHaveProperty('--brand-primary');
    expect(props).toHaveProperty('--brand-accent');
    expect(props).toHaveProperty('--brand-text-on-primary');
    expect(props).toHaveProperty('--brand-font-family');
  });

  it('Inter font uses system font stack without quotes', () => {
    const interTheme = { ...theme, font_family: 'Inter' as const };
    const props = buildThemeCssProps(interTheme);
    expect(props['--brand-font-family']).toBe('Inter, system-ui, sans-serif');
  });

  it('Poppins font wraps in quotes', () => {
    const props = buildThemeCssProps(theme);
    expect(props['--brand-font-family']).toBe("'Poppins', Inter, system-ui, sans-serif");
  });

  it('primary_color matches input', () => {
    const props = buildThemeCssProps(theme);
    expect(props['--brand-primary']).toBe('#1a1a2e');
  });
});

// ---------------------------------------------------------------------------
// cssPropsToStyleString
// ---------------------------------------------------------------------------

describe('cssPropsToStyleString — pure', () => {
  const props = buildThemeCssProps({
    primary_color: '#6366f1',
    accent_color: '#8b5cf6',
    text_on_primary: '#ffffff',
    font_family: 'Inter',
  });

  it('contains all 4 properties', () => {
    const str = cssPropsToStyleString(props);
    expect(str).toContain('--brand-primary');
    expect(str).toContain('--brand-accent');
    expect(str).toContain('--brand-text-on-primary');
    expect(str).toContain('--brand-font-family');
  });

  it('properties separated by semicolons', () => {
    const str = cssPropsToStyleString(props);
    expect(str.split('; ').length).toBe(4);
  });

  it('produces deterministic output', () => {
    const str1 = cssPropsToStyleString(props);
    const str2 = cssPropsToStyleString(props);
    expect(str1).toBe(str2);
  });
});

// ---------------------------------------------------------------------------
// buildLogoStoragePath
// ---------------------------------------------------------------------------

describe('buildLogoStoragePath — pure', () => {
  const orgId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  it('builds path for PNG file', () => {
    expect(buildLogoStoragePath(orgId, 'logo.png')).toBe(`${orgId}/logo.png`);
  });

  it('lowercases the extension', () => {
    expect(buildLogoStoragePath(orgId, 'MyLogo.PNG')).toBe(`${orgId}/logo.png`);
  });

  it('returns null for unsupported GIF format', () => {
    expect(buildLogoStoragePath(orgId, 'logo.gif')).toBeNull();
  });

  it('returns null for file without extension', () => {
    expect(buildLogoStoragePath(orgId, 'no-extension')).toBeNull();
  });
});
