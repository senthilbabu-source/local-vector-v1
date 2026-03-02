// ---------------------------------------------------------------------------
// lib/corrections/types.ts — Sprint 121: Correction Follow-up Types
// ---------------------------------------------------------------------------

export type CorrectionReScanStatus = 'pending' | 'cleared' | 'persists' | 'inconclusive';

export interface CorrectionFollowUp {
  id: string;
  hallucination_id: string;
  org_id: string;
  correction_brief_id: string | null;
  rescan_due_at: string;
  rescan_completed_at: string | null;
  rescan_status: CorrectionReScanStatus;
  rescan_ai_response: string | null;
  created_at: string;
  updated_at: string;
}

export interface CorrectionResult {
  follow_up: CorrectionFollowUp;
  brief_id: string | null;
}
