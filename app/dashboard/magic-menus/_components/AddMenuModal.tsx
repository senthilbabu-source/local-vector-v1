'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateMagicMenuSchema,
  type CreateMagicMenuInput,
} from '@/lib/schemas/magic-menus';
import { createMagicMenu } from '../actions';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type LocationOption = {
  id: string;
  business_name: string;
  city: string | null;
  state: string | null;
};

interface Props {
  locations: LocationOption[];
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

export default function AddMenuModal({ locations }: Props) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateMagicMenuInput>({
    resolver: zodResolver(CreateMagicMenuSchema),
  });

  function handleClose() {
    setOpen(false);
    setServerError(null);
    reset();
  }

  async function onSubmit(data: CreateMagicMenuInput) {
    setServerError(null);
    const result = await createMagicMenu(data);
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
        New Menu
      </button>

      {/* Backdrop + Dialog */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-900/5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Create Magic Menu</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Link a menu to one of your locations so AI can read it.
                </p>
              </div>
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

            {/* No locations warning */}
            {locations.length === 0 && (
              <div className="mb-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700 ring-1 ring-amber-200">
                You need to add a location before creating a menu.{' '}
                <a href="/dashboard/locations" className="font-semibold underline">
                  Add a location →
                </a>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              {/* Menu Name */}
              <Field label="Menu name" id="name" error={errors.name?.message}>
                <input
                  id="name"
                  type="text"
                  placeholder="e.g. Dinner Menu, Brunch Menu"
                  {...register('name')}
                  className={inputClass(!!errors.name)}
                />
              </Field>

              {/* Location select */}
              <Field label="Location" id="location_id" error={errors.location_id?.message}>
                <select
                  id="location_id"
                  {...register('location_id')}
                  className={inputClass(!!errors.location_id)}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select a location…
                  </option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.business_name}
                      {loc.city ? ` — ${loc.city}${loc.state ? `, ${loc.state}` : ''}` : ''}
                    </option>
                  ))}
                </select>
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
                  disabled={isSubmitting || locations.length === 0}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Creating…' : 'Create Menu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
