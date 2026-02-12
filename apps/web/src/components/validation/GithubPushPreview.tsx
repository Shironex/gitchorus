import { useState, useEffect, useCallback, useMemo } from 'react';
import { ExternalLink, Send, Loader2, RefreshCw, Pencil, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Markdown } from '@/components/ui/markdown';
import { useValidationStore, type PushStatus } from '@/stores/useValidationStore';
import type {
  ValidationResult,
  BugValidation,
  FeatureValidation,
  IssueComment,
} from '@gitchorus/shared';

// ============================================
// Props
// ============================================

interface GithubPushPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issueNumber: number;
  result: ValidationResult;
  onPush: (issueNumber: number, body: string) => Promise<string | null>;
  onUpdate: (issueNumber: number, commentId: string, body: string) => Promise<string | null>;
  onListComments: (issueNumber: number) => Promise<IssueComment[]>;
}

// ============================================
// Section toggle state
// ============================================

interface SectionToggles {
  verdict: boolean;
  affectedFiles: boolean;
  approach: boolean;
  reasoning: boolean;
  featureDetails: boolean;
}

// ============================================
// Section edit overrides
// ============================================

interface SectionEdits {
  approach?: string;
  reasoning?: string;
  featureDetails?: string;
}

// ============================================
// Constants
// ============================================

const GITCHORUS_MARKER = '<!-- gitchorus-validation -->';

// ============================================
// Build comment body
// ============================================

function buildCommentBody(
  result: ValidationResult,
  toggles: SectionToggles,
  sectionEdits?: SectionEdits
): string {
  const isFeature = result.issueType === 'feature';
  const lines: string[] = [GITCHORUS_MARKER];

  // Header
  const typeLabel = isFeature ? 'Feature Feasibility' : 'Bug Validation';
  lines.push(
    `## ${typeLabel}: ${result.verdict.charAt(0).toUpperCase() + result.verdict.slice(1)} (${result.confidence}% confidence)`
  );
  lines.push('');

  // Verdict section
  if (toggles.verdict) {
    const complexityLabel = result.complexity.replace('-', ' ');
    lines.push(`**Issue type:** ${isFeature ? 'Feature Request' : 'Bug Report'}  `);
    lines.push(`**Complexity:** ${complexityLabel}  `);

    if (isFeature && toggles.featureDetails) {
      const feat = result as FeatureValidation;
      if (feat.effortEstimate) {
        lines.push(`**Effort estimate:** ${feat.effortEstimate}  `);
      }
    }
    lines.push('');
  }

  // Approach
  if (toggles.approach) {
    const approachText = sectionEdits?.approach ?? result.suggestedApproach;
    lines.push('### Suggested Approach');
    lines.push('');
    lines.push(approachText);
    lines.push('');
  }

  // Feature details
  if (isFeature && toggles.featureDetails) {
    const feat = result as FeatureValidation;

    if (sectionEdits?.featureDetails !== undefined) {
      // User edited the combined prerequisites & conflicts text
      lines.push('### Prerequisites & Conflicts');
      lines.push('');
      lines.push(sectionEdits.featureDetails);
      lines.push('');
    } else {
      if (feat.prerequisites.length > 0) {
        lines.push('### Prerequisites');
        lines.push('');
        for (const prereq of feat.prerequisites) {
          lines.push(`- ${prereq}`);
        }
        lines.push('');
      }

      if (feat.potentialConflicts.length > 0) {
        lines.push('### Potential Conflicts');
        lines.push('');
        for (const conflict of feat.potentialConflicts) {
          lines.push(`- ${conflict}`);
        }
        lines.push('');
      }
    }
  }

  // Affected files
  if (toggles.affectedFiles && result.affectedFiles.length > 0) {
    lines.push('<details>');
    lines.push(
      `<summary><strong>Affected Files (${result.affectedFiles.length})</strong></summary>`
    );
    lines.push('');
    for (const file of result.affectedFiles) {
      lines.push(`- \`${file.path}\` - ${file.reason}`);
      if (file.snippet) {
        lines.push('  ```');
        lines.push(`  ${file.snippet}`);
        lines.push('  ```');
      }
    }
    lines.push('</details>');
    lines.push('');
  }

  // Reasoning
  if (toggles.reasoning) {
    const reasoningText =
      sectionEdits?.reasoning ?? (result as BugValidation | FeatureValidation).reasoning;
    lines.push('<details>');
    lines.push('<summary><strong>Reasoning</strong></summary>');
    lines.push('');
    lines.push(reasoningText);
    lines.push('</details>');
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('*via [GitChorus](https://github.com/Shironex/gitchorus)*');

  return lines.join('\n');
}

// ============================================
// Helper: build default feature details text from result
// ============================================

function buildFeatureDetailsText(result: FeatureValidation): string {
  const lines: string[] = [];
  if (result.prerequisites.length > 0) {
    lines.push('**Prerequisites:**');
    for (const prereq of result.prerequisites) {
      lines.push(`- ${prereq}`);
    }
  }
  if (result.potentialConflicts.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('**Potential Conflicts:**');
    for (const conflict of result.potentialConflicts) {
      lines.push(`- ${conflict}`);
    }
  }
  return lines.join('\n');
}

// ============================================
// Section checkbox row
// ============================================

function SectionRow({
  label,
  checked,
  onChange,
  children,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('rounded-lg border p-3 transition-opacity', !checked && 'opacity-40')}>
      <label className="flex items-center gap-2 cursor-pointer select-none mb-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="h-4 w-4 rounded border-input text-primary accent-primary focus:ring-primary"
        />
        <span className="text-sm font-medium text-foreground">{label}</span>
      </label>
      <div className={cn(!checked && 'pointer-events-none')}>{children}</div>
    </div>
  );
}

// ============================================
// GithubPushPreview Modal
// ============================================

/**
 * Modal dialog for editing and previewing a GitHub comment before pushing.
 *
 * Features Edit/Preview tabs with per-section checkboxes and textareas.
 * Supports detecting prior GitChorus comments for update-or-post-new.
 */
export function GithubPushPreview({
  open,
  onOpenChange,
  issueNumber,
  result,
  onPush,
  onUpdate,
  onListComments,
}: GithubPushPreviewProps) {
  const pushStatus = useValidationStore(
    state => state.pushStatus.get(issueNumber) || 'idle'
  ) as PushStatus;
  const setPushStatus = useValidationStore(state => state.setPushStatus);

  const [toggles, setToggles] = useState<SectionToggles>({
    verdict: true,
    affectedFiles: true,
    approach: true,
    reasoning: true,
    featureDetails: result.issueType === 'feature',
  });

  const [sectionEdits, setSectionEdits] = useState<SectionEdits>({});
  const [priorComment, setPriorComment] = useState<IssueComment | null>(null);
  const [checkingPrior, setCheckingPrior] = useState(false);
  const [pushSuccess, setPushSuccess] = useState<string | null>(null);

  const isFeature = result.issueType === 'feature';

  // Build comment body with current toggles and edits
  const commentBody = useMemo(
    () => buildCommentBody(result, toggles, sectionEdits),
    [result, toggles, sectionEdits]
  );

  // Check for prior GitChorus comments when modal opens
  const checkPriorComments = useCallback(async () => {
    setCheckingPrior(true);
    try {
      const comments = await onListComments(issueNumber);
      const gitchorusComment = comments.find(c => c.body.includes(GITCHORUS_MARKER));
      if (gitchorusComment) {
        setPriorComment(gitchorusComment);
      }
    } catch {
      // Non-blocking -- just skip prior comment detection
    }
    setCheckingPrior(false);
  }, [issueNumber, onListComments]);

  useEffect(() => {
    if (open && pushStatus !== 'posted') {
      checkPriorComments();
    }
  }, [open, pushStatus, checkPriorComments]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setPushSuccess(null);
    }
  }, [open]);

  const handleToggle = (key: keyof SectionToggles) => {
    setToggles(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSectionEdit = (key: keyof SectionEdits, value: string) => {
    setSectionEdits(prev => ({ ...prev, [key]: value }));
  };

  const handlePushNew = async () => {
    setPushStatus(issueNumber, 'pushing');
    const url = await onPush(issueNumber, commentBody);
    if (url) {
      setPushSuccess(url);
      setTimeout(() => onOpenChange(false), 2000);
    } else {
      setPushStatus(issueNumber, 'idle');
    }
  };

  const handleUpdateExisting = async () => {
    if (!priorComment) return;
    setPushStatus(issueNumber, 'pushing');
    const url = await onUpdate(issueNumber, priorComment.id, commentBody);
    if (url) {
      setPushSuccess(url);
      setTimeout(() => onOpenChange(false), 2000);
    } else {
      setPushStatus(issueNumber, 'idle');
    }
  };

  const isPushing = pushStatus === 'pushing';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="text-base">Push to GitHub</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Edit sections and preview the comment before posting to issue #{issueNumber}
          </DialogDescription>
        </DialogHeader>

        {/* Success state */}
        {pushSuccess ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 px-6">
            <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <Send size={18} className="text-green-500" />
            </div>
            <p className="text-sm font-medium text-foreground">Comment posted successfully</p>
            <a
              href={pushSuccess}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View on GitHub <ExternalLink size={10} />
            </a>
          </div>
        ) : (
          <>
            <Tabs defaultValue="edit" className="flex-1 flex flex-col min-h-0">
              <div className="px-6">
                <TabsList className="w-full">
                  <TabsTrigger value="edit" className="flex-1 gap-1.5">
                    <Pencil size={12} /> Edit
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="flex-1 gap-1.5">
                    <Eye size={12} /> Preview
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Edit tab */}
              <TabsContent value="edit" className="flex-1 overflow-y-auto px-6 pb-4 mt-0 pt-3">
                <div className="space-y-3">
                  {/* Verdict section (read-only) */}
                  <SectionRow
                    label="Verdict & Confidence"
                    checked={toggles.verdict}
                    onChange={() => handleToggle('verdict')}
                  >
                    <div className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground space-y-0.5">
                      <p>
                        <span className="font-medium text-foreground">{result.verdict}</span> at{' '}
                        {result.confidence}% confidence
                      </p>
                      <p>Complexity: {result.complexity.replace('-', ' ')}</p>
                      {isFeature && (result as FeatureValidation).effortEstimate && (
                        <p>Effort: {(result as FeatureValidation).effortEstimate}</p>
                      )}
                    </div>
                  </SectionRow>

                  {/* Approach section (editable) */}
                  <SectionRow
                    label="Suggested Approach"
                    checked={toggles.approach}
                    onChange={() => handleToggle('approach')}
                  >
                    <textarea
                      className="w-full min-h-[80px] p-2.5 text-xs font-mono bg-muted/50 border rounded-md resize-y focus:outline-none focus:ring-1 focus:ring-primary"
                      value={sectionEdits.approach ?? result.suggestedApproach}
                      onChange={e => handleSectionEdit('approach', e.target.value)}
                    />
                  </SectionRow>

                  {/* Affected files section (read-only) */}
                  <SectionRow
                    label={`Affected Files (${result.affectedFiles.length})`}
                    checked={toggles.affectedFiles}
                    onChange={() => handleToggle('affectedFiles')}
                  >
                    <div className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground space-y-1 max-h-[120px] overflow-y-auto">
                      {result.affectedFiles.length > 0 ? (
                        result.affectedFiles.map((file, idx) => (
                          <p key={idx}>
                            <code className="text-[11px] text-chart-2 bg-muted px-1 py-0.5 rounded font-mono">
                              {file.path}
                            </code>{' '}
                            <span className="text-muted-foreground">- {file.reason}</span>
                          </p>
                        ))
                      ) : (
                        <p className="italic">No affected files identified</p>
                      )}
                    </div>
                  </SectionRow>

                  {/* Reasoning section (editable) */}
                  <SectionRow
                    label="Reasoning"
                    checked={toggles.reasoning}
                    onChange={() => handleToggle('reasoning')}
                  >
                    <textarea
                      className="w-full min-h-[80px] p-2.5 text-xs font-mono bg-muted/50 border rounded-md resize-y focus:outline-none focus:ring-1 focus:ring-primary"
                      value={
                        sectionEdits.reasoning ??
                        (result as BugValidation | FeatureValidation).reasoning
                      }
                      onChange={e => handleSectionEdit('reasoning', e.target.value)}
                    />
                  </SectionRow>

                  {/* Feature details section (editable) */}
                  {isFeature && (
                    <SectionRow
                      label="Prerequisites & Conflicts"
                      checked={toggles.featureDetails}
                      onChange={() => handleToggle('featureDetails')}
                    >
                      <textarea
                        className="w-full min-h-[80px] p-2.5 text-xs font-mono bg-muted/50 border rounded-md resize-y focus:outline-none focus:ring-1 focus:ring-primary"
                        value={
                          sectionEdits.featureDetails ??
                          buildFeatureDetailsText(result as FeatureValidation)
                        }
                        onChange={e => handleSectionEdit('featureDetails', e.target.value)}
                      />
                    </SectionRow>
                  )}
                </div>
              </TabsContent>

              {/* Preview tab */}
              <TabsContent value="preview" className="flex-1 overflow-y-auto px-6 pb-4 mt-0 pt-3">
                <div className="rounded-lg border bg-white dark:bg-[#0d1117] p-4 github-preview">
                  <Markdown size="md">{commentBody}</Markdown>
                </div>
              </TabsContent>
            </Tabs>

            {/* Footer with action buttons */}
            <DialogFooter className="px-6 py-4 border-t">
              <div className="flex items-center justify-between w-full">
                <div className="text-xs text-muted-foreground">
                  {checkingPrior && (
                    <span className="flex items-center gap-1">
                      <Loader2 size={10} className="animate-spin" /> Checking for prior comments...
                    </span>
                  )}
                  {priorComment && !checkingPrior && (
                    <span className="text-yellow-600 dark:text-yellow-400">
                      Existing GitChorus comment found
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isPushing ? (
                    <Button size="sm" disabled className="h-8 text-xs">
                      <Loader2 size={12} className="mr-1.5 animate-spin" /> Pushing...
                    </Button>
                  ) : priorComment ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={handleUpdateExisting}
                      >
                        <RefreshCw size={12} className="mr-1.5" /> Update existing
                      </Button>
                      <Button size="sm" className="h-8 text-xs" onClick={handlePushNew}>
                        <Send size={12} className="mr-1.5" /> Post new
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" className="h-8 text-xs" onClick={handlePushNew}>
                      <Send size={12} className="mr-1.5" /> Push to GitHub
                    </Button>
                  )}
                </div>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
