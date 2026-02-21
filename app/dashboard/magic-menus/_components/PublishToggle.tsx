'use client';

import { useTransition } from 'react';
import { toggleMenuStatus } from '../actions';

interface Props {
  menuId: string;
  isPublished: boolean;
}

export default function PublishToggle({ menuId, isPublished }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await toggleMenuStatus(menuId);
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      aria-label={isPublished ? 'Unpublish menu' : 'Publish menu'}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${
        isPublished ? 'bg-indigo-600' : 'bg-slate-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          isPublished ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
