import { BrowserWindow } from 'electron';
import {
  registerWindowHandlers,
  cleanupWindowHandlers,
  registerDialogHandlers,
  cleanupDialogHandlers,
  registerStoreHandlers,
  cleanupStoreHandlers,
  registerAppHandlers,
  cleanupAppHandlers,
  registerGithubCliHandlers,
  cleanupGithubCliHandlers,
  registerCodexCliHandlers,
  cleanupCodexCliHandlers,
  registerUpdaterHandlers,
  cleanupUpdaterHandlers,
} from './ipc';

/**
 * Register all IPC handlers for the application
 */
export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  registerWindowHandlers(mainWindow);
  registerDialogHandlers(mainWindow);
  registerStoreHandlers();
  registerAppHandlers();
  registerGithubCliHandlers();
  registerCodexCliHandlers();
  registerUpdaterHandlers();
}

/**
 * Clean up IPC handlers (call on app quit)
 */
export function cleanupIpcHandlers(): void {
  cleanupWindowHandlers();
  cleanupDialogHandlers();
  cleanupStoreHandlers();
  cleanupAppHandlers();
  cleanupGithubCliHandlers();
  cleanupCodexCliHandlers();
  cleanupUpdaterHandlers();
}
