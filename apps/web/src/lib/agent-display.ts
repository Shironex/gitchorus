import type { ReviewAgentType } from '@gitchorus/shared';

/**
 * Agent badge colors for FindingCard display.
 */
export const AGENT_BADGE_COLORS: Record<ReviewAgentType, string> = {
  // Required by Record type but context agent never produces findings
  context: 'bg-slate-500/5 text-slate-500 dark:text-slate-300 border-slate-500/15',
  'code-quality': 'bg-cyan-500/5 text-cyan-500 dark:text-cyan-300 border-cyan-500/15',
  'code-patterns': 'bg-indigo-500/5 text-indigo-500 dark:text-indigo-300 border-indigo-500/15',
  'security-performance': 'bg-rose-500/5 text-rose-500 dark:text-rose-300 border-rose-500/15',
};

/**
 * Short agent labels for compact badges (FindingCard).
 */
export const AGENT_SHORT_LABELS: Record<ReviewAgentType, string> = {
  context: 'Context',
  'code-quality': 'Quality',
  'code-patterns': 'Patterns',
  'security-performance': 'Sec & Perf',
};

/**
 * Full agent labels for expanded displays (ReviewSummary breakdown).
 */
export const AGENT_FULL_LABELS: Record<ReviewAgentType, string> = {
  context: 'Context',
  'code-quality': 'Code Quality',
  'code-patterns': 'Code Patterns',
  'security-performance': 'Security & Perf',
};
