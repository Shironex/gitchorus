import { useState } from 'react';
import { Settings, Minus, Square, X as XIcon, FolderOpen, ArrowLeftRight } from 'lucide-react';
import { APP_NAME } from '@gitchorus/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useRepositoryStore } from '@/stores/useRepositoryStore';
import { useValidationStore } from '@/stores/useValidationStore';
import { useReviewStore } from '@/stores/useReviewStore';
import { useIssueStore } from '@/stores/useIssueStore';
import { ConfirmDialog } from './ConfirmDialog';
import { IS_MAC } from '@/lib/platform';

const isElectron = !!window.electronAPI;

export function TopBar() {
  const openSettings = useSettingsStore(state => state.openSettings);
  const repositoryName = useRepositoryStore(state => state.repositoryName);
  const repositoryPath = useRepositoryStore(state => state.repositoryPath);
  const isConnected = repositoryPath !== null;

  const [switchDialogOpen, setSwitchDialogOpen] = useState(false);

  const hasInProgressWork = (): boolean => {
    const validationQueue = useValidationStore.getState().queue;
    const hasActiveValidations = validationQueue.some(
      item => item.status === 'queued' || item.status === 'running'
    );

    const reviewStatus = useReviewStore.getState().reviewStatus;
    const hasActiveReviews = Array.from(reviewStatus.values()).some(
      status => status === 'queued' || status === 'running'
    );

    return hasActiveValidations || hasActiveReviews;
  };

  const handleSwitchClick = () => {
    if (hasInProgressWork()) {
      setSwitchDialogOpen(true);
    } else {
      performSwitch();
    }
  };

  const performSwitch = () => {
    useIssueStore.getState().clearIssues();
    useReviewStore.getState().clearPullRequests();
    useValidationStore.getState().clearAll();
    useRepositoryStore.getState().clearRepository();
    setSwitchDialogOpen(false);
  };

  return (
    <>
      <div
        className={cn(
          'h-10 flex items-center justify-between',
          'border-b border-border bg-background/95 backdrop-blur-sm',
          'select-none drag',
          'shrink-0'
        )}
      >
        {/* Left: Project info or app name */}
        <div className={cn('flex items-center gap-2', IS_MAC ? 'pl-20' : 'pl-4')}>
          {isConnected ? (
            <>
              <FolderOpen size={14} className="text-muted-foreground" />
              <span className="text-sm font-medium text-foreground/80 truncate max-w-[200px]">
                {repositoryName}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSwitchClick}
                className="no-drag w-6 h-6 ml-1"
                aria-label="Switch project"
                title="Switch project"
              >
                <ArrowLeftRight size={13} />
              </Button>
            </>
          ) : (
            <span className="text-sm font-semibold text-foreground/80">{APP_NAME}</span>
          )}
        </div>

        {/* Right: Settings + Window controls */}
        <div className="flex items-center gap-1 pr-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openSettings()}
            className="no-drag w-7 h-7"
            aria-label="Settings"
          >
            <Settings size={15} />
          </Button>

          {/* Window controls (Electron only, hidden on macOS which uses native traffic lights) */}
          {isElectron && !IS_MAC && (
            <>
              <div className="w-px h-5 bg-border mx-1" />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.electronAPI?.window.minimize()}
                className="no-drag w-7 h-7"
                aria-label="Minimize"
              >
                <Minus size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.electronAPI?.window.maximize()}
                className="no-drag w-7 h-7"
                aria-label="Maximize"
              >
                <Square size={12} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.electronAPI?.window.close()}
                className="no-drag w-7 h-7 hover:bg-destructive/20 hover:text-destructive"
                aria-label="Close"
              >
                <XIcon size={14} />
              </Button>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={switchDialogOpen}
        onOpenChange={setSwitchDialogOpen}
        title="Switch Project?"
        description="There are validations or reviews in progress. Switching projects will cancel them. Are you sure?"
        confirmLabel="Switch Project"
        onConfirm={performSwitch}
      />
    </>
  );
}
