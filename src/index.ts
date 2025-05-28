/**
 * CoinPoker Intelligence Assistant - Main Entry Point
 * 
 * Real-time poker analysis tool providing LLM-powered recommendations
 * through screenshot analysis and UI overlay integration.
 * 
 * @author CoinPoker Intelligence Assistant Team
 * @version 1.0.0
 */

import { app, BrowserWindow } from 'electron';
import path from 'path';
import { Logger } from './utils/logger';
import { PerformanceMonitor } from './utils/performance';

const logger = new Logger('MainProcess');

/**
 * Application configuration and state
 */
class PokerIntelligenceApp {
  private mainWindow: BrowserWindow | null = null;
  private performanceMonitor: PerformanceMonitor;

  constructor() {
    this.performanceMonitor = PerformanceMonitor.getInstance();
    this.initializeElectronApp();
  }

  /**
   * Initialize Electron application with security settings
   */
  private initializeElectronApp(): void {
    // Enable live reload for Electron in development
    if (process.env['NODE_ENV'] === 'development') {
      require('electron-reload')(__dirname, {
        electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
        hardResetMethod: 'exit'
      });
    }

    app.whenReady().then(() => {
      this.createMainWindow();
      this.setupApplicationHandlers();
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createMainWindow();
      }
    });
  }

  /**
   * Create the main application window with security configurations
   */
  private createMainWindow(): void {
    try {
      this.mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          preload: path.join(__dirname, 'preload.js')
        },
        show: false,
        titleBarStyle: 'hiddenInset'
      });

      // Load the main UI
      this.mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));

      // Show window when ready to prevent visual flash
      this.mainWindow.once('ready-to-show', () => {
        this.mainWindow?.show();
        logger.info('Main window initialized successfully');
      });

      this.mainWindow.on('closed', () => {
        this.mainWindow = null;
      });

    } catch (error) {
      logger.error('Failed to create main window:', error);
      app.quit();
    }
  }

  /**
   * Setup application-level event handlers
   */
  private setupApplicationHandlers(): void {
    // Handle application errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.gracefulShutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', undefined, { promise: String(promise), reason: String(reason) });
    });

    // Performance monitoring is automatically started in constructor
    logger.debug('Performance monitoring initialized');
  }

  /**
   * Gracefully shutdown the application
   */
  private gracefulShutdown(): void {
    logger.info('Initiating graceful shutdown...');
    
    this.performanceMonitor.stop();
    
    if (this.mainWindow) {
      this.mainWindow.close();
    }
    
    app.quit();
  }
}

// Initialize the application
const pokerApp = new PokerIntelligenceApp();

export default pokerApp;
