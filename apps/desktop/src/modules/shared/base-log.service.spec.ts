// ---- Mocks ----

const mockMkdirSync = jest.fn();
const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockReaddirSync = jest.fn();
const mockUnlinkSync = jest.fn();
const mockCreateWriteStream = jest.fn();
const mockAccess = jest.fn();
const mockReadFile = jest.fn();

jest.mock('fs', () => ({
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  unlinkSync: (...args: unknown[]) => mockUnlinkSync(...args),
  createWriteStream: (...args: unknown[]) => mockCreateWriteStream(...args),
  promises: {
    access: (...args: unknown[]) => mockAccess(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
  },
}));

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/mock/userData'),
  },
}));

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  log: jest.fn(),
};

jest.mock('@gitchorus/shared', () => {
  const actual = jest.requireActual('@gitchorus/shared');
  return {
    ...actual,
    createLogger: jest.fn(() => mockLogger),
  };
});

import { createLogger } from '@gitchorus/shared';
import { BaseLogService } from './base-log.service';

// Concrete test subclass
class TestLogService extends BaseLogService {
  constructor() {
    super('test');
  }
}

function makeMockWriteStream() {
  return {
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
  };
}

describe('BaseLogService', () => {
  let service: TestLogService;
  let mockStream: ReturnType<typeof makeMockWriteStream>;

  beforeEach(() => {
    // Reset all mocks (clearMocks: true in jest config handles this, but be explicit)
    jest.clearAllMocks();

    // Default: log directory exists, no files to clean up
    mockReaddirSync.mockReturnValue([]);
    mockStream = makeMockWriteStream();
    mockCreateWriteStream.mockReturnValue(mockStream);

    service = new TestLogService();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  describe('constructor', () => {
    it('should create log directory on startup', () => {
      expect(mockMkdirSync).toHaveBeenCalledWith(expect.stringContaining('logs'), {
        recursive: true,
      });
    });

    it('should create logger with prefix-based context', () => {
      expect(createLogger).toHaveBeenCalledWith('testLogService');
    });

    it('should clean up old logs on startup', () => {
      expect(mockReaddirSync).toHaveBeenCalled();
    });

    it('should handle mkdirSync failure gracefully', () => {
      mockMkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Should not throw
      expect(() => new TestLogService()).not.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create log directory:',
        expect.any(Error)
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('should end write stream if one exists', () => {
      // Trigger stream creation by writing
      const transport = service.getLogTransport();
      transport('test message');

      service.onModuleDestroy();

      expect(mockStream.end).toHaveBeenCalled();
    });

    it('should be a no-op if no stream exists', () => {
      // Don't trigger any writes, so no stream
      service.onModuleDestroy();
      // Should not throw
    });
  });

  describe('getLogTransport', () => {
    it('should return a function', () => {
      const transport = service.getLogTransport();
      expect(typeof transport).toBe('function');
    });

    it('should write messages to the stream', () => {
      const transport = service.getLogTransport();
      transport('{"level":"info","message":"hello"}\n');

      expect(mockStream.write).toHaveBeenCalledWith('{"level":"info","message":"hello"}\n');
    });

    it('should create the write stream lazily on first write', () => {
      expect(mockCreateWriteStream).not.toHaveBeenCalled();

      const transport = service.getLogTransport();
      transport('first message');

      expect(mockCreateWriteStream).toHaveBeenCalledTimes(1);
      expect(mockCreateWriteStream).toHaveBeenCalledWith(
        expect.stringMatching(/test-\d{4}-\d{2}-\d{2}\.log$/),
        { flags: 'a' }
      );
    });

    it('should register an error handler on the stream', () => {
      const transport = service.getLogTransport();
      transport('message');

      expect(mockStream.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('getLogEntries', () => {
    it('should return empty array if log file does not exist', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const entries = await service.getLogEntries();
      expect(entries).toEqual([]);
    });

    it('should parse JSONL entries from log file', async () => {
      const logLines = [
        JSON.stringify({
          timestamp: '2026-01-01T00:00:00Z',
          level: 'info',
          context: 'Test',
          message: 'hello',
        }),
        JSON.stringify({
          timestamp: '2026-01-01T00:00:01Z',
          level: 'error',
          context: 'Test',
          message: 'oops',
        }),
      ].join('\n');

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(logLines);

      const entries = await service.getLogEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0].message).toBe('hello');
      expect(entries[1].message).toBe('oops');
    });

    it('should return the last N entries when limit is specified', async () => {
      const lines = Array.from({ length: 10 }, (_, i) =>
        JSON.stringify({
          timestamp: `2026-01-01T00:00:0${i}Z`,
          level: 'info',
          context: 'Test',
          message: `msg${i}`,
        })
      ).join('\n');

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(lines);

      const entries = await service.getLogEntries(3);
      expect(entries).toHaveLength(3);
      expect(entries[0].message).toBe('msg7');
      expect(entries[1].message).toBe('msg8');
      expect(entries[2].message).toBe('msg9');
    });

    it('should skip malformed JSONL lines', async () => {
      const logLines = [
        JSON.stringify({
          timestamp: '2026-01-01T00:00:00Z',
          level: 'info',
          context: 'Test',
          message: 'valid',
        }),
        'this is not json',
        JSON.stringify({
          timestamp: '2026-01-01T00:00:02Z',
          level: 'info',
          context: 'Test',
          message: 'also valid',
        }),
      ].join('\n');

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(logLines);

      const entries = await service.getLogEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0].message).toBe('valid');
      expect(entries[1].message).toBe('also valid');
    });

    it('should handle read errors gracefully', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockRejectedValue(new Error('read error'));

      const entries = await service.getLogEntries();
      expect(entries).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to read log entries:',
        expect.any(Error)
      );
    });

    it('should use default limit of 100', async () => {
      const lines = Array.from({ length: 150 }, (_, i) =>
        JSON.stringify({
          timestamp: `2026-01-01T00:00:00Z`,
          level: 'info',
          context: 'Test',
          message: `msg${i}`,
        })
      ).join('\n');

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(lines);

      const entries = await service.getLogEntries();
      expect(entries).toHaveLength(100);
      expect(entries[0].message).toBe('msg50');
    });

    it('should handle empty log file', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue('');

      const entries = await service.getLogEntries();
      expect(entries).toEqual([]);
    });
  });

  describe('daily rotation', () => {
    it('should create a new stream when the date changes', () => {
      const transport = service.getLogTransport();

      // First write — creates initial stream
      transport('message 1');
      expect(mockCreateWriteStream).toHaveBeenCalledTimes(1);

      // Simulate date change by mocking Date
      const originalDate = global.Date;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // Override Date to return tomorrow
      const mockDate = class extends originalDate {
        constructor() {
          super();
          return tomorrow;
        }

        static now() {
          return tomorrow.getTime();
        }
      } as DateConstructor;

      global.Date = mockDate;

      const newStream = makeMockWriteStream();
      mockCreateWriteStream.mockReturnValue(newStream);

      // Second write — should detect date change and create new stream
      transport('message 2');

      expect(mockCreateWriteStream).toHaveBeenCalledTimes(2);
      expect(mockCreateWriteStream).toHaveBeenLastCalledWith(
        expect.stringContaining(`test-${tomorrowStr}.log`),
        { flags: 'a' }
      );
      // Old stream should be ended
      expect(mockStream.end).toHaveBeenCalled();

      global.Date = originalDate;
    });
  });

  describe('cleanupOldLogs', () => {
    it('should remove log files older than 7 days', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      const oldDateStr = oldDate.toISOString().split('T')[0];

      mockReaddirSync.mockReturnValue([`test-${oldDateStr}.log`]);

      // Re-create service to trigger cleanup with mocked files
      service = new TestLogService();

      expect(mockUnlinkSync).toHaveBeenCalledWith(
        expect.stringContaining(`test-${oldDateStr}.log`)
      );
    });

    it('should not remove recent log files', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3);
      const recentDateStr = recentDate.toISOString().split('T')[0];

      mockReaddirSync.mockReturnValue([`test-${recentDateStr}.log`]);

      service = new TestLogService();

      expect(mockUnlinkSync).not.toHaveBeenCalled();
    });

    it('should only remove files matching its own prefix', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      const oldDateStr = oldDate.toISOString().split('T')[0];

      mockReaddirSync.mockReturnValue([
        `test-${oldDateStr}.log`,
        `other-${oldDateStr}.log`,
        `validation-${oldDateStr}.log`,
        'random-file.txt',
      ]);

      service = new TestLogService();

      // Should only delete the test- prefixed file
      expect(mockUnlinkSync).toHaveBeenCalledTimes(1);
      expect(mockUnlinkSync).toHaveBeenCalledWith(
        expect.stringContaining(`test-${oldDateStr}.log`)
      );
    });

    it('should handle cleanup errors gracefully', () => {
      mockReaddirSync.mockImplementation(() => {
        throw new Error('readdir failed');
      });

      // Should not throw
      expect(() => new TestLogService()).not.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to clean up old logs:',
        expect.any(Error)
      );
    });
  });
});
