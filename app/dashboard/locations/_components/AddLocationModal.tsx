'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateLocationSchema, type CreateLocationInput } from '@/lib/schemas/locations';
import { createLocation } from '../../actions';

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
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

const inputClass = (hasError: boolean) =>
  `w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:ring-2 ${
    hasError
      ? 'border-red-400 focus:ring-red-300'
      : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-200'
  }`;

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export default function AddLocationModal() {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateLocationInput>({
    resolver: zodResolver(CreateLocationSchema),
  });

  function handleClose() {
    setOpen(false);
    setServerError(null);
    reset();
  }

  async function onSubmit(data: CreateLocationInput) {
    setServerError(null);
    const result = await createLocation(data);
    if (result.success) {
      handleClose();
    } else {
      setServerError(result.error);
    }
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add Location
      </button>

      {/* Backdrop + Dialog */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-900/5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Add New Location</h2>
              <button
                onClick={handleClose}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Global error */}
            {serverError && (
              <div
                role="alert"
                className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200"
              >
                {serverError}
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

              {/* City / State / ZIP — 3 columns */}
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

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Saving…' : 'Save Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
