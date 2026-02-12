import { useMemo, useState } from 'react';
import { useIssueStore } from '@/stores/useIssueStore';
import { useReviewStore } from '@/stores/useReviewStore';
import { useValidationStore } from '@/stores/useValidationStore';

// ============================================
// Types
// ============================================

export type TimeRange = '7d' | '14d' | '30d' | '90d';

export interface DashboardStats {
  openIssues: number;
  openPrs: number;
  totalValidations: number;
  totalReviews: number;
  avgQualityScore: number | null;
}

export interface ActivityItem {
  id: string;
  type: 'validation' | 'review' | 'issue-opened' | 'pr-opened';
  title: string;
  number: number;
  timestamp: string;
  status: 'completed' | 'failed' | 'info';
  qualityScore?: number;
  verdict?: string;
}

// ============================================
// Hook
// ============================================

export function useDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  // Read from stores
  const issues = useIssueStore(state => state.issues);
  const pullRequests = useReviewStore(state => state.pullRequests);
  const reviewResults = useReviewStore(state => state.reviewResults);
  const validationHistory = useValidationStore(state => state.history);
  const validationResults = useValidationStore(state => state.results);

  // Compute stats
  const stats = useMemo<DashboardStats>(() => {
    const openIssues = issues.length;
    const openPrs = pullRequests.filter(pr => pr.state === 'open').length;
    const totalValidations = validationHistory.length + validationResults.size;
    const totalReviews = reviewResults.size;

    const scores = Array.from(reviewResults.values()).map(r => r.qualityScore);
    const avgQualityScore =
      scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : null;

    return { openIssues, openPrs, totalValidations, totalReviews, avgQualityScore };
  }, [issues, pullRequests, reviewResults, validationHistory, validationResults]);

  // Quality score data points for chart
  const qualityChartData = useMemo(() => {
    const cutoff = getTimeRangeCutoff(timeRange);
    const points: { date: string; score: number; prNumber: number }[] = [];

    for (const result of reviewResults.values()) {
      if (new Date(result.reviewedAt) >= cutoff) {
        points.push({
          date: result.reviewedAt,
          score: result.qualityScore,
          prNumber: result.prNumber,
        });
      }
    }

    points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return points;
  }, [reviewResults, timeRange]);

  // Activity feed items
  const activityItems = useMemo<ActivityItem[]>(() => {
    const cutoff = getTimeRangeCutoff(timeRange);
    const items: ActivityItem[] = [];

    // Validation history entries
    for (const entry of validationHistory) {
      const ts = entry.validatedAt;
      if (new Date(ts) >= cutoff) {
        items.push({
          id: entry.id,
          type: 'validation',
          title: `Issue #${entry.issueNumber}: ${entry.issueTitle}`,
          number: entry.issueNumber,
          timestamp: ts,
          status: 'completed',
          verdict: entry.verdict,
        });
      }
    }

    // Review results
    for (const result of reviewResults.values()) {
      if (new Date(result.reviewedAt) >= cutoff) {
        items.push({
          id: `review-${result.prNumber}-${result.reviewedAt}`,
          type: 'review',
          title: `PR #${result.prNumber}: ${result.prTitle}`,
          number: result.prNumber,
          timestamp: result.reviewedAt,
          status: 'completed',
          qualityScore: result.qualityScore,
          verdict: result.verdict,
        });
      }
    }

    // Issues opened
    for (const issue of issues) {
      if (new Date(issue.createdAt) >= cutoff) {
        items.push({
          id: `issue-opened-${issue.number}`,
          type: 'issue-opened',
          title: `Issue #${issue.number}: ${issue.title}`,
          number: issue.number,
          timestamp: issue.createdAt,
          status: 'info',
        });
      }
    }

    // PRs opened
    for (const pr of pullRequests) {
      if (new Date(pr.createdAt) >= cutoff) {
        items.push({
          id: `pr-opened-${pr.number}`,
          type: 'pr-opened',
          title: `PR #${pr.number}: ${pr.title}`,
          number: pr.number,
          timestamp: pr.createdAt,
          status: 'info',
        });
      }
    }

    // Sort by most recent first
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items;
  }, [validationHistory, reviewResults, issues, pullRequests, timeRange]);

  return { stats, qualityChartData, activityItems, timeRange, setTimeRange };
}

// ============================================
// Helpers
// ============================================

function getTimeRangeCutoff(range: TimeRange): Date {
  const now = new Date();
  const days = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 }[range];
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
