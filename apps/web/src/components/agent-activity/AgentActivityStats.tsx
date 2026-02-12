import { FileText, Search, Terminal, Clock } from 'lucide-react';

interface AgentActivityStatsProps {
  filesRead: number;
  searchesPerformed: number;
  commandsRun: number;
  elapsedSeconds: number;
  totalSteps: number;
}

/**
 * Real-time stats bar showing tool invocation counters and elapsed time.
 */
export function AgentActivityStats({
  filesRead,
  searchesPerformed,
  commandsRun,
  elapsedSeconds,
  totalSteps,
}: AgentActivityStatsProps) {
  return (
    <div className="flex items-center justify-center gap-5 py-2.5 px-4 rounded-lg bg-muted/30 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <FileText size={12} className="text-blue-500" />
        <span className="tabular-nums font-medium text-foreground">{filesRead}</span>
        <span>files</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Search size={12} className="text-amber-500" />
        <span className="tabular-nums font-medium text-foreground">{searchesPerformed}</span>
        <span>searches</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Terminal size={12} className="text-green-500" />
        <span className="tabular-nums font-medium text-foreground">{commandsRun}</span>
        <span>commands</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Clock size={12} />
        <span className="tabular-nums font-medium text-foreground">{elapsedSeconds}s</span>
      </div>
      <div className="text-muted-foreground/50">|</div>
      <span className="tabular-nums">{totalSteps} steps</span>
    </div>
  );
}
