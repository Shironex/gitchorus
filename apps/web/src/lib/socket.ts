import { io, Socket } from 'socket.io-client';
import { createLogger, LOCALHOST } from '@gitchorus/shared';

const logger = createLogger('Socket');

let _socket: Socket | null = null;

let isConnecting = false;

interface PendingCaller {
  resolve: () => void;
  reject: (error: Error) => void;
}

let pendingCallers: PendingCaller[] = [];

function resolvePendingCallers(): void {
  const callers = pendingCallers;
  pendingCallers = [];
  for (const caller of callers) {
    caller.resolve();
  }
}

function rejectPendingCallers(error: Error): void {
  const callers = pendingCallers;
  pendingCallers = [];
  for (const caller of callers) {
    caller.reject(error);
  }
}

/**
 * Initialize the socket with the dynamically assigned backend port.
 * Must be called once before any socket operations.
 * Idempotent — returns the existing socket if already initialized.
 */
export function initializeSocket(port: number): Socket {
  if (_socket) {
    logger.warn('Socket already initialized, returning existing instance');
    return _socket;
  }

  const url = `ws://${LOCALHOST}:${port}`;
  logger.info(`Initializing socket connection to ${url}`);

  _socket = io(url, {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.5,
    timeout: 20000,
    transports: ['websocket', 'polling'],
  });

  // Connection event handlers
  _socket.on('connect', () => {
    logger.info('Connected to server');
  });

  _socket.on('disconnect', reason => {
    logger.warn('Disconnected:', reason);
  });

  _socket.on('reconnect', attemptNumber => {
    logger.info('Reconnected after', attemptNumber, 'attempts');
  });

  _socket.on('reconnect_attempt', attemptNumber => {
    logger.debug('Reconnection attempt', attemptNumber);
  });

  _socket.on('reconnect_error', error => {
    logger.error('Reconnection error:', error);
  });

  _socket.on('reconnect_failed', () => {
    logger.error('Reconnection failed after all attempts');
  });

  // Expose socket instance on window for E2E testing.
  // Allows Playwright to trigger disconnect/reconnect scenarios.
  // This is a desktop Electron app -- window globals are already accessible
  // via devtools, so exposing the socket adds no meaningful attack surface.
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__testSocket = _socket;
  }

  return _socket;
}

/**
 * Get the socket instance. Throws if not yet initialized.
 */
export function getSocket(): Socket {
  if (!_socket) {
    throw new Error('Socket not initialized. Call initializeSocket(port) first.');
  }
  return _socket;
}

export function connectSocket(): Promise<void> {
  const socket = getSocket();
  return new Promise((resolve, reject) => {
    if (socket.connected) {
      resolve();
      return;
    }

    if (isConnecting) {
      pendingCallers.push({ resolve, reject });
      return;
    }

    isConnecting = true;

    const onConnect = () => {
      isConnecting = false;
      cleanup();
      resolve();
      resolvePendingCallers();
    };

    const onConnectError = (error: Error) => {
      isConnecting = false;
      cleanup();
      reject(error);
      rejectPendingCallers(error);
    };

    const cleanup = () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
    };

    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);

    socket.connect();
  });
}

export function disconnectSocket(): void {
  if (_socket?.connected) {
    _socket.disconnect();
  }
}

// Re-export socket helpers for convenient access
export {
  emitAsync,
  emitWithErrorHandling,
  emitWithSuccessHandling,
  type EmitOptions,
  type ErrorResponse,
  type SuccessResponse,
} from './socketHelpers';
