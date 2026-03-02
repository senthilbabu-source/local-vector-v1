/**
 * ThemeEditorForm — Sprint 115
 *
 * Client component: color pickers, font dropdown, logo upload,
 * powered-by toggle, and a save button with real-time preview.
 */

'use client';

import { useState, useCallback } from 'react';
import * as Sentry from '@sentry/nextjs';
import type { OrgTheme, FontFamily } from '@/lib/whitelabel/types';
import { GOOGLE_FONT_FAMILIES } from '@/lib/whitelabel/types';
import { validateHexColor, computeTextOnPrimary } from '@/lib/whitelabel/theme-utils';
import ThemePreview from './ThemePreview';
import LogoUploader from './LogoUploader';
import PoweredByToggle from './PoweredByToggle';

interface ThemeEditorFormProps {
  initialTheme: OrgTheme;
  orgName: string;
}

export default function ThemeEditorForm({ initialTheme, orgName }: ThemeEditorFormProps) {
  const [primaryColor, setPrimaryColor] = useState(initialTheme.primary_color);
  const [accentColor, setAccentColor] = useState(initialTheme.accent_color);
  const [fontFamily, setFontFamily] = useState<FontFamily>(initialTheme.font_family);
  const [logoUrl, setLogoUrl] = useState(initialTheme.logo_url);
  const [showPoweredBy, setShowPoweredBy] = useState(initialTheme.show_powered_by);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDirty =
    primaryColor !== initialTheme.primary_color ||
    accentColor !== initialTheme.accent_color ||
    fontFamily !== initialTheme.font_family;

  const textOnPrimary = computeTextOnPrimary(primaryColor);

  const handleColorChange = useCallback((setter: (v: string) => void) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
    };
  }, []);

  const handleHexInput = useCallback((setter: (v: string) => void) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (validateHexColor(val)) {
        setter(val);
      }
    };
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setToast(null);

    try {
      const res = await fetch('/api/whitelabel/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary_color: primaryColor,
          accent_color: accentColor,
          font_family: fontFamily,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? 'Failed to save theme.');
        setSaving(false);
        return;
      }

      setToast('Theme saved');
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      Sentry.captureException(err);
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const handleLogoChange = useCallback((url: string | null) => {
    setLogoUrl(url);
  }, []);

  const handlePoweredByChange = useCallback((value: boolean) => {
    setShowPoweredBy(value);
  }, []);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Editor column */}
      <div className="space-y-6">
        {/* Logo */}
        <div className="rounded-lg border border-white/10 bg-[#0A1628] p-6">
          <h3 className="mb-4 text-sm font-semibold text-white">Logo</h3>
          <LogoUploader currentLogoUrl={logoUrl} onLogoChange={handleLogoChange} />
        </div>

        {/* Colors */}
        <div className="rounded-lg border border-white/10 bg-[#0A1628] p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white">Colors</h3>

          {/* Primary color */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Primary Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={handleColorChange(setPrimaryColor)}
                className="h-9 w-9 cursor-pointer rounded border border-white/10 bg-transparent p-0"
              />
              <input
                data-testid="primary-color-input"
                type="text"
                value={primaryColor}
                onChange={handleHexInput(setPrimaryColor)}
                className="w-28 rounded-md border border-white/10 bg-[#050A15] px-3 py-1.5 text-xs font-mono text-white"
                maxLength={7}
              />
            </div>
          </div>

          {/* Accent color */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Accent Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={accentColor}
                onChange={handleColorChange(setAccentColor)}
                className="h-9 w-9 cursor-pointer rounded border border-white/10 bg-transparent p-0"
              />
              <input
                data-testid="accent-color-input"
                type="text"
                value={accentColor}
                onChange={handleHexInput(setAccentColor)}
                className="w-28 rounded-md border border-white/10 bg-[#050A15] px-3 py-1.5 text-xs font-mono text-white"
                maxLength={7}
              />
            </div>
          </div>
        </div>

        {/* Font */}
        <div className="rounded-lg border border-white/10 bg-[#0A1628] p-6">
          <h3 className="mb-3 text-sm font-semibold text-white">Font Family</h3>
          <select
            data-testid="font-family-select"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value as FontFamily)}
            className="w-full rounded-md border border-white/10 bg-[#050A15] px-3 py-2 text-sm text-white"
          >
            {GOOGLE_FONT_FAMILIES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        {/* Powered by toggle */}
        <div className="rounded-lg border border-white/10 bg-[#0A1628] p-6">
          <PoweredByToggle
            initialValue={showPoweredBy}
            onChange={handlePoweredByChange}
          />
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3">
          <button
            data-testid="save-theme-btn"
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="rounded-md bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Theme'}
          </button>
          {toast && <span className="text-sm text-green-400">{toast}</span>}
          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>
      </div>

      {/* Preview column */}
      <div className="space-y-6">
        <ThemePreview
          primaryColor={primaryColor}
          accentColor={accentColor}
          textOnPrimary={textOnPrimary}
          fontFamily={fontFamily}
          logoUrl={logoUrl}
          orgName={orgName}
          showPoweredBy={showPoweredBy}
        />
      </div>
    </div>
  );
}
