/**
 * Structured logging utility with multiple output levels
 * 
 * Provides centralized logging with configurable levels, structured formatting,
 * and environment-aware output handling for debugging and monitoring.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Available logging levels in order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Structured log entry interface
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  metadata?: Record<string, unknown>;
  error?: Error;
}

/**
 * Logger configuration interface
 */
export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  logDirectory?: string;
  maxFileSize?: number; // in bytes
  maxFiles?: number;
}

/**
 * Centralized logging utility with structured output and level filtering
 */
export class Logger {
  private readonly component: string;
  private readonly config: LoggerConfig;
  private static globalConfig: LoggerConfig = {
    level: LogLevel.INFO,
    enableConsole: true,
    enableFile: false,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
  };

  constructor(component: string, config?: Partial<LoggerConfig>) {
    this.component = component;
    this.config = { ...Logger.globalConfig, ...config };
    
    // Set log level from environment variable if available
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    if (envLevel && LogLevel[envLevel as keyof typeof LogLevel] !== undefined) {
      this.config.level = LogLevel[envLevel as keyof typeof LogLevel];
    }

    this.initializeFileLogging();
  }

  /**
   * Configure global logger settings
   */
  public static configure(config: Partial<LoggerConfig>): void {
    Logger.globalConfig = { ...Logger.globalConfig, ...config };
  }

  /**
   * Log a debug message
   */
  public debug(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Log an info message
   */
  public info(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * Log a warning message
   */
  public warn(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Log an error message
   */
  public error(message: string, error?: Error | unknown, metadata?: Record<string, unknown>): void {
    const errorObj = error instanceof Error ? error : undefined;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      component: this.component,
      message,
      ...(metadata && { metadata }),
      ...(errorObj && { error: errorObj }),
    };

    this.writeLog(entry);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    if (level < this.config.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: this.component,
      message,
      ...(metadata && { metadata }),
    };

    this.writeLog(entry);
  }

  /**
   * Write log entry to configured outputs
   */
  private writeLog(entry: LogEntry): void {
    const formattedMessage = this.formatLogEntry(entry);

    if (this.config.enableConsole) {
      this.writeToConsole(entry, formattedMessage);
    }

    if (this.config.enableFile) {
      this.writeToFile(formattedMessage);
    }
  }

  /**
   * Format log entry for output
   */
  private formatLogEntry(entry: LogEntry): string {
    const levelStr = LogLevel[entry.level].padEnd(5);
    const metadataStr = entry.metadata ? ` | ${JSON.stringify(entry.metadata)}` : '';
    const errorStr = entry.error ? ` | Error: ${entry.error.message}\n${entry.error.stack}` : '';
    
    return `${entry.timestamp} | ${levelStr} | ${entry.component} | ${entry.message}${metadataStr}${errorStr}`;
  }

  /**
   * Write to console with appropriate styling
   */
  private writeToConsole(entry: LogEntry, message: string): void {
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(message);
        break;
      case LogLevel.INFO:
        console.info(message);
        break;
      case LogLevel.WARN:
        console.warn(message);
        break;
      case LogLevel.ERROR:
        console.error(message);
        break;
    }
  }

  /**
   * Initialize file logging if enabled
   */
  private initializeFileLogging(): void {
    if (!this.config.enableFile || !this.config.logDirectory) {
      return;
    }

    try {
      if (!fs.existsSync(this.config.logDirectory)) {
        fs.mkdirSync(this.config.logDirectory, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to initialize log directory:', error);
      this.config.enableFile = false;
    }
  }

  /**
   * Write to log file with rotation
   */
  private writeToFile(message: string): void {
    if (!this.config.logDirectory) {
      return;
    }

    try {
      const logFile = path.join(this.config.logDirectory, 'application.log');
      fs.appendFileSync(logFile, message + '\n');
      
      // Check if rotation is needed
      this.rotateLogFileIfNeeded(logFile);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Rotate log file if it exceeds maximum size
   */
  private rotateLogFileIfNeeded(logFile: string): void {
    try {
      const stats = fs.statSync(logFile);
      if (stats.size > (this.config.maxFileSize || 10 * 1024 * 1024)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedFile = logFile.replace('.log', `_${timestamp}.log`);
        fs.renameSync(logFile, rotatedFile);
        
        // Clean up old files
        this.cleanupOldLogFiles();
      }
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  /**
   * Remove old log files beyond retention limit
   */
  private cleanupOldLogFiles(): void {
    if (!this.config.logDirectory) {
      return;
    }

    try {
      const files = fs.readdirSync(this.config.logDirectory)
        .filter(file => file.endsWith('.log') && file !== 'application.log')
        .map(file => ({
          name: file,
          path: path.join(this.config.logDirectory!, file),
          mtime: fs.statSync(path.join(this.config.logDirectory!, file)).mtime,
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Remove excess files
      const maxFiles = this.config.maxFiles || 5;
      if (files.length > maxFiles) {
        files.slice(maxFiles).forEach(file => {
          fs.unlinkSync(file.path);
        });
      }
    } catch (error) {
      console.error('Failed to cleanup old log files:', error);
    }
  }
}