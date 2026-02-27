'use client';

// ---------------------------------------------------------------------------
// LocationFormModal — Add / Edit location modal (Sprint 100)
//
// Reuses AddLocationModal pattern with react-hook-form + Zod.
// Supports both create (no initialData) and edit (with initialData) modes.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, X } from 'lucide-react';
import { AddLocationSchema, type AddLocationInput } from '@/lib/schemas/locations';
import { addLocation, updateLocation } from '@/app/actions/locations';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LocationFormModalProps {
  /** When provided, the form is in edit mode with pre-filled values. */
  initialData?: {
    id: string;
    business_name: string;
    display_name: string | null;
    address_line1: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    phone: string | null;
    website_url: string | null;
    timezone: string | null;
  };
  /** Whether the add button is disabled (at location limit). */
  disabled?: boolean;
  /** Tooltip when disabled. */
  disabledReason?: string;
}

// ---------------------------------------------------------------------------
// Field helper
// ---------------------------------------------------------------------------

function Field({
  label,
  id,
  error,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-slate-400">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-alert-crimson">{error}</p>}
    </div>
  );
}

const inputClass = (hasError: boolean) =>
  `w-full rounded-xl border px-3 py-2.5 text-sm text-white bg-midnight-slate placeholder-slate-500 outline-none transition focus:ring-2 ${
    hasError
      ? 'border-alert-crimson/50 focus:ring-alert-crimson/30'
      : 'border-white/10 focus:border-signal-green focus:ring-signal-green/20'
  }`;

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export default function LocationFormModal({
  initialData,
  disabled,
  disabledReason,
}: LocationFormModalProps) {
  const isEditMode = !!initialData;
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddLocationInput>({
    resolver: zodResolver(AddLocationSchema),
    defaultValues: isEditMode
      ? {
          business_name: initialData.business_name,
          display_name: initialData.display_name ?? '',
          address_line1: initialData.address_line1 ?? '',
          city: initialData.city ?? '',
          state: initialData.state ?? '',
          zip: initialData.zip ?? '',
          phone: initialData.phone ?? '',
          website_url: initialData.website_url ?? '',
          timezone: initialData.timezone ?? 'America/New_York',
        }
      : {
          timezone: 'America/New_York',
        },
  });

  function handleClose() {
    setOpen(false);
    setServerError(null);
    setServerSuccess(null);
    if (!isEditMode) reset();
  }

  async function onSubmit(data: AddLocationInput) {
    setServerError(null);
    setServerSuccess(null);

    if (isEditMode) {
      const result = await updateLocation(initialData.id, data);
      if (result.success) {
        setServerSuccess('Location updated');
        setTimeout(handleClose, 800);
      } else {
        setServerError(result.error);
      }
    } else {
      const result = await addLocation(data);
      if (result.success) {
        handleClose();
      } else {
        setServerError(result.error);
      }
    }
  }

  return (
    <>
      {/* Trigger */}
      {isEditMode ? (
        <button
          onClick={() => setOpen(true)}
          data-testid={`location-edit-btn-${initialData.id}`}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-signal-green hover:bg-signal-green/10 transition"
        >
          Edit
        </button>
      ) : (
        <button
          onClick={() => !disabled && setOpen(true)}
          disabled={disabled}
          data-testid="location-add-btn"
          title={disabled ? disabledReason : undefined}
          className="inline-flex items-center gap-2 rounded-xl bg-signal-green px-4 py-2 text-sm font-semibold text-deep-navy shadow-sm transition hover:bg-signal-green/90 focus:outline-none focus:ring-2 focus:ring-signal-green disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add Location
        </button>
      )}

      {/* Backdrop + Dialog */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={handleClose}
        >
          <div
            data-testid="location-add-panel"
            className="w-full max-w-lg rounded-2xl bg-surface-dark border border-white/10 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {isEditMode ? 'Edit Location' : 'Add New Location'}
              </h2>
              <button
                onClick={handleClose}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-white/5 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Error */}
            {serverError && (
              <div
                role="alert"
                data-testid="location-form-error"
                className="mb-5 rounded-lg bg-alert-crimson/10 border border-alert-crimson/20 px-4 py-3 text-sm text-alert-crimson"
              >
                {serverError}
              </div>
            )}

            {/* Success */}
            {serverSuccess && (
              <div
                data-testid="location-form-success"
                className="mb-5 rounded-lg bg-signal-green/10 border border-signal-green/20 px-4 py-3 text-sm text-signal-green"
              >
                {serverSuccess}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              {/* Business Name */}
              <Field label="Business name" id="business_name" error={errors.business_name?.message}>
                <input
                  id="business_name"
                  type="text"
                  placeholder="Charcoal N Chill"
                  {...register('business_name')}
                  className={inputClass(!!errors.business_name)}
                />
              </Field>

              {/* Display Name */}
              <Field label="Display name (optional)" id="display_name" error={errors.display_name?.message}>
                <input
                  id="display_name"
                  type="text"
                  placeholder="Downtown Branch"
                  {...register('display_name')}
                  className={inputClass(!!errors.display_name)}
                />
              </Field>

              {/* Address */}
              <Field label="Street address" id="address_line1" error={errors.address_line1?.message}>
                <input
                  id="address_line1"
                  type="text"
                  placeholder="123 Main St, Suite 100"
                  {...register('address_line1')}
                  className={inputClass(!!errors.address_line1)}
                />
              </Field>

              {/* City / State / ZIP */}
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-2">
                  <Field label="City" id="city" error={errors.city?.message}>
                    <input
                      id="city"
                      type="text"
                      placeholder="Atlanta"
                      {...register('city')}
                      className={inputClass(!!errors.city)}
                    />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="State" id="state" error={errors.state?.message}>
                    <input
                      id="state"
                      type="text"
                      placeholder="GA"
                      {...register('state')}
                      className={inputClass(!!errors.state)}
                    />
                  </Field>
                </div>
                <div className="col-span-1">
                  <Field label="ZIP" id="zip" error={errors.zip?.message}>
                    <input
                      id="zip"
                      type="text"
                      placeholder="30005"
                      {...register('zip')}
                      className={inputClass(!!errors.zip)}
                    />
                  </Field>
                </div>
              </div>

              {/* Phone */}
              <Field label="Phone (optional)" id="phone" error={errors.phone?.message}>
                <input
                  id="phone"
                  type="tel"
                  placeholder="(470) 546-4866"
                  {...register('phone')}
                  className={inputClass(!!errors.phone)}
                />
              </Field>

              {/* Website */}
              <Field label="Website URL (optional)" id="website_url" error={errors.website_url?.message}>
                <input
                  id="website_url"
                  type="url"
                  placeholder="https://charcoalnchill.com"
                  {...register('website_url')}
                  className={inputClass(!!errors.website_url)}
                />
              </Field>

              {/* Timezone */}
              <Field label="Timezone" id="timezone" error={errors.timezone?.message}>
                <select
                  id="timezone"
                  {...register('timezone')}
                  className={inputClass(false)}
                >
                  <option value="America/New_York">Eastern (ET)</option>
                  <option value="America/Chicago">Central (CT)</option>
                  <option value="America/Denver">Mountain (MT)</option>
                  <option value="America/Los_Angeles">Pacific (PT)</option>
                  <option value="America/Anchorage">Alaska (AKT)</option>
                  <option value="Pacific/Honolulu">Hawaii (HST)</option>
                </select>
              </Field>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  data-testid="location-form-submit-btn"
                  className="rounded-xl bg-signal-green px-4 py-2.5 text-sm font-semibold text-deep-navy shadow-sm transition hover:bg-signal-green/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting
                    ? 'Saving…'
                    : isEditMode
                      ? 'Save Changes'
                      : 'Add Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
