/**
 * Multi-Agent Review Utilities
 *
 * Pure functions for multi-agent review result processing:
 * - Finding deduplication
 * - Weighted score calculation
 * - Severity caps
 *
 * Extracted to a separate file to avoid importing the Claude Agent SDK
 * in test environments.
 */

import type { ReviewFinding, ReviewSeverity, SubAgentScore } from '@gitchorus/shared';

/**
 * Ordered severity levels — single source of truth for ordering and bumping.
 */
const SEVERITY_LEVELS: ReviewSeverity[] = ['nit', 'minor', 'major', 'critical'];

/**
 * Severity level ordering for comparison (derived from SEVERITY_LEVELS).
 */
const SEVERITY_ORDER: Record<ReviewSeverity, number> = Object.fromEntries(
  SEVERITY_LEVELS.map((level, index) => [level, index])
) as Record<ReviewSeverity, number>;

/**
 * Bump a severity level up by one.
 */
function bumpSeverity(severity: ReviewSeverity): ReviewSeverity {
  const idx = SEVERITY_LEVELS.indexOf(severity);
  return SEVERITY_LEVELS[Math.min(idx + 1, SEVERITY_LEVELS.length - 1)];
}

/**
 * Group a line number into a bucket of 5 for deduplication.
 * Lines 1-5 -> 1, lines 6-10 -> 6, etc.
 */
function lineGroup(line: number): number {
  const safeLine = Math.max(1, line);
  return Math.floor((safeLine - 1) / 5) * 5 + 1;
}

/**
 * Deduplicate findings from multiple sub-agents.
 * - Key on file + lineGroup(5) + category
 * - Keep the finding with higher severity or longer explanation
 * - If same finding from different agents, bump severity by one level
 */
export function deduplicateFindings(findings: ReviewFinding[]): ReviewFinding[] {
  const groups = new Map<string, ReviewFinding[]>();

  for (const finding of findings) {
    const key = `${finding.file}:${lineGroup(finding.line)}:${finding.category}`;
    const group = groups.get(key) || [];
    group.push(finding);
    groups.set(key, group);
  }

  const result: ReviewFinding[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }

    // Multiple agents flagged the same area — keep most detailed, bump severity
    const sorted = [...group].sort((a, b) => {
      // Prefer higher severity
      const sevDiff = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
      if (sevDiff !== 0) return sevDiff;
      // Prefer longer explanation
      return b.explanation.length - a.explanation.length;
    });

    const best = { ...sorted[0] };

    // Check if different agents flagged this
    const uniqueAgents = new Set(group.map(f => f.agentSource).filter(Boolean));
    if (uniqueAgents.size > 1) {
      best.severity = bumpSeverity(best.severity);
    }

    result.push(best);
  }

  return result;
}

/**
 * Calculate weighted quality score from sub-agent scores.
 */
export function calculateWeightedScore(subAgentScores: SubAgentScore[]): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const agentScore of subAgentScores) {
    if (agentScore.weight > 0) {
      weightedSum += agentScore.score * agentScore.weight;
      totalWeight += agentScore.weight;
    }
  }

  if (totalWeight === 0) return 5;
  return Math.round((weightedSum / totalWeight) * 10) / 10;
}

/**
 * Apply severity caps to the quality score.
 * - Any critical finding -> max 5/10
 * - Any major finding -> max 7/10
 */
export function applySeverityCaps(score: number, findings: ReviewFinding[]): number {
  const hasCritical = findings.some(f => f.severity === 'critical');
  const hasMajor = findings.some(f => f.severity === 'major');

  if (hasCritical) return Math.min(score, 5);
  if (hasMajor) return Math.min(score, 7);
  return score;
}
