import { OnModuleDestroy } from '@nestjs/common';
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '@gitchorus/shared';
import type { LogEntry, Logger } from '@gitchorus/shared';

/** Maximum number of daily log files to retain */
const MAX_LOG_DAYS = 7;

/**
 * Get today's date formatted as YYYY-MM-DD for log file naming.
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Abstract base class for file-based JSONL log services.
 *
 * Writes JSONL logs to {app.getPath('userData')}/logs/{prefix}-{date}.log.
 * Rotates daily and retains the last {@link MAX_LOG_DAYS} days of logs.
 *
 * Concrete subclasses only need to call `super(prefix)` in their constructor.
 */
export abstract class BaseLogService implements OnModuleDestroy {
  private readonly logDir: string;
  private readonly logger: Logger;
  private readonly logPattern: RegExp;
  private currentDate: string;
  private writeStream: fs.WriteStream | null = null;

  constructor(private readonly logPrefix: string) {
    this.logger = createLogger(`${logPrefix}LogService`);
    this.logPattern = new RegExp(`^${logPrefix}-(\\d{4}-\\d{2}-\\d{2})\\.log$`);
    this.logDir = path.join(app.getPath('userData'), 'logs');
    this.currentDate = getTodayDate();

    // Ensure log directory exists
    try {
      fs.mkdirSync(this.logDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create log directory:', error);
    }

    // Clean up old log files on startup
    this.cleanupOldLogs();
    this.logger.info(`Log directory: ${this.logDir}`);
  }

  onModuleDestroy(): void {
    if (this.writeStream) {
      this.writeStream.end();
      this.writeStream = null;
    }
  }

  /**
   * Get a file transport function compatible with createLogger({ fileTransport }).
   * The transport writes JSONL-formatted messages to the current day's log file.
   */
  getLogTransport(): (message: string) => void {
    return (message: string) => {
      this.ensureCurrentStream();
      if (this.writeStream) {
        this.writeStream.write(message);
      }
    };
  }

  /**
   * Get recent log entries from the current log file.
   * Returns the most recent `limit` entries (default 100).
   */
  async getLogEntries(limit: number = 100): Promise<LogEntry[]> {
    const logFilePath = this.getLogFilePath(getTodayDate());

    try {
      try {
        await fs.promises.access(logFilePath);
      } catch {
        return [];
      }

      const content = await fs.promises.readFile(logFilePath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      // Take last N lines
      const recentLines = lines.slice(-limit);

      const entries: LogEntry[] = [];
      for (const line of recentLines) {
        try {
          const entry = JSON.parse(line) as LogEntry;
          entries.push(entry);
        } catch {
          // Skip malformed lines
        }
      }

      return entries;
    } catch (error) {
      this.logger.error('Failed to read log entries:', error);
      return [];
    }
  }

  /**
   * Get the file path for a given date's log file.
   */
  private getLogFilePath(date: string): string {
    return path.join(this.logDir, `${this.logPrefix}-${date}.log`);
  }

  /**
   * Ensure the write stream points to the current day's log file.
   * Rotates the stream if the day has changed.
   */
  private ensureCurrentStream(): void {
    const today = getTodayDate();

    if (today !== this.currentDate || !this.writeStream) {
      // Close previous stream
      if (this.writeStream) {
        this.writeStream.end();
      }

      this.currentDate = today;
      const logFilePath = this.getLogFilePath(today);

      this.writeStream = fs.createWriteStream(logFilePath, { flags: 'a' });
      this.writeStream.on('error', err => {
        this.logger.error('Log file write error:', err);
      });
    }
  }

  /**
   * Remove log files older than MAX_LOG_DAYS.
   * Each concrete service manages only its own prefixed files for safe concurrent cleanup.
   */
  private cleanupOldLogs(): void {
    try {
      const files = fs.readdirSync(this.logDir);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - MAX_LOG_DAYS);

      for (const file of files) {
        const match = file.match(this.logPattern);
        if (match) {
          const fileDate = new Date(match[1]);
          if (fileDate < cutoff) {
            fs.unlinkSync(path.join(this.logDir, file));
            this.logger.debug(`Removed old log file: ${file}`);
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to clean up old logs:', error);
    }
  }
}
