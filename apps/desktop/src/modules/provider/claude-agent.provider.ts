import { Injectable } from '@nestjs/common';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type {
  SDKMessage,
  SDKResultSuccess,
  SDKResultError,
  SDKAssistantMessage,
  SDKToolProgressMessage,
  SDKToolUseSummaryMessage,
} from '@anthropic-ai/claude-agent-sdk';
import type {
  ProviderStatus,
  ValidationParams,
  ValidationStep,
  ValidationResult,
  ReviewParams,
  ReviewResult,
} from '@gitchorus/shared';
import { createLogger, REVIEW_DEPTH_CONFIG } from '@gitchorus/shared';
import { getClaudeCliStatus } from '../../main/utils';
import { SettingsService } from '../settings';

/**
 * Default model for Claude Agent SDK queries
 */
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

/**
 * Default maximum turns for agent queries
 */
const DEFAULT_MAX_TURNS = 30;

/**
 * Default maximum turns for review queries (larger scope than validation)
 */
const DEFAULT_REVIEW_MAX_TURNS = 50;

/**
 * Maximum number of stderr lines to retain for error diagnostics.
 */
const MAX_STDERR_LINES = 20;

/**
 * Map SDK assistant message error codes to user-friendly messages.
 */
const ASSISTANT_ERROR_MESSAGES: Record<string, string> = {
  authentication_failed: 'Claude authentication failed. Please re-authenticate.',
  billing_error: 'Claude billing error. Check your subscription.',
  rate_limit: 'Rate limited by Claude API. Please try again later.',
  invalid_request: 'Invalid request sent to Claude API.',
  server_error: 'Claude API server error. Please try again later.',
  max_output_tokens: 'Claude response exceeded maximum output tokens.',
};

/**
 * JSON schema for structured validation output.
 * Matches the ValidationResult type (without metadata fields that are added after).
 */
const VALIDATION_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    issueType: { type: 'string', enum: ['bug', 'feature'] },
    verdict: { type: 'string', enum: ['confirmed', 'likely', 'uncertain', 'unlikely', 'invalid'] },
    confidence: { type: 'number', minimum: 0, maximum: 100 },
    affectedFiles: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          reason: { type: 'string' },
          snippet: { type: 'string' },
        },
        required: ['path', 'reason'],
      },
    },
    complexity: { type: 'string', enum: ['trivial', 'low', 'medium', 'high', 'very-high'] },
    suggestedApproach: { type: 'string' },
    reasoning: { type: 'string' },
    // Feature-specific fields (optional for bugs)
    prerequisites: { type: 'array', items: { type: 'string' } },
    potentialConflicts: { type: 'array', items: { type: 'string' } },
    effortEstimate: { type: 'string' },
  },
  required: [
    'issueType',
    'verdict',
    'confidence',
    'affectedFiles',
    'complexity',
    'suggestedApproach',
    'reasoning',
  ],
};

/**
 * Build the system prompt for issue validation.
 */
function buildSystemPrompt(): string {
  return `You are a senior software engineer performing deep code analysis to validate a GitHub issue against a codebase.

Your task:
1. Read the issue carefully to understand what is being reported or requested
2. Auto-detect whether this is a BUG REPORT or a FEATURE REQUEST
3. Analyze the codebase thoroughly — read relevant files, search for patterns, trace code paths
4. Produce a structured validation result

For BUG REPORTS:
- Determine if the bug is real by finding the affected code
- Identify all files that are affected
- Assess the complexity of fixing it
- Suggest an approach to fix it
- Provide your reasoning and confidence level

For FEATURE REQUESTS:
- Assess feasibility by analyzing the existing architecture
- Identify files that would need to be modified
- Determine prerequisites and potential conflicts
- Estimate effort and complexity
- Suggest an implementation approach

IMPORTANT RULES:
- Be thorough: read files, grep for patterns, understand the code structure
- Be evidence-based: cite specific files and code when making claims
- Be honest: if you are uncertain, say so with lower confidence
- Focus on the codebase as it exists NOW, not hypothetical future states
- Use read-only tools only: Read, Grep, Glob, Bash (for non-destructive commands like ls, find, cat)`;
}

/**
 * Build the user prompt for a specific issue.
 */
function buildIssuePrompt(params: ValidationParams): string {
  const issue = params.issue;
  return `Validate the following GitHub issue against the repository at ${params.repoPath}:

**Repository:** ${params.repoName}

**Issue #${issue.number}: ${issue.title}**
${issue.labels.length > 0 ? `Labels: ${issue.labels.map(l => l.name).join(', ')}` : ''}
${issue.body ? `\n${issue.body}` : '(No description provided)'}

Analyze this issue against the codebase and produce your validation result.`;
}

/**
 * JSON schema for structured review output.
 * Matches the ReviewResult type (without metadata fields that are added after).
 */
const REVIEW_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['critical', 'major', 'minor', 'nit'] },
          category: {
            type: 'string',
            enum: ['security', 'logic', 'performance', 'style', 'codebase-fit'],
          },
          file: { type: 'string' },
          line: { type: 'number' },
          codeSnippet: { type: 'string' },
          explanation: { type: 'string' },
          suggestedFix: { type: 'string' },
          title: { type: 'string' },
        },
        required: [
          'severity',
          'category',
          'file',
          'line',
          'codeSnippet',
          'explanation',
          'suggestedFix',
          'title',
        ],
      },
    },
    verdict: { type: 'string' },
    qualityScore: { type: 'number', minimum: 1, maximum: 10 },
  },
  required: ['findings', 'verdict', 'qualityScore'],
};

/**
 * Build the system prompt for PR code review.
 */
function buildReviewSystemPrompt(): string {
  return `You are a senior software engineer performing a thorough code review of a pull request. You have full access to the codebase.

Your task:
1. Analyze the PR diff carefully, understanding every change
2. Use the codebase tools to read related files, search for patterns, and understand context
3. Review all changed files across these categories: Security, Logic, Performance, Style, Codebase-fit
4. Produce structured findings for each issue you discover
5. Provide an overall verdict with a quality score from 1-10

For each finding, provide:
- severity: critical (security holes, data loss, crashes) | major (bugs, logic errors, significant issues) | minor (code quality, edge cases) | nit (style, naming, formatting)
- category: security | logic | performance | style | codebase-fit
- file: the file path where the issue was found
- line: the line number in the file (approximate is fine)
- codeSnippet: the problematic code from the diff
- explanation: clear explanation of why this is an issue
- suggestedFix: suggested fix as a code block with inline comments
- title: one-line summary of the finding

IMPORTANT RULES:
- Be thorough: read related files beyond the diff to understand context
- Be evidence-based: cite actual code from the diff and codebase
- Be actionable: every finding should have a clear suggested fix
- Be calibrated: don't flag style nits as major issues
- Be constructive: explain WHY something is an issue, not just WHAT
- Review ALL changed files, no size limit
- If the code looks good, say so — don't manufacture issues
- Use read-only tools only: Read, Grep, Glob, Bash (for non-destructive commands)`;
}

/**
 * Build the user prompt for a specific PR review.
 */
function buildReviewPrompt(params: ReviewParams): string {
  return `Review the following pull request against the repository at ${params.repoPath}:

**Repository:** ${params.repoName}
**PR #${params.prNumber}: ${params.prTitle}**
**Branch:** ${params.headBranch} -> ${params.baseBranch}
${params.prBody ? `\n**Description:**\n${params.prBody}` : '(No description provided)'}

**Diff:**
\`\`\`diff
${params.diff}
\`\`\`

Analyze this PR against the codebase and produce your review findings. Read related files for context beyond the diff.`;
}

/**
 * Truncate a string to maxLen characters, appending "..." if truncated.
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

/**
 * Parse tool_use content blocks from an SDK assistant message
 * and yield detailed progress steps.
 */
function* parseAssistantToolUseBlocks(message: SDKAssistantMessage): Generator<ValidationStep> {
  const content = message.message?.content;
  if (!Array.isArray(content)) return;

  for (const block of content) {
    // Only process tool_use blocks
    if (block.type !== 'tool_use') continue;

    const toolName = block.name as string;
    const input = (block.input || {}) as Record<string, unknown>;
    const timestamp = new Date().toISOString();

    switch (toolName) {
      case 'Read': {
        const filePath = (input.file_path as string) || 'unknown file';
        yield {
          step: 'tool-read',
          message: `Reading ${filePath}`,
          timestamp,
          stepType: 'reading',
          toolName: 'Read',
          filePath,
        };
        break;
      }
      case 'Grep': {
        const pattern = (input.pattern as string) || '';
        const searchPath = (input.path as string) || 'codebase';
        yield {
          step: 'tool-grep',
          message: `Searching for "${truncate(pattern, 40)}" in ${searchPath}`,
          timestamp,
          stepType: 'searching',
          toolName: 'Grep',
        };
        break;
      }
      case 'Glob': {
        const globPattern = (input.pattern as string) || '';
        yield {
          step: 'tool-glob',
          message: `Finding files matching ${globPattern}`,
          timestamp,
          stepType: 'searching',
          toolName: 'Glob',
        };
        break;
      }
      case 'Bash': {
        const command = (input.command as string) || '';
        yield {
          step: 'tool-bash',
          message: `Running command: ${truncate(command, 80)}`,
          timestamp,
          stepType: 'tool-use',
          toolName: 'Bash',
        };
        break;
      }
      default: {
        yield {
          step: `tool-${toolName.toLowerCase()}`,
          message: `Using ${toolName}`,
          timestamp,
          stepType: 'tool-use',
          toolName,
        };
        break;
      }
    }
  }
}

/**
 * Claude Agent SDK provider for AI-powered issue validation.
 *
 * Uses the Claude Agent SDK to spawn a Claude Code agent that analyzes
 * issues against the repository codebase in read-only mode.
 */
@Injectable()
export class ClaudeAgentProvider {
  private abortController: AbortController | null = null;

  constructor(private readonly settingsService: SettingsService) {}

  /**
   * Check if Claude CLI is available and authenticated.
   */
  async getStatus(): Promise<ProviderStatus> {
    try {
      const cliStatus = await getClaudeCliStatus();

      return {
        type: 'claude',
        available: cliStatus.installed,
        version: cliStatus.version,
        authenticated: cliStatus.auth.authenticated,
        error: !cliStatus.installed
          ? 'Claude CLI is not installed'
          : !cliStatus.auth.authenticated
            ? 'Claude CLI is not authenticated. Run "claude login" to authenticate.'
            : undefined,
      };
    } catch (error) {
      const defaultLogger = createLogger('ClaudeAgentProvider');
      defaultLogger.error('Failed to get Claude CLI status:', error);
      return {
        type: 'claude',
        available: false,
        authenticated: false,
        error: `Failed to check Claude CLI status: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Run validation on an issue using the Claude Agent SDK.
   *
   * This is an async generator that yields ValidationStep events
   * for progress tracking and returns the final ValidationResult.
   *
   * If params.fileTransport is provided, creates a logger with file transport
   * for writing structured logs to disk.
   */
  async *validate(params: ValidationParams): AsyncGenerator<ValidationStep, ValidationResult> {
    const startTime = Date.now();
    const settingsConfig = this.settingsService.getConfig();
    const model = params.config?.model || settingsConfig.model || DEFAULT_MODEL;
    const maxTurns =
      params.config?.maxTurns ||
      REVIEW_DEPTH_CONFIG[settingsConfig.validationDepth].validationMaxTurns ||
      DEFAULT_MAX_TURNS;

    // Create logger — with file transport if provided
    const logger = createLogger('ClaudeAgentProvider', {
      fileTransport: params.fileTransport,
    });

    this.abortController = new AbortController();

    // Capture stderr output for error diagnostics
    const stderrBuffer: string[] = [];

    yield {
      step: 'initializing',
      message: 'Starting Claude agent for issue analysis...',
      timestamp: new Date().toISOString(),
      stepType: 'init',
    };

    const agentQuery = query({
      prompt: buildIssuePrompt(params),
      options: {
        cwd: params.repoPath,
        tools: ['Read', 'Grep', 'Glob', 'Bash'],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        abortController: this.abortController,
        systemPrompt: buildSystemPrompt(),
        model,
        maxTurns,
        maxBudgetUsd: params.config?.maxBudgetUsd,
        outputFormat: {
          type: 'json_schema',
          schema: VALIDATION_OUTPUT_SCHEMA,
        },
        persistSession: false,
        stderr: (data: string) => {
          stderrBuffer.push(data.trimEnd());
          if (stderrBuffer.length > MAX_STDERR_LINES) {
            stderrBuffer.shift();
          }
        },
      },
    });

    yield {
      step: 'reading-issue',
      message: `Analyzing issue #${params.issue.number}: ${params.issue.title}`,
      timestamp: new Date().toISOString(),
      stepType: 'analyzing',
    };

    let resultMessage: SDKResultSuccess | null = null;

    try {
      for await (const message of agentQuery as AsyncIterable<SDKMessage>) {
        logger.debug(`SDK message: type=${message.type}`);

        if (message.type === 'assistant') {
          // Check for assistant-level errors (auth, billing, rate limit, etc.)
          const assistantMsg = message as SDKAssistantMessage;
          if (assistantMsg.error) {
            const friendlyMsg =
              ASSISTANT_ERROR_MESSAGES[assistantMsg.error] ||
              `Claude agent error: ${assistantMsg.error}`;
            logger.error(`Assistant error: ${assistantMsg.error} — ${friendlyMsg}`);
            throw new Error(friendlyMsg);
          }

          // Parse tool_use blocks from assistant message content
          const toolSteps = [...parseAssistantToolUseBlocks(assistantMsg)];

          // If assistant message has tool_use blocks, yield each one
          // If no tool_use blocks (pure text), skip — user doesn't need to see thinking
          for (const step of toolSteps) {
            logger.info(`Step: [${step.stepType}] ${step.message}`);
            yield step;
          }
        } else if (message.type === 'tool_use_summary') {
          const summaryMsg = message as SDKToolUseSummaryMessage;
          const step: ValidationStep = {
            step: 'tool-summary',
            message: summaryMsg.summary,
            timestamp: new Date().toISOString(),
            stepType: 'tool-use',
          };
          logger.info(`Step: [tool-summary] ${summaryMsg.summary}`);
          yield step;
        } else if (message.type === 'tool_progress') {
          const progressMsg = message as SDKToolProgressMessage;
          const step: ValidationStep = {
            step: 'tool-progress',
            message: `Running ${progressMsg.tool_name}...`,
            timestamp: new Date().toISOString(),
            stepType: 'tool-use',
            toolName: progressMsg.tool_name,
          };
          logger.debug(`Tool progress: ${progressMsg.tool_name}`);
          yield step;
        } else if (message.type === 'result') {
          if (message.subtype === 'success') {
            resultMessage = message as SDKResultSuccess;
            logger.info('Agent query completed successfully');
          } else {
            const errorResult = message as SDKResultError;
            const errorMsg = `Agent query failed: ${errorResult.subtype} - ${errorResult.errors?.join(', ') || 'Unknown error'}`;
            logger.error(errorMsg);
            throw new Error(errorMsg);
          }
        }
        // All other message types (system, stream_event, etc.): skip
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.info('Validation cancelled by user');
        throw new Error('Validation cancelled by user');
      }
      // Enrich error with stderr context if available
      if (stderrBuffer.length > 0 && error instanceof Error) {
        const stderrContext = stderrBuffer.join('\n');
        logger.error(`stderr output:\n${stderrContext}`);
        error.message = `${error.message}\n[stderr]: ${stderrContext}`;
      }
      throw error;
    } finally {
      this.abortController = null;
    }

    if (!resultMessage) {
      throw new Error('Agent query completed without producing a result');
    }

    yield {
      step: 'processing-result',
      message: 'Processing validation result...',
      timestamp: new Date().toISOString(),
      stepType: 'processing',
    };

    // Parse the structured output
    const structuredOutput = resultMessage.structured_output as Record<string, unknown> | undefined;

    if (!structuredOutput) {
      // Fallback: try to parse the result text as JSON
      try {
        const parsed = JSON.parse(resultMessage.result);
        return this.buildValidationResult(parsed, params, model, startTime, resultMessage);
      } catch {
        throw new Error(
          'Agent did not produce structured output and result text is not valid JSON'
        );
      }
    }

    return this.buildValidationResult(structuredOutput, params, model, startTime, resultMessage);
  }

  /**
   * Run a PR code review using the Claude Agent SDK.
   *
   * This is an async generator that yields ValidationStep events
   * for progress tracking and returns the final ReviewResult.
   */
  async *review(params: ReviewParams): AsyncGenerator<ValidationStep, ReviewResult> {
    const startTime = Date.now();
    const settingsConfig = this.settingsService.getConfig();
    const model = params.config?.model || settingsConfig.model || DEFAULT_MODEL;
    const maxTurns =
      params.config?.maxTurns ||
      REVIEW_DEPTH_CONFIG[settingsConfig.reviewDepth].reviewMaxTurns ||
      DEFAULT_REVIEW_MAX_TURNS;

    // Create logger -- with file transport if provided
    const logger = createLogger('ClaudeAgentProvider', {
      fileTransport: params.fileTransport,
    });

    this.abortController = new AbortController();

    // Capture stderr output for error diagnostics
    const stderrBuffer: string[] = [];

    yield {
      step: 'initializing',
      message: 'Starting Claude agent for PR review...',
      timestamp: new Date().toISOString(),
      stepType: 'init',
    };

    const agentQuery = query({
      prompt: buildReviewPrompt(params),
      options: {
        cwd: params.repoPath,
        tools: ['Read', 'Grep', 'Glob', 'Bash'],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        abortController: this.abortController,
        systemPrompt: buildReviewSystemPrompt(),
        model,
        maxTurns,
        maxBudgetUsd: params.config?.maxBudgetUsd,
        outputFormat: {
          type: 'json_schema',
          schema: REVIEW_OUTPUT_SCHEMA,
        },
        persistSession: false,
        stderr: (data: string) => {
          stderrBuffer.push(data.trimEnd());
          if (stderrBuffer.length > MAX_STDERR_LINES) {
            stderrBuffer.shift();
          }
        },
      },
    });

    yield {
      step: 'reading-pr',
      message: `Analyzing PR #${params.prNumber}: ${params.prTitle}`,
      timestamp: new Date().toISOString(),
      stepType: 'analyzing',
    };

    let resultMessage: SDKResultSuccess | null = null;

    try {
      for await (const message of agentQuery as AsyncIterable<SDKMessage>) {
        logger.debug(`SDK message: type=${message.type}`);

        if (message.type === 'assistant') {
          // Check for assistant-level errors (auth, billing, rate limit, etc.)
          const assistantMsg = message as SDKAssistantMessage;
          if (assistantMsg.error) {
            const friendlyMsg =
              ASSISTANT_ERROR_MESSAGES[assistantMsg.error] ||
              `Claude agent error: ${assistantMsg.error}`;
            logger.error(`Assistant error: ${assistantMsg.error} — ${friendlyMsg}`);
            throw new Error(friendlyMsg);
          }

          const toolSteps = [...parseAssistantToolUseBlocks(assistantMsg)];

          for (const step of toolSteps) {
            logger.info(`Step: [${step.stepType}] ${step.message}`);
            yield step;
          }
        } else if (message.type === 'tool_use_summary') {
          const summaryMsg = message as SDKToolUseSummaryMessage;
          const step: ValidationStep = {
            step: 'tool-summary',
            message: summaryMsg.summary,
            timestamp: new Date().toISOString(),
            stepType: 'tool-use',
          };
          logger.info(`Step: [tool-summary] ${summaryMsg.summary}`);
          yield step;
        } else if (message.type === 'tool_progress') {
          const progressMsg = message as SDKToolProgressMessage;
          const step: ValidationStep = {
            step: 'tool-progress',
            message: `Running ${progressMsg.tool_name}...`,
            timestamp: new Date().toISOString(),
            stepType: 'tool-use',
            toolName: progressMsg.tool_name,
          };
          logger.debug(`Tool progress: ${progressMsg.tool_name}`);
          yield step;
        } else if (message.type === 'result') {
          if (message.subtype === 'success') {
            resultMessage = message as SDKResultSuccess;
            logger.info('Review agent query completed successfully');
          } else {
            const errorResult = message as SDKResultError;
            const errorMsg = `Review agent query failed: ${errorResult.subtype} - ${errorResult.errors?.join(', ') || 'Unknown error'}`;
            logger.error(errorMsg);
            throw new Error(errorMsg);
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.info('Review cancelled by user');
        throw new Error('Review cancelled by user');
      }
      // Enrich error with stderr context if available
      if (stderrBuffer.length > 0 && error instanceof Error) {
        const stderrContext = stderrBuffer.join('\n');
        logger.error(`stderr output:\n${stderrContext}`);
        error.message = `${error.message}\n[stderr]: ${stderrContext}`;
      }
      throw error;
    } finally {
      this.abortController = null;
    }

    if (!resultMessage) {
      throw new Error('Review agent query completed without producing a result');
    }

    yield {
      step: 'processing-result',
      message: 'Processing review result...',
      timestamp: new Date().toISOString(),
      stepType: 'processing',
    };

    // Parse the structured output
    const structuredOutput = resultMessage.structured_output as Record<string, unknown> | undefined;

    if (!structuredOutput) {
      try {
        const parsed = JSON.parse(resultMessage.result);
        return this.buildReviewResult(parsed, params, model, startTime, resultMessage);
      } catch {
        throw new Error(
          'Review agent did not produce structured output and result text is not valid JSON'
        );
      }
    }

    return this.buildReviewResult(structuredOutput, params, model, startTime, resultMessage);
  }

  /**
   * Cancel the current validation or review.
   */
  cancel(): void {
    if (this.abortController) {
      const logger = createLogger('ClaudeAgentProvider');
      logger.info('Cancelling Claude agent query');
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Build a full ReviewResult from the agent's structured output.
   */
  private buildReviewResult(
    output: Record<string, unknown>,
    params: ReviewParams,
    model: string,
    startTime: number,
    resultMessage: SDKResultSuccess
  ): ReviewResult {
    const findings = (output['findings'] || []) as ReviewResult['findings'];
    const verdict = (output['verdict'] || 'No verdict provided') as string;
    const qualityScore = (output['qualityScore'] || 5) as number;

    return {
      prNumber: params.prNumber,
      prTitle: params.prTitle,
      repositoryFullName: params.repoName,
      findings,
      verdict,
      qualityScore,
      reviewedAt: new Date().toISOString(),
      providerType: 'claude' as const,
      model,
      costUsd: resultMessage.total_cost_usd || 0,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Build a full ValidationResult from the agent's structured output.
   */
  private buildValidationResult(
    output: Record<string, unknown>,
    params: ValidationParams,
    model: string,
    startTime: number,
    resultMessage: SDKResultSuccess
  ): ValidationResult {
    const baseResult = {
      issueNumber: params.issue.number,
      issueTitle: params.issue.title,
      repositoryFullName: params.repoName,
      validatedAt: new Date().toISOString(),
      providerType: 'claude' as const,
      model,
      costUsd: resultMessage.total_cost_usd || 0,
      durationMs: Date.now() - startTime,
    };

    if (output['issueType'] === 'feature') {
      return {
        issueType: 'feature',
        verdict: output['verdict'] as ValidationResult['verdict'],
        confidence: output['confidence'] as number,
        affectedFiles: (output['affectedFiles'] || []) as ValidationResult['affectedFiles'],
        complexity: output['complexity'] as ValidationResult['complexity'],
        prerequisites: (output['prerequisites'] || []) as string[],
        potentialConflicts: (output['potentialConflicts'] || []) as string[],
        effortEstimate: (output['effortEstimate'] || 'Unknown') as string,
        suggestedApproach: output['suggestedApproach'] as string,
        reasoning: output['reasoning'] as string,
        ...baseResult,
      };
    }

    return {
      issueType: 'bug',
      verdict: output['verdict'] as ValidationResult['verdict'],
      confidence: output['confidence'] as number,
      affectedFiles: (output['affectedFiles'] || []) as ValidationResult['affectedFiles'],
      complexity: output['complexity'] as ValidationResult['complexity'],
      suggestedApproach: output['suggestedApproach'] as string,
      reasoning: output['reasoning'] as string,
      ...baseResult,
    };
  }
}
