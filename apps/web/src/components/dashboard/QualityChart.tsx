import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TimeRange } from '@/hooks/useDashboard';

interface QualityChartProps {
  data: { date: string; score: number; prNumber: number }[];
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '14d', label: '14d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
];

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface TooltipPayloadItem {
  payload: { date: string; score: number; prNumber: number };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">
        PR #{data.prNumber}: {data.score}/10
      </p>
      <p className="text-xs text-muted-foreground">{formatDate(data.date)}</p>
    </div>
  );
}

/**
 * Quality score trend line chart using recharts.
 * Shows PR quality scores over time with a time range selector.
 * Uses CSS variables for theme-aware colors.
 */
export default function QualityChart({ data, timeRange, setTimeRange }: QualityChartProps) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-primary" />
          <h3 className="text-sm font-medium text-foreground">Quality Score Trend</h3>
        </div>

        {/* Time range selector */}
        <div className="flex items-center gap-1">
          {TIME_RANGES.map(range => (
            <button
              key={range.value}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-full transition-colors',
                timeRange === range.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
              onClick={() => setTimeRange(range.value)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">
              No reviews yet. Run a PR review to see quality trends.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                axisLine={{ stroke: 'var(--color-border)' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 10]}
                ticks={[0, 2, 4, 6, 8, 10]}
                tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                axisLine={{ stroke: 'var(--color-border)' }}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={{ r: 4, fill: 'var(--color-primary)', stroke: 'var(--color-card)' }}
                activeDot={{
                  r: 6,
                  fill: 'var(--color-primary)',
                  stroke: 'var(--color-card)',
                  strokeWidth: 2,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
