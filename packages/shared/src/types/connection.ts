/**
 * Connection Types - WebSocket connection state
 */

/**
 * Connection status for WebSocket
 */
export type ConnectionStatus = 'connected' | 'reconnecting' | 'failed';

/**
 * Payload emitted when a WebSocket event is rate-limited
 */
export interface WsThrottledPayload {
  /** The socket event name that was throttled */
  event: string;
  /** Milliseconds until the block expires */
  retryAfter: number;
}
