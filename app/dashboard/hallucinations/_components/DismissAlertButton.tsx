// ---------------------------------------------------------------------------
// DismissAlertButton — Sprint H: "Dismiss" action for open hallucinations.
// Calls the existing updateHallucinationStatus server action.
// ---------------------------------------------------------------------------

'use client';

import { useTransition } from 'react';
import { updateHallucinationStatus } from '../../actions';

interface Props {
  alertId: string;
}

export default function DismissAlertButton({ alertId }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleDismiss() {
    startTransition(async () => {
      await updateHallucinationStatus(alertId, 'dismissed');
    });
  }

  return (
    <button
      type="button"
      onClick={handleDismiss}
      disabled={isPending}
      className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      data-testid={`alert-dismiss-${alertId}`}
    >
      {isPending ? 'Dismissing…' : 'Dismiss'}
    </button>
  );
}
