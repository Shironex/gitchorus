import { CircleDot, GitPullRequest, Search, FileSearch, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DashboardStats } from '@/hooks/useDashboard';

interface StatsCardsProps {
  stats: DashboardStats;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  iconBgClass: string;
}

function StatCard({ icon, label, value, iconBgClass }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-4 flex items-center gap-3">
      <div className={cn('flex items-center justify-center w-9 h-9 rounded-lg', iconBgClass)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-semibold text-foreground leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/**
 * Dashboard stats cards showing repo and analysis metrics.
 *
 * Row 1: Open Issues, Open PRs (repository stats from GitHub)
 * Row 2: Total Validations, Total Reviews, Average Quality Score
 */
export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="space-y-3">
      {/* Row 1: Repository Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<CircleDot size={18} className="text-emerald-500" />}
          iconBgClass="bg-emerald-500/10"
          label="Open Issues"
          value={stats.openIssues}
        />
        <StatCard
          icon={<GitPullRequest size={18} className="text-blue-500" />}
          iconBgClass="bg-blue-500/10"
          label="Open PRs"
          value={stats.openPrs}
        />
      </div>

      {/* Row 2: Analysis Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<Search size={18} className="text-primary" />}
          iconBgClass="bg-primary/10"
          label="Validations"
          value={stats.totalValidations}
        />
        <StatCard
          icon={<FileSearch size={18} className="text-amber-500" />}
          iconBgClass="bg-amber-500/10"
          label="Reviews"
          value={stats.totalReviews}
        />
        <StatCard
          icon={<TrendingUp size={18} className="text-purple-500" />}
          iconBgClass="bg-purple-500/10"
          label="Avg Quality"
          value={stats.avgQualityScore !== null ? `${stats.avgQualityScore}/10` : 'N/A'}
        />
      </div>
    </div>
  );
}
