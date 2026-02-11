import { Injectable } from '@nestjs/common';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKMessage, SDKResultSuccess, SDKResultError } from '@anthropic-ai/claude-agent-sdk';
import type {
  ProviderStatus,
  ValidationParams,
  ValidationStep,
  ValidationResult,
} from '@gitchorus/shared';
import { createLogger } from '@gitchorus/shared';
import { getClaudeCliStatus } from '../../main/utils';

const logger = createLogger('ClaudeAgentProvider');

/**
 * Default model for Claude Agent SDK queries
 */
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

/**
 * Default maximum turns for agent queries
 */
const DEFAULT_MAX_TURNS = 30;

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
 * Claude Agent SDK provider for AI-powered issue validation.
 *
 * Uses the Claude Agent SDK to spawn a Claude Code agent that analyzes
 * issues against the repository codebase in read-only mode.
 */
@Injectable()
export class ClaudeAgentProvider {
  private abortController: AbortController | null = null;

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
      logger.error('Failed to get Claude CLI status:', error);
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
   */
  async *validate(
    params: ValidationParams
  ): AsyncGenerator<ValidationStep, ValidationResult> {
    const startTime = Date.now();
    const model = params.config?.model || DEFAULT_MODEL;
    const maxTurns = params.config?.maxTurns || DEFAULT_MAX_TURNS;

    this.abortController = new AbortController();

    yield {
      step: 'initializing',
      message: 'Starting Claude agent for issue analysis...',
      timestamp: new Date().toISOString(),
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
      },
    });

    yield {
      step: 'reading-issue',
      message: `Analyzing issue #${params.issue.number}: ${params.issue.title}`,
      timestamp: new Date().toISOString(),
    };

    let resultMessage: SDKResultSuccess | null = null;

    try {
      for await (const message of agentQuery as AsyncIterable<SDKMessage>) {
        // Yield progress steps based on message types
        if (message.type === 'assistant') {
          yield {
            step: 'analyzing',
            message: 'Agent is analyzing the codebase...',
            timestamp: new Date().toISOString(),
          };
        } else if (message.type === 'result') {
          if (message.subtype === 'success') {
            resultMessage = message as SDKResultSuccess;
          } else {
            const errorResult = message as SDKResultError;
            throw new Error(
              `Agent query failed: ${errorResult.subtype} - ${errorResult.errors?.join(', ') || 'Unknown error'}`
            );
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Validation cancelled by user');
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
    };

    // Parse the structured output
    const structuredOutput = resultMessage.structured_output as Record<string, unknown> | undefined;

    if (!structuredOutput) {
      // Fallback: try to parse the result text as JSON
      try {
        const parsed = JSON.parse(resultMessage.result);
        return this.buildValidationResult(parsed, params, model, startTime, resultMessage);
      } catch {
        throw new Error('Agent did not produce structured output and result text is not valid JSON');
      }
    }

    return this.buildValidationResult(structuredOutput, params, model, startTime, resultMessage);
  }

  /**
   * Cancel the current validation.
   */
  cancel(): void {
    if (this.abortController) {
      logger.info('Cancelling Claude agent query');
      this.abortController.abort();
      this.abortController = null;
    }
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
