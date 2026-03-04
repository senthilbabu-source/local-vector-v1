// ---------------------------------------------------------------------------
// lib/content-brief/index.ts — Barrel Export
//
// P8-FIX-34: Content Brief module — prioritization + quality gating.
// ---------------------------------------------------------------------------

export {
  normalizeQueryGap,
  normalizeDraftTrigger,
  scoreBriefCandidate,
  prioritizeBriefCandidates,
  type BriefCandidate,
  type BriefCandidateSource,
} from './brief-prioritizer';

export {
  assessBriefQuality,
  generateSuggestions,
  gradeFromScore,
  PUBLISH_READY_THRESHOLD,
  NEEDS_REVIEW_THRESHOLD,
  type QualityGrade,
  type QualityVerdict,
} from './brief-quality-gate';
