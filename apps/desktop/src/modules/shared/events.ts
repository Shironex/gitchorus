/**
 * Internal EventEmitter2 Event Constants (Backend Only)
 *
 * These events are used for internal NestJS module communication.
 * They use dot-notation and are NOT sent over WebSocket.
 *
 * For WebSocket socket.io events, see @gitchorus/shared constants/events.ts
 */

// ============================================
// Git Internal Events
// ============================================
export const InternalGitEvents = {
  REPO_CHANGED: 'git.repo-changed',
} as const;
