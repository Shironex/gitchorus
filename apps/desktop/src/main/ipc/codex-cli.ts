import { ipcMain } from 'electron';
import { createLogger } from '@gitchorus/shared';
import { getCodexCliStatus } from '../utils';

const logger = createLogger('IPC:CodexCli');

/**
 * Register Codex CLI IPC handlers.
 */
export function registerCodexCliHandlers(): void {
  ipcMain.handle('codex:get-status', async () => {
    try {
      return await getCodexCliStatus();
    } catch (error) {
      logger.error('Failed to get Codex CLI status:', error);
      throw error;
    }
  });
}

/**
 * Clean up Codex CLI IPC handlers.
 */
export function cleanupCodexCliHandlers(): void {
  ipcMain.removeHandler('codex:get-status');
}
