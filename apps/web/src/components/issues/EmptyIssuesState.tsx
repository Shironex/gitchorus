import { CircleCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyIssuesStateProps {
  className?: string;
}

/**
 * Illustrated empty state shown when the repository has no open issues.
 * Uses a lucide icon as the illustration with a friendly message.
 */
export function EmptyIssuesState({ className }: EmptyIssuesStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4', className)}>
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
        <CircleCheck size={32} className="text-primary" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-1">No open issues</h3>
      <p className="text-sm text-muted-foreground text-center max-w-xs">
        This repository has no open issues. Issues will appear here when they are created on GitHub.
      </p>
    </div>
  );
}
