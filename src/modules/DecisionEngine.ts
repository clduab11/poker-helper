/**
 * DecisionEngine: Poker LLM strategy engine with caching, timeout, and provider switching.
 * - Supports Gemini Pro and GPT-4 Turbo via provider abstraction.
 * - Uses LRU cache for fast recommendations and fallback.
 * - Handles timeouts, exponential backoff, and performance constraints.
 */

import { GameState } from '../shared/types/GameState';
import {
  PokerAction,
  Recommendation,
  LLMProvider,
  DecisionEngineConfig,
} from '../shared/types/Decision';
import { PromptEngineering, PromptContext } from './utils/PromptEngineering';
import { LRUCache } from './utils/LRUCache';

// Import OpenAI and Google SDKs dynamically to avoid hard dependencies
type OpenAIClient = any;
type GeminiClient = any;

interface DecisionEngineDependencies {
  openAI?: OpenAIClient;
  gemini?: GeminiClient;
}

export class DecisionEngine {
  private config: DecisionEngineConfig;
  private cache: LRUCache<GameState, Recommendation>;
  private openAI?: OpenAIClient;
  private gemini?: GeminiClient;

  constructor(config: DecisionEngineConfig, deps?: DecisionEngineDependencies) {
    this.config = {
      cacheTTLms: 60000,
      cacheSize: 100,
      timeoutMs: 100,
      minBackoffMs: 100,
      maxBackoffMs: 1000,
      ...config,
    };
    this.cache = new LRUCache<GameState, Recommendation>({
      maxSize: this.config.cacheSize!,
      ttlMs: this.config.cacheTTLms!,
      hashFn: LRUCache.defaultObjectHash,
    });
    this.openAI = deps?.openAI;
    this.gemini = deps?.gemini;
  }

  /**
   * Main entry: Get a recommendation for a given game state.
   * Uses cache, timeout, and exponential backoff for reliability and speed.
   */
  async getRecommendation(
    gameState: GameState,
    context: PromptContext
  ): Promise<Recommendation> {
    const cacheKey = gameState;
    const cached = this.cache.get(cacheKey);
    // Start timer for <80ms performance constraint
    const start = performance.now();

    // Promise for LLM call with timeout
    const llmPromise = this._withTimeout(
      () => this._callLLM(gameState, context),
      this.config.timeoutMs!
    ).catch((err) => {
      if (err === 'timeout') {
        // Timeout occurred - LLM call will return undefined
      }
      return undefined;
    });

    let rec: Recommendation | undefined = await llmPromise;

    // Fallback to cache if timed out or error
    if (!rec && cached) {
      rec = cached;
    }

    // If still no rec, return a default fold
    if (!rec) {
      rec = {
        action: PokerAction.FOLD,
        confidence: 0.0,
        rationale: 'Unable to compute recommendation in time; defaulting to fold.',
        timestamp: Date.now(),
      };
    }

    // Cache the new recommendation if not from cache
    if (rec && !cached) {
      this.cache.set(cacheKey, rec);
    }

    // Performance check
    const elapsed = performance.now() - start;
    if (elapsed > 80) {
      // Optionally log or track performance issues
    }

    return rec;
  }

  /**
   * Calls the LLM provider with exponential backoff for rate limits.
   */
  private async _callLLM(
    gameState: GameState,
    context: PromptContext
  ): Promise<Recommendation | undefined> {
    const prompt = PromptEngineering.formatPrompt(gameState, context);
    let attempt = 0;
    let backoff = this.config.minBackoffMs!;
    const maxBackoff = this.config.maxBackoffMs!;

    while (attempt < 5) {
      try {
        let response: string;
        if (this.config.provider === LLMProvider.GPT4) {
          response = await this._callOpenAI(prompt);
        } else if (this.config.provider === LLMProvider.GEMINI) {
          response = await this._callGemini(prompt);
        } else {
          throw new Error('Unsupported LLM provider');
        }
        const rec = PromptEngineering.parseResponse(response);
        if (rec) {return rec;}
        // If response is malformed, break
        break;
      } catch (err: any) {
        // Exponential backoff on rate limit
        if (err?.message?.includes('rate limit')) {
          await new Promise((res) => setTimeout(res, backoff));
          backoff = Math.min(backoff * 2, maxBackoff);
          attempt++;
          continue;
        }
        // Other errors: break
        break;
      }
    }
    return undefined;
  }

  /**
   * Calls OpenAI GPT-4 Turbo.
   */
  private async _callOpenAI(prompt: string): Promise<string> {
    if (!this.openAI) {
      // Dynamically import if not provided
      const { OpenAI } = await import('openai');
      this.openAI = new OpenAI({ apiKey: this.config.openAIApiKey });
    }
    const completion = await this.openAI.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 256,
    });
    return completion.choices[0]?.message?.content || '';
  }

  /**
   * Calls Google Gemini Pro.
   */
  private async _callGemini(prompt: string): Promise<string> {
    if (!this.gemini) {
      // Dynamically import if not provided
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      this.gemini = new GoogleGenerativeAI(this.config.googleApiKey!);
    }
    const model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(prompt);
    return result?.response?.text() || '';
  }

  /**
   * Utility: Runs a promise with a timeout.
   */
  private async _withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
    let timeout: NodeJS.Timeout;
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject('timeout'), ms);
      }),
    ]).finally(() => {
      if (timeout) {clearTimeout(timeout);}
    });
  }
}