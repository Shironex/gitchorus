import { GitPullRequest } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyPRsStateProps {
  className?: string;
}

/**
 * Illustrated empty state shown when the repository has no pull requests
 * matching the current filters.
 */
export function EmptyPRsState({ className }: EmptyPRsStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4', className)}>
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
        <GitPullRequest size={32} className="text-primary" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-1">No pull requests</h3>
      <p className="text-sm text-muted-foreground text-center max-w-xs">
        This repository has no pull requests matching the current filter. Pull requests will appear
        here when they are created on GitHub.
      </p>
    </div>
  );
}
