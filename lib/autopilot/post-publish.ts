// ---------------------------------------------------------------------------
// lib/autopilot/post-publish.ts — Post-Publish SOV Re-Check Scheduling
//
// Stores re-check tasks in Redis for the SOV cron to execute 14 days
// after content is published. Gracefully degrades if Redis is unavailable.
//
// AI_RULES §17: All Redis callers must try/catch and degrade gracefully.
//
// Spec: docs/19-AUTOPILOT-ENGINE.md §6.1
// ---------------------------------------------------------------------------

import { getRedis } from '@/lib/redis';
import type { PostPublishMeasurementTask } from '@/lib/types/autopilot';

/** Redis key prefix for SOV re-check tasks. */
export const RECHECK_KEY_PREFIX = 'sov_recheck:';

/** Redis SET key for tracking all pending re-check task IDs. */
export const RECHECK_SET_KEY = 'sov_recheck:pending';

/** Days to wait before re-checking SOV for published content. */
export const RECHECK_DELAY_DAYS = 14;

/** Redis TTL in seconds (15 days — 1 day buffer after recheck). */
export const RECHECK_TTL = 15 * 86_400;

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

/**
 * Schedule a SOV re-check for a published draft.
 * Stores task in Redis. Gracefully degrades if Redis unavailable.
 */
export async function schedulePostPublishRecheck(
  draftId: string,
  locationId: string,
  targetQuery: string,
): Promise<void> {
  if (!targetQuery) return; // Nothing to re-check without a target query

  try {
    const redis = getRedis();
    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + RECHECK_DELAY_DAYS);

    const task: PostPublishMeasurementTask = {
      taskType: 'sov_recheck',
      targetDate: targetDate.toISOString(),
      payload: {
        draftId,
        locationId,
        targetQuery,
      },
    };

    const key = `${RECHECK_KEY_PREFIX}${draftId}`;

    // Store the task with TTL
    await redis.set(key, JSON.stringify(task), { ex: RECHECK_TTL });

    // Add to pending set for discovery
    await redis.sadd(RECHECK_SET_KEY, draftId);
  } catch (error) {
    console.warn(
      '[autopilot/post-publish] Redis unavailable, skipping SOV re-check scheduling:',
      error,
    );
    // Draft still publishes successfully; measurement is optional
  }
}

// ---------------------------------------------------------------------------
// Read Pending
// ---------------------------------------------------------------------------

/**
 * Scan for pending re-check tasks that are past their target date.
 * Called from the SOV cron.
 */
export async function getPendingRechecks(): Promise<PostPublishMeasurementTask[]> {
  try {
    const redis = getRedis();
    const memberIds = await redis.smembers(RECHECK_SET_KEY);
    if (!memberIds || memberIds.length === 0) return [];

    const now = new Date();
    const ready: PostPublishMeasurementTask[] = [];

    for (const draftId of memberIds) {
      const key = `${RECHECK_KEY_PREFIX}${draftId}`;
      const raw = await redis.get(key);
      if (!raw) {
        // Key expired — clean up the set
        await redis.srem(RECHECK_SET_KEY, draftId);
        continue;
      }

      const task = (typeof raw === 'string' ? JSON.parse(raw) : raw) as PostPublishMeasurementTask;
      if (new Date(task.targetDate) <= now) {
        ready.push(task);
      }
    }

    return ready;
  } catch (error) {
    console.warn(
      '[autopilot/post-publish] Redis unavailable, skipping pending recheck scan:',
      error,
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Complete
// ---------------------------------------------------------------------------

/**
 * Clean up a completed re-check task from Redis.
 */
export async function completeRecheck(draftId: string): Promise<void> {
  try {
    const redis = getRedis();
    const key = `${RECHECK_KEY_PREFIX}${draftId}`;
    await redis.del(key);
    await redis.srem(RECHECK_SET_KEY, draftId);
  } catch (error) {
    console.warn(
      '[autopilot/post-publish] Redis unavailable, skipping recheck cleanup:',
      error,
    );
  }
}
