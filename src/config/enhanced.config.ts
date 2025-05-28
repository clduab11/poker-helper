import { EnhancedOrchestratorConfig } from '../modules/EnhancedMainOrchestrator';
import { env } from './environment';

export const enhancedConfig: EnhancedOrchestratorConfig = {
  maxPipelineLatencyMs: 200,
  pollingIntervalMs: 1000,
  moduleConfigs: {
    screenCapture: {
      targetWindowTitle: 'CoinPoker',
      supportedResolutions: [
        { width: 1920, height: 1080, name: '1080p' },
        { width: 2560, height: 1440, name: '1440p' },
        { width: 3840, height: 2160, name: '4K' },
      ],
      captureQuality: 0.9,
      throttleMs: 50,
    },
    dataExtraction: {
      lang: 'eng',
      fastMode: true,
      confidence_threshold: 0.7,
    },
    gameStateManager: {
      maxHistorySize: 100,
      diffingEnabled: true,
    },
    decisionEngine: {
      llmProvider: 'openai',
      llmModel: 'gpt-4-turbo',
      maxRetries: 3,
      timeoutMs: 5000,
    },
    overlayUI: {
      opacity: 0.8,
      position: { x: 100, y: 100 },
      fontSize: 14,
      theme: 'dark',
    },
    securityManager: {
      antiDetectionEnabled: true,
      processIsolationEnabled: false,
      riskProfile: 'medium',
    },
  },
  screenshotManager: {
    captureIntervalMs: 1000, // 1 second intervals
    retentionPeriodMs: 30 * 60 * 1000, // 30 minutes
    storageDirectory: './screenshots',
    maxStorageSizeMB: 500, // 500MB max storage
  },
  visionModel: {
    provider: 'openai',
    apiKey: env.openaiApiKey,
    model: 'gpt-4-vision-preview',
    maxTokens: 1000,
    temperature: 0.3,
    timeout: 15000,
  },
  multiAgentWorkflow: {
    agents: [
      {
        id: 'vision-agent-1',
        role: 'vision',
        model: 'gpt-4-vision-preview',
        provider: 'openai',
        specialization: 'OCR and visual extraction',
      },
      {
        id: 'analysis-agent-1',
        role: 'analysis',
        model: 'gpt-4-turbo',
        provider: 'openai',
        specialization: 'Game state validation and analysis',
      },
      {
        id: 'strategy-agent-1',
        role: 'strategy',
        model: 'gpt-4-turbo',
        provider: 'openai',
        specialization: 'GTO and exploitative strategy',
      },
      {
        id: 'coordinator-agent-1',
        role: 'coordinator',
        model: 'gpt-4-turbo',
        provider: 'openai',
        specialization: 'Decision synthesis and conflict resolution',
      },
    ],
    maxIterations: 3,
    consensusThreshold: 0.7,
  },
  useMultiAgentMode: true,
};

// Alternative configurations for different providers
export const anthropicConfig: Partial<EnhancedOrchestratorConfig> = {
  visionModel: {
    provider: 'anthropic',
    apiKey: env.anthropicApiKey,
    model: 'claude-3-opus-20240229',
    maxTokens: 1000,
    temperature: 0.3,
    timeout: 15000,
  },
  multiAgentWorkflow: {
    agents: [
      {
        id: 'vision-agent-claude',
        role: 'vision',
        model: 'claude-3-opus-20240229',
        provider: 'anthropic',
        specialization: 'OCR and visual extraction',
      },
      {
        id: 'analysis-agent-claude',
        role: 'analysis',
        model: 'claude-3-opus-20240229',
        provider: 'anthropic',
        specialization: 'Game state validation',
      },
      {
        id: 'strategy-agent-claude',
        role: 'strategy',
        model: 'claude-3-opus-20240229',
        provider: 'anthropic',
        specialization: 'Strategic recommendations',
      },
      {
        id: 'coordinator-agent-claude',
        role: 'coordinator',
        model: 'claude-3-opus-20240229',
        provider: 'anthropic',
        specialization: 'Decision synthesis',
      },
    ],
    maxIterations: 3,
    consensusThreshold: 0.7,
  },
};

export const googleConfig: Partial<EnhancedOrchestratorConfig> = {
  visionModel: {
    provider: 'google',
    apiKey: process.env.GOOGLE_API_KEY || '',
    model: 'gemini-pro-vision',
    maxTokens: 1000,
    temperature: 0.3,
    timeout: 15000,
  },
  multiAgentWorkflow: {
    agents: [
      {
        id: 'vision-agent-gemini',
        role: 'vision',
        model: 'gemini-pro-vision',
        provider: 'google',
        specialization: 'Visual analysis',
      },
      {
        id: 'analysis-agent-gemini',
        role: 'analysis',
        model: 'gemini-pro',
        provider: 'google',
        specialization: 'Game analysis',
      },
      {
        id: 'strategy-agent-gemini',
        role: 'strategy',
        model: 'gemini-pro',
        provider: 'google',
        specialization: 'Strategy generation',
      },
      {
        id: 'coordinator-agent-gemini',
        role: 'coordinator',
        model: 'gemini-pro',
        provider: 'google',
        specialization: 'Coordination',
      },
    ],
    maxIterations: 3,
    consensusThreshold: 0.7,
  },
};

// Custom OpenAI-compatible endpoint configuration
export const customEndpointConfig: Partial<EnhancedOrchestratorConfig> = {
  visionModel: {
    provider: 'custom',
    apiKey: process.env.CUSTOM_API_KEY || '',
    baseURL: process.env.CUSTOM_BASE_URL || 'http://localhost:8000/v1',
    model: 'custom-vision-model',
    maxTokens: 1000,
    temperature: 0.3,
    timeout: 15000,
  },
};

// Development configuration with reduced resources
export const developmentConfig: Partial<EnhancedOrchestratorConfig> = {
  screenshotManager: {
    captureIntervalMs: 5000, // 5 seconds in dev
    retentionPeriodMs: 5 * 60 * 1000, // 5 minutes
    storageDirectory: './dev-screenshots',
    maxStorageSizeMB: 100,
  },
  useMultiAgentMode: false, // Use simple mode in development
};

// Error recovery strategy
export const errorRecoveryStrategy = {
  recover: (moduleName: string, error: Error): boolean => {
    console.error(`Module ${moduleName} error:`, error);
    
    // Attempt to recover based on module
    switch (moduleName) {
      case 'screenCapture':
        // Retry with lower resolution
        return true;
      case 'visionService':
        // Fallback to OCR-only mode
        return true;
      case 'multiAgentWorkflow':
        // Fallback to single agent
        return true;
      default:
        return false;
    }
  },
  fallback: (moduleName: string) => {
    console.warn(`Applying fallback for module: ${moduleName}`);
    // Implement fallback logic
  },
};