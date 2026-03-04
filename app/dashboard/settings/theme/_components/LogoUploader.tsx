/**
 * LogoUploader — Sprint 115
 *
 * Client component: logo upload with preview and remove.
 */

'use client';

import { useState, useRef } from 'react';
import * as Sentry from '@sentry/nextjs';

interface LogoUploaderProps {
  currentLogoUrl: string | null;
  onLogoChange: (url: string | null) => void;
}

export default function LogoUploader({ currentLogoUrl, onLogoChange }: LogoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Client-side validation
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only PNG, JPEG, WebP, and SVG files are allowed.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('File size must not exceed 2MB.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);

      const res = await fetch('/api/whitelabel/theme/logo', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? 'Failed to upload logo.');
        return;
      }

      onLogoChange(data.logo_url);
    } catch (err) {
      Sentry.captureException(err);
      setError('Network error. Please try again.');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function handleRemove() {
    if (!window.confirm('Remove the logo?')) return;

    setError(null);
    try {
      const res = await fetch('/api/whitelabel/theme/logo', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? 'Failed to remove logo.');
        return;
      }
      onLogoChange(null);
    } catch (err) {
      Sentry.captureException(err);
      setError('Network error. Please try again.');
    }
  }

  return (
    <div className="space-y-3">
      {currentLogoUrl ? (
        <div className="flex items-center gap-4">
          <div data-testid="logo-preview" className="rounded border border-white/10 bg-[#050A15] p-2">
            <img
              src={currentLogoUrl}
              alt="Organization logo"
              style={{ maxWidth: '150px', maxHeight: '60px', objectFit: 'contain' }}
            />
          </div>
          <button
            data-testid="remove-logo-btn"
            onClick={handleRemove}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Remove
          </button>
        </div>
      ) : (
        <div
          data-testid="logo-upload-area"
          className="rounded-lg border-2 border-dashed border-white/10 p-6 text-center"
        >
          <p className="text-sm text-slate-400 mb-2">Upload your organization logo</p>
          <p className="text-xs text-slate-400">PNG, JPEG, WebP, or SVG. Max 2MB.</p>
        </div>
      )}

      <input
        ref={fileInputRef}
        data-testid="logo-upload-input"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={handleFileChange}
        disabled={uploading}
        className="block text-xs text-slate-400 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-indigo-500 file:cursor-pointer disabled:opacity-50"
      />

      {uploading && <p className="text-xs text-slate-400">Uploading...</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
