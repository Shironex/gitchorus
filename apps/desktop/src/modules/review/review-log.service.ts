import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '@gitchorus/shared';
import type { LogEntry } from '@gitchorus/shared';

const logger = createLogger('ReviewLogService');

/** Maximum number of daily log files to retain */
const MAX_LOG_DAYS = 7;

/**
 * Get today's date formatted as YYYY-MM-DD for log file naming.
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * NestJS Injectable that provides file-based log transport for review.
 *
 * Writes JSONL logs to {app.getPath('userData')}/logs/review-{date}.log.
 * Rotates daily and retains the last 7 days of logs.
 */
@Injectable()
export class ReviewLogService implements OnModuleDestroy {
  private readonly logDir: string;
  private currentDate: string;
  private writeStream: fs.WriteStream | null = null;

  constructor() {
    this.logDir = path.join(app.getPath('userData'), 'logs');
    this.currentDate = getTodayDate();

    // Ensure log directory exists
    try {
      fs.mkdirSync(this.logDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create log directory:', error);
    }

    // Clean up old log files on startup
    this.cleanupOldLogs();
    logger.info(`Log directory: ${this.logDir}`);
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
  getLogEntries(limit: number = 100): LogEntry[] {
    const logFilePath = this.getLogFilePath(getTodayDate());

    try {
      if (!fs.existsSync(logFilePath)) {
        return [];
      }

      const content = fs.readFileSync(logFilePath, 'utf-8');
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
      logger.error('Failed to read log entries:', error);
      return [];
    }
  }

  /**
   * Get the file path for a given date's log file.
   */
  private getLogFilePath(date: string): string {
    return path.join(this.logDir, `review-${date}.log`);
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
        logger.error('Log file write error:', err);
      });
    }
  }

  /**
   * Remove log files older than MAX_LOG_DAYS.
   *
   * Note: This service shares the log directory with ValidationLogService.
   * Each service uses a distinct file prefix (review- vs validation-) to avoid conflicts.
   */
  private cleanupOldLogs(): void {
    try {
      const files = fs.readdirSync(this.logDir);
      const logPattern = /^review-(\d{4}-\d{2}-\d{2})\.log$/;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - MAX_LOG_DAYS);

      for (const file of files) {
        const match = file.match(logPattern);
        if (match) {
          const fileDate = new Date(match[1]);
          if (fileDate < cutoff) {
            fs.unlinkSync(path.join(this.logDir, file));
            logger.debug(`Removed old log file: ${file}`);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to clean up old logs:', error);
    }
  }
}
