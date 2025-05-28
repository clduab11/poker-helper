/**
 * TDD tests for DecisionEngine.
 * - Mocks LLM clients for OpenAI and Gemini.
 * - Tests: API call, response parsing, timeout fallback, cache hit/miss, backoff, and performance.
 */

import { DecisionEngine } from '../../src/modules/DecisionEngine';
import { PokerAction, LLMProvider, DecisionEngineConfig } from '../../src/shared/types/Decision';
import { GameState, GamePhase } from '../../src/shared/types/GameState';
import { PromptContext, PokerPhase } from '../../src/modules/utils/PromptEngineering';

jest.useFakeTimers();

const mockGameState: GameState = {
  phase: GamePhase.Flop,
  players: [
    {
      position: 0,
      name: 'hero',
      chips: 1000,
      cards: [
        { rank: 'A', suit: 's' },
        { rank: 'K', suit: 'd' }
      ],
      actions: [],
      isActive: true,
      isDealer: true,
    },
    {
      position: 1,
      name: 'villain',
      chips: 900,
      actions: [],
      isActive: true,
    }
  ],
  communityCards: [
    { rank: '2', suit: 'c' },
    { rank: '7', suit: 'd' },
    { rank: 'J', suit: 'h' }
  ],
  pot: 100,
  heroPosition: 0,
  currentBet: 0,
  lastAction: undefined,
  extractionErrors: undefined,
  timestamp: Date.now(),
  multiWindowDetected: false,
};

const mockContext: PromptContext = {
  potOdds: 0.25,
  position: 'BTN',
  stackSizes: { hero: 1000, villain: 900 },
  phase: PokerPhase.FLOP,
};


describe('DecisionEngine', () => {
  let config: DecisionEngineConfig;

  beforeEach(() => {
    config = {
      provider: LLMProvider.GPT4,
      openAIApiKey: 'test-key',
      cacheTTLms: 1000,
      cacheSize: 2,
      timeoutMs: 100,
      minBackoffMs: 10,
      maxBackoffMs: 40,
    };
  });

  it('parses a valid LLM response', async () => {
    const engine = new DecisionEngine(config, {
      openAI: {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: JSON.stringify({
                action: 'raise',
                confidence: 0.85,
                rationale: 'Strong draw and fold equity.'
              }) } }]
            }),
          },
        },
      },
    });
    const recommendation = await engine['getRecommendation'](mockGameState, mockContext);
    expect(recommendation.action).toBe(PokerAction.RAISE);
    expect(recommendation.confidence).toBeCloseTo(0.85);
    expect(recommendation.rationale).toMatch(/draw/i);
  });

  it('returns cached recommendation on timeout', async () => {
       jest.setTimeout(10000); // Increase timeout to 10 seconds
    const engine = new DecisionEngine(config, {
      openAI: {
        chat: {
          completions: {
            create: jest.fn().mockImplementation(() => new Promise(res => setTimeout(() => res({
              choices: [{ message: { content: JSON.stringify({
                action: 'call',
                confidence: 0.5,
                rationale: 'Timeout test'
              }) } }]
            }), 200))),
          },
        },
      },
    });
    // Pre-populate cache
    engine['cache'].set(mockGameState, {
      action: PokerAction.RAISE,
      confidence: 0.85,
      rationale: 'Strong draw and fold equity.',
      timestamp: Date.now(),
    });
    const rec = await engine['getRecommendation'](mockGameState, mockContext);
    expect(rec.action).toBe(PokerAction.RAISE); // Should return cached
  });

  it('returns default fold if no LLM and no cache', async () => {
    const engine = new DecisionEngine(config, {
      openAI: {
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('network error')),
          },
        },
      },
    });
    const recommendation = await engine['getRecommendation'](mockGameState, mockContext);
    expect(recommendation.action).toBe(PokerAction.FOLD);
    expect(recommendation.confidence).toBe(0.0);
  });

  it('caches new recommendations', async () => {
    const engine = new DecisionEngine(config, {
      openAI: {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: JSON.stringify({
                action: 'call',
                confidence: 0.7,
                rationale: 'Pot odds justify a call.'
              }) } }]
            }),
          },
        },
      },
    });
    await engine['getRecommendation'](mockGameState, mockContext);
    const cached = engine['cache'].get(mockGameState);
    expect(cached).toBeDefined();
    expect(cached?.action).toBe(PokerAction.CALL);
  });

  it('handles rate limit with exponential backoff', async () => {
    const createMock = jest.fn()
      .mockRejectedValueOnce(new Error('rate limit'))
      .mockRejectedValueOnce(new Error('rate limit'))
      .mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({
          action: 'call',
          confidence: 0.6,
          rationale: 'Backoff test'
        }) } }]
      });
    const engine = new DecisionEngine(config, {
      openAI: {
        chat: {
          completions: { create: createMock },
        },
      },
    });
    const rec = await engine['getRecommendation'](mockGameState, mockContext);
    expect(rec.action).toBe(PokerAction.CALL);
    expect(createMock).toHaveBeenCalledTimes(3);
  });

  it('completes recommendation in under 80ms (mocked)', async () => {
    const engine = new DecisionEngine(config, {
      openAI: {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: JSON.stringify({
                action: 'call',
                confidence: 0.7,
                rationale: 'Fast response'
              }) } }]
            }),
          },
        },
      },
    });
    const start = performance.now();
    await engine['getRecommendation'](mockGameState, mockContext);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(80);
  });

  it('generates correct prompt for various game states', () => {
    const { formatPrompt } = require('../../src/modules/utils/PromptEngineering');
    const prompt = formatPrompt(mockGameState, mockContext);
    expect(prompt).toMatch(/pot odds/i);
    expect(prompt).toMatch(/Game State:/i);
    expect(prompt).toMatch(/recommend the optimal action/i);
  });
});