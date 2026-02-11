import { useAppInitialization } from '@/hooks';
import { useUpdateToast } from '@/hooks/useUpdateToast';

function App() {
  useAppInitialization();
  useUpdateToast();

  return (
    <div className="h-screen w-screen bg-background text-foreground flex flex-col overflow-hidden">
      <div className="flex items-center justify-center flex-1">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">GitChorus</h1>
          <p className="text-muted-foreground">Repository connection coming soon</p>
        </div>
      </div>
    </div>
  );
}

export default App;
