import { useCallback } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import type { ActivityItem } from '@/hooks/useDashboard';
import { StatsCards } from './StatsCards';
import { QualityChart } from './QualityChart';
import { ActivityFeed } from './ActivityFeed';

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
        <QualityChart data={qualityChartData} timeRange={timeRange} setTimeRange={setTimeRange} />

        {/* Activity Feed */}
        <ActivityFeed items={activityItems} onNavigate={handleNavigate} />
      </div>
    </div>
  );
}
