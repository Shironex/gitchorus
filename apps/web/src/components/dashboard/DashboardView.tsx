import { lazy, Suspense, useCallback } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import type { ActivityItem } from '@/hooks/useDashboard';
import { StatsCards } from './StatsCards';
import { ActivityFeed } from './ActivityFeed';

const QualityChart = lazy(() => import('./QualityChart'));

interface DashboardViewProps {
  onNavigateToIssue: (issueNumber: number) => void;
  onNavigateToPR: (prNumber: number) => void;
}

/**
 * Main dashboard view showing project health overview.
 *
 * Layout:
 * - Stats cards (open issues/PRs, total validations/reviews, avg quality)
 * - Quality score trend line chart (with time range filter)
 * - Clickable activity feed (validations, reviews, issue/PR opens)
 *
 * This is the default landing view after connecting a repo.
 */
export function DashboardView({ onNavigateToIssue, onNavigateToPR }: DashboardViewProps) {
  const { stats, qualityChartData, activityItems, timeRange, setTimeRange } = useDashboard();

  const handleNavigate = useCallback(
    (type: ActivityItem['type'], number: number) => {
      if (type === 'validation' || type === 'issue-opened') {
        onNavigateToIssue(number);
      } else {
        onNavigateToPR(number);
      }
    },
    [onNavigateToIssue, onNavigateToPR]
  );

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Stats Cards */}
        <StatsCards stats={stats} />

        {/* Quality Score Chart */}
        <Suspense
          fallback={
            <div className="rounded-xl border border-border/50 bg-card/50 p-6 animate-pulse">
              <div className="h-64 flex items-center justify-center">
                <div className="text-sm text-muted-foreground">Loading chart...</div>
              </div>
            </div>
          }
        >
          <QualityChart data={qualityChartData} timeRange={timeRange} setTimeRange={setTimeRange} />
        </Suspense>

        {/* Activity Feed */}
        <ActivityFeed items={activityItems} onNavigate={handleNavigate} />
      </div>
    </div>
  );
}
