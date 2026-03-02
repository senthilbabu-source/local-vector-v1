export {
  markHallucinationCorrected,
  generateCorrectionBrief,
  runCorrectionRescan,
  getCorrectionEffectivenessScore,
} from './correction-service';
export {
  buildCorrectionBriefPrompt,
  buildCorrectionDraftTitle,
} from './correction-brief-prompt';
export type {
  CorrectionFollowUp,
  CorrectionResult,
  CorrectionReScanStatus,
} from './types';
