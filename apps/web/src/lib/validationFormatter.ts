/**
 * Shared formatting utilities for issue validation comments.
 *
 * Used by GithubPushPreview.tsx for building GitHub issue comment bodies.
 * Mirrors the structure of reviewFormatter.ts for PR reviews.
 */

import type {
  ValidationResult,
  BugValidation,
  FeatureValidation,
  ValidationVerdict,
} from '@gitchorus/shared';
import { GITCHORUS_VALIDATION_MARKER } from '@gitchorus/shared';
import { getLanguageForFile, normalizeFindingPath } from './reviewFormatter';

export { GITCHORUS_VALIDATION_MARKER };

// ============================================
// Section toggle/edit types
// ============================================

/** Section toggle state — controls which sections appear in the comment */
export interface SectionToggles {
  verdict: boolean;
  affectedFiles: boolean;
  approach: boolean;
  reasoning: boolean;
  featureDetails: boolean;
}

/** Per-section edit overrides */
export interface SectionEdits {
  approach?: string;
  reasoning?: string;
  featureDetails?: string;
}

// ============================================
// Verdict helpers
// ============================================

/** Map validation verdicts to GitHub alert syntax */
const VERDICT_ALERT: Record<ValidationVerdict, string> = {
  confirmed: '> [!TIP]',
  likely: '> [!TIP]',
  uncertain: '> [!WARNING]',
  unlikely: '> [!CAUTION]',
  invalid: '> [!CAUTION]',
};

/** Map validation verdicts to emoji */
const VERDICT_EMOJI: Record<ValidationVerdict, string> = {
  confirmed: '\u2705', // green checkmark
  likely: '\u{1F7E2}', // green circle
  uncertain: '\u{1F7E1}', // yellow circle
  unlikely: '\u{1F7E0}', // orange circle
  invalid: '\u{1F534}', // red circle
};

/**
 * Get appropriate GitHub alert prefix for a verdict.
 */
export function getVerdictAlert(verdict: ValidationVerdict): string {
  return VERDICT_ALERT[verdict] ?? '> [!NOTE]';
}

/**
 * Get emoji for a verdict.
 */
export function getVerdictEmoji(verdict: ValidationVerdict): string {
  return VERDICT_EMOJI[verdict] ?? '\u{26AA}';
}

// ============================================
// Complexity helpers
// ============================================

/** Map complexity levels to display labels with emoji */
const COMPLEXITY_DISPLAY: Record<string, string> = {
  trivial: '\u{1F7E2} Trivial',
  low: '\u{1F7E2} Low',
  medium: '\u{1F7E1} Medium',
  high: '\u{1F7E0} High',
  'very-high': '\u{1F534} Very High',
};

function formatComplexity(complexity: string): string {
  return COMPLEXITY_DISPLAY[complexity] ?? complexity.replace('-', ' ');
}

// ============================================
// Confidence bar
// ============================================

/**
 * Build a visual confidence bar (e.g. "85% ████████░░").
 */
function buildConfidenceBar(confidence: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(confidence)));
  const filled = Math.round(clamped / 10);
  return `${clamped}% ${'█'.repeat(filled)}${'░'.repeat(10 - filled)}`;
}

// ============================================
// Feature details helper
// ============================================

/**
 * Build the default feature details text from a FeatureValidation result.
 * Used by GithubPushPreview as the default textarea value.
 */
export function buildFeatureDetailsText(result: FeatureValidation): string {
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
// Main comment body formatter
// ============================================

/**
 * Format a validation result as a GitHub issue comment body.
 *
 * Produces a structured markdown comment with:
 * - Verdict-appropriate GitHub alert header
 * - Compact metadata table
 * - Affected files table with collapsible code evidence
 * - Structured approach and reasoning sections
 * - Feature-specific details (prerequisites, conflicts)
 *
 * Respects toggle/edit state for the GithubPushPreview component.
 */
export function formatValidationCommentBody(
  result: ValidationResult,
  toggles: SectionToggles,
  sectionEdits?: SectionEdits
): string {
  const isFeature = result.issueType === 'feature';
  const lines: string[] = [GITCHORUS_VALIDATION_MARKER];

  // ---- Header with GitHub alert syntax ----
  const alertPrefix = getVerdictAlert(result.verdict);
  const emoji = getVerdictEmoji(result.verdict);
  const typeLabel = isFeature ? 'Feature Feasibility' : 'Bug Validation';
  const verdictCapitalized = result.verdict.charAt(0).toUpperCase() + result.verdict.slice(1);

  lines.push(alertPrefix);
  lines.push(
    `> ${emoji} **${typeLabel}: ${verdictCapitalized}** (${buildConfidenceBar(result.confidence)})`
  );
  lines.push('');

  // ---- Metadata table ----
  if (toggles.verdict) {
    lines.push('| Property | Value |');
    lines.push('|----------|-------|');
    lines.push(`| **Type** | ${isFeature ? 'Feature Request' : 'Bug Report'} |`);
    lines.push(`| **Complexity** | ${formatComplexity(result.complexity)} |`);
    lines.push(`| **Confidence** | ${result.confidence}% |`);

    if (isFeature && toggles.featureDetails) {
      const feat = result as FeatureValidation;
      if (feat.effortEstimate) {
        lines.push(`| **Effort Estimate** | ${feat.effortEstimate} |`);
      }
    }
    lines.push('');
  }

  // ---- Suggested Approach ----
  if (toggles.approach) {
    const approachText = sectionEdits?.approach ?? result.suggestedApproach;
    lines.push('### Suggested Approach');
    lines.push('');
    lines.push(approachText);
    lines.push('');
  }

  // ---- Feature details (prerequisites & conflicts) ----
  if (isFeature && toggles.featureDetails) {
    const feat = result as FeatureValidation;

    if (sectionEdits?.featureDetails !== undefined) {
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

  // ---- Affected files ----
  if (toggles.affectedFiles && result.affectedFiles.length > 0) {
    lines.push(`### Affected Files (${result.affectedFiles.length})`);
    lines.push('');

    // Summary table
    lines.push('| File | Reason |');
    lines.push('|------|--------|');
    for (const file of result.affectedFiles) {
      const normalized = normalizeFindingPath(file.path);
      lines.push(`| \`${normalized}\` | ${file.reason} |`);
    }
    lines.push('');

    // Collapsible code evidence (only files that have snippets)
    const filesWithSnippets = result.affectedFiles.filter(f => f.snippet);
    if (filesWithSnippets.length > 0) {
      lines.push('<details>');
      lines.push(
        `<summary><strong>Code Evidence (${filesWithSnippets.length} files)</strong></summary>`
      );
      lines.push('');
      for (const file of filesWithSnippets) {
        const normalized = normalizeFindingPath(file.path);
        const lang = getLanguageForFile(file.path);
        lines.push(`**\`${normalized}\`** — ${file.reason}`);
        lines.push(`\`\`\`${lang}`);
        lines.push(file.snippet!);
        lines.push('```');
        lines.push('');
      }
      lines.push('</details>');
      lines.push('');
    }
  }

  // ---- Reasoning ----
  if (toggles.reasoning) {
    const reasoningText =
      sectionEdits?.reasoning ?? (result as BugValidation | FeatureValidation).reasoning;
    lines.push('<details>');
    lines.push('<summary><strong>Reasoning</strong></summary>');
    lines.push('');
    lines.push(reasoningText);
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  // ---- Footer ----
  lines.push('---');
  lines.push('*via [GitChorus](https://github.com/Shironex/gitchorus)*');

  return lines.join('\n');
}
