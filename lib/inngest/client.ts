// ---------------------------------------------------------------------------
// lib/inngest/client.ts — Inngest client singleton
//
// Single client instance used across all Inngest functions and event senders.
// Event types are provided via EventSchemas for type-safe `.send()` calls.
// ---------------------------------------------------------------------------

import { EventSchemas, Inngest } from 'inngest';
import type { Events } from './events';

export const inngest = new Inngest({
  id: 'localvector',
  schemas: new EventSchemas().fromRecord<Events>(),
});
