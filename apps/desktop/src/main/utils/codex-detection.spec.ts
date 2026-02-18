import { execFile } from 'child_process';
import { existsSync } from 'fs';
import {
  getCodexConfigDir,
  getCodexCliPaths,
  findCodexCli,
  getCodexCliVersion,
  checkCodexAuth,
  getCodexCliStatus,
} from './codex-detection';
import { joinPaths, getHomeDir, isWindows } from './path';
import { findCliInPath, findCliInLocalPaths } from './cli-detection';

jest.mock('child_process');
jest.mock('fs');
jest.mock('./path');
jest.mock('./cli-detection');

const mockExecFile = execFile as jest.MockedFunction<typeof execFile>;
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockJoinPaths = joinPaths as jest.MockedFunction<typeof joinPaths>;
const mockGetHomeDir = getHomeDir as jest.MockedFunction<typeof getHomeDir>;
const mockIsWindows = isWindows as jest.MockedFunction<typeof isWindows>;
const mockFindCliInPath = findCliInPath as jest.MockedFunction<typeof findCliInPath>;
const mockFindCliInLocalPaths = findCliInLocalPaths as jest.MockedFunction<
  typeof findCliInLocalPaths
>;

describe('codex-detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetHomeDir.mockReturnValue('/home/testuser');
    mockIsWindows.mockReturnValue(false);
    mockJoinPaths.mockImplementation((...parts: string[]) => parts.join('/'));
    mockExistsSync.mockReturnValue(false);
    mockFindCliInPath.mockResolvedValue(undefined);
    mockFindCliInLocalPaths.mockReturnValue(undefined);

    mockExecFile.mockImplementation((_file, _args, cb) => {
      if (typeof cb === 'function') {
        cb(null, { stdout: '', stderr: '' });
      }
      return {} as ReturnType<typeof execFile>;
    });
  });

  it('builds ~/.codex config path', () => {
    const result = getCodexConfigDir();
    expect(result).toBe('/home/testuser/.codex');
    expect(mockJoinPaths).toHaveBeenCalledWith('/home/testuser', '.codex');
  });

  it('returns common unix codex paths', () => {
    const paths = getCodexCliPaths();
    const joined = paths.join(' ');
    expect(joined).toContain('/usr/local/bin/codex');
    expect(joined).toContain('/opt/homebrew/bin/codex');
  });

  it('finds codex in PATH before local paths', async () => {
    mockFindCliInPath.mockResolvedValue('/usr/local/bin/codex');

    const result = await findCodexCli();
    expect(result).toEqual({ cliPath: '/usr/local/bin/codex', method: 'path' });
    expect(mockFindCliInLocalPaths).not.toHaveBeenCalled();
  });

  it('gets codex version', async () => {
    mockExecFile.mockImplementation((_file, _args, cb) => {
      if (typeof cb === 'function') {
        cb(null, { stdout: 'codex-cli 0.80.0\n', stderr: '' });
      }
      return {} as ReturnType<typeof execFile>;
    });

    const result = await getCodexCliVersion('/usr/local/bin/codex');
    expect(result).toBe('codex-cli 0.80.0');
  });

  it('detects authenticated codex login status', async () => {
    mockExecFile.mockImplementation((_file, args, cb) => {
      if (typeof cb === 'function') {
        if (Array.isArray(args) && args[0] === 'login' && args[1] === 'status') {
          cb(null, { stdout: 'Logged in using ChatGPT\n', stderr: '' });
        } else {
          cb(null, { stdout: '', stderr: '' });
        }
      }
      return {} as ReturnType<typeof execFile>;
    });

    const result = await checkCodexAuth('/usr/local/bin/codex');
    expect(result).toEqual({ authenticated: true });
  });

  it('does not treat "not logged in" as authenticated', async () => {
    mockExecFile.mockImplementation((_file, args, cb) => {
      if (typeof cb === 'function') {
        if (Array.isArray(args) && args[0] === 'login' && args[1] === 'status') {
          cb(null, { stdout: 'Not logged in\n', stderr: '' });
        } else {
          cb(null, { stdout: '', stderr: '' });
        }
      }
      return {} as ReturnType<typeof execFile>;
    });

    const result = await checkCodexAuth('/usr/local/bin/codex');
    expect(result).toEqual({ authenticated: false });
  });

  it('returns full codex status', async () => {
    mockFindCliInPath.mockResolvedValue('/usr/local/bin/codex');
    mockExecFile.mockImplementation((_file, args, cb) => {
      if (typeof cb === 'function') {
        if (Array.isArray(args) && args[0] === '--version') {
          cb(null, { stdout: 'codex-cli 0.80.0\n', stderr: '' });
        } else if (Array.isArray(args) && args[0] === 'login' && args[1] === 'status') {
          cb(null, { stdout: 'Logged in using ChatGPT\n', stderr: '' });
        } else {
          cb(null, { stdout: '', stderr: '' });
        }
      }
      return {} as ReturnType<typeof execFile>;
    });

    const result = await getCodexCliStatus();
    expect(result.installed).toBe(true);
    expect(result.path).toBe('/usr/local/bin/codex');
    expect(result.version).toBe('codex-cli 0.80.0');
    expect(result.auth.authenticated).toBe(true);
  });
});
