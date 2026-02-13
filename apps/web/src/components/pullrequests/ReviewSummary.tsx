import { Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Markdown } from '@/components/ui/markdown';
import type { ReviewResult, ReviewSeverity } from '@gitchorus/shared';

interface ReviewSummaryProps {
  result: ReviewResult;
}

const SEVERITY_ORDER: ReviewSeverity[] = ['critical', 'major', 'minor', 'nit'];

/**
 * Quality score badge with color based on score range.
 * 8-10 green, 5-7 amber, 1-4 red
 */
function QualityBadge({ score }: { score: number }) {
  const color =
    score >= 8
      ? 'text-green-600 dark:text-green-400'
      : score >= 5
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

  const bgColor =
    score >= 8
      ? 'bg-green-500/10 border-green-500/20'
      : score >= 5
        ? 'bg-amber-500/10 border-amber-500/20'
        : 'bg-red-500/10 border-red-500/20';

  return (
    <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg border', bgColor)}>
      <Star size={16} className={color} />
      <span className={cn('text-lg font-bold', color)}>{score}</span>
      <span className="text-xs text-muted-foreground">/10</span>
    </div>
  );
}

/**
 * Score progression delta display for re-reviews.
 * Shows the previous score, an arrow, and the delta (+2, -1, etc.)
 */
function ScoreDelta({ previous, current }: { previous: number; current: number }) {
  const delta = current - previous;

  if (delta === 0) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>{previous}/10</span>
        <Minus size={12} />
        <span>No change</span>
      </div>
    );
  }

  const isImprovement = delta > 0;
  const Icon = isImprovement ? TrendingUp : TrendingDown;
  const colorClass = isImprovement
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div className={cn('flex items-center gap-1 text-xs font-medium', colorClass)}>
      <span className="text-muted-foreground">{previous}/10</span>
      <Icon size={14} />
      <span>
        {isImprovement ? '+' : ''}
        {delta}
      </span>
    </div>
  );
}

/**
 * Summary section displayed at the top of the review results.
 *
 * Shows the overall verdict text (rendered as markdown), quality score badge,
 * and a finding count summary broken down by severity.
 */
export function ReviewSummary({ result }: ReviewSummaryProps) {
  const findingsBySeverity = result.findings.reduce(
    (acc, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Build finding count summary: "2 Critical, 3 Major, 5 Minor, 1 Nit"
  const countParts = SEVERITY_ORDER.filter(sev => findingsBySeverity[sev]).map(
    sev => `${findingsBySeverity[sev]} ${sev.charAt(0).toUpperCase() + sev.slice(1)}`
  );
  const countSummary = countParts.length > 0 ? countParts.join(', ') : 'No findings';

  return (
    <div className="rounded-lg border p-4 bg-card space-y-3">
      {/* Top row: verdict + score */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground mb-1">Verdict</h4>
          <Markdown size="sm">{result.verdict}</Markdown>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {/* Score delta for re-reviews */}
          {result.previousScore != null && (
            <ScoreDelta previous={result.previousScore} current={result.qualityScore} />
          )}
          <QualityBadge score={result.qualityScore} />
        </div>
      </div>

      {/* Finding count summary */}
      <div className="text-xs text-muted-foreground">{countSummary}</div>

      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-2">
        <span>Model: {result.model}</span>
        <span>Cost: ${result.costUsd.toFixed(4)}</span>
        <span>Duration: {(result.durationMs / 1000).toFixed(1)}s</span>
      </div>
    </div>
  );
}
