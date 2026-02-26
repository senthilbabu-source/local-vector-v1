// ---------------------------------------------------------------------------
// WordPressConnectModal — Sprint 61C: WordPress Credential Management
//
// Modal form for entering WordPress site URL, username, and Application
// Password. Includes a "Test Connection" step before saving.
//
// Credentials are stored server-side only via saveWordPressCredentials().
// Never exposed to the client after save.
// ---------------------------------------------------------------------------

'use client';

import { useState, useTransition } from 'react';
import { X, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import {
  testWordPressConnection,
  saveWordPressCredentials,
} from '../actions';

interface WordPressConnectModalProps {
  locationId: string;
  open: boolean;
  onClose: () => void;
}

export default function WordPressConnectModal({
  locationId,
  open,
  onClose,
}: WordPressConnectModalProps) {
  const [siteUrl, setSiteUrl] = useState('');
  const [username, setUsername] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isTesting, startTestTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();

  if (!open) return null;

  function handleTest() {
    setError(null);
    setTestResult('idle');
    startTestTransition(async () => {
      const result = await testWordPressConnection(siteUrl, username, appPassword);
      if (result.success) {
        setTestResult('success');
      } else {
        setTestResult('error');
        setError(result.error);
      }
    });
  }

  function handleSave() {
    setError(null);
    startSaveTransition(async () => {
      const result = await saveWordPressCredentials(locationId, siteUrl, username, appPassword);
      if (result.success) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  const canTest = siteUrl.length > 0 && username.length > 0 && appPassword.length > 0;
  const canSave = testResult === 'success';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-xl bg-midnight-slate p-6 shadow-xl ring-1 ring-white/10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            Connect WordPress
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Help text */}
        <p className="mt-2 text-xs text-slate-400">
          Create an Application Password in your WordPress admin:
          Users &rarr; Your Profile &rarr; Application Passwords
        </p>

        {/* Form */}
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="wp-site-url" className="block text-xs font-medium text-slate-400">
              WordPress Site URL
            </label>
            <input
              id="wp-site-url"
              type="url"
              placeholder="https://yoursite.com"
              value={siteUrl}
              onChange={(e) => { setSiteUrl(e.target.value); setTestResult('idle'); }}
              className="mt-1 w-full rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-electric-indigo focus:outline-none focus:ring-1 focus:ring-electric-indigo"
            />
          </div>
          <div>
            <label htmlFor="wp-username" className="block text-xs font-medium text-slate-400">
              Username
            </label>
            <input
              id="wp-username"
              type="text"
              placeholder="admin"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setTestResult('idle'); }}
              className="mt-1 w-full rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-electric-indigo focus:outline-none focus:ring-1 focus:ring-electric-indigo"
            />
          </div>
          <div>
            <label htmlFor="wp-app-password" className="block text-xs font-medium text-slate-400">
              Application Password
            </label>
            <input
              id="wp-app-password"
              type="password"
              placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
              value={appPassword}
              onChange={(e) => { setAppPassword(e.target.value); setTestResult('idle'); }}
              className="mt-1 w-full rounded-lg border border-white/10 bg-surface-dark px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-electric-indigo focus:outline-none focus:ring-1 focus:ring-electric-indigo"
            />
          </div>
        </div>

        {/* Test result feedback */}
        {testResult === 'success' && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-400/10 px-3 py-2 text-xs text-emerald-400">
            <CheckCircle className="h-4 w-4" />
            Connection successful
          </div>
        )}
        {testResult === 'error' && error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-alert-crimson/10 px-3 py-2 text-xs text-alert-crimson">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={handleTest}
            disabled={!canTest || isTesting}
            className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-600 disabled:opacity-50"
          >
            {isTesting && <Loader2 className="h-4 w-4 animate-spin" />}
            Test Connection
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className="flex items-center gap-2 rounded-lg bg-electric-indigo px-4 py-2 text-sm font-semibold text-white transition hover:bg-electric-indigo/90 disabled:opacity-50"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save &amp; Connect
          </button>
        </div>
      </div>
    </div>
  );
}
