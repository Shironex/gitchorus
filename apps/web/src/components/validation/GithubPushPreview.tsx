import { useState, useEffect, useCallback } from 'react';
import {
  ExternalLink,
  Send,
  Loader2,
  Check,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useValidationStore, type PushStatus } from '@/stores/useValidationStore';
import type {
  ValidationResult,
  BugValidation,
  FeatureValidation,
  IssueComment,
} from '@gitchorus/shared';

interface GithubPushPreviewProps {
  issueNumber: number;
  result: ValidationResult;
  onPush: (issueNumber: number, body: string) => Promise<string | null>;
  onUpdate: (issueNumber: number, commentId: string, body: string) => Promise<string | null>;
  onListComments: (issueNumber: number) => Promise<IssueComment[]>;
}

/** Section toggle state */
interface SectionToggles {
  verdict: boolean;
  affectedFiles: boolean;
  approach: boolean;
  reasoning: boolean;
  featureDetails: boolean;
}

const GITCHORUS_MARKER = '<!-- gitchorus-validation -->';

/**
 * Build a markdown comment body from the validation result and section toggles.
 */
function buildCommentBody(result: ValidationResult, toggles: SectionToggles): string {
  const isFeature = result.issueType === 'feature';
  const lines: string[] = [GITCHORUS_MARKER];

  // Header
  const typeLabel = isFeature ? 'Feature Feasibility' : 'Bug Validation';
  lines.push(`## ${typeLabel}: ${result.verdict.charAt(0).toUpperCase() + result.verdict.slice(1)} (${result.confidence}% confidence)`);
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
    lines.push('### Suggested Approach');
    lines.push('');
    lines.push(result.suggestedApproach);
    lines.push('');
  }

  // Feature details
  if (isFeature && toggles.featureDetails) {
    const feat = result as FeatureValidation;

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

  // Affected files
  if (toggles.affectedFiles && result.affectedFiles.length > 0) {
    lines.push('<details>');
    lines.push(`<summary><strong>Affected Files (${result.affectedFiles.length})</strong></summary>`);
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
    lines.push('<details>');
    lines.push('<summary><strong>Reasoning</strong></summary>');
    lines.push('');
    lines.push((result as BugValidation | FeatureValidation).reasoning);
    lines.push('</details>');
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('*via [GitChorus](https://github.com/Shironex/gitchorus)*');

  return lines.join('\n');
}

/**
 * Editable preview with section toggles before pushing to GitHub.
 *
 * Supports detecting prior GitChorus comments for update-or-post-new.
 * Push button shows state transitions: idle -> pushing -> posted with link.
 */
export function GithubPushPreview({
  issueNumber,
  result,
  onPush,
  onUpdate,
  onListComments,
}: GithubPushPreviewProps) {
  const pushStatus = useValidationStore((state) => state.pushStatus.get(issueNumber) || 'idle') as PushStatus;
  const postedUrl = useValidationStore((state) => state.postedCommentUrls.get(issueNumber));
  const setPushStatus = useValidationStore((state) => state.setPushStatus);

  const [toggles, setToggles] = useState<SectionToggles>({
    verdict: true,
    affectedFiles: true,
    approach: true,
    reasoning: true,
    featureDetails: result.issueType === 'feature',
  });

  const [commentBody, setCommentBody] = useState(() => buildCommentBody(result, toggles));
  const [priorComment, setPriorComment] = useState<IssueComment | null>(null);
  const [checkingPrior, setCheckingPrior] = useState(false);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);

  const isFeature = result.issueType === 'feature';

  // Rebuild comment body when toggles change
  useEffect(() => {
    setCommentBody(buildCommentBody(result, toggles));
  }, [result, toggles]);

  // Check for prior GitChorus comments
  const checkPriorComments = useCallback(async () => {
    setCheckingPrior(true);
    try {
      const comments = await onListComments(issueNumber);
      const gitchorusComment = comments.find((c) => c.body.includes(GITCHORUS_MARKER));
      if (gitchorusComment) {
        setPriorComment(gitchorusComment);
        setShowUpdatePrompt(true);
      }
    } catch {
      // Non-blocking — just skip prior comment detection
    }
    setCheckingPrior(false);
  }, [issueNumber, onListComments]);

  // Check on mount
  useEffect(() => {
    if (pushStatus === 'idle') {
      checkPriorComments();
    }
  }, [pushStatus, checkPriorComments]);

  const handleToggle = (key: keyof SectionToggles) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePushNew = async () => {
    setShowUpdatePrompt(false);
    await onPush(issueNumber, commentBody);
  };

  const handleUpdateExisting = async () => {
    if (!priorComment) return;
    setShowUpdatePrompt(false);
    await onUpdate(issueNumber, priorComment.id, commentBody);
  };

  const handleEdit = () => {
    setPushStatus(issueNumber, 'editing');
  };

  if (pushStatus === 'posted' && postedUrl) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Check size={14} className="text-green-500" />
        <span className="text-xs text-green-600 dark:text-green-400 font-medium">Posted</span>
        <a
          href={postedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          View on GitHub <ExternalLink size={10} />
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Section toggles */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-foreground">Include sections:</h4>
        <div className="space-y-1.5">
          <ToggleRow label="Verdict & confidence" checked={toggles.verdict} onChange={() => handleToggle('verdict')} />
          <ToggleRow label="Suggested approach" checked={toggles.approach} onChange={() => handleToggle('approach')} />
          <ToggleRow label="Affected files" checked={toggles.affectedFiles} onChange={() => handleToggle('affectedFiles')} />
          <ToggleRow label="Reasoning" checked={toggles.reasoning} onChange={() => handleToggle('reasoning')} />
          {isFeature && (
            <ToggleRow
              label="Prerequisites & conflicts"
              checked={toggles.featureDetails}
              onChange={() => handleToggle('featureDetails')}
            />
          )}
        </div>
      </div>

      {/* Editable body */}
      {pushStatus === 'editing' && (
        <textarea
          className="w-full h-40 p-2 text-xs font-mono bg-muted/50 border rounded-lg resize-y focus:outline-none focus:ring-1 focus:ring-primary"
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
        />
      )}

      {/* Prior comment prompt */}
      {showUpdatePrompt && priorComment && pushStatus !== 'pushing' && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-2.5">
          <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-2">
            A previous GitChorus comment was found on this issue.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleUpdateExisting}>
              <RefreshCw size={12} className="mr-1" /> Update existing
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handlePushNew}>
              <Send size={12} className="mr-1" /> Post new
            </Button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {pushStatus === 'pushing' ? (
          <Button size="sm" disabled className="h-7 text-xs">
            <Loader2 size={12} className="mr-1 animate-spin" /> Pushing...
          </Button>
        ) : !showUpdatePrompt ? (
          <Button size="sm" className="h-7 text-xs" onClick={handlePushNew}>
            <Send size={12} className="mr-1" /> Push to GitHub
          </Button>
        ) : null}

        {pushStatus !== 'pushing' && pushStatus !== 'editing' && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleEdit}>
            Edit
          </Button>
        )}

        {checkingPrior && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Loader2 size={10} className="animate-spin" /> Checking for prior comments...
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Simple toggle row with label and switch.
 */
function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn('text-xs', checked ? 'text-foreground' : 'text-muted-foreground')}>
        {label}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} className="scale-75" />
    </div>
  );
}
