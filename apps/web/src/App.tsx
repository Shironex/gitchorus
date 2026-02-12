import { useState, useCallback } from 'react';
import { useAppInitialization } from '@/hooks';
import { useUpdateToast } from '@/hooks/useUpdateToast';
import { useValidationSocket } from '@/hooks/useValidation';
import { useReviewSocket } from '@/hooks/useReview';
import { useRepositoryStore } from '@/stores/useRepositoryStore';
import { useIssueStore } from '@/stores/useIssueStore';
import { useReviewStore } from '@/stores/useReviewStore';
import { TopBar, WelcomeView, TabBar } from '@/components/shared';
import type { AppTab } from '@/components/shared';
import { SettingsModal } from '@/components/settings';
import { DashboardView } from '@/components/dashboard';
import { IssueListView } from '@/components/issues';
import { PRListView } from '@/components/pullrequests';

function App() {
  useAppInitialization();
  useUpdateToast();
  // Initialize socket listeners at app level (call exactly once)
  useValidationSocket();
  useReviewSocket();

  const repositoryPath = useRepositoryStore(state => state.repositoryPath);
  const isConnected = repositoryPath !== null;

  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');

  const handleNavigateToIssue = useCallback((issueNumber: number) => {
    useIssueStore.getState().setSelectedIssue(issueNumber);
    setActiveTab('issues');
  }, []);

  const handleNavigateToPR = useCallback((prNumber: number) => {
    useReviewStore.getState().setSelectedPr(prNumber);
    setActiveTab('prs');
  }, []);

  return (
    <div className="h-screen w-screen bg-background text-foreground flex flex-col overflow-hidden">
      <TopBar />
      {isConnected && (
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      )}
      <div className="flex-1 overflow-hidden">
        {!isConnected ? (
          <WelcomeView />
        ) : activeTab === 'dashboard' ? (
          <DashboardView
            onNavigateToIssue={handleNavigateToIssue}
            onNavigateToPR={handleNavigateToPR}
          />
        ) : activeTab === 'issues' ? (
          <IssueListView />
        ) : (
          <PRListView />
        )}
      </div>
      <SettingsModal />
    </div>
  );
}

export default App;
