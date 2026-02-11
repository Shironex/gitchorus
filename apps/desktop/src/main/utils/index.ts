// Path utilities
export { normalizePath, joinPaths, getHomeDir, isWindows, isMac, isLinux } from './path';

// CLI detection utilities
export {
  CLI_TOOLS,
  type CLITool,
  type CliDetectionResult,
  checkCliAvailable,
  findCliInPath,
  findCliInLocalPaths,
} from './cli-detection';

// GitHub CLI detection
export {
  getGhCliPaths,
  findGhCli,
  getGhCliVersion,
  checkGhAuth,
  getGhCliStatus,
} from './github-detection';

// Claude CLI detection
export {
  getClaudeConfigDir,
  getClaudeCredentialPaths,
  getClaudeCliPaths,
  findClaudeCli,
  getClaudeCliVersion,
  checkClaudeAuth,
  getClaudeCliStatus,
} from './claude-detection';
