// ---------------------------------------------------------------------------
// lib/ai-shopper/shopper-runner.ts — S25: AI Shopper Conversation Runner
//
// Runs a 4-turn AI conversation and evaluates each response for accuracy.
// Saves result to ai_shopper_runs table.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import { buildTurnPrompts, type GroundTruthContext } from './shopper-scenarios';
import { evaluateTurnAccuracy, identifyFailureTurn, type TurnEvaluation } from './shopper-evaluator';
import { queryOpenAI } from '@/lib/ai-preview/model-queries';
import * as Sentry from '@sentry/nextjs';
import type { Json } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AIShopperRun {
  id: string;
  scenario_type: string;
  overall_pass: boolean;
  failure_turn: number | null;
  failure_reason: string | null;
  conversation_turns: TurnEvaluation[];
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Runs a 4-turn AI shopper simulation for a specific scenario type.
 * Sequential OpenAI calls with conversation history.
 * Saves result to ai_shopper_runs table.
 *
 * Never throws — returns null on error.
 */
export async function runAIShopperScenario(
  supabase: SupabaseClient,
  orgId: string,
  locationId: string,
  scenarioType: string,
  groundTruth: GroundTruthContext,
): Promise<AIShopperRun | null> {
  try {
    const prompts = buildTurnPrompts(scenarioType, groundTruth);
    if (prompts.length === 0) return null;

    const evaluations: TurnEvaluation[] = [];
    const conversationHistory: { role: string; content: string }[] = [];

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];

      // Build conversation context for sequential turns
      conversationHistory.push({ role: 'user', content: prompt });
      const contextPrompt = conversationHistory.map((m) => `${m.role}: ${m.content}`).join('\n');

      let response: string;
      try {
        const result = await queryOpenAI(contextPrompt, '');
        response = result.status === 'success' ? result.content : '';
      } catch (err) {
        Sentry.captureException(err);
        response = '';
      }

      conversationHistory.push({ role: 'assistant', content: response });

      const evaluation = evaluateTurnAccuracy(i + 1, response, groundTruth);
      evaluations.push(evaluation);
    }

    const { failureTurn, failureReason } = identifyFailureTurn(evaluations);
    const overallPass = failureTurn === null;

    // Save to DB
    const { data: inserted } = await supabase
      .from('ai_shopper_runs' as 'cron_run_log')
      .insert({
        org_id: orgId,
        location_id: locationId,
        model_provider: 'openai',
        scenario_type: scenarioType,
        conversation_turns: evaluations as unknown as Json,
        failure_turn: failureTurn,
        failure_reason: failureReason,
        overall_pass: overallPass,
        credit_cost: 4,
      } as unknown as Json)
      .select('id' as 'cron_name')
      .single();

    return {
      id: (inserted as unknown as { id: string } | null)?.id ?? 'unknown',
      scenario_type: scenarioType,
      overall_pass: overallPass,
      failure_turn: failureTurn,
      failure_reason: failureReason,
      conversation_turns: evaluations,
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { service: 'shopper-runner', sprint: 'S25' } });
    return null;
  }
}
