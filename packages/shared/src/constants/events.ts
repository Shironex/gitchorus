/**
 * WebSocket Socket.io Event Constants
 *
 * Single source of truth for all socket event names used between
 * the frontend (apps/web) and backend (apps/desktop).
 *
 * Naming convention: 'domain:action' (colon separator)
 */

// ============================================
// Git Events
// ============================================
export const GitEvents = {
  BRANCHES: 'git:branches',
  COMMITS: 'git:commits',
  CHECKOUT: 'git:checkout',
  CREATE_BRANCH: 'git:create-branch',
  CURRENT_BRANCH: 'git:current-branch',
} as const;

// ============================================
// GitHub Events
// ============================================
export const GithubEvents = {
  STATUS: 'github:status',
  REPO_INFO: 'github:repo-info',
  PRS: 'github:prs',
  PR: 'github:pr',
  PR_DIFF: 'github:pr-diff',
  CREATE_PR: 'github:create-pr',
  ISSUES: 'github:issues',
  ISSUE: 'github:issue',
  CREATE_COMMENT: 'github:create-comment',
  LIST_COMMENTS: 'github:list-comments',
  UPDATE_COMMENT: 'github:update-comment',
} as const;

// ============================================
// Repository Events
// ============================================
export const RepositoryEvents = {
  VALIDATE_REPO: 'git:validate-repo',
  GET_GITHUB_REMOTE: 'git:github-remote',
} as const;

// ============================================
// Validation Events
// ============================================
export const ValidationEvents = {
  START: 'validation:start',
  CANCEL: 'validation:cancel',
  PROGRESS: 'validation:progress',
  COMPLETE: 'validation:complete',
  ERROR: 'validation:error',
  QUEUE_UPDATE: 'validation:queue-update',
  HISTORY_LIST: 'validation:history-list',
  HISTORY_GET: 'validation:history-get',
  HISTORY_DELETE: 'validation:history-delete',
  LOG_ENTRIES: 'validation:log-entries',
} as const;

// ============================================
// Review Events
// ============================================
export const ReviewEvents = {
  START: 'review:start',
  CANCEL: 'review:cancel',
  PROGRESS: 'review:progress',
  COMPLETE: 'review:complete',
  ERROR: 'review:error',
  QUEUE_UPDATE: 'review:queue-update',
} as const;

// ============================================
// Provider Events
// ============================================
export const ProviderEvents = {
  STATUS: 'provider:status',
  CLAUDE_CLI_STATUS: 'provider:claude-cli-status',
} as const;

// ============================================
// System Events
// ============================================
export const SystemEvents = {
  THROTTLED: 'ws:throttled',
} as const;
