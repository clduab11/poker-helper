// Types and enums for the DecisionEngine module

/**
 * Enum representing possible poker actions.
 */
export enum PokerAction {
  FOLD = 'fold',
  CALL = 'call',
  RAISE = 'raise',
  ALL_IN = 'all-in',
}

/**
 * Enum for supported LLM providers.
 */
export enum LLMProvider {
  GEMINI = 'Gemini',
  GPT4 = 'GPT4',
}

/**
 * Interface for a recommendation returned by the DecisionEngine.
 */
export interface Recommendation {
  action: PokerAction;
  confidence: number; // 0.0 - 1.0
  rationale: string;
  timestamp: number; // Unix epoch ms
}

/**
 * Interface for a decision made by the decision engine.
 * Similar to Recommendation but with reasoning instead of rationale.
 */
export interface Decision {
  action: PokerAction;
  confidence: number; // 0.0 - 1.0
  reasoning: string;
  timestamp: number; // Unix epoch ms
  alternatives?: Array<{ action: PokerAction; probability: number }>;
}

/**
 * Configuration for the DecisionEngine.
 */
export interface DecisionEngineConfig {
  provider: LLMProvider;
  openAIApiKey?: string;
  googleApiKey?: string;
  cacheTTLms?: number;
  cacheSize?: number;
  timeoutMs?: number;
  maxBackoffMs?: number;
  minBackoffMs?: number;
}

/**
 * Cache entry for the LRU cache.
 */
export interface CacheEntry {
  key: string;
  recommendation: Recommendation;
  createdAt: number;
  expiresAt: number;
}