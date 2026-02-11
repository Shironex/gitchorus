import { ipcMain } from 'electron';
import { createLogger } from '@gitchorus/shared';
import { getClaudeCliStatus } from '../utils';

const logger = createLogger('IPC:ClaudeCli');

/**
 * Register Claude CLI IPC handlers
 */
export function registerClaudeCliHandlers(): void {
  ipcMain.handle('claude:get-status', async () => {
    try {
      return await getClaudeCliStatus();
    } catch (error) {
      logger.error('Failed to get Claude CLI status:', error);
      throw error;
    }
  });
}

/**
 * Clean up Claude CLI IPC handlers
 */
export function cleanupClaudeCliHandlers(): void {
  ipcMain.removeHandler('claude:get-status');
}
