import { GitBranch, Github, FolderOpen, ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useRepositoryStore } from '@/stores/useRepositoryStore';
import { useRepositoryConnection } from '@/hooks/useRepositoryConnection';

interface RepoInfoViewProps {
  className?: string;
}

export function RepoInfoView({ className }: RepoInfoViewProps) {
  const repositoryName = useRepositoryStore(state => state.repositoryName);
  const repositoryPath = useRepositoryStore(state => state.repositoryPath);
  const currentBranch = useRepositoryStore(state => state.currentBranch);
  const githubInfo = useRepositoryStore(state => state.githubInfo);
  const { changeRepository } = useRepositoryConnection();

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center h-full w-full',
        'bg-background',
        className
      )}
    >
      <div className="max-w-lg w-full px-8">
        <Card className="border-border/60">
          <CardContent className="p-8">
            {/* Repository Name */}
            <div className="flex items-center gap-3 mb-6">
              <div
                className={cn(
                  'w-12 h-12 rounded-xl',
                  'bg-primary/10 border border-primary/20',
                  'flex items-center justify-center shrink-0'
                )}
              >
                <GitBranch size={24} className="text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-foreground truncate">{repositoryName}</h2>
                <p className="text-sm text-muted-foreground">Connected repository</p>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-4">
              {/* GitHub Remote */}
              {githubInfo && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Github size={18} className="text-foreground/70 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">GitHub</p>
                    <a
                      href={githubInfo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary hover:underline truncate block"
                    >
                      {githubInfo.fullName}
                    </a>
                  </div>
                </div>
              )}

              {/* Current Branch */}
              {currentBranch && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <GitBranch size={18} className="text-foreground/70 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Branch</p>
                    <p className="text-sm font-medium text-foreground truncate">{currentBranch}</p>
                  </div>
                </div>
              )}

              {/* Local Path */}
              {repositoryPath && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <FolderOpen size={18} className="text-foreground/70 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Local path</p>
                    <p className="text-sm text-foreground/80 truncate font-mono">
                      {repositoryPath}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Change Repository button */}
            <div className="mt-8 flex justify-center">
              <Button variant="secondary" onClick={changeRepository} className="gap-2">
                <ArrowLeftRight size={16} />
                Change Repository
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
