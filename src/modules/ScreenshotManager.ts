import { EventEmitter } from 'events';
import { ScreenCaptureModule } from './ScreenCaptureModule';
import { ScreenCapture } from '../shared/types/ScreenCapture';
import { Logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ScreenshotManagerConfig {
  captureIntervalMs: number;
  retentionPeriodMs: number;
  storageDirectory: string;
  maxStorageSizeMB: number;
}

export interface StoredScreenshot {
  id: string;
  timestamp: number;
  filepath: string;
  metadata: {
    resolution: { width: number; height: number };
    windowTitle?: string;
  };
}

export class ScreenshotManager extends EventEmitter {
  private config: ScreenshotManagerConfig;
  private captureModule: ScreenCaptureModule;
  private logger: Logger;
  private captureInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private screenshots: Map<string, StoredScreenshot> = new Map();
  private isRunning: boolean = false;

  constructor(
    config: ScreenshotManagerConfig,
    captureModule: ScreenCaptureModule,
    logger: Logger
  ) {
    super();
    this.config = config;
    this.captureModule = captureModule;
    this.logger = logger;
  }

  public async initialize(): Promise<void> {
    // Ensure storage directory exists
    try {
      await fs.mkdir(this.config.storageDirectory, { recursive: true });
      this.logger.info(`Screenshot storage directory ready: ${this.config.storageDirectory}`);
    } catch (error) {
      this.logger.error('Failed to create storage directory', error);
      throw error;
    }

    // Load existing screenshots from disk
    await this.loadExistingScreenshots();
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('ScreenshotManager is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting screenshot capture system');

    // Start capture interval (1 second)
    this.captureInterval = setInterval(async () => {
      await this.captureScreenshot();
    }, this.config.captureIntervalMs);

    // Start cleanup interval (check every minute)
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupOldScreenshots();
    }, 60000);

    // Initial capture
    await this.captureScreenshot();
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = undefined as any;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined as any;
    }

    this.logger.info('Stopped screenshot capture system');
  }

  private async captureScreenshot(): Promise<void> {
    try {
      const startTime = performance.now();
      
      // Capture the screen
      const capture: ScreenCapture = await this.captureModule.captureScreen();
      
      // Generate unique ID and filename
      const id = `screenshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const filename = `${id}.png`;
      const filepath = path.join(this.config.storageDirectory, filename);

      // Save to disk
      await fs.writeFile(filepath, capture.image);

      // Store metadata
      const screenshot: StoredScreenshot = {
        id,
        timestamp: capture.timestamp,
        filepath,
        metadata: {
          resolution: capture.resolution,
          ...(capture.windowTitle && { windowTitle: capture.windowTitle }),
        },
      };

      this.screenshots.set(id, screenshot);

      // Emit event for other modules
      this.emit('screenshot:captured', {
        id,
        capture,
        filepath,
      });

      const captureTime = performance.now() - startTime;
      this.logger.debug(`Screenshot captured in ${captureTime.toFixed(2)}ms: ${id}`);

    } catch (error) {
      this.logger.error('Failed to capture screenshot', error);
      this.emit('screenshot:error', error);
    }
  }

  private async cleanupOldScreenshots(): Promise<void> {
    const now = Date.now();
    const cutoffTime = now - this.config.retentionPeriodMs;
    const toDelete: string[] = [];

    // Find screenshots older than retention period
    for (const [id, screenshot] of this.screenshots.entries()) {
      if (screenshot.timestamp < cutoffTime) {
        toDelete.push(id);
      }
    }

    // Delete old screenshots
    for (const id of toDelete) {
      const screenshot = this.screenshots.get(id);
      if (screenshot) {
        try {
          await fs.unlink(screenshot.filepath);
          this.screenshots.delete(id);
          this.logger.debug(`Deleted old screenshot: ${id}`);
        } catch (error) {
          this.logger.error(`Failed to delete screenshot ${id}`, error);
        }
      }
    }

    // Check storage size and cleanup if needed
    await this.checkStorageSize();

    if (toDelete.length > 0) {
      this.logger.info(`Cleaned up ${toDelete.length} old screenshots`);
    }
  }

  private async checkStorageSize(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.storageDirectory);
      let totalSize = 0;

      // Calculate total size
      for (const file of files) {
        const filepath = path.join(this.config.storageDirectory, file);
        const stats = await fs.stat(filepath);
        totalSize += stats.size;
      }

      const totalSizeMB = totalSize / (1024 * 1024);

      // If exceeding limit, delete oldest screenshots
      if (totalSizeMB > this.config.maxStorageSizeMB) {
        this.logger.warn(`Storage size (${totalSizeMB.toFixed(2)}MB) exceeds limit (${this.config.maxStorageSizeMB}MB)`);
        
        // Sort by timestamp and delete oldest
        const sorted = Array.from(this.screenshots.values())
          .sort((a, b) => a.timestamp - b.timestamp);

        const targetSize = this.config.maxStorageSizeMB * 0.8; // Target 80% of max
        let currentSize = totalSizeMB;

        for (const screenshot of sorted) {
          if (currentSize <= targetSize) {break;}

          try {
            const stats = await fs.stat(screenshot.filepath);
            await fs.unlink(screenshot.filepath);
            this.screenshots.delete(screenshot.id);
            currentSize -= stats.size / (1024 * 1024);
            this.logger.debug(`Deleted screenshot for storage management: ${screenshot.id}`);
          } catch (error) {
            this.logger.error(`Failed to delete screenshot ${screenshot.id}`, error);
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to check storage size', error);
    }
  }

  private async loadExistingScreenshots(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.storageDirectory);
      
      for (const file of files) {
        if (file.endsWith('.png')) {
          const filepath = path.join(this.config.storageDirectory, file);
          const stats = await fs.stat(filepath);
          
          // Extract ID from filename
          const id = file.replace('.png', '');
          
          // Only load if within retention period
          if (Date.now() - stats.mtimeMs < this.config.retentionPeriodMs) {
            this.screenshots.set(id, {
              id,
              timestamp: stats.mtimeMs,
              filepath,
              metadata: {
                resolution: { width: 0, height: 0 }, // Unknown for existing files
              },
            });
          }
        }
      }

      this.logger.info(`Loaded ${this.screenshots.size} existing screenshots`);
    } catch (error) {
      this.logger.error('Failed to load existing screenshots', error);
    }
  }

  public getRecentScreenshots(count: number = 10): StoredScreenshot[] {
    return Array.from(this.screenshots.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count);
  }

  public async getScreenshotData(id: string): Promise<Buffer | null> {
    const screenshot = this.screenshots.get(id);
    if (!screenshot) {return null;}

    try {
      return await fs.readFile(screenshot.filepath);
    } catch (error) {
      this.logger.error(`Failed to read screenshot ${id}`, error);
      return null;
    }
  }

  public getScreenshotCount(): number {
    return this.screenshots.size;
  }

  public getOldestTimestamp(): number | null {
    if (this.screenshots.size === 0) {return null;}
    
    return Math.min(...Array.from(this.screenshots.values()).map(s => s.timestamp));
  }

  public getNewestTimestamp(): number | null {
    if (this.screenshots.size === 0) {return null;}
    
    return Math.max(...Array.from(this.screenshots.values()).map(s => s.timestamp));
  }
}
