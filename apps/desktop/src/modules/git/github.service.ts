import { Injectable } from '@nestjs/common';
import { execFile, ExecException } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { GH_TIMEOUT_MS, createLogger, normalizePath, extractErrorMessage } from '@gitchorus/shared';
import type {
  GhCliStatus,
  GhCliAuthStatus,
  GhCliDetectionMethod,
  PullRequest,
  PullRequestState,
  StatusCheckRollup,
  ReviewDecision,
  ListPullRequestsOptions,
  CreatePullRequestOptions,
  Issue,
  IssueState,
  IssueComment,
  ListIssuesOptions,
  RepoInfo,
} from '@gitchorus/shared';
import type { ExecResult } from './git-base.service';

const execFileAsync = promisify(execFile);

/** Cache TTL for CLI status (1 minute) */
const CACHE_TTL_MS = 60 * 1000;

/** gh environment variables to prevent interactive prompts */
const GH_ENV: Record<string, string> = {
  GH_PROMPT_DISABLED: '1',
  NO_COLOR: '1',
};

interface CliDetectionResult {
  cliPath?: string;
  method: GhCliDetectionMethod | 'none';
}

/**
 * Join paths and normalize
 */
function joinPaths(...paths: string[]): string {
  return normalizePath(join(...paths));
}

/**
 * Get common gh CLI installation paths (cross-platform)
 */
function getGhCliPaths(): string[] {
  const home = normalizePath(homedir());
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const localAppData = process.env['LOCALAPPDATA'] || joinPaths(home, 'AppData/Local');
    return [
      joinPaths(programFiles, 'GitHub CLI/gh.exe'),
      joinPaths(localAppData, 'Programs/GitHub CLI/gh.exe'),
      joinPaths(home, 'scoop/shims/gh.exe'),
      joinPaths(home, '.local/bin/gh.exe'),
    ];
  }

  // macOS and Linux
  const isMac = process.platform === 'darwin';
  const isLinux = process.platform === 'linux';
  return [
    '/usr/local/bin/gh',
    '/usr/bin/gh',
    ...(isMac ? ['/opt/homebrew/bin/gh'] : []),
    joinPaths(home, '.local/bin/gh'),
    ...(isLinux ? ['/snap/bin/gh'] : []),
  ];
}

@Injectable()
export class GithubService {
  private readonly logger = createLogger('GithubService');
  private cachedStatus: GhCliStatus | null = null;
  private cacheTimestamp: number = 0;
  private pendingStatus: Promise<GhCliStatus> | null = null;

  /**
   * Execute a gh CLI command with timeout and proper environment
   */
  private async execGh(
    repoPath: string,
    args: string[],
    timeoutMs: number = GH_TIMEOUT_MS
  ): Promise<ExecResult> {
    const command = `gh ${args.join(' ')}`;

    try {
      const result = await execFileAsync('gh', args, {
        cwd: repoPath,
        timeout: timeoutMs,
        env: {
          ...process.env,
          ...GH_ENV,
        },
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
      };
    } catch (error) {
      const execError = error as ExecException & {
        stdout?: string;
        stderr?: string;
      };

      // Check for timeout
      if (execError.killed) {
        throw new Error(`gh command timed out after ${timeoutMs}ms: ${command}`);
      }

      // Return stdout/stderr even on non-zero exit codes
      if (execError.stdout !== undefined || execError.stderr !== undefined) {
        return {
          stdout: execError.stdout ?? '',
          stderr: execError.stderr ?? '',
        };
      }

      throw new Error(`gh command failed: ${execError.message}`);
    }
  }

  /**
   * Find gh CLI installation
   */
  private async findCli(): Promise<CliDetectionResult> {
    const platform = process.platform;

    // Try to find CLI in PATH first
    try {
      const whichCmd = platform === 'win32' ? 'where' : '/usr/bin/which';
      const { stdout } = await execFileAsync(whichCmd, ['gh']);
      // Take first line (Windows 'where' may return multiple results)
      const firstPath = stdout.trim().split('\n')[0]?.trim();
      if (firstPath) {
        return { cliPath: firstPath, method: 'path' };
      }
    } catch {
      // Not in PATH, fall through to check common locations
    }

    // Check common installation locations
    const localPaths = getGhCliPaths();
    for (const localPath of localPaths) {
      if (existsSync(localPath)) {
        return { cliPath: localPath, method: 'local' };
      }
    }

    return { method: 'none' };
  }

  /**
   * Get gh CLI version
   */
  private async getVersion(cliPath: string): Promise<string | undefined> {
    try {
      const { stdout } = await execFileAsync(cliPath, ['--version'], {
        timeout: 5000,
      });
      // Parse version from output like "gh version 2.40.1 (2024-01-15)"
      const match = stdout.match(/gh version ([^\s(]+)/);
      return match ? match[1] : stdout.trim().split('\n')[0];
    } catch {
      return undefined;
    }
  }

  /**
   * Check gh CLI authentication status
   */
  private async checkAuth(cliPath: string): Promise<GhCliAuthStatus> {
    try {
      const { stdout, stderr } = await execFileAsync(cliPath, ['auth', 'status'], {
        timeout: 10000,
        env: {
          ...process.env,
          ...GH_ENV,
        },
      });
      const output = stdout + stderr;

      // Check if authenticated
      if (output.includes('Logged in to')) {
        // Extract username from output like "Logged in to github.com account username"
        const usernameMatch = output.match(/Logged in to [^\s]+ account ([^\s(]+)/);
        const username = usernameMatch ? usernameMatch[1] : undefined;

        // Extract scopes if present
        const scopesMatch = output.match(/Token scopes: ([^\n]+)/);
        const scopes = scopesMatch
          ? scopesMatch[1]
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
          : undefined;

        return { authenticated: true, username, scopes };
      }

      return { authenticated: false };
    } catch (error) {
      // gh auth status returns non-zero exit code when not logged in
      const errorMessage = extractErrorMessage(error);

      // Check if the error message indicates not logged in vs actual error
      if (
        errorMessage.includes('not logged in') ||
        errorMessage.includes('no authentication') ||
        errorMessage.includes('You are not logged')
      ) {
        return { authenticated: false };
      }

      // Handle timeout errors gracefully
      const execError = error as { killed?: boolean; signal?: string };
      if (execError.killed || execError.signal === 'SIGTERM') {
        this.logger.warn('gh auth check timed out');
        return { authenticated: false };
      }

      // Log unexpected errors but return unauthenticated
      this.logger.warn('Failed to check gh auth status', error);
      return { authenticated: false };
    }
  }

  /**
   * Get gh CLI status (with caching)
   */
  async getStatus(): Promise<GhCliStatus> {
    const now = Date.now();
    if (this.cachedStatus && now - this.cacheTimestamp < CACHE_TTL_MS) {
      return this.cachedStatus;
    }

    // Use pending promise pattern to prevent race conditions
    if (!this.pendingStatus) {
      this.pendingStatus = this.fetchStatus()
        .then(status => {
          this.cachedStatus = status;
          this.cacheTimestamp = Date.now();
          return status;
        })
        .finally(() => {
          this.pendingStatus = null;
        });
    }
    return this.pendingStatus;
  }

  /**
   * Fetch fresh gh CLI status
   */
  private async fetchStatus(): Promise<GhCliStatus> {
    const platform = process.platform;
    const arch = process.arch;

    const { cliPath, method } = await this.findCli();

    if (!cliPath || method === 'none') {
      return {
        installed: false,
        platform,
        arch,
        auth: { authenticated: false },
      };
    }

    const version = await this.getVersion(cliPath);
    const auth = await this.checkAuth(cliPath);

    return {
      installed: true,
      path: cliPath,
      version,
      method,
      platform,
      arch,
      auth,
    };
  }

  /**
   * Clear cached status (force refresh)
   */
  clearCache(): void {
    this.cachedStatus = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Check if repository has a GitHub remote
   */
  async hasGitHubRemote(repoPath: string): Promise<boolean> {
    try {
      const { stdout } = await this.execGh(repoPath, ['repo', 'view', '--json', 'url']);
      const data = JSON.parse(stdout);
      return !!data.url;
    } catch {
      return false;
    }
  }

  /**
   * Get repository information
   */
  async getRepoInfo(repoPath: string): Promise<RepoInfo | null> {
    try {
      const { stdout } = await this.execGh(repoPath, [
        'repo',
        'view',
        '--json',
        'name,nameWithOwner,description,url,defaultBranchRef,visibility,isFork,isArchived',
      ]);

      const data = JSON.parse(stdout);
      return {
        name: data.name,
        fullName: data.nameWithOwner,
        description: data.description || undefined,
        url: data.url,
        defaultBranch: data.defaultBranchRef?.name || 'main',
        visibility: data.visibility?.toLowerCase() || 'public',
        isFork: data.isFork || false,
        isArchived: data.isArchived || false,
      };
    } catch (error) {
      this.logger.debug('Failed to get repo info:', error);
      return null;
    }
  }

  /**
   * List pull requests
   */
  async listPullRequests(
    repoPath: string,
    options?: ListPullRequestsOptions
  ): Promise<PullRequest[]> {
    const args = [
      'pr',
      'list',
      '--json',
      'number,title,body,state,author,url,headRefName,baseRefName,isDraft,labels,additions,deletions,changedFiles,statusCheckRollup,reviewDecision,createdAt,updatedAt,mergedAt',
    ];

    if (options?.state && options.state !== 'all') {
      args.push('--state', options.state);
    }

    if (options?.limit) {
      args.push('--limit', options.limit.toString());
    }

    const { stdout } = await this.execGh(repoPath, args);

    if (!stdout.trim()) {
      return [];
    }

    const data = JSON.parse(stdout);
    return data.map((pr: Record<string, unknown>) => this.mapPullRequest(pr));
  }

  /**
   * Create a pull request
   */
  async createPullRequest(
    repoPath: string,
    options: CreatePullRequestOptions
  ): Promise<PullRequest> {
    const args = [
      'pr',
      'create',
      '--json',
      'number,title,body,state,author,url,headRefName,baseRefName,isDraft,createdAt,updatedAt',
      '--title',
      options.title,
    ];

    if (options.body) {
      args.push('--body', options.body);
    }

    if (options.base) {
      args.push('--base', options.base);
    }

    if (options.head) {
      args.push('--head', options.head);
    }

    if (options.draft) {
      args.push('--draft');
    }

    const { stdout } = await this.execGh(repoPath, args);
    const data = JSON.parse(stdout);

    return this.mapPullRequest(data);
  }

  /**
   * List issues
   */
  async listIssues(repoPath: string, options?: ListIssuesOptions): Promise<Issue[]> {
    const args = [
      'issue',
      'list',
      '--json',
      'number,title,body,state,author,url,labels,comments,createdAt,updatedAt,closedAt',
    ];

    if (options?.state && options.state !== 'all') {
      args.push('--state', options.state);
    }

    if (options?.limit) {
      args.push('--limit', options.limit.toString());
    }

    if (options?.labels && options.labels.length > 0) {
      args.push('--label', options.labels.join(','));
    }

    const { stdout } = await this.execGh(repoPath, args);

    if (!stdout.trim()) {
      return [];
    }

    const data = JSON.parse(stdout);
    return data.map((issue: Record<string, unknown>) => this.mapIssue(issue));
  }

  /**
   * View a specific pull request
   */
  async getPullRequest(repoPath: string, prNumber: number): Promise<PullRequest | null> {
    try {
      const { stdout } = await this.execGh(repoPath, [
        'pr',
        'view',
        prNumber.toString(),
        '--json',
        'number,title,body,state,author,url,headRefName,baseRefName,isDraft,labels,additions,deletions,changedFiles,statusCheckRollup,reviewDecision,createdAt,updatedAt,mergedAt',
      ]);

      const data = JSON.parse(stdout);
      return this.mapPullRequest(data);
    } catch (error) {
      this.logger.debug(`Failed to get PR #${prNumber}:`, error);
      return null;
    }
  }

  /**
   * View a specific issue
   */
  async getIssue(repoPath: string, issueNumber: number): Promise<Issue | null> {
    try {
      const { stdout } = await this.execGh(repoPath, [
        'issue',
        'view',
        issueNumber.toString(),
        '--json',
        'number,title,body,state,author,url,labels,comments,createdAt,updatedAt,closedAt',
      ]);

      const data = JSON.parse(stdout);
      return this.mapIssue(data);
    } catch (error) {
      this.logger.debug(`Failed to get issue #${issueNumber}:`, error);
      return null;
    }
  }

  /**
   * Create a comment on an issue.
   * Returns the URL of the created comment.
   */
  async createComment(
    repoPath: string,
    issueNumber: number,
    body: string
  ): Promise<{ url: string }> {
    const { stdout, stderr } = await this.execGh(repoPath, [
      'issue',
      'comment',
      issueNumber.toString(),
      '--body',
      body,
    ]);

    // gh issue comment outputs the URL to stderr or stdout depending on version
    const output = (stdout + stderr).trim();
    // Try to extract a URL from the output
    const urlMatch = output.match(/(https:\/\/github\.com\/[^\s]+)/);
    const url = urlMatch ? urlMatch[1] : `https://github.com/issues/${issueNumber}`;

    return { url };
  }

  /**
   * List comments on an issue.
   */
  async listComments(repoPath: string, issueNumber: number): Promise<IssueComment[]> {
    try {
      const { stdout } = await this.execGh(repoPath, [
        'issue',
        'view',
        issueNumber.toString(),
        '--json',
        'comments',
      ]);

      if (!stdout.trim()) {
        return [];
      }

      const data = JSON.parse(stdout);
      const comments = (data.comments || []) as Array<Record<string, unknown>>;

      return comments.map(comment => ({
        id: String(comment.id ?? ''),
        author: {
          login: ((comment.author as Record<string, unknown>)?.login as string) || 'unknown',
        },
        body: (comment.body as string) || '',
        createdAt: (comment.createdAt as string) || '',
        url: (comment.url as string) || '',
      }));
    } catch (error) {
      this.logger.debug(`Failed to list comments for issue #${issueNumber}:`, error);
      return [];
    }
  }

  /**
   * Update an existing comment on an issue.
   * Uses the gh api command to PATCH the comment.
   */
  async updateComment(repoPath: string, commentId: string, body: string): Promise<{ url: string }> {
    // First, get the repo info to construct the API path
    const repoInfo = await this.getRepoInfo(repoPath);
    if (!repoInfo) {
      throw new Error('Could not determine repository info for comment update');
    }

    const { stdout } = await this.execGh(repoPath, [
      'api',
      `repos/${repoInfo.fullName}/issues/comments/${commentId}`,
      '-X',
      'PATCH',
      '-f',
      `body=${body}`,
      '--jq',
      '.html_url',
    ]);

    const url =
      stdout.trim() || `https://github.com/${repoInfo.fullName}/issues/comments/${commentId}`;
    return { url };
  }

  /**
   * Create a PR review with inline comments and a summary body.
   *
   * Uses the GitHub Reviews API (POST /repos/{owner}/{repo}/pulls/{prNumber}/reviews).
   * Pre-validates comments against the PR diff to prevent 422 errors.
   * Comments targeting lines outside the diff are skipped and reported back
   * so the caller can include them in the summary body.
   */
  async createPrReview(
    repoPath: string,
    prNumber: number,
    body: string,
    event: 'REQUEST_CHANGES' | 'COMMENT',
    comments: Array<{ path: string; line: number; body: string; side?: 'LEFT' | 'RIGHT' }>
  ): Promise<{
    url: string;
    postedComments: number;
    skippedComments: number;
    skippedDetails?: Array<{ path: string; line: number; body: string; reason: string }>;
  }> {
    const repoInfo = await this.getRepoInfo(repoPath);
    if (!repoInfo) {
      throw new Error('Could not determine repository info for PR review');
    }

    // Pre-validate comments against the PR diff
    let validComments = comments;
    let skippedDetails: Array<{ path: string; line: number; body: string; reason: string }> = [];

    if (comments.length > 0) {
      try {
        const diff = await this.getPrDiff(repoPath, prNumber);
        const validLines = this.parseDiffValidLines(diff);

        const validated = this.validateCommentsAgainstDiff(comments, validLines);
        validComments = validated.valid;
        skippedDetails = validated.skipped;

        if (skippedDetails.length > 0) {
          this.logger.warn(
            `PR #${prNumber}: ${skippedDetails.length} comment(s) skipped (line not in diff)`
          );
        }
      } catch (error) {
        // If diff fetching fails, proceed with all comments (best effort)
        this.logger.warn(
          `Failed to fetch diff for pre-validation of PR #${prNumber}, proceeding without validation:`,
          error
        );
      }
    }

    // Append skipped comments to the review body so they're still visible
    let finalBody = body;
    if (skippedDetails.length > 0) {
      const skippedSection = [
        '',
        '### Comments Not Placed Inline',
        '',
        '_The following findings could not be placed as inline comments (line not in diff):_',
        '',
        ...skippedDetails.map(s => `- **\`${s.path}:${s.line}\`** — ${s.reason}`),
      ].join('\n');
      finalBody = body + skippedSection;
    }

    const result = await this.createPrReviewWithStdin(repoPath, repoInfo.fullName, prNumber, {
      body: finalBody,
      event,
      comments: validComments,
    });

    return {
      ...result,
      skippedComments: result.skippedComments + skippedDetails.length,
      skippedDetails: skippedDetails.length > 0 ? skippedDetails : undefined,
    };
  }

  /**
   * Internal: create PR review using gh api with stdin JSON.
   * On 422 failure, retries once without inline comments as a fallback.
   */
  private async createPrReviewWithStdin(
    repoPath: string,
    repoFullName: string,
    prNumber: number,
    payload: {
      body: string;
      event: string;
      comments: Array<{ path: string; line: number; body: string; side?: 'LEFT' | 'RIGHT' }>;
    }
  ): Promise<{ url: string; postedComments: number; skippedComments: number }> {
    const inputJson = JSON.stringify(payload);

    try {
      const result = await this.spawnGhApiWithStdin(repoPath, repoFullName, prNumber, inputJson);

      if (result.code !== 0) {
        // Check for 422 (validation error -- inline comment on line not in diff)
        const errorOutput = result.stderr + result.stdout;
        if (
          errorOutput.includes('422') ||
          errorOutput.includes('pull_request_review_thread.path')
        ) {
          // Try without inline comments -- post as summary-only review
          this.logger.warn(
            `Some inline comments failed for PR #${prNumber} despite pre-validation, retrying without inline comments`
          );
          return this.createPrReviewSummaryOnly(
            repoPath,
            repoFullName,
            prNumber,
            payload.body,
            payload.event,
            payload.comments.length
          );
        }
        throw new Error(`Failed to create PR review: ${errorOutput}`);
      }

      // Parse response
      const data = JSON.parse(result.stdout);
      const url =
        data.html_url ||
        `https://github.com/${repoFullName}/pull/${prNumber}#pullrequestreview-${data.id}`;

      return {
        url,
        postedComments: payload.comments.length,
        skippedComments: 0,
      };
    } catch (error) {
      // If it's our known error, rethrow
      if (error instanceof Error && error.message.startsWith('Failed to create PR review')) {
        throw error;
      }
      throw new Error(
        `Failed to create PR review: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Internal: spawn `gh api` with JSON piped to stdin and collect output.
   */
  private spawnGhApiWithStdin(
    repoPath: string,
    repoFullName: string,
    prNumber: number,
    inputJson: string
  ): Promise<{ stdout: string; stderr: string; code: number }> {
    const child = require('child_process').spawn(
      'gh',
      ['api', `repos/${repoFullName}/pulls/${prNumber}/reviews`, '-X', 'POST', '--input', '-'],
      {
        cwd: repoPath,
        env: { ...process.env, ...GH_ENV },
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    // Write JSON to stdin
    child.stdin.write(inputJson);
    child.stdin.end();

    return new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d: Buffer) => {
        stdout += d.toString();
      });
      child.stderr.on('data', (d: Buffer) => {
        stderr += d.toString();
      });

      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('PR review creation timed out'));
      }, GH_TIMEOUT_MS);

      child.on('close', (code: number) => {
        clearTimeout(timeout);
        resolve({ stdout, stderr, code });
      });

      child.on('error', (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  /**
   * Internal: fallback to summary-only review when inline comments fail
   */
  private async createPrReviewSummaryOnly(
    repoPath: string,
    repoFullName: string,
    prNumber: number,
    body: string,
    event: string,
    totalComments: number
  ): Promise<{ url: string; postedComments: number; skippedComments: number }> {
    const { stdout } = await this.execGh(repoPath, [
      'api',
      `repos/${repoFullName}/pulls/${prNumber}/reviews`,
      '-X',
      'POST',
      '-f',
      `body=${body}`,
      '-f',
      `event=${event}`,
    ]);

    const data = JSON.parse(stdout);
    const url =
      data.html_url ||
      `https://github.com/${repoFullName}/pull/${prNumber}#pullrequestreview-${data.id}`;

    return {
      url,
      postedComments: 0,
      skippedComments: totalComments,
    };
  }

  /**
   * Parse a unified diff to extract valid (path, line) pairs on the RIGHT side.
   * Returns a Map from normalized file path to a Set of valid line numbers.
   * @internal Exposed as public for unit testing.
   */
  parseDiffValidLines(diff: string): Map<string, Set<number>> {
    const validLines = new Map<string, Set<number>>();
    const lines = diff.split('\n');
    let currentFile: string | null = null;
    let rightLine = 0;
    let inHunk = false;

    for (const line of lines) {
      // Match +++ b/path/to/file (new file path)
      const fileMatch = line.match(/^\+\+\+ b\/(.+)/);
      if (fileMatch) {
        currentFile = fileMatch[1];
        inHunk = false;
        if (!validLines.has(currentFile)) {
          validLines.set(currentFile, new Set());
        }
        continue;
      }

      // Skip diff header lines (---, +++ /dev/null)
      // Note: +++ b/path lines are handled by the fileMatch regex above
      if (line.startsWith('--- ') || line === '+++ /dev/null') {
        continue;
      }

      // Match @@ hunk header to get the starting line number on the right side
      const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (hunkMatch) {
        rightLine = parseInt(hunkMatch[1], 10);
        inHunk = true;
        continue;
      }

      // Skip inter-file metadata lines (diff --git, index, etc.)
      if (line.startsWith('diff ')) {
        inHunk = false;
        continue;
      }

      if (!currentFile || !inHunk) continue;

      // Context line (unchanged) — counts on both sides
      if (!line.startsWith('+') && !line.startsWith('-') && !line.startsWith('\\')) {
        const fileLines = validLines.get(currentFile)!;
        fileLines.add(rightLine);
        rightLine++;
        continue;
      }

      // Added line — counts on the right side only
      if (line.startsWith('+')) {
        const fileLines = validLines.get(currentFile)!;
        fileLines.add(rightLine);
        rightLine++;
        continue;
      }

      // Removed line — only counts on the left side, skip right
      if (line.startsWith('-')) {
        continue;
      }
    }

    return validLines;
  }

  /**
   * Validate comments against the parsed diff.
   * Tries to snap close line numbers (within ±3 lines) to a valid diff line.
   * Returns valid and skipped comments.
   */
  private validateCommentsAgainstDiff(
    comments: Array<{ path: string; line: number; body: string; side?: 'LEFT' | 'RIGHT' }>,
    validLines: Map<string, Set<number>>
  ): {
    valid: Array<{ path: string; line: number; body: string; side?: 'LEFT' | 'RIGHT' }>;
    skipped: Array<{ path: string; line: number; body: string; reason: string }>;
  } {
    const valid: Array<{ path: string; line: number; body: string; side?: 'LEFT' | 'RIGHT' }> = [];
    const skipped: Array<{ path: string; line: number; body: string; reason: string }> = [];

    for (const comment of comments) {
      // Normalize the comment path to match diff paths
      let normalizedPath = comment.path.replace(/\\/g, '/');
      if (normalizedPath.startsWith('./')) normalizedPath = normalizedPath.slice(2);
      if (normalizedPath.startsWith('/')) normalizedPath = normalizedPath.slice(1);

      const fileLines = validLines.get(normalizedPath);

      if (!fileLines) {
        skipped.push({
          path: normalizedPath,
          line: comment.line,
          body: comment.body,
          reason: `File "${normalizedPath}" not found in diff`,
        });
        continue;
      }

      // Exact match
      if (fileLines.has(comment.line)) {
        valid.push({ ...comment, path: normalizedPath });
        continue;
      }

      // Try snapping to nearest valid line within ±3 lines
      let snappedLine: number | null = null;
      let minDistance = Infinity;
      for (const validLine of fileLines) {
        const distance = Math.abs(validLine - comment.line);
        if (distance <= 3 && distance < minDistance) {
          minDistance = distance;
          snappedLine = validLine;
        }
      }

      if (snappedLine !== null) {
        this.logger.debug(
          `Snapped comment line ${comment.line} → ${snappedLine} for ${normalizedPath}`
        );
        valid.push({ ...comment, path: normalizedPath, line: snappedLine });
        continue;
      }

      skipped.push({
        path: normalizedPath,
        line: comment.line,
        body: comment.body,
        reason: `Line ${comment.line} not in diff for "${normalizedPath}"`,
      });
    }

    return { valid, skipped };
  }

  /**
   * List reviews on a pull request via the GitHub API.
   * Returns reviews with their body, state, commit_id, and metadata.
   */
  async listPrReviews(
    repoPath: string,
    prNumber: number
  ): Promise<
    Array<{
      id: number;
      body: string;
      state: string;
      commitId: string;
      submittedAt: string;
      user: string;
      htmlUrl: string;
    }>
  > {
    const repoInfo = await this.getRepoInfo(repoPath);
    if (!repoInfo) {
      throw new Error('Could not determine repository info for listing PR reviews');
    }

    const { stdout } = await this.execGh(repoPath, [
      'api',
      `repos/${repoInfo.fullName}/pulls/${prNumber}/reviews`,
      '--jq',
      '[.[] | {id, body, state, commit_id, submitted_at, user: .user.login, html_url}]',
    ]);

    if (!stdout.trim()) {
      return [];
    }

    const data = JSON.parse(stdout) as Array<Record<string, unknown>>;
    return data.map(r => ({
      id: r.id as number,
      body: (r.body as string) || '',
      state: (r.state as string) || '',
      commitId: (r.commit_id as string) || '',
      submittedAt: (r.submitted_at as string) || '',
      user: (r.user as string) || 'unknown',
      htmlUrl: (r.html_url as string) || '',
    }));
  }

  /**
   * Get the HEAD commit SHA for a pull request
   */
  async getPrHeadSha(repoPath: string, prNumber: number): Promise<string> {
    const { stdout } = await this.execGh(repoPath, [
      'pr',
      'view',
      prNumber.toString(),
      '--json',
      'headRefOid',
      '--jq',
      '.headRefOid',
    ]);

    const sha = stdout.trim();
    if (!sha) {
      throw new Error(`Failed to get HEAD SHA for PR #${prNumber}`);
    }
    return sha;
  }

  /**
   * Get the diff between two commits (for incremental re-review).
   * Fetches from origin first to ensure commits are available locally.
   */
  async getCommitDiff(repoPath: string, fromSha: string, toSha: string): Promise<string> {
    // Validate SHA format (basic hex check)
    const shaRegex = /^[0-9a-f]{4,40}$/i;
    if (!shaRegex.test(fromSha) || !shaRegex.test(toSha)) {
      throw new Error(`Invalid commit SHA format: ${fromSha}..${toSha}`);
    }

    // Fetch latest to ensure both SHAs are available locally
    try {
      await execFileAsync('git', ['fetch', 'origin'], {
        cwd: repoPath,
        timeout: GH_TIMEOUT_MS,
      });
    } catch (error) {
      this.logger.warn('git fetch origin failed, proceeding with local state:', error);
    }

    const { stdout } = await execFileAsync('git', ['diff', `${fromSha}..${toSha}`], {
      cwd: repoPath,
      maxBuffer: 10 * 1024 * 1024, // 10MB
      timeout: GH_TIMEOUT_MS,
    });

    return stdout;
  }

  /**
   * Get PR diff using gh CLI
   */
  async getPrDiff(repoPath: string, prNumber: number): Promise<string> {
    try {
      const { stdout } = await this.execGh(repoPath, ['pr', 'diff', prNumber.toString()]);

      if (stdout.trim()) {
        return stdout;
      }
    } catch (error) {
      this.logger.debug(`gh pr diff failed for #${prNumber}, falling back to git diff:`, error);
    }

    // Fallback: get PR info and use local git diff
    try {
      const pr = await this.getPullRequest(repoPath, prNumber);
      if (!pr) {
        throw new Error(`PR #${prNumber} not found`);
      }

      const { stdout } = await execFileAsync(
        'git',
        ['diff', `${pr.baseRefName}...${pr.headRefName}`],
        {
          cwd: repoPath,
          maxBuffer: 10 * 1024 * 1024, // 10MB
          timeout: GH_TIMEOUT_MS,
        }
      );

      return stdout;
    } catch (fallbackError) {
      this.logger.error(`git diff fallback also failed for PR #${prNumber}:`, fallbackError);
      throw new Error(`Failed to get diff for PR #${prNumber}`);
    }
  }

  /**
   * Map raw gh CLI JSON output to a typed PullRequest object
   */
  private mapPullRequest(pr: Record<string, unknown>): PullRequest {
    // Parse statusCheckRollup - gh CLI returns it as a string or nested object
    let statusCheckRollup: StatusCheckRollup = null;
    const rawRollup = pr.statusCheckRollup as string | undefined;
    if (
      rawRollup === 'SUCCESS' ||
      rawRollup === 'FAILURE' ||
      rawRollup === 'PENDING' ||
      rawRollup === 'ERROR'
    ) {
      statusCheckRollup = rawRollup;
    }

    // Parse reviewDecision
    let reviewDecision: ReviewDecision = null;
    const rawDecision = pr.reviewDecision as string | undefined;
    if (
      rawDecision === 'APPROVED' ||
      rawDecision === 'CHANGES_REQUESTED' ||
      rawDecision === 'REVIEW_REQUIRED'
    ) {
      reviewDecision = rawDecision;
    }

    return {
      number: pr.number as number,
      title: pr.title as string,
      body: (pr.body as string) || undefined,
      state: (pr.state === 'MERGED'
        ? 'merged'
        : (pr.state as string).toLowerCase()) as PullRequestState,
      author: {
        login: ((pr.author as Record<string, unknown>)?.login as string) || 'unknown',
        name: (pr.author as Record<string, unknown>)?.name as string | undefined,
      },
      url: pr.url as string,
      headRefName: pr.headRefName as string,
      baseRefName: pr.baseRefName as string,
      isDraft: (pr.isDraft as boolean) || false,
      labels: ((pr.labels as Array<Record<string, unknown>>) || []).map(label => ({
        name: label.name as string,
        color: label.color as string | undefined,
      })),
      additions: (pr.additions as number) || 0,
      deletions: (pr.deletions as number) || 0,
      changedFiles: (pr.changedFiles as number) || 0,
      statusCheckRollup,
      reviewDecision,
      createdAt: pr.createdAt as string,
      updatedAt: pr.updatedAt as string,
      mergedAt: (pr.mergedAt as string) || undefined,
    };
  }

  /**
   * Map raw gh CLI JSON output to a typed Issue object
   */
  private mapIssue(issue: Record<string, unknown>): Issue {
    // gh CLI returns comments as an array of comment objects
    const comments = issue.comments as unknown[] | undefined;
    const commentsCount = Array.isArray(comments) ? comments.length : 0;

    return {
      number: issue.number as number,
      title: issue.title as string,
      body: (issue.body as string) || undefined,
      state: (issue.state as string).toLowerCase() as IssueState,
      author: {
        login: ((issue.author as Record<string, unknown>)?.login as string) || 'unknown',
        name: (issue.author as Record<string, unknown>)?.name as string | undefined,
      },
      url: issue.url as string,
      labels: ((issue.labels as Array<Record<string, unknown>>) || []).map(label => ({
        name: label.name as string,
        color: label.color as string | undefined,
      })),
      commentsCount,
      createdAt: issue.createdAt as string,
      updatedAt: issue.updatedAt as string,
      closedAt: (issue.closedAt as string) || undefined,
    };
  }
}
