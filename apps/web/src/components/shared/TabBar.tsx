import { cn } from '@/lib/utils';

export type AppTab = 'dashboard' | 'issues' | 'prs';

interface TabBarProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  className?: string;
}

const TABS: { value: AppTab; label: string }[] = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'issues', label: 'Issues' },
  { value: 'prs', label: 'PRs' },
];

/**
 * Tab bar for switching between Issues and Pull Requests views.
 * Placed at the top of the content area below the TopBar.
 * Uses teal underline on the active tab for brand consistency.
 */
export function TabBar({ activeTab, onTabChange, className }: TabBarProps) {
  return (
    <div className={cn('flex border-b border-border', className)}>
      {TABS.map((tab) => (
        <button
          key={tab.value}
          className={cn(
            'px-4 py-2.5 text-sm font-medium transition-colors relative',
            'hover:text-foreground',
            activeTab === tab.value
              ? 'text-foreground'
              : 'text-muted-foreground'
          )}
          onClick={() => onTabChange(tab.value)}
        >
          {tab.label}
          {/* Active indicator - teal underline */}
          {activeTab === tab.value && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      ))}
    </div>
  );
}
