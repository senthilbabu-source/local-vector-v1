/**
 * Sprint 115 — email-theme-wrapper.test.ts
 *
 * Pure function tests — zero mocks.
 * 11 tests for buildThemedEmailWrapper.
 */

import { describe, it, expect } from 'vitest';
import { buildThemedEmailWrapper } from '@/lib/whitelabel/email-theme-wrapper';
import type { OrgTheme } from '@/lib/whitelabel/types';
import { MOCK_ORG_THEME, MOCK_ORG_THEME_WITH_LOGO } from '@/src/__fixtures__/golden-tenant';

const baseParams = {
  orgName: 'Charcoal N Chill',
  subject: 'Test Subject',
  bodyHtml: '<p>Hello from the test body.</p>',
};

describe('buildThemedEmailWrapper — pure', () => {
  it('uses DEFAULT_THEME colors when theme is null', () => {
    const result = buildThemedEmailWrapper({ ...baseParams, theme: null });
    expect(result.html).toContain('#6366f1');
  });

  it('uses custom primary_color in header background', () => {
    const result = buildThemedEmailWrapper({ ...baseParams, theme: MOCK_ORG_THEME });
    expect(result.html).toContain('#1a1a2e');
  });

  it('uses text_on_primary for header text color', () => {
    const result = buildThemedEmailWrapper({ ...baseParams, theme: MOCK_ORG_THEME });
    expect(result.html).toContain('color:#ffffff');
  });

  it('includes logo img tag when logo_url present', () => {
    const result = buildThemedEmailWrapper({ ...baseParams, theme: MOCK_ORG_THEME_WITH_LOGO });
    expect(result.html).toContain('<img');
    expect(result.html).toContain('org-logos');
  });

  it('does not include logo img tag when logo_url is null', () => {
    const result = buildThemedEmailWrapper({ ...baseParams, theme: MOCK_ORG_THEME });
    expect(result.html).not.toMatch(/<img[^>]*org-logos/);
  });

  it('includes "Powered by LocalVector" when show_powered_by is true', () => {
    const result = buildThemedEmailWrapper({ ...baseParams, theme: { ...MOCK_ORG_THEME, show_powered_by: true } });
    expect(result.html).toContain('Powered by');
    expect(result.html).toContain('LocalVector');
  });

  it('does NOT include "Powered by LocalVector" when show_powered_by is false', () => {
    const result = buildThemedEmailWrapper({ ...baseParams, theme: { ...MOCK_ORG_THEME, show_powered_by: false } });
    expect(result.html).not.toContain('Powered by');
  });

  it('includes bodyHtml content in output', () => {
    const result = buildThemedEmailWrapper({ ...baseParams, theme: null });
    expect(result.html).toContain('Hello from the test body.');
  });

  it('returns subject unchanged', () => {
    const result = buildThemedEmailWrapper({ ...baseParams, theme: null });
    expect(result.subject).toBe('Test Subject');
  });

  it('plain text version does not contain HTML tags', () => {
    const result = buildThemedEmailWrapper({ ...baseParams, theme: null });
    expect(result.text).not.toContain('<p>');
    expect(result.text).not.toContain('</p>');
  });

  it('includes previewText near top of HTML', () => {
    const result = buildThemedEmailWrapper({
      ...baseParams,
      theme: null,
      previewText: 'Preview text here',
    });
    expect(result.html).toContain('Preview text here');
    // Preview text should appear before the main body
    const previewIdx = result.html.indexOf('Preview text here');
    const bodyIdx = result.html.indexOf('Hello from the test body');
    expect(previewIdx).toBeLessThan(bodyIdx);
  });
});
