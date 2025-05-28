/**
 * Electron Preload Script for CoinPoker Intelligence Assistant
 * 
 * Provides secure IPC bridge between renderer and main processes.
 * Exposes controlled APIs for poker game state management, security,
 * and overlay functionality while maintaining security isolation.
 * 
 * Security Features:
 * - Context isolation enabled
 * - Node integration disabled in renderer
 * - Controlled API exposure via contextBridge
 * - Input validation and sanitization
 * - Rate limiting for API calls
 */

import { contextBridge, ipcRenderer } from 'electron';
import { GameState } from '../shared/types/GameState';
import { Recommendation } from '../shared/types/Recommendation';
import { SecurityProfile } from '../shared/types/Security';

// Rate limiting configuration
const RATE_LIMITS = {
  gameStateUpdate: { maxCalls: 10, windowMs: 1000 }, // 10 calls per second
  getRecommendation: { maxCalls: 5, windowMs: 1000 }, // 5 calls per second
  screenshot: { maxCalls: 2, windowMs: 1000 }, // 2 calls per second
  securityCheck: { maxCalls: 1, windowMs: 5000 }, // 1 call per 5 seconds
};

// Rate limiting state
const rateLimitState = new Map<string, { calls: number; resetTime: number }>();

/**
 * Rate limiting utility
 */
function checkRateLimit(operation: string): boolean {
  const limit = RATE_LIMITS[operation as keyof typeof RATE_LIMITS];
  if (!limit) return true;

  const now = Date.now();
  const state = rateLimitState.get(operation) || { calls: 0, resetTime: now + limit.windowMs };

  // Reset if window has passed
  if (now > state.resetTime) {
    state.calls = 0;
    state.resetTime = now + limit.windowMs;
  }

  // Check if limit exceeded
  if (state.calls >= limit.maxCalls) {
    return false;
  }

  state.calls++;
  rateLimitState.set(operation, state);
  return true;
}

/**
 * Input validation utilities
 */
function validateGameState(gameState: any): gameState is GameState {
  return (
    typeof gameState === 'object' &&
    gameState !== null &&
    typeof gameState.timestamp === 'number' &&
    typeof gameState.phase === 'string' &&
    Array.isArray(gameState.players)
  );
}

function validateString(value: any, maxLength = 1000): value is string {
  return typeof value === 'string' && value.length <= maxLength;
}

function validateNumber(value: any, min = 0, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && value >= min && value <= max;
}

/**
 * Secure API interface for renderer process
 */
interface PokerHelperAPI {
  // Game State Management
  gameState: {
    getCurrent(): Promise<GameState | null>;
    update(gameState: GameState): Promise<boolean>;
    getHistory(limit?: number): Promise<GameState[]>;
    subscribe(callback: (gameState: GameState) => void): () => void;
  };

  // Recommendations
  recommendations: {
    generate(gameState: GameState, options?: any): Promise<Recommendation>;
    getCurrent(): Promise<Recommendation[]>;
    subscribe(callback: (recommendation: Recommendation) => void): () => void;
  };

  // Screen Capture
  capture: {
    takeScreenshot(options?: { region?: { x: number; y: number; width: number; height: number } }): Promise<string>;
    startMonitoring(interval?: number): Promise<boolean>;
    stopMonitoring(): Promise<boolean>;
    getLastCapture(): Promise<string | null>;
  };

  // Security
  security: {
    getCurrentProfile(): Promise<SecurityProfile>;
    checkStatus(): Promise<{ safe: boolean; risks: string[]; footprint: any }>;
    updateProfile(profile: Partial<SecurityProfile>): Promise<boolean>;
    getEventLog(limit?: number): Promise<any[]>;
  };

  // Overlay Management
  overlay: {
    show(): Promise<boolean>;
    hide(): Promise<boolean>;
    setPosition(x: number, y: number): Promise<boolean>;
    setSize(width: number, height: number): Promise<boolean>;
    setOpacity(opacity: number): Promise<boolean>;
    setAlwaysOnTop(alwaysOnTop: boolean): Promise<boolean>;
  };

  // Configuration
  config: {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<boolean>;
    getAll(): Promise<Record<string, any>>;
    reset(): Promise<boolean>;
  };

  // System
  system: {
    getVersion(): Promise<string>;
    getMetrics(): Promise<any>;
    checkForUpdates(): Promise<{ available: boolean; version?: string }>;
    restart(): Promise<void>;
  };

  // Events
  events: {
    on(event: string, callback: (...args: any[]) => void): () => void;
    emit(event: string, ...args: any[]): Promise<boolean>;
  };
}

/**
 * Implementation of the secure API
 */
const pokerHelperAPI: PokerHelperAPI = {
  // Game State Management
  gameState: {
    async getCurrent(): Promise<GameState | null> {
      if (!checkRateLimit('gameStateUpdate')) {
        throw new Error('Rate limit exceeded for gameState.getCurrent');
      }
      return ipcRenderer.invoke('gameState:getCurrent');
    },

    async update(gameState: GameState): Promise<boolean> {
      if (!checkRateLimit('gameStateUpdate')) {
        throw new Error('Rate limit exceeded for gameState.update');
      }
      if (!validateGameState(gameState)) {
        throw new Error('Invalid game state provided');
      }
      return ipcRenderer.invoke('gameState:update', gameState);
    },

    async getHistory(limit = 50): Promise<GameState[]> {
      if (!validateNumber(limit, 1, 1000)) {
        throw new Error('Invalid limit provided');
      }
      return ipcRenderer.invoke('gameState:getHistory', limit);
    },

    subscribe(callback: (gameState: GameState) => void): () => void {
      const listener = (_event: any, gameState: GameState) => {
        if (validateGameState(gameState)) {
          callback(gameState);
        }
      };
      ipcRenderer.on('gameState:updated', listener);
      return () => ipcRenderer.removeListener('gameState:updated', listener);
    },
  },

  // Recommendations
  recommendations: {
    async generate(gameState: GameState, options = {}): Promise<Recommendation> {
      if (!checkRateLimit('getRecommendation')) {
        throw new Error('Rate limit exceeded for recommendations.generate');
      }
      if (!validateGameState(gameState)) {
        throw new Error('Invalid game state provided');
      }
      return ipcRenderer.invoke('recommendations:generate', gameState, options);
    },

    async getCurrent(): Promise<Recommendation[]> {
      return ipcRenderer.invoke('recommendations:getCurrent');
    },

    subscribe(callback: (recommendation: Recommendation) => void): () => void {
      const listener = (_event: any, recommendation: Recommendation) => {
        callback(recommendation);
      };
      ipcRenderer.on('recommendations:updated', listener);
      return () => ipcRenderer.removeListener('recommendations:updated', listener);
    },
  },

  // Screen Capture
  capture: {
    async takeScreenshot(options = {}): Promise<string> {
      if (!checkRateLimit('screenshot')) {
        throw new Error('Rate limit exceeded for capture.takeScreenshot');
      }
      return ipcRenderer.invoke('capture:takeScreenshot', options);
    },

    async startMonitoring(interval = 1000): Promise<boolean> {
      if (!validateNumber(interval, 100, 10000)) {
        throw new Error('Invalid interval provided');
      }
      return ipcRenderer.invoke('capture:startMonitoring', interval);
    },

    async stopMonitoring(): Promise<boolean> {
      return ipcRenderer.invoke('capture:stopMonitoring');
    },

    async getLastCapture(): Promise<string | null> {
      return ipcRenderer.invoke('capture:getLastCapture');
    },
  },

  // Security
  security: {
    async getCurrentProfile(): Promise<SecurityProfile> {
      if (!checkRateLimit('securityCheck')) {
        throw new Error('Rate limit exceeded for security.getCurrentProfile');
      }
      return ipcRenderer.invoke('security:getCurrentProfile');
    },

    async checkStatus(): Promise<{ safe: boolean; risks: string[]; footprint: any }> {
      if (!checkRateLimit('securityCheck')) {
        throw new Error('Rate limit exceeded for security.checkStatus');
      }
      return ipcRenderer.invoke('security:checkStatus');
    },

    async updateProfile(profile: Partial<SecurityProfile>): Promise<boolean> {
      return ipcRenderer.invoke('security:updateProfile', profile);
    },

    async getEventLog(limit = 100): Promise<any[]> {
      if (!validateNumber(limit, 1, 1000)) {
        throw new Error('Invalid limit provided');
      }
      return ipcRenderer.invoke('security:getEventLog', limit);
    },
  },

  // Overlay Management
  overlay: {
    async show(): Promise<boolean> {
      return ipcRenderer.invoke('overlay:show');
    },

    async hide(): Promise<boolean> {
      return ipcRenderer.invoke('overlay:hide');
    },

    async setPosition(x: number, y: number): Promise<boolean> {
      if (!validateNumber(x, -10000, 10000) || !validateNumber(y, -10000, 10000)) {
        throw new Error('Invalid position coordinates');
      }
      return ipcRenderer.invoke('overlay:setPosition', x, y);
    },

    async setSize(width: number, height: number): Promise<boolean> {
      if (!validateNumber(width, 100, 5000) || !validateNumber(height, 100, 5000)) {
        throw new Error('Invalid size dimensions');
      }
      return ipcRenderer.invoke('overlay:setSize', width, height);
    },

    async setOpacity(opacity: number): Promise<boolean> {
      if (!validateNumber(opacity, 0, 1)) {
        throw new Error('Invalid opacity value');
      }
      return ipcRenderer.invoke('overlay:setOpacity', opacity);
    },

    async setAlwaysOnTop(alwaysOnTop: boolean): Promise<boolean> {
      if (typeof alwaysOnTop !== 'boolean') {
        throw new Error('Invalid alwaysOnTop value');
      }
      return ipcRenderer.invoke('overlay:setAlwaysOnTop', alwaysOnTop);
    },
  },

  // Configuration
  config: {
    async get(key: string): Promise<any> {
      if (!validateString(key, 100)) {
        throw new Error('Invalid config key');
      }
      return ipcRenderer.invoke('config:get', key);
    },

    async set(key: string, value: any): Promise<boolean> {
      if (!validateString(key, 100)) {
        throw new Error('Invalid config key');
      }
      return ipcRenderer.invoke('config:set', key, value);
    },

    async getAll(): Promise<Record<string, any>> {
      return ipcRenderer.invoke('config:getAll');
    },

    async reset(): Promise<boolean> {
      return ipcRenderer.invoke('config:reset');
    },
  },

  // System
  system: {
    async getVersion(): Promise<string> {
      return ipcRenderer.invoke('system:getVersion');
    },

    async getMetrics(): Promise<any> {
      return ipcRenderer.invoke('system:getMetrics');
    },

    async checkForUpdates(): Promise<{ available: boolean; version?: string }> {
      return ipcRenderer.invoke('system:checkForUpdates');
    },

    async restart(): Promise<void> {
      return ipcRenderer.invoke('system:restart');
    },
  },

  // Events
  events: {
    on(event: string, callback: (...args: any[]) => void): () => void {
      if (!validateString(event, 50)) {
        throw new Error('Invalid event name');
      }
      ipcRenderer.on(event, callback);
      return () => ipcRenderer.removeListener(event, callback);
    },

    async emit(event: string, ...args: any[]): Promise<boolean> {
      if (!validateString(event, 50)) {
        throw new Error('Invalid event name');
      }
      return ipcRenderer.invoke('events:emit', event, ...args);
    },
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('pokerHelper', pokerHelperAPI);

// Expose development tools in development mode
if (process.env['NODE_ENV'] === 'development') {
  contextBridge.exposeInMainWorld('electronAPI', {
    openDevTools: () => ipcRenderer.invoke('dev:openDevTools'),
    reloadWindow: () => ipcRenderer.invoke('dev:reloadWindow'),
    getProcessInfo: () => ipcRenderer.invoke('dev:getProcessInfo'),
  });
}

// Security monitoring - log any attempts to access restricted APIs
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  // Log security-related errors to main process
  if (args.some(arg => typeof arg === 'string' && arg.includes('Rate limit'))) {
    ipcRenderer.send('security:rateLimitViolation', args);
  }
  originalConsoleError.apply(console, args);
};

// Prevent access to Node.js APIs
Object.defineProperty(window, 'require', {
  value: undefined,
  writable: false,
  configurable: false,
});

Object.defineProperty(window, 'module', {
  value: undefined,
  writable: false,
  configurable: false,
});

Object.defineProperty(window, 'exports', {
  value: undefined,
  writable: false,
  configurable: false,
});

// Log successful preload initialization
console.log('CoinPoker Intelligence Assistant preload script loaded successfully');
