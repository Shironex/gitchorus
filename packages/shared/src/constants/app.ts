/**
 * Application Constants
 *
 * Centralized constants for the GitChorus application.
 * Use these instead of hardcoding values throughout the codebase.
 */

// =============================================================================
// App Identity
// =============================================================================

/** Application name (display) */
export const APP_NAME = 'GitChorus';

/** Application name (lowercase, for paths/IDs) */
export const APP_NAME_LOWER = 'gitchorus';

/** Application ID for Electron/OS registration */
export const APP_ID = 'com.gitchorus.desktop';

// =============================================================================
// Paths
// =============================================================================

/** Directory name for user data (e.g., ~/.gitchorus) */
export const USER_DATA_DIR = '.gitchorus';

// =============================================================================
// Timeouts (in milliseconds)
// =============================================================================

/** Default timeout for git commands */
export const GIT_TIMEOUT_MS = 30000;

/** Default timeout for GitHub CLI commands */
export const GH_TIMEOUT_MS = 30000;

/** Cache TTL for status checks */
export const STATUS_CACHE_TTL_MS = 5 * 60 * 1000;

// =============================================================================
// Network
// =============================================================================

/** Vite dev server port */
export const VITE_DEV_PORT = 15173;

/** Localhost address */
export const LOCALHOST = '127.0.0.1';

// =============================================================================
// Links
// =============================================================================

/** GitHub releases page URL */
export const GITHUB_RELEASES_URL = 'https://github.com/Shironex/gitchorus/releases';

// =============================================================================
// Logging
// =============================================================================

/** Log file prefix */
export const LOG_FILE_PREFIX = 'gitchorus';

/** Maximum log file size before rotation (10MB) */
export const LOG_MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Maximum age of log files before cleanup (7 days in ms) */
export const LOG_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Log flush interval in milliseconds */
export const LOG_FLUSH_INTERVAL_MS = 100;

/** Maximum buffered log entries before forced flush */
export const LOG_BUFFER_MAX_ENTRIES = 50;

/** Log cleanup interval (1 hour in ms) */
export const LOG_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

// =============================================================================
// Validation
// =============================================================================

/** Maximum length for project path */
export const MAX_PATH_LENGTH = 1024;

// =============================================================================
// Review Markers
// =============================================================================

/** Hidden HTML comment used to identify GitChorus reviews on GitHub */
export const GITCHORUS_REVIEW_MARKER = '<!-- gitchorus-review -->';
