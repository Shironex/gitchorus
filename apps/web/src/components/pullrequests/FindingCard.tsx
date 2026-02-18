import { FileCode2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Markdown } from '@/components/ui/markdown';
import { getLanguageForFile } from '@/lib/reviewFormatter';
import type { ReviewFinding, ReviewSeverity, ReviewCategory } from '@gitchorus/shared';

interface FindingCardProps {
  finding: ReviewFinding;
  index: number;
  selected: boolean;
  onToggle: (index: number) => void;
}

// ============================================
// Severity badge colors
// ============================================

const severityColors: Record<ReviewSeverity, string> = {
  critical: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  major: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  minor: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  nit: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
};

// ============================================
// Category badge colors
// ============================================

const categoryColors: Record<ReviewCategory, string> = {
  security: 'bg-red-500/5 text-red-500 dark:text-red-300 border-red-500/15',
  logic: 'bg-blue-500/5 text-blue-500 dark:text-blue-300 border-blue-500/15',
  performance: 'bg-purple-500/5 text-purple-500 dark:text-purple-300 border-purple-500/15',
  style: 'bg-teal-500/5 text-teal-500 dark:text-teal-300 border-teal-500/15',
  'codebase-fit': 'bg-amber-500/5 text-amber-500 dark:text-amber-300 border-amber-500/15',
};

/**
 * Individual finding card with severity/category badges, code snippet,
 * explanation, and suggested fix.
 *
 * Renders code snippets using Markdown component's shiki syntax highlighting.
 * Selection checkbox on the left for parent-managed selection state.
 */
export function FindingCard({ finding, index, selected, onToggle }: FindingCardProps) {
  const lang = getLanguageForFile(finding.file);

  // Wrap code in a fenced code block for Markdown component's shiki rendering
  const codeSnippetMd = finding.codeSnippet ? `\`\`\`${lang}\n${finding.codeSnippet}\n\`\`\`` : '';

  const suggestedFixMd = finding.suggestedFix
    ? `\`\`\`${lang}\n${finding.suggestedFix}\n\`\`\``
    : '';

  return (
    <div
      className={cn(
        'rounded-lg border p-3 bg-card transition-colors',
        selected ? 'border-primary/30 bg-primary/[0.02]' : 'hover:bg-muted/30'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <label className="flex items-center mt-1 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(index)}
            className="h-4 w-4 rounded border-input text-primary accent-primary focus:ring-primary"
          />
        </label>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Header: badges + title */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Severity badge */}
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full border font-semibold uppercase tracking-wide',
                  severityColors[finding.severity]
                )}
              >
                {finding.severity}
              </span>
              {/* Category badge */}
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full border font-medium capitalize',
                  categoryColors[finding.category]
                )}
              >
                {finding.category}
              </span>
              {/* Addressing status badge (re-review only) */}
              {finding.addressingStatus && (
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full border font-medium capitalize',
                    finding.addressingStatus === 'new'
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                      : finding.addressingStatus === 'persisting'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                  )}
                >
                  {finding.addressingStatus}
                </span>
              )}
            </div>

            {/* Title */}
            <h5 className="text-sm font-medium text-foreground leading-snug">{finding.title}</h5>

            {/* File path + line */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <FileCode2 size={12} className="shrink-0" />
              <span className="truncate">
                {finding.file}:{finding.line}
              </span>
            </div>
          </div>

          {/* Code snippet */}
          {codeSnippetMd && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Problematic code
              </p>
              <Markdown size="sm">{codeSnippetMd}</Markdown>
            </div>
          )}

          {/* Explanation */}
          {finding.explanation && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Explanation
              </p>
              <div className="text-xs text-foreground-secondary">
                <Markdown size="sm">{finding.explanation}</Markdown>
              </div>
            </div>
          )}

          {/* Suggested fix */}
          {suggestedFixMd && (
            <div>
              <p className="text-[10px] font-medium text-green-600 dark:text-green-400 uppercase tracking-wide mb-1">
                Suggested fix
              </p>
              <Markdown size="sm">{suggestedFixMd}</Markdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
