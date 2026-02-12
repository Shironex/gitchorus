interface DashboardViewProps {
  onNavigateToIssue: (issueNumber: number) => void;
  onNavigateToPR: (prNumber: number) => void;
}

/**
 * Main dashboard view - placeholder for Task 1.
 * Full implementation in Task 2.
 */
export function DashboardView({ onNavigateToIssue, onNavigateToPR }: DashboardViewProps) {
  void onNavigateToIssue;
  void onNavigateToPR;
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold">Dashboard</h2>
    </div>
  );
}
