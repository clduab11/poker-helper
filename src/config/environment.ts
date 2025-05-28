/**
 * Environment variable configuration with proper TypeScript typing
 * Provides safe access to environment variables with defaults and validation
 */

interface EnvironmentConfig {
  // API Keys
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  
  // Environment
  NODE_ENV: 'development' | 'production' | 'test';
  
  // Logging
  LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error';
  
  // Application
  PORT?: string;
  HOST?: string;
}

class Environment {
  private config: EnvironmentConfig;

  constructor() {
    this.config = this.parseEnvironmentVariables();
    this.validateRequired();
  }

  private parseEnvironmentVariables(): EnvironmentConfig {
    return {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
      NODE_ENV: (process.env.NODE_ENV as any) || 'development',
      LOG_LEVEL: process.env.LOG_LEVEL as any,
      PORT: process.env.PORT,
      HOST: process.env.HOST,
    };
  }

  private validateRequired(): void {
    const required: (keyof EnvironmentConfig)[] = ['NODE_ENV'];
    
    for (const key of required) {
      if (!this.config[key]) {
        throw new Error(`Required environment variable ${key} is not set`);
      }
    }
  }

  // Getters with defaults
  get openaiApiKey(): string {
    return this.config.OPENAI_API_KEY || '';
  }

  get anthropicApiKey(): string {
    return this.config.ANTHROPIC_API_KEY || '';
  }

  get googleApiKey(): string {
    return this.config.GOOGLE_API_KEY || '';
  }

  get nodeEnv(): 'development' | 'production' | 'test' {
    return this.config.NODE_ENV;
  }

  get logLevel(): 'debug' | 'info' | 'warn' | 'error' {
    return this.config.LOG_LEVEL || 'info';
  }

  get port(): number {
    return parseInt(this.config.PORT || '3000', 10);
  }

  get host(): string {
    return this.config.HOST || 'localhost';
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }
}

// Export singleton instance
export const env = new Environment();
export default env;