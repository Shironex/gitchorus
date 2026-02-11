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
  CREATE_PR: 'github:create-pr',
  ISSUES: 'github:issues',
  ISSUE: 'github:issue',
} as const;

// ============================================
// System Events
// ============================================
export const SystemEvents = {
  THROTTLED: 'ws:throttled',
} as const;
