// ---------------------------------------------------------------------------
// lib/vaio/mission-generator.ts — Pure mission generation for VAIO Sprint 2
//
// Takes a profile snapshot and returns up to 5 actionable missions ordered
// by potential score gain (highest impact first).
// ---------------------------------------------------------------------------

import type { Mission, MissionStep, MissionGeneratorInput } from './types';
import { VOICE_SCORE_MAX } from './score-card-helpers';

// ---------------------------------------------------------------------------
// Per-component mission builders
// ---------------------------------------------------------------------------

function buildCrawlerMission(ptsGain: number): Mission {
  const steps: MissionStep[] = [
    {
      label: 'Open your robots.txt file',
      detail:
        'Find it at yourdomain.com/robots.txt — if it doesn\'t exist, create one in your site root.',
    },
    {
      label: 'Allow major AI crawlers',
      detail:
        'Add these allow rules (blank Disallow = allow everything):\n\nUser-agent: GPTBot\nDisallow:\n\nUser-agent: ClaudeBot\nDisallow:\n\nUser-agent: PerplexityBot\nDisallow:\n\nUser-agent: OAI-SearchBot\nDisallow:',
    },
    {
      label: 'Save and deploy',
      detail: 'Publish the updated file so AI bots can confirm access on their next crawl.',
    },
    {
      label: 'Run Voice Check to confirm',
      detail: 'Click "Run Voice Check" above — crawler status rows should turn green.',
    },
  ];

  return {
    id: 'crawler_access',
    title: 'Open Your Doors to AI',
    subtitle: 'Let AI assistants read your content',
    pts_gain: ptsGain,
    component: 'crawler_access',
    status: ptsGain === 0 ? 'done' : 'open',
    steps,
  };
}

function buildLlmsTxtMission(
  ptsGain: number,
  llmsTxtStatus: MissionGeneratorInput['llms_txt_status'],
): Mission {
  const isStale = llmsTxtStatus === 'stale';

  const steps: MissionStep[] = isStale
    ? [
        {
          label: 'Your AI profile is outdated',
          detail:
            'Regenerate it now to reflect your latest menu, hours, and offerings — stale data loses citation trust.',
        },
        {
          label: 'Click "Run Voice Check"',
          detail: 'This regenerates your llms.txt with current business data.',
        },
        {
          label: 'Copy the refreshed profile',
          detail: 'Open "AI Business Profile" below and copy the updated standard text.',
        },
        {
          label: 'Replace yourdomain.com/llms.txt',
          detail: 'Upload the new file to your domain root to overwrite the stale version.',
        },
      ]
    : [
        {
          label: 'Click "Run Voice Check"',
          detail:
            'This generates your AI Business Profile (llms.txt) from your current menu and business data.',
        },
        {
          label: 'Copy the generated profile text',
          detail: 'Open "AI Business Profile" below and copy the standard profile block.',
        },
        {
          label: 'Host at yourdomain.com/llms.txt',
          detail:
            'Ask your developer to place this file at your domain root — most platforms support static file hosting.',
        },
        {
          label: 'Run Voice Check again to earn points',
          detail:
            'Your AI Profile score updates once the file is live and confirmed accessible.',
        },
      ];

  return {
    id: 'llms_txt',
    title: 'Tell AI Who You Are',
    subtitle: 'Create a structured AI Business Profile',
    pts_gain: ptsGain,
    component: 'llms_txt',
    status: ptsGain === 0 ? 'done' : 'open',
    steps,
  };
}

function buildVoiceCitationMission(
  ptsGain: number,
  input: MissionGeneratorInput,
): Mission {
  const { voice_gaps } = input;
  const topGap = voice_gaps[0];

  const steps: MissionStep[] = [
    {
      label:
        voice_gaps.length > 0
          ? `Fix ${voice_gaps.length} content gap${voice_gaps.length !== 1 ? 's' : ''}`
          : 'Create content that directly answers voice queries',
      detail:
        topGap != null
          ? `Your longest gap: "${topGap.queries[0] ?? ''}" — ${topGap.weeks_at_zero} week${topGap.weeks_at_zero !== 1 ? 's' : ''} at zero AI citations. Suggested answer: "${topGap.suggested_query_answer}"`
          : 'Focus on question-and-answer formatted content for common customer queries.',
    },
    {
      label: 'Write short, direct answers (1–2 sentences)',
      detail:
        'Lead with the answer, not context. Voice AI truncates long responses and skips preamble.',
    },
    {
      label: 'Include your business name and city in every answer',
      detail:
        'AI needs local signals to recommend you by location. Name + neighborhood in every response.',
    },
    {
      label: 'Publish as a FAQ page or GBP post',
      detail:
        'Structured FAQ content is the fastest path to AI citations for "near me" and local queries.',
    },
    {
      label: 'Run Voice Check to measure improvement',
      detail:
        'Citation rate updates after each scan cycle. Small content changes can produce quick gains.',
    },
  ];

  return {
    id: 'voice_citation',
    title: 'Get AI Talking About You',
    subtitle: 'Turn zero-citation queries into recommendations',
    pts_gain: ptsGain,
    component: 'voice_citation',
    status: ptsGain === 0 ? 'done' : 'open',
    steps,
  };
}

function buildContentQualityMission(
  ptsGain: number,
  input: MissionGeneratorInput,
): Mission {
  const topIssues = input.top_content_issues.slice(0, 3);

  const issueSteps: MissionStep[] = topIssues.map((issue) => ({
    label: issue.description,
    detail: issue.fix,
  }));

  const fallbackSteps: MissionStep[] = [
    {
      label: 'Keep answers under 50 words',
      detail:
        'Voice assistants truncate long answers. Lead with the most important fact first.',
    },
    {
      label: 'Use active voice throughout',
      detail:
        '"We serve hookah from 4 PM" — not "Hookah service is offered starting at 4 PM".',
    },
    {
      label: 'Remove markdown formatting',
      detail: 'Asterisks, bullets, and headers break spoken delivery. Write plain prose.',
    },
  ];

  const steps: MissionStep[] = [
    ...(issueSteps.length > 0 ? issueSteps : fallbackSteps),
    {
      label: 'Aim for sentences under 18 words',
      detail:
        'Voice answers must sound natural when spoken aloud. Short sentences reduce listener fatigue.',
    },
  ];

  return {
    id: 'content_quality',
    title: 'Make Your Content Voice-Ready',
    subtitle: 'Format answers so AI can speak them aloud',
    pts_gain: ptsGain,
    component: 'content_quality',
    status: ptsGain === 0 ? 'done' : 'open',
    steps,
  };
}

// ---------------------------------------------------------------------------
// generateMissions — main export
// ---------------------------------------------------------------------------

/**
 * Returns up to 5 missions ordered by potential score gain (highest first).
 * Done missions (pts_gain === 0) are sorted to the end.
 *
 * Returns an empty array if breakdown is missing (no scan yet).
 */
export function generateMissions(input: MissionGeneratorInput): Mission[] {
  const { breakdown } = input;

  const missions: Mission[] = [
    buildCrawlerMission(VOICE_SCORE_MAX.crawler_access - breakdown.crawler_access),
    buildLlmsTxtMission(VOICE_SCORE_MAX.llms_txt - breakdown.llms_txt, input.llms_txt_status),
    buildVoiceCitationMission(VOICE_SCORE_MAX.voice_citation - breakdown.voice_citation, input),
    buildContentQualityMission(
      VOICE_SCORE_MAX.content_quality - breakdown.content_quality,
      input,
    ),
  ];

  // Sort: open missions by pts_gain desc; done missions trail at the end
  return missions
    .sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (a.status !== 'done' && b.status === 'done') return -1;
      return b.pts_gain - a.pts_gain;
    })
    .slice(0, 5);
}
