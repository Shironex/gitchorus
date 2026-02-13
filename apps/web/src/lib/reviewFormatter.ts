/**
 * Shared formatting utilities for PR review comments.
 *
 * Used by both useReview.ts (actual GitHub push) and ReviewPushModal.tsx (preview),
 * eliminating the DRY violation between the two.
 */

import type { ReviewFinding, ReviewSeverity } from '@gitchorus/shared';

// ============================================
// Constants
// ============================================

/** Hidden HTML comment used to identify GitChorus reviews on GitHub */
export const GITCHORUS_MARKER = '<!-- gitchorus-review -->';

// ============================================
// Language detection
// ============================================

/** Map file extensions to GitHub Linguist language identifiers for syntax highlighting */
const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  rb: 'ruby',
  swift: 'swift',
  kt: 'kotlin',
  c: 'c',
  cpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  css: 'css',
  html: 'html',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  md: 'markdown',
  sql: 'sql',
  sh: 'bash',
  bash: 'bash',
};

/**
 * Detect the programming language from a file path for syntax highlighting.
 */
export function getLanguageForFile(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  return EXTENSION_LANGUAGE_MAP[ext ?? ''] || 'text';
}

// ============================================
// Severity helpers
// ============================================

const SEVERITY_EMOJI: Record<ReviewSeverity, string> = {
  critical: '\u{1F534}',
  major: '\u{1F7E0}',
  minor: '\u{1F7E1}',
  nit: '\u{1F535}',
};

const SEVERITY_ALERT: Record<ReviewSeverity, string> = {
  critical: '> [!CAUTION]',
  major: '> [!WARNING]',
  minor: '> [!IMPORTANT]',
  nit: '> [!NOTE]',
};

const SEVERITY_ORDER: Record<ReviewSeverity, number> = {
  critical: 0,
  major: 1,
  minor: 2,
  nit: 3,
};

/**
 * Get the colored circle emoji for a severity level.
 */
export function getSeverityEmoji(severity: ReviewSeverity): string {
  return SEVERITY_EMOJI[severity] ?? '\u{26AA}';
}

/**
 * Get the GitHub alert syntax prefix for a severity level.
 */
export function getSeverityAlert(severity: ReviewSeverity): string {
  return SEVERITY_ALERT[severity] ?? '> [!NOTE]';
}

// ============================================
// Path normalization
// ============================================

/**
 * Normalize a finding's file path for the GitHub Reviews API.
 * - Strip leading `./`
 * - Convert backslashes to forward slashes
 * - Strip leading `/`
 */
export function normalizeFindingPath(filePath: string): string {
  let normalized = filePath.replace(/\\/g, '/');
  // Strip leading ./
  if (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }
  // Strip leading /
  if (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }
  return normalized;
}

// ============================================
// Star rating
// ============================================

/**
 * Build a visual star rating string for a quality score (1-10).
 */
function buildStarRating(score: number): string {
  const clamped = Math.max(1, Math.min(10, Math.round(score)));
  return '\u2B50'.repeat(clamped) + '\u2606'.repeat(10 - clamped);
}

// ============================================
// Summary body formatting
// ============================================

/**
 * Format the full review summary body for posting to GitHub.
 *
 * Produces a structured summary with severity-sorted table, star rating,
 * and the GitChorus marker for identification.
 */
export function formatReviewSummaryBody(
  findings: ReviewFinding[],
  verdict: string,
  qualityScore: number,
  skippedComments?: Array<{ finding: ReviewFinding; reason: string }>
): string {
  // Sort findings by severity
  const sorted = [...findings].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3)
  );

  const lines: string[] = [
    GITCHORUS_MARKER,
    '## GitChorus AI Review',
    '',
    verdict,
    '',
    `**Quality Score:** ${qualityScore}/10 ${buildStarRating(qualityScore)}`,
    '',
    '### Findings Summary',
    '',
  ];

  if (sorted.length > 0) {
    // Table header
    lines.push('| # | Severity | Category | Finding | Location |');
    lines.push('|---|----------|----------|---------|----------|');

    sorted.forEach((f, i) => {
      const emoji = getSeverityEmoji(f.severity);
      const severity = f.severity.charAt(0).toUpperCase() + f.severity.slice(1);
      const category = f.category.charAt(0).toUpperCase() + f.category.slice(1);
      // Use just the filename (not the full path) to keep the table compact
      const normalizedPath = normalizeFindingPath(f.file);
      const fileName = normalizedPath.split('/').pop() ?? normalizedPath;
      const location = `\`${fileName}:${f.line}\``;
      lines.push(`| ${i + 1} | ${emoji} ${severity} | ${category} | ${f.title} | ${location} |`);
    });
  } else {
    lines.push('No findings — the code looks good!');
  }

  // Append skipped inline comments (comments that couldn't be placed in the diff)
  if (skippedComments && skippedComments.length > 0) {
    lines.push('');
    lines.push('### Comments Not Placed Inline');
    lines.push('');
    lines.push(
      '_The following findings could not be placed as inline comments (line not in diff):_'
    );
    lines.push('');
    for (const { finding } of skippedComments) {
      const lang = getLanguageForFile(finding.file);
      const emoji = getSeverityEmoji(finding.severity);
      const severity = finding.severity.charAt(0).toUpperCase() + finding.severity.slice(1);
      const category = finding.category.charAt(0).toUpperCase() + finding.category.slice(1);
      lines.push(
        `#### ${emoji} [${severity} - ${category}] ${finding.title} (\`${normalizeFindingPath(finding.file)}:${finding.line}\`)`
      );
      lines.push('');
      lines.push(finding.explanation);
      if (finding.codeSnippet) {
        lines.push('');
        lines.push(`**Problematic code:**`);
        lines.push(`\`\`\`${lang}`);
        lines.push(finding.codeSnippet);
        lines.push('```');
      }
      if (finding.suggestedFix) {
        lines.push('');
        lines.push(`**Suggested fix:**`);
        lines.push('```diff');
        lines.push(finding.suggestedFix);
        lines.push('```');
      }
      lines.push('');
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('*via [GitChorus](https://github.com/Shironex/gitchorus)*');

  return lines.join('\n');
}

// ============================================
// Inline comment formatting
// ============================================

/**
 * Format a single inline review comment body for posting to GitHub.
 *
 * Uses GitHub alert syntax for severity indicators and language-hinted
 * code blocks for syntax highlighting.
 */
export function formatInlineCommentBody(finding: ReviewFinding): string {
  const alert = getSeverityAlert(finding.severity);
  const severity = finding.severity.charAt(0).toUpperCase() + finding.severity.slice(1);
  const category = finding.category.charAt(0).toUpperCase() + finding.category.slice(1);
  const lang = getLanguageForFile(finding.file);

  const lines: string[] = [
    alert,
    `> **${severity} - ${category}:** ${finding.title}`,
    '',
    finding.explanation,
  ];

  if (finding.codeSnippet) {
    lines.push('');
    lines.push('**Problematic code:**');
    lines.push(`\`\`\`${lang}`);
    lines.push(finding.codeSnippet);
    lines.push('```');
  }

  if (finding.suggestedFix) {
    lines.push('');
    lines.push('**Suggested fix:**');
    lines.push('```diff');
    lines.push(finding.suggestedFix);
    lines.push('```');
  }

  return lines.join('\n');
}
