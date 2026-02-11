import { useEffect } from 'react';
import { createLogger } from '@gitchorus/shared';
import { useUpdateStore } from '@/stores/useUpdateStore';
import { useConnectionStore } from '@/stores/useConnectionStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { connectSocket } from '@/lib/socket';

const logger = createLogger('AppInit');

/**
 * Detect GitHub CLI installation & auth status via IPC and store the result.
 */
async function detectGithubCliStatus(): Promise<void> {
  try {
    if (window.electronAPI?.github?.getStatus) {
      const status = await window.electronAPI.github.getStatus();
      useSettingsStore.getState().setGithubCliStatus(status);
      logger.info(
        'GitHub CLI detected:',
        status.installed ? 'installed' : 'not installed',
        status.auth.authenticated ? '(authenticated)' : '(not authenticated)'
      );
    }
  } catch (error) {
    logger.warn('Failed to detect GitHub CLI status:', error);
  }
}

/**
 * Initialize app-level socket connection and register store and updater listeners on mount.
 *
 * Registers socket listeners for the connection store BEFORE establishing the socket connection,
 * ensuring that onConnect callbacks fire on the initial connection. After connecting, initializes
 * IPC-based update listeners. Cleans up all registered listeners when the component unmounts.
 */
export function useAppInitialization(): void {
  // Connection store (global socket connection state)
  const initConnectionListeners = useConnectionStore(state => state.initListeners);
  const cleanupConnectionListeners = useConnectionStore(state => state.cleanupListeners);

  // Update store (uses IPC, not socket -- init separately)
  const initUpdateListeners = useUpdateStore(state => state.initListeners);

  // Initialize stores and socket on mount
  useEffect(() => {
    let mounted = true;
    let cleanupUpdateListeners: (() => void) | undefined;
    const init = async () => {
      try {
        logger.info('Initializing app...');
        // Register connection listeners BEFORE connecting
        initConnectionListeners();
        logger.info('All listeners registered');
        await connectSocket();
        if (!mounted) return;
        logger.info('Socket connected');
        // Detect GitHub CLI status
        detectGithubCliStatus().catch(() => {});
        // Init updater listeners (IPC-based, not socket)
        cleanupUpdateListeners = initUpdateListeners();
      } catch (error) {
        logger.error('Failed to initialize:', error);
      }
    };

    init();

    return () => {
      mounted = false;
      logger.debug('Cleaning up listeners');
      cleanupConnectionListeners();
      cleanupUpdateListeners?.();
    };
  }, [initConnectionListeners, cleanupConnectionListeners, initUpdateListeners]);
}
