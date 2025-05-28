/**
 * Configuration Management Utility
 * 
 * Centralizes application configuration with environment variable support,
 * validation, and type safety. Provides structured access to all application
 * settings with proper defaults and validation.
 */

import { Logger } from './logger';

const logger = new Logger('ConfigManager');

/**
 * Application configuration interface with all required settings
 */
export interface AppConfig {
  // Application settings
  app: {
    name: string;
    version: string;
    isDevelopment: boolean;
    logLevel: string;
  };
  
  // Window settings
  window: {
    width: number;
    height: number;
    minWidth: number;
    minHeight: number;
    resizable: boolean;
    alwaysOnTop: boolean;
    transparent: boolean;
  };
  
  // Performance settings
  performance: {
    enableMetrics: boolean;
    sampleRate: number;
    maxMemoryUsage: number;
  };
  
  // OCR settings
  ocr: {
    language: string;
    confidence: number;
    enablePreprocessing: boolean;
  };
  
  // API settings
  api: {
    timeout: number;
    retries: number;
    baseUrl?: string;
    aiApiKey: string; // REQUIRED: AI API key for external services
    dbSecret?: string | undefined; // OPTIONAL: DB secret for advanced features
  };
}

/**
 * Environment variable configuration schema
 */
interface EnvConfig {
  NODE_ENV?: string;
  LOG_LEVEL?: string;
  WINDOW_WIDTH?: string;
  WINDOW_HEIGHT?: string;
  OCR_LANGUAGE?: string;
  OCR_CONFIDENCE?: string;
  API_TIMEOUT?: string;
  API_RETRIES?: string;
  API_BASE_URL?: string;
  ENABLE_METRICS?: string;
  PERFORMANCE_SAMPLE_RATE?: string;
  MAX_MEMORY_USAGE?: string;
  AI_API_KEY?: string; // REQUIRED
  DB_SECRET?: string;  // OPTIONAL
}

/**
 * Configuration manager with environment variable support and validation
 */
export class ConfigurationManager {
  private static instance: ConfigurationManager;
  private config: AppConfig;

  private constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
    logger.info('Configuration loaded successfully', { 
      environment: this.config.app.isDevelopment ? 'development' : 'production' 
    });
  }

  /**
   * Get singleton instance of configuration manager
   */
  public static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  /**
   * Get complete application configuration
   */
  public getConfig(): AppConfig {
    return { ...this.config };
  }

  /**
   * Get specific configuration section
   */
  public getSection<K extends keyof AppConfig>(section: K): AppConfig[K] {
    return { ...this.config[section] };
  }

  /**
   * Get specific configuration value with type safety
   */
  public getValue<K extends keyof AppConfig, T extends keyof AppConfig[K]>(
    section: K,
    key: T
  ): AppConfig[K][T] {
    return this.config[section][key];
  }

  /**
   * Update configuration section (for runtime updates)
   */
  public updateSection<K extends keyof AppConfig>(
    section: K,
    updates: Partial<AppConfig[K]>
  ): void {
    this.config[section] = { ...this.config[section], ...updates };
    logger.debug('Configuration section updated', { section, updates });
  }

  /**
   * Check if running in development mode
   */
  public isDevelopment(): boolean {
    return this.config.app.isDevelopment;
  }

  /**
   * Load configuration from environment variables with defaults
   */
  private loadConfiguration(): AppConfig {
    const env = process.env as EnvConfig;
    
    return {
      app: {
        name: 'CoinPoker Intelligence Assistant',
        version: '1.0.0',
        isDevelopment: env['NODE_ENV'] !== 'production',
        logLevel: env['LOG_LEVEL'] || 'info',
      },
      
      window: {
        width: this.parseNumber(env['WINDOW_WIDTH'], 1200),
        height: this.parseNumber(env['WINDOW_HEIGHT'], 800),
        minWidth: 800,
        minHeight: 600,
        resizable: true,
        alwaysOnTop: false,
        transparent: false,
      },
      
      performance: {
        enableMetrics: this.parseBoolean(env['ENABLE_METRICS'], true),
        sampleRate: this.parseNumber(env['PERFORMANCE_SAMPLE_RATE'], 0.1),
        maxMemoryUsage: this.parseNumber(env['MAX_MEMORY_USAGE'], 512 * 1024 * 1024), // 512MB
      },
      
      ocr: {
        language: env['OCR_LANGUAGE'] || 'eng',
        confidence: this.parseNumber(env['OCR_CONFIDENCE'], 0.8),
        enablePreprocessing: true,
      },
      
      api: {
        timeout: this.parseNumber(env['API_TIMEOUT'], 30000),
        retries: this.parseNumber(env['API_RETRIES'], 3),
        ...(env['API_BASE_URL'] && { baseUrl: env['API_BASE_URL'] }),
        aiApiKey: env['AI_API_KEY'] || '', // Will be validated as required
        dbSecret: env['DB_SECRET'], // Optional
      },
    };
  }

  /**
   * Validate configuration values
   */
  private validateConfiguration(): void {
    const errors: string[] = [];

    // Validate window dimensions
    if (this.config.window.width < 400) {
      errors.push('Window width must be at least 400px');
    }
    if (this.config.window.height < 300) {
      errors.push('Window height must be at least 300px');
    }

    // Validate OCR confidence
    if (this.config.ocr.confidence < 0 || this.config.ocr.confidence > 1) {
      errors.push('OCR confidence must be between 0 and 1');
    }

    // Validate performance settings
    if (this.config.performance.sampleRate < 0 || this.config.performance.sampleRate > 1) {
      errors.push('Performance sample rate must be between 0 and 1');
    }

    // Validate API settings
    if (this.config.api.timeout < 1000) {
      errors.push('API timeout must be at least 1000ms');
    }
    if (this.config.api.retries < 0) {
      errors.push('API retries must be non-negative');
    }
    // Validate required secrets
    if (!this.config.api.aiApiKey || this.config.api.aiApiKey.trim() === '') {
      errors.push('Missing required environment variable: AI_API_KEY');
    }
    // Optional: dbSecret is not required, but warn if missing and advanced features are enabled

    if (errors.length > 0) {
      const errorMessage = `Configuration validation failed: ${errors.join(', ')}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Parse string to number with fallback
   */
  private parseNumber(value: string | undefined, defaultValue: number): number {
    if (!value) {return defaultValue;}
    const parsed = Number(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Parse string to boolean with fallback
   */
  private parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
    if (!value) {return defaultValue;}
    return value.toLowerCase() === 'true' || value === '1';
  }

  /**
   * Export configuration to JSON (for debugging)
   */
  public toJSON(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Reload configuration from environment (for hot reloading)
   */
  public reload(): void {
    logger.info('Reloading configuration');
    this.config = this.loadConfiguration();
    this.validateConfiguration();
    logger.info('Configuration reloaded successfully');
  }
}