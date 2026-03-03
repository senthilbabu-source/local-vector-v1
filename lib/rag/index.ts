// ---------------------------------------------------------------------------
// lib/rag/index.ts — RAG Chatbot Widget Barrel Export (Sprint 133)
// ---------------------------------------------------------------------------

export { checkRAGReadiness } from './rag-readiness-check';
export type { RAGReadinessResult, RAGReadinessInput } from './rag-readiness-check';

export { buildRAGContext, formatHoursData } from './rag-context-builder';
export type { RAGContext, RAGMenuItem } from './rag-context-builder';

export {
  buildRAGSystemPrompt,
  answerQuestion,
} from './rag-responder';
export type { RAGAnswer, AnswerConfidence } from './rag-responder';
