import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from '@/components';
import { SplashScreen } from '@/components/splash';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useConnectionStore } from '@/stores';
import './styles/globals.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find root element');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <TooltipProvider delayDuration={300}>
        <SplashScreen />
        <App />
        <Toaster />
      </TooltipProvider>
    </ErrorBoundary>
  </StrictMode>
);

// Expose stores on window for E2E testing.
(window as unknown as Record<string, unknown>).__testStores = {
  connection: useConnectionStore,
};
