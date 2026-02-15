import { lazy, Suspense, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useAppInitialization } from '@/hooks';
import { useUpdateToast } from '@/hooks/useUpdateToast';
import { useValidationSocket } from '@/hooks/useValidation';
import { useReviewSocket } from '@/hooks/useReview';
import { useRepositoryStore } from '@/stores/useRepositoryStore';
import { useConnectionStore } from '@/stores/useConnectionStore';
import { useSettingsStore } from '@/stores';
import { useIssueStore } from '@/stores/useIssueStore';
import { useReviewStore } from '@/stores/useReviewStore';
import { TopBar, WelcomeView, TabBar } from '@/components/shared';
import type { AppTab } from '@/components/shared';
import { DashboardView } from '@/components/dashboard';
import { IssueListView } from '@/components/issues';
import { PRListView } from '@/components/pullrequests';

const SettingsModal = lazy(() => import('@/components/settings/SettingsModal'));

function App() {
  useAppInitialization();
  useUpdateToast();
  // Initialize socket listeners at app level (call exactly once)
  useValidationSocket();
  useReviewSocket();

  const repositoryPath = useRepositoryStore(state => state.repositoryPath);
  const isRestoring = useRepositoryStore(state => state.isRestoring);
  const connectionStatus = useConnectionStore(state => state.status);
  const settingsOpen = useSettingsStore(state => state.isOpen);
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
    <div
      className="h-screen w-screen bg-background text-foreground flex flex-col overflow-hidden"
      {...(connectionStatus === 'connected' ? { 'data-testid': 'app-ready' } : {})}
    >
      <TopBar />
      {isConnected && <TabBar activeTab={activeTab} onTabChange={setActiveTab} />}
      <div className="flex-1 overflow-hidden">
        {!isConnected ? (
          isRestoring ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={32} className="animate-spin text-primary" />
            </div>
          ) : (
            <WelcomeView />
          )
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
      {settingsOpen && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          }
        >
          <SettingsModal />
        </Suspense>
      )}
    </div>
  );
}

export default App;
