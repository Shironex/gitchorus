import { useAppInitialization } from '@/hooks';
import { useUpdateToast } from '@/hooks/useUpdateToast';
import { useRepositoryStore } from '@/stores/useRepositoryStore';
import { TopBar, WelcomeView } from '@/components/shared';
import { SettingsModal } from '@/components/settings';
import { IssueListView } from '@/components/issues';

function App() {
  useAppInitialization();
  useUpdateToast();

  const repositoryPath = useRepositoryStore(state => state.repositoryPath);
  const isConnected = repositoryPath !== null;

  return (
    <div className="h-screen w-screen bg-background text-foreground flex flex-col overflow-hidden">
      <TopBar />
      <div className="flex-1 overflow-hidden">
        {isConnected ? <IssueListView /> : <WelcomeView />}
      </div>
      <SettingsModal />
    </div>
  );
}

export default App;
