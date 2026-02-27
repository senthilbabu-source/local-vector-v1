'use client';

// ---------------------------------------------------------------------------
// BusinessInfoForm — Sprint 93
//
// All-in-one client form for editing location ground-truth data.
// Sections: GBP Sync (conditional) → Basic Info → Amenities → Hours.
// Single Save button with change detection → audit prompt banner.
//
// UI patterns for hours grid + amenities checkboxes replicate
// app/onboarding/_components/TruthCalibrationForm.tsx for consistency.
// ---------------------------------------------------------------------------

import { useState, useTransition, useRef } from 'react';
import Link from 'next/link';
import { saveBusinessInfo } from '../actions';
import { triggerGBPImport } from '@/app/actions/gbp-import';
import { triggerFirstAudit } from '@/app/onboarding/actions';
import type { HoursData, DayOfWeek, Amenities } from '@/lib/types/ground-truth';
import type { BusinessInfoPageData } from '../page';
import type { MappedLocationData } from '@/lib/gbp/gbp-data-mapper';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: 'monday',    label: 'Monday' },
  { key: 'tuesday',   label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday',  label: 'Thursday' },
  { key: 'friday',    label: 'Friday' },
  { key: 'saturday',  label: 'Saturday' },
  { key: 'sunday',    label: 'Sunday' },
];

type AmenityKey = keyof Pick<
  Amenities,
  'has_outdoor_seating' | 'serves_alcohol' | 'has_hookah' | 'is_kid_friendly' | 'takes_reservations' | 'has_live_music'
>;

const AMENITY_FIELDS: { key: AmenityKey; label: string }[] = [
  { key: 'serves_alcohol',       label: 'Serves alcohol' },
  { key: 'has_outdoor_seating',  label: 'Outdoor seating' },
  { key: 'takes_reservations',   label: 'Takes reservations' },
  { key: 'has_live_music',       label: 'Live music' },
  { key: 'has_hookah',           label: 'Hookah lounge' },
  { key: 'is_kid_friendly',      label: 'Kid friendly' },
];

const STATUS_OPTIONS = [
  { value: 'OPERATIONAL',            label: 'Open' },
  { value: 'CLOSED_TEMPORARILY',     label: 'Closed temporarily' },
  { value: 'CLOSED_PERMANENTLY',     label: 'Closed permanently' },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DayHoursState = { closed: boolean; open: string; close: string };
type AmenitiesState = Record<AmenityKey, boolean>;

interface BusinessInfoFormProps {
  location: BusinessInfoPageData['location'];
  hasGBPConnection: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initHours(hours_data: HoursData | null): Record<DayOfWeek, DayHoursState> {
  const result: Record<DayOfWeek, DayHoursState> = {
    monday:    { closed: false, open: '09:00', close: '21:00' },
    tuesday:   { closed: false, open: '09:00', close: '21:00' },
    wednesday: { closed: false, open: '09:00', close: '21:00' },
    thursday:  { closed: false, open: '09:00', close: '21:00' },
    friday:    { closed: false, open: '09:00', close: '22:00' },
    saturday:  { closed: false, open: '09:00', close: '22:00' },
    sunday:    { closed: true,  open: '10:00', close: '20:00' },
  };
  if (!hours_data) return result;
  for (const { key } of DAYS) {
    const entry = hours_data[key];
    if (!entry) {
      result[key] = { ...result[key], closed: true };
    } else if (entry === 'closed') {
      result[key] = { ...result[key], closed: true };
    } else {
      result[key] = { closed: false, open: entry.open, close: entry.close };
    }
  }
  return result;
}

function initAmenities(amenities: Partial<Amenities> | null): AmenitiesState {
  return {
    has_outdoor_seating: amenities?.has_outdoor_seating ?? false,
    serves_alcohol:      amenities?.serves_alcohol ?? false,
    has_hookah:          amenities?.has_hookah ?? false,
    is_kid_friendly:     amenities?.is_kid_friendly ?? false,
    takes_reservations:  amenities?.takes_reservations ?? false,
    has_live_music:      amenities?.has_live_music ?? false,
  };
}

function buildHoursPayload(hours: Record<DayOfWeek, DayHoursState>): HoursData {
  return Object.fromEntries(
    DAYS.map(({ key }) => {
      const day = hours[key];
      return [key, day.closed ? 'closed' as const : { open: day.open, close: day.close }];
    })
  ) as HoursData;
}

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

// Amenity key mapping: GBP mapper returns simplified keys, we need canonical keys.
function mapGBPAmenitiesToState(
  gbpAmenities: Record<string, boolean> | undefined
): Partial<AmenitiesState> {
  if (!gbpAmenities) return {};
  const mapping: Record<string, AmenityKey> = {
    outdoor_seating: 'has_outdoor_seating',
    alcohol:         'serves_alcohol',
    reservations:    'takes_reservations',
    live_music:      'has_live_music',
    hookah:          'has_hookah',
    kid_friendly:    'is_kid_friendly',
    // Also handle canonical keys directly
    has_outdoor_seating: 'has_outdoor_seating',
    serves_alcohol:      'serves_alcohol',
    takes_reservations:  'takes_reservations',
    has_live_music:      'has_live_music',
    has_hookah:          'has_hookah',
    is_kid_friendly:     'is_kid_friendly',
  };
  const result: Partial<AmenitiesState> = {};
  for (const [key, value] of Object.entries(gbpAmenities)) {
    const canonical = mapping[key];
    if (canonical) result[canonical] = value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BusinessInfoForm({
  location,
  hasGBPConnection,
}: BusinessInfoFormProps) {
  // ── Form state ──────────────────────────────────────────────────────────
  const [businessName, setBusinessName] = useState(location?.business_name ?? '');
  const [phone, setPhone] = useState(location?.phone ?? '');
  const [websiteUrl, setWebsiteUrl] = useState(location?.website_url ?? '');
  const [addressLine1, setAddressLine1] = useState(location?.address_line1 ?? '');
  const [city, setCity] = useState(location?.city ?? '');
  const [state, setState] = useState(location?.state ?? '');
  const [zip, setZip] = useState(location?.zip ?? '');
  const [primaryCategory, setPrimaryCategory] = useState(
    location?.categories?.[0] ?? ''
  );
  const [operationalStatus, setOperationalStatus] = useState(
    location?.operational_status ?? 'OPERATIONAL'
  );
  const [amenities, setAmenities] = useState<AmenitiesState>(
    initAmenities(location?.amenities ?? null)
  );
  const [hours, setHours] = useState<Record<DayOfWeek, DayHoursState>>(
    initHours(location?.hours_data ?? null)
  );

  // Snapshot of initial values for change detection.
  const initialRef = useRef({
    hours: buildHoursPayload(initHours(location?.hours_data ?? null)),
    amenities: initAmenities(location?.amenities ?? null),
    operationalStatus: location?.operational_status ?? 'OPERATIONAL',
  });

  // ── UI state ────────────────────────────────────────────────────────────
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Audit prompt
  const [showAuditPrompt, setShowAuditPrompt] = useState(false);
  const [changedFields, setChangedFields] = useState<string[]>([]);
  const [auditRunning, setAuditRunning] = useState(false);

  // GBP sync
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncErrorCode, setSyncErrorCode] = useState<string | null>(null);
  const [syncSummary, setSyncSummary] = useState<string | null>(null);

  // ── Handlers ────────────────────────────────────────────────────────────

  function toggleAmenity(key: AmenityKey) {
    setAmenities((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function updateHours(day: DayOfWeek, field: keyof DayHoursState, value: string | boolean) {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  }

  function handleStateBlur() {
    setState((v) => v.toUpperCase());
  }

  function handleWebsiteBlur() {
    setWebsiteUrl((v) => {
      if (!v.trim()) return v;
      if (v.startsWith('http://') || v.startsWith('https://')) return v;
      return `https://${v}`;
    });
  }

  function detectChanges(): string[] {
    const changed: string[] = [];
    const currentHours = buildHoursPayload(hours);
    if (JSON.stringify(currentHours) !== JSON.stringify(initialRef.current.hours)) {
      changed.push('hours_data');
    }
    if (JSON.stringify(amenities) !== JSON.stringify(initialRef.current.amenities)) {
      changed.push('amenities');
    }
    if (operationalStatus !== initialRef.current.operationalStatus) {
      changed.push('operational_status');
    }
    return changed;
  }

  function handleSave() {
    setValidationError(null);
    setSaveError(null);

    if (!businessName.trim() || businessName.trim().length < 2) {
      setValidationError('Business name is required (at least 2 characters).');
      return;
    }

    if (!location) {
      setSaveError('No location found. Please contact support.');
      return;
    }

    startTransition(async () => {
      const result = await saveBusinessInfo({
        location_id:      location.id,
        business_name:    businessName.trim(),
        phone:            phone || null,
        website_url:      websiteUrl || null,
        address_line1:    addressLine1 || null,
        city:             city || null,
        state:            state || null,
        zip:              zip || null,
        primary_category: primaryCategory || null,
        operational_status: operationalStatus,
        amenities,
        hours_data:       buildHoursPayload(hours),
      });

      if (!result.success) {
        setSaveStatus('error');
        setSaveError(result.error);
        return;
      }

      // Change detection for audit prompt.
      const changed = detectChanges();
      const groundTruthChanged = changed.length > 0;

      // Update initial snapshot after successful save.
      initialRef.current = {
        hours: buildHoursPayload(hours),
        amenities: { ...amenities },
        operationalStatus,
      };

      setSaveStatus('saved');
      if (groundTruthChanged) {
        setChangedFields(changed);
        setShowAuditPrompt(true);
      }
      setTimeout(() => setSaveStatus('idle'), 3000);
    });
  }

  async function handleGBPSync() {
    // Confirm if user has been editing.
    if (saveStatus !== 'idle') return;

    const hasEdits = detectChanges().length > 0;
    if (hasEdits) {
      const confirmed = window.confirm(
        'Re-syncing will replace your current edits with Google data. Continue?'
      );
      if (!confirmed) return;
    }

    setSyncStatus('syncing');
    setSyncError(null);
    setSyncErrorCode(null);
    setSyncSummary(null);

    const result = await triggerGBPImport();

    if (!result.ok) {
      setSyncStatus('error');
      setSyncError(result.error ?? 'Sync failed');
      setSyncErrorCode(result.error_code ?? null);
      return;
    }

    // Merge mapped data into form state.
    const mapped = result.mapped;
    if (mapped) {
      if (mapped.business_name) setBusinessName(mapped.business_name);
      if (mapped.phone) setPhone(mapped.phone);
      if (mapped.website_url) setWebsiteUrl(mapped.website_url);
      if (mapped.address_line1) setAddressLine1(mapped.address_line1);
      if (mapped.city) setCity(mapped.city);
      if (mapped.state) setState(mapped.state);
      if (mapped.zip) setZip(mapped.zip);
      if (mapped.primary_category) setPrimaryCategory(mapped.primary_category);
      if (mapped.operational_status !== undefined) setOperationalStatus(mapped.operational_status ?? 'OPERATIONAL');
      if (mapped.hours_data) setHours(initHours(mapped.hours_data));
      if (mapped.amenities) {
        const mappedState = mapGBPAmenitiesToState(mapped.amenities);
        setAmenities((prev) => ({ ...prev, ...mappedState }));
      }

      // Build summary of what was updated.
      const updated: string[] = [];
      if (mapped.hours_data)         updated.push('hours');
      if (mapped.amenities)          updated.push('amenities');
      if (mapped.phone)              updated.push('phone');
      if (mapped.business_name)      updated.push('business name');
      if (mapped.operational_status) updated.push('operational status');
      setSyncSummary(
        updated.length > 0
          ? `Updated: ${updated.join(', ')}`
          : 'No changes detected — your Google data matches what\'s saved.'
      );

      // If ground-truth fields changed via GBP sync, show audit prompt immediately
      // (data was already written to DB by the import endpoint).
      const gbpGroundTruthChanged = !!(mapped.hours_data || mapped.amenities || mapped.operational_status);
      if (gbpGroundTruthChanged) {
        const gbpChanged: string[] = [];
        if (mapped.hours_data) gbpChanged.push('hours_data');
        if (mapped.amenities) gbpChanged.push('amenities');
        if (mapped.operational_status) gbpChanged.push('operational_status');
        setChangedFields(gbpChanged);
        setShowAuditPrompt(true);
      }
    }

    setSyncStatus('success');
  }

  async function handleRunAudit() {
    setAuditRunning(true);
    const result = await triggerFirstAudit();
    if (!result.success) {
      console.warn('[business-info] Audit trigger failed:', result.error);
    }
    setShowAuditPrompt(false);
    setAuditRunning(false);
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (!location) {
    return (
      <section className="rounded-2xl bg-surface-dark border border-white/5 p-6">
        <p className="text-sm text-slate-400">
          No location data found. Please complete onboarding or contact support.
        </p>
        <Link
          href="/dashboard/settings"
          className="mt-3 inline-block text-xs font-medium text-signal-green hover:underline"
        >
          &larr; Back to Settings
        </Link>
      </section>
    );
  }

  function buildAuditMessage(): string {
    const has = (f: string) => changedFields.includes(f);
    if (has('hours_data') && has('amenities')) return 'hours and amenities';
    if (has('hours_data')) return 'hours';
    if (has('amenities')) return 'amenities';
    if (has('operational_status')) return 'operational status';
    return 'business details';
  }

  return (
    <div data-testid="business-info-editor" className="space-y-6">

      {/* Back link */}
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-signal-green transition"
      >
        &larr; Back to Settings
      </Link>

      {/* ── GBP Sync Card ─────────────────────────────────────────────── */}
      {hasGBPConnection && (
        <section
          data-testid="gbp-sync-card"
          className="rounded-2xl bg-surface-dark border border-white/5 p-6"
        >
          <h2 className="text-sm font-semibold text-white mb-3">Google Business Profile</h2>

          {syncStatus === 'idle' && (
            <div data-testid="gbp-sync-status" className="text-xs text-slate-400 mb-3">
              Connected{location.gbp_synced_at
                ? ` · Last synced ${formatRelativeTime(location.gbp_synced_at)}`
                : ' · Never synced'}
            </div>
          )}

          {syncStatus === 'syncing' && (
            <div data-testid="gbp-sync-status" className="text-xs text-slate-400 mb-3 flex items-center gap-2">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-signal-green border-t-transparent" />
              Syncing…
            </div>
          )}

          {syncStatus === 'success' && (
            <div data-testid="gbp-sync-success" className="text-xs text-signal-green mb-3">
              {syncSummary}
            </div>
          )}

          {syncStatus === 'error' && (
            <div data-testid="gbp-sync-error" className="text-xs text-alert-crimson mb-3">
              {syncErrorCode === 'token_expired'
                ? 'Google connection expired.'
                : `Couldn't reach Google right now. ${syncError ?? ''}`}
            </div>
          )}

          {syncStatus === 'error' && syncErrorCode === 'token_expired' ? (
            <Link
              href="/api/auth/google"
              className="rounded-xl bg-signal-green px-4 py-2 text-sm font-semibold text-deep-navy hover:bg-signal-green/90 transition inline-block"
            >
              Reconnect Google Business Profile &rarr;
            </Link>
          ) : (
            <button
              type="button"
              data-testid="gbp-sync-btn"
              onClick={handleGBPSync}
              disabled={syncStatus === 'syncing' || isPending}
              className="rounded-xl bg-signal-green px-4 py-2 text-sm font-semibold text-deep-navy hover:bg-signal-green/90 disabled:opacity-60 transition"
            >
              {syncStatus === 'syncing'
                ? 'Syncing…'
                : syncStatus === 'error'
                ? '↻ Retry'
                : location.gbp_synced_at
                ? '↻ Re-sync from Google'
                : '↻ Import from Google'}
            </button>
          )}
        </section>
      )}

      {/* ── Audit Prompt Banner ────────────────────────────────────────── */}
      {showAuditPrompt && (
        <section
          data-testid="audit-prompt-banner"
          className="rounded-2xl border border-signal-green/20 bg-signal-green/5 p-6"
        >
          <p className="text-sm font-medium text-white mb-1">Business info updated.</p>
          <p data-testid="audit-prompt-message" className="text-xs text-slate-400 mb-4">
            You changed your <strong className="text-white">{buildAuditMessage()}</strong>.
            AI models may still have outdated information about you.
            Running a new audit will check all 4 engines.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-testid="audit-prompt-run-btn"
              onClick={handleRunAudit}
              disabled={auditRunning}
              className="rounded-xl bg-signal-green px-4 py-2 text-sm font-semibold text-deep-navy hover:bg-signal-green/90 disabled:opacity-60 transition"
            >
              {auditRunning ? 'Starting audit…' : '↻ Run Hallucination Audit'}
            </button>
            <button
              type="button"
              data-testid="audit-prompt-dismiss-btn"
              onClick={() => setShowAuditPrompt(false)}
              className="text-xs font-medium text-slate-400 hover:text-white transition"
            >
              Not now
            </button>
          </div>
        </section>
      )}

      {/* ── Basic Info ─────────────────────────────────────────────────── */}
      <section className="rounded-2xl bg-surface-dark border border-white/5 p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Basic Information</h2>
        <div className="space-y-4">

          <div>
            <label htmlFor="biz-name" className="block text-xs font-medium text-slate-400 mb-1.5">
              Business Name <span className="text-alert-crimson">*</span>
            </label>
            <input
              id="biz-name"
              data-testid="basic-info-name"
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              maxLength={255}
              className="w-full rounded-xl bg-midnight-slate border border-white/10 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-signal-green"
              placeholder="e.g. Charcoal N Chill"
            />
          </div>

          <div>
            <label htmlFor="biz-phone" className="block text-xs font-medium text-slate-400 mb-1.5">Phone</label>
            <input
              id="biz-phone"
              data-testid="basic-info-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={50}
              className="w-full rounded-xl bg-midnight-slate border border-white/10 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-signal-green"
              placeholder="(470) 555-0123"
            />
          </div>

          <div>
            <label htmlFor="biz-website" className="block text-xs font-medium text-slate-400 mb-1.5">Website</label>
            <input
              id="biz-website"
              data-testid="basic-info-website"
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              onBlur={handleWebsiteBlur}
              maxLength={2000}
              className="w-full rounded-xl bg-midnight-slate border border-white/10 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-signal-green"
              placeholder="https://charcoalnchill.com"
            />
          </div>

          <div>
            <label htmlFor="biz-address" className="block text-xs font-medium text-slate-400 mb-1.5">Address</label>
            <input
              id="biz-address"
              data-testid="basic-info-address"
              type="text"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              maxLength={255}
              className="w-full rounded-xl bg-midnight-slate border border-white/10 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-signal-green"
              placeholder="11950 Jones Bridge Rd"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="biz-city" className="block text-xs font-medium text-slate-400 mb-1.5">City</label>
              <input
                id="biz-city"
                data-testid="basic-info-city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                maxLength={100}
                className="w-full rounded-xl bg-midnight-slate border border-white/10 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-signal-green"
                placeholder="Alpharetta"
              />
            </div>
            <div>
              <label htmlFor="biz-state" className="block text-xs font-medium text-slate-400 mb-1.5">State</label>
              <input
                id="biz-state"
                data-testid="basic-info-state"
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                onBlur={handleStateBlur}
                maxLength={2}
                className="w-full rounded-xl bg-midnight-slate border border-white/10 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-signal-green"
                placeholder="GA"
              />
            </div>
            <div>
              <label htmlFor="biz-zip" className="block text-xs font-medium text-slate-400 mb-1.5">ZIP</label>
              <input
                id="biz-zip"
                data-testid="basic-info-zip"
                type="text"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                maxLength={10}
                className="w-full rounded-xl bg-midnight-slate border border-white/10 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-signal-green"
                placeholder="30005"
              />
            </div>
          </div>

          <div>
            <label htmlFor="biz-category" className="block text-xs font-medium text-slate-400 mb-1.5">
              Primary Category
            </label>
            <input
              id="biz-category"
              data-testid="basic-info-category"
              type="text"
              value={primaryCategory}
              onChange={(e) => setPrimaryCategory(e.target.value)}
              maxLength={100}
              className="w-full rounded-xl bg-midnight-slate border border-white/10 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-signal-green"
              placeholder="Hookah Bar"
            />
          </div>

          <div>
            <label htmlFor="biz-status" className="block text-xs font-medium text-slate-400 mb-1.5">
              Operational Status
            </label>
            <select
              id="biz-status"
              data-testid="basic-info-status"
              value={operationalStatus}
              onChange={(e) => setOperationalStatus(e.target.value)}
              className="w-full rounded-xl bg-midnight-slate border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-signal-green"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

        </div>
      </section>

      {/* ── Amenities ──────────────────────────────────────────────────── */}
      <section className="rounded-2xl bg-surface-dark border border-white/5 p-6">
        <h2 className="text-sm font-semibold text-white mb-1">Amenities</h2>
        <p className="text-xs text-slate-400 mb-4">
          Select everything that applies. AI often gets these wrong —
          unchecked items let us detect hallucinations.
        </p>
        <div className="space-y-2">
          {AMENITY_FIELDS.map(({ key, label }) => (
            <label
              key={key}
              className={[
                'flex items-center gap-3 w-full rounded-lg px-4 py-3 text-sm font-medium border cursor-pointer transition select-none',
                amenities[key]
                  ? 'bg-signal-green/10 border-signal-green/40 text-white'
                  : 'bg-midnight-slate border-white/5 text-slate-400 hover:border-white/10',
              ].join(' ')}
            >
              <input
                type="checkbox"
                checked={amenities[key]}
                onChange={() => toggleAmenity(key)}
                className="h-4 w-4 rounded border-white/20 bg-midnight-slate accent-signal-green"
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      {/* ── Hours ──────────────────────────────────────────────────────── */}
      <section className="rounded-2xl bg-surface-dark border border-white/5 p-6">
        <h2 className="text-sm font-semibold text-white mb-1">Business Hours</h2>
        <p className="text-xs text-slate-400 mb-4">
          Set your accurate hours. Closed days are stored explicitly so the
          Fear Engine can catch &quot;we&apos;re open&quot; hallucinations.
        </p>
        <div className="space-y-2">
          {DAYS.map(({ key, label }) => {
            const day = hours[key];
            return (
              <div
                key={key}
                className="flex items-center gap-3 rounded-lg bg-midnight-slate border border-white/5 px-3 py-2.5"
              >
                <span className="w-24 shrink-0 text-xs font-medium text-slate-300">
                  {label}
                </span>

                <button
                  type="button"
                  onClick={() => updateHours(key, 'closed', !day.closed)}
                  title={day.closed ? 'Mark as open' : 'Mark as closed'}
                  className={[
                    'shrink-0 flex h-5 w-9 items-center rounded-full transition-colors',
                    day.closed ? 'bg-alert-crimson/70' : 'bg-signal-green/70',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
                      day.closed ? 'translate-x-4' : 'translate-x-1',
                    ].join(' ')}
                  />
                </button>

                <span className="text-xs text-slate-500 w-9 shrink-0">
                  {day.closed ? 'Closed' : 'Open'}
                </span>

                {!day.closed && (
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <input
                      type="time"
                      value={day.open}
                      onChange={(e) => updateHours(key, 'open', e.target.value)}
                      className="flex-1 min-w-0 rounded-md border border-white/10 bg-surface-dark px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-signal-green/50"
                    />
                    <span className="text-slate-500 text-xs shrink-0">&ndash;</span>
                    <input
                      type="time"
                      value={day.close}
                      onChange={(e) => updateHours(key, 'close', e.target.value)}
                      className="flex-1 min-w-0 rounded-md border border-white/10 bg-surface-dark px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-signal-green/50"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Save ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          data-testid="business-info-save-btn"
          onClick={handleSave}
          disabled={isPending || syncStatus === 'syncing'}
          className="rounded-xl bg-signal-green px-6 py-2.5 text-sm font-semibold text-deep-navy hover:bg-signal-green/90 disabled:opacity-60 transition"
        >
          {isPending ? 'Saving…' : 'Save Changes'}
        </button>

        <span data-testid="business-info-save-status" className="text-xs">
          {saveStatus === 'saved' && (
            <span className="text-signal-green">Saved</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-alert-crimson">{saveError}</span>
          )}
        </span>
      </div>

      {validationError && (
        <p className="text-xs text-alert-crimson bg-alert-crimson/10 rounded-lg px-3 py-2">
          {validationError}
        </p>
      )}

    </div>
  );
}
