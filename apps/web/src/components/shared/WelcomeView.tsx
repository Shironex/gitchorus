import { useEffect, useState } from 'react';
import { GitBranch, FolderOpen, Loader2, AlertCircle, Clock, X as XIcon } from 'lucide-react';
import { APP_NAME } from '@gitchorus/shared';
import type { RecentProject } from '@gitchorus/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useRepositoryStore } from '@/stores/useRepositoryStore';
import { useRepositoryConnection } from '@/hooks/useRepositoryConnection';
import { loadRecentProjects, connectToProject, removeRecentProject } from '@/lib/recentProjects';

interface WelcomeViewProps {
  className?: string;
}

export function WelcomeView({ className }: WelcomeViewProps) {
  const isConnecting = useRepositoryStore(state => state.isConnecting);
  const isRestoring = useRepositoryStore(state => state.isRestoring);
  const error = useRepositoryStore(state => state.error);
  const { openRepository } = useRepositoryConnection();

  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const isBusy = isConnecting || isRestoring;

  // Load recent projects on mount
  useEffect(() => {
    loadRecentProjects().then(setRecentProjects);
  }, []);

  // Keyboard shortcut: Ctrl/Cmd + O to open repository
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        openRepository();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openRepository]);

  const handleRecentClick = (project: RecentProject) => {
    connectToProject(project);
  };

  const handleRemoveRecent = async (e: React.MouseEvent, localPath: string) => {
    e.stopPropagation();
    await removeRecentProject(localPath);
    setRecentProjects(prev => prev.filter(p => p.localPath !== localPath));
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center h-full w-full',
        'bg-background relative overflow-hidden',
        className
      )}
    >
      {/* Subtle background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/3 -right-20 w-80 h-80 bg-primary/10 rounded-full blur-[120px]" />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center max-w-md w-full px-8">
        {/* Logo / Icon */}
        <div className="mb-8">
          <div
            className={cn(
              'w-20 h-20 rounded-2xl',
              'bg-primary/10 border border-primary/20',
              'flex items-center justify-center'
            )}
          >
            <GitBranch size={40} className="text-primary" strokeWidth={1.5} />
          </div>
        </div>

        {/* App name */}
        <h1 className="text-3xl font-bold text-foreground mb-2">{APP_NAME}</h1>
        <p className="text-sm text-muted-foreground text-center mb-10">
          Open a git repository to get started
        </p>

        {/* Error message */}
        {error && (
          <div className="w-full mb-6 flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Could not open repository</p>
              <p className="text-destructive/80 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Open Repository button */}
        <Button
          onClick={openRepository}
          disabled={isBusy}
          size="lg"
          className={cn(
            'gap-3 px-8 py-3 rounded-xl text-base',
            'shadow-lg shadow-primary/20',
            'hover:shadow-xl hover:shadow-primary/25',
            'transition-all duration-200'
          )}
        >
          {isBusy ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <FolderOpen size={20} />
              <span>Open Repository</span>
            </>
          )}
        </Button>

        {/* Keyboard hint */}
        <p className="mt-6 text-xs text-muted-foreground">
          Press{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-foreground-secondary">
            {navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl'}+O
          </kbd>{' '}
          to open a repository
        </p>

        {/* Recent Projects */}
        {recentProjects.length > 0 && (
          <div className="w-full mt-8">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-muted-foreground" />
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Recent Projects
              </h2>
            </div>
            <div className="space-y-2">
              {recentProjects.map(project => (
                <button
                  key={project.localPath}
                  onClick={() => handleRecentClick(project)}
                  disabled={isBusy}
                  className={cn(
                    'w-full px-4 py-3 rounded-lg border border-border',
                    'bg-card hover:bg-accent/50',
                    'text-left transition-colors group',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-foreground truncate">{project.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {project.localPath}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeDate(project.lastOpened)}
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={e => handleRemoveRecent(e, project.localPath)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            handleRemoveRecent(e as unknown as React.MouseEvent, project.localPath);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-opacity"
                        aria-label={`Remove ${project.name} from recent projects`}
                      >
                        <XIcon size={12} className="text-muted-foreground" />
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
