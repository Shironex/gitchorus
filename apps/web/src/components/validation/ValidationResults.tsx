import { useState, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Bug,
  Lightbulb,
  FileCode,
  Clock,
  Clipboard,
  Check,
} from 'lucide-react';
import { cn, formatDuration } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Markdown } from '@/components/ui/markdown';
import type { ValidationResult, BugValidation, FeatureValidation } from '@gitchorus/shared';

// ---------------------------------------------------------------------------
// Language inference from file extension
// ---------------------------------------------------------------------------

const EXTENSION_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  css: 'css',
  html: 'html',
  json: 'json',
  md: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'bash',
  bash: 'bash',
  sql: 'sql',
  rb: 'ruby',
  swift: 'swift',
  kt: 'kotlin',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  cc: 'cpp',
  cs: 'csharp',
  php: 'php',
};

/**
 * Infer a syntax highlighting language identifier from a file path's extension.
 * Returns an empty string when the extension is unrecognised.
 */
function inferLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_MAP[ext] ?? '';
}

// ---------------------------------------------------------------------------
// Component helpers
// ---------------------------------------------------------------------------

interface ValidationResultsProps {
  result: ValidationResult;
}

/**
 * Map verdict to display badge style
 */
function getVerdictBadge(verdict: string): { label: string; className: string } {
  switch (verdict) {
    case 'confirmed':
      return {
        label: 'Confirmed',
        className: 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30',
      };
    case 'likely':
      return {
        label: 'Likely',
        className: 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30',
      };
    case 'uncertain':
      return {
        label: 'Uncertain',
        className: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
      };
    case 'unlikely':
      return {
        label: 'Unlikely',
        className: 'bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30',
      };
    case 'invalid':
      return {
        label: 'Invalid',
        className: 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30',
      };
    default:
      return { label: verdict, className: 'bg-muted text-muted-foreground' };
  }
}

/**
 * Map complexity to display badge style
 */
function getComplexityBadge(complexity: string): { label: string; className: string } {
  switch (complexity) {
    case 'trivial':
      return { label: 'Trivial', className: 'bg-green-500/10 text-green-600' };
    case 'low':
      return { label: 'Low', className: 'bg-blue-500/10 text-blue-600' };
    case 'medium':
      return { label: 'Medium', className: 'bg-yellow-500/10 text-yellow-600' };
    case 'high':
      return { label: 'High', className: 'bg-orange-500/10 text-orange-600' };
    case 'very-high':
      return { label: 'Very High', className: 'bg-red-500/10 text-red-600' };
    default:
      return { label: complexity, className: 'bg-muted text-muted-foreground' };
  }
}

/**
 * Collapsible section component.
 */
function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {title}
      </button>
      {isOpen && <div className="px-3 pb-3 text-xs">{children}</div>}
    </div>
  );
}

/**
 * Copy-to-clipboard button that swaps to a check icon briefly on success.
 */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available — silently ignore
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="absolute top-1 right-1 p-1 rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
      title={copied ? 'Copied!' : 'Copy snippet'}
    >
      {copied ? <Check size={12} /> : <Clipboard size={12} />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Structured results display for completed validations.
 *
 * Shows verdict banner, confidence percentage, issue type badge,
 * complexity badge, affected files, suggested approach, and reasoning.
 * Feature requests additionally show prerequisites, conflicts, and effort estimate.
 *
 * - Suggested Approach renders full GitHub-flavored markdown with syntax highlighting.
 * - Affected file snippets are syntax-highlighted based on inferred file extension.
 * - Code snippets have a copy-to-clipboard button on hover.
 */
export function ValidationResults({ result }: ValidationResultsProps) {
  const verdictBadge = getVerdictBadge(result.verdict);
  const complexityBadge = getComplexityBadge(result.complexity);
  const isFeature = result.issueType === 'feature';

  return (
    <div className="space-y-3">
      {/* Verdict banner */}
      <div className={cn('rounded-lg border px-3 py-2.5', verdictBadge.className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isFeature ? <Lightbulb size={16} /> : <Bug size={16} />}
            <span className="font-semibold text-sm">{verdictBadge.label}</span>
          </div>
          <span className="text-sm font-mono font-bold">{result.confidence}%</span>
        </div>
      </div>

      {/* Type + Complexity badges */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px] capitalize">
          {isFeature ? 'Feature Request' : 'Bug Report'}
        </Badge>
        <Badge variant="outline" className={cn('text-[10px]', complexityBadge.className)}>
          {complexityBadge.label} complexity
        </Badge>
      </div>

      {/* Suggested approach — rendered as full GFM markdown */}
      <div>
        <h4 className="text-xs font-medium text-foreground mb-1">Suggested Approach</h4>
        <Markdown>{result.suggestedApproach}</Markdown>
      </div>

      {/* Feature-specific: prerequisites, conflicts, effort */}
      {isFeature && (
        <>
          {(result as FeatureValidation).prerequisites.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-foreground mb-1">Prerequisites</h4>
              <ul className="space-y-0.5">
                {(result as FeatureValidation).prerequisites.map((prereq, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-primary mt-0.5 shrink-0">-</span>
                    {prereq}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(result as FeatureValidation).potentialConflicts.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-foreground mb-1">Potential Conflicts</h4>
              <ul className="space-y-0.5">
                {(result as FeatureValidation).potentialConflicts.map((conflict, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-destructive mt-0.5 shrink-0">!</span>
                    {conflict}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock size={12} />
            <span>Effort estimate: {(result as FeatureValidation).effortEstimate}</span>
          </div>
        </>
      )}

      {/* Affected files — snippets syntax-highlighted via Markdown + inferred language */}
      {result.affectedFiles.length > 0 && (
        <CollapsibleSection title={`Affected Files (${result.affectedFiles.length})`} defaultOpen>
          <div className="space-y-2">
            {result.affectedFiles.map((file, i) => (
              <div key={i} className="border-l-2 border-primary/30 pl-2">
                <div className="flex items-center gap-1.5 text-foreground">
                  <FileCode size={12} className="shrink-0" />
                  <span className="font-mono text-[11px]">{file.path}</span>
                </div>
                <p className="text-muted-foreground mt-0.5">{file.reason}</p>
                {file.snippet && (
                  <div className="relative group mt-1">
                    <CopyButton text={file.snippet} />
                    <Markdown>{`\`\`\`${inferLanguage(file.path)}\n${file.snippet}\n\`\`\``}</Markdown>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Reasoning */}
      <CollapsibleSection title="Reasoning">
        <Markdown>{(result as BugValidation | FeatureValidation).reasoning}</Markdown>
      </CollapsibleSection>

      {/* Cost and duration */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground/60 pt-1 border-t">
        <span className="flex items-center gap-1">
          <Clock size={10} />
          {formatDuration(result.durationMs / 1000)}
        </span>
        <span className="ml-auto">{result.model}</span>
      </div>
    </div>
  );
}
