/**
 * Backend port state management.
 *
 * Separated from index.ts to avoid circular imports with window.ts.
 * The port is set once during NestJS bootstrap and read by the CSP
 * setup and IPC handlers.
 */

let backendPort: number | null = null;

export function getBackendPort(): number {
  if (backendPort === null) {
    throw new Error('Backend port not yet available — NestJS has not started');
  }
  return backendPort;
}

export function setBackendPort(port: number): void {
  if (backendPort !== null) {
    throw new Error(`Backend port already set to ${backendPort}`);
  }
  backendPort = port;
}
