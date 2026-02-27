'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveGroundTruth } from '../actions';
import type { PrimaryLocation } from '../page';
import type { DayOfWeek, Amenities, HoursData } from '@/lib/types/ground-truth';

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

// Doc 03 §15.2 — all 6 core amenities.
// Doc 06 §7 specifies: Alcohol, Outdoor Seating, Reservations, Live Music (required UI).
// has_hookah and is_kid_friendly are also core per Doc 03 §15.2.
const AMENITY_FIELDS: { key: keyof AmenitiesState; label: string }[] = [
  { key: 'serves_alcohol',       label: 'Serves alcohol' },
  { key: 'has_outdoor_seating',  label: 'Outdoor seating' },
  { key: 'takes_reservations',   label: 'Takes reservations' },
  { key: 'has_live_music',       label: 'Live music' },
  { key: 'has_hookah',           label: 'Hookah lounge' },
  { key: 'is_kid_friendly',      label: 'Kid friendly' },
];

const STEP_LABELS = ['Business', 'Amenities', 'Hours'];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DayHoursState = {
  closed: boolean;
  open: string;
  close: string;
};

type AmenitiesState = Pick<
  Amenities,
  | 'has_outdoor_seating'
  | 'serves_alcohol'
  | 'has_hookah'
  | 'is_kid_friendly'
  | 'takes_reservations'
  | 'has_live_music'
>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initHours(
  hours_data: PrimaryLocation['hours_data']
): Record<DayOfWeek, DayHoursState> {
  // Sensible defaults: Mon–Fri 9–21, Sat 9–22, Sun closed
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
      // No key = "unknown hours" per Doc 03 §15.1 — treat same as closed for form
      result[key] = { ...result[key], closed: true };
    } else if (entry === 'closed') {
      result[key] = { ...result[key], closed: true };
    } else {
      result[key] = { closed: false, open: entry.open, close: entry.close };
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// TruthCalibrationForm — 3-step wizard
//
// Step 1: Business name  (pre-filled from DB)
// Step 2: Amenity checkboxes — all 6 core amenities (Doc 03 §15.2 + Doc 06 §7)
// Step 3: Hours grid — 7 days, closed = "closed" string (Doc 03 §15.1)
//
// On submit: calls saveGroundTruth() Server Action, then pushes to /dashboard.
// ---------------------------------------------------------------------------

interface TruthCalibrationFormProps {
  location: PrimaryLocation;
  /** Called on successful submit instead of redirecting to /dashboard. */
  onSubmitSuccess?: () => void;
  /** GBP import pre-fill for hours (takes priority over location.hours_data). */
  prefillHours?: HoursData | null;
  /** GBP import pre-fill for amenities (merged into defaults). */
  prefillAmenities?: Partial<AmenitiesState> | null;
  /** Show "Imported from Google" banner above the form. */
  showPrefillBanner?: boolean;
}

export default function TruthCalibrationForm({
  location,
  onSubmitSuccess,
  prefillHours,
  prefillAmenities,
  showPrefillBanner,
}: TruthCalibrationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // ── Step state ────────────────────────────────────────────────────────────
  const [businessName, setBusinessName] = useState(location.business_name);

  const [amenities, setAmenities] = useState<AmenitiesState>({
    has_outdoor_seating: prefillAmenities?.has_outdoor_seating ?? location.amenities?.has_outdoor_seating ?? false,
    serves_alcohol:      prefillAmenities?.serves_alcohol ?? location.amenities?.serves_alcohol ?? false,
    has_hookah:          prefillAmenities?.has_hookah ?? location.amenities?.has_hookah ?? false,
    is_kid_friendly:     prefillAmenities?.is_kid_friendly ?? location.amenities?.is_kid_friendly ?? false,
    takes_reservations:  prefillAmenities?.takes_reservations ?? location.amenities?.takes_reservations ?? false,
    has_live_music:      prefillAmenities?.has_live_music ?? location.amenities?.has_live_music ?? false,
  });

  const [hours, setHours] = useState<Record<DayOfWeek, DayHoursState>>(
    initHours(prefillHours ?? location.hours_data)
  );

  // ── Handlers ──────────────────────────────────────────────────────────────
  function toggleAmenity(key: keyof AmenitiesState) {
    setAmenities((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function updateHours(
    day: DayOfWeek,
    field: keyof DayHoursState,
    value: string | boolean
  ) {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }

  function advanceStep() {
    if (step === 1 && !businessName.trim()) {
      setError('Business name is required');
      return;
    }
    setError(null);
    setStep((s) => s + 1);
  }

  function handleSubmit() {
    setError(null);

    // Build hours_data payload per Doc 03 §15.1:
    //   closed days  → "closed" string (never omit — missing = "unknown")
    //   open days    → { open: "HH:MM", close: "HH:MM" }
    const hours_data = Object.fromEntries(
      DAYS.map(({ key }) => {
        const day = hours[key];
        return [key, day.closed ? 'closed' as const : { open: day.open, close: day.close }];
      })
    ) as Parameters<typeof saveGroundTruth>[0]['hours_data'];

    startTransition(async () => {
      const result = await saveGroundTruth({
        location_id:   location.id,
        business_name: businessName.trim(),
        amenities,
        hours_data,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      if (onSubmitSuccess) {
        onSubmitSuccess();
      } else {
        router.push('/dashboard');
      }
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div data-testid="step2-hours-form" className="rounded-2xl bg-surface-dark border border-white/5 overflow-hidden">

      {/* ── GBP prefill banner (Sprint 91) ─────────────────────────── */}
      {showPrefillBanner && (
        <div
          data-testid="step2-gbp-prefill-banner"
          className="px-4 py-3 bg-signal-green/10 border-b border-signal-green/20 text-sm text-signal-green flex items-center gap-2"
        >
          <span>&#10003;</span>
          Imported from Google — review and confirm your hours
        </div>
      )}

      {/* ── Step indicator ──────────────────────────────────────────── */}
      <div className="flex border-b border-white/5">
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          const isActive = step === stepNum;
          const isDone = step > stepNum;
          return (
            <div
              key={label}
              className={[
                'flex-1 py-3 text-center text-xs font-medium transition-colors',
                isActive
                  ? 'text-signal-green border-b-2 border-signal-green -mb-px'
                  : isDone
                  ? 'text-signal-green'
                  : 'text-slate-500',
              ].join(' ')}
            >
              {isDone ? '✓ ' : `${stepNum}. `}
              {label}
            </div>
          );
        })}
      </div>

      <div className="p-6 space-y-5">

        {/* ── Step 1: Business Name ──────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight mb-1">
              Business Name
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Confirm the exact name AI assistants should use for your business.
            </p>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Business name
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-midnight-slate px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-signal-green/50 focus:border-signal-green/50 transition"
              placeholder="e.g. Charcoal N Chill"
              maxLength={255}
            />
          </div>
        )}

        {/* ── Step 2: Amenities ─────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight mb-1">
              Amenities
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Select everything that applies. AI often gets these wrong —
              unchecked items let us detect hallucinations.
            </p>
            {/* Doc 06 §7 specifies checkboxes ([ ]). Using styled checkboxes
                that match the Deep Night aesthetic. */}
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
          </div>
        )}

        {/* ── Step 3: Hours ─────────────────────────────────────────── */}
        {step === 3 && (
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight mb-1">
              Business Hours
            </h2>
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
                    {/* Day label */}
                    <span className="w-24 shrink-0 text-xs font-medium text-slate-300">
                      {label}
                    </span>

                    {/* Closed / Open toggle */}
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

                    {/* Time inputs — shown only when open */}
                    {!day.closed && (
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <input
                          type="time"
                          value={day.open}
                          onChange={(e) =>
                            updateHours(key, 'open', e.target.value)
                          }
                          className="flex-1 min-w-0 rounded-md border border-white/10 bg-surface-dark px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-signal-green/50"
                        />
                        <span className="text-slate-500 text-xs shrink-0">–</span>
                        <input
                          type="time"
                          value={day.close}
                          onChange={(e) =>
                            updateHours(key, 'close', e.target.value)
                          }
                          className="flex-1 min-w-0 rounded-md border border-white/10 bg-surface-dark px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-signal-green/50"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────── */}
        {error && (
          <p className="text-xs text-alert-crimson bg-alert-crimson/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* ── Navigation ────────────────────────────────────────────── */}
        <div className="flex gap-3 pt-1">
          {step > 1 && (
            <button
              type="button"
              onClick={() => { setError(null); setStep((s) => s - 1); }}
              disabled={isPending}
              className="flex-1 rounded-lg border border-white/10 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 transition disabled:opacity-50"
            >
              Back
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={advanceStep}
              className="flex-1 rounded-lg bg-signal-green px-4 py-2.5 text-sm font-semibold text-deep-navy hover:brightness-110 transition"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="flex-1 rounded-lg bg-signal-green px-4 py-2.5 text-sm font-semibold text-deep-navy hover:brightness-110 transition disabled:opacity-60"
            >
              {isPending ? 'Saving…' : 'Save & Continue'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
