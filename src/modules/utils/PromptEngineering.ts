/**
 * Prompt engineering utilities for the DecisionEngine.
 * - Formats GameState into LLM prompts with strategic context.
 * - Injects pot odds, position, stack sizes, and phase-specific templates.
 * - Parses LLM responses into structured recommendations.
 */

import { PokerAction, Recommendation } from '../../shared/types/Decision';
import { GameState } from '../../shared/types/GameState';

export enum PokerPhase {
  PREFLOP = 'preflop',
  FLOP = 'flop',
  TURN = 'turn',
  RIVER = 'river',
  SHOWDOWN = 'showdown',
}

export interface PromptContext {
  potOdds: number;
  position: string;
  stackSizes: Record<string, number>;
  phase: PokerPhase;
}

export class PromptEngineering {
  /**
   * Formats a GameState and context into a prompt for the LLM.
   */
  static formatPrompt(gameState: GameState, context: PromptContext): string {
    // Phase-specific template
    const phaseTemplate = PromptEngineering.getPhaseTemplate(context.phase);
    // Strategic context
    const contextBlock = [
      `Pot odds: ${context.potOdds.toFixed(2)}`,
      `Position: ${context.position}`,
      `Stack sizes: ${JSON.stringify(context.stackSizes)}`,
      `Phase: ${context.phase}`,
    ].join('\n');
    // Game state summary
    const stateBlock = JSON.stringify(gameState, null, 2);

    return `${phaseTemplate}
Strategic Context:
${contextBlock}

Game State:
${stateBlock}

Based on the above, recommend the optimal action (fold, call, raise, all-in) with a confidence score (0-1) and a brief rationale. Respond in JSON:
{"action": "...", "confidence": 0.0, "rationale": "..."}`;
  }

  /**
   * Returns a prompt template for the given poker phase.
   */
  static getPhaseTemplate(phase: PokerPhase): string {
    switch (phase) {
      case PokerPhase.PREFLOP:
        return 'You are an expert poker strategist. Analyze the preflop situation:';
      case PokerPhase.FLOP:
        return 'You are an expert poker strategist. Analyze the flop situation:';
      case PokerPhase.TURN:
        return 'You are an expert poker strategist. Analyze the turn situation:';
      case PokerPhase.RIVER:
        return 'You are an expert poker strategist. Analyze the river situation:';
      case PokerPhase.SHOWDOWN:
        return 'You are an expert poker strategist. Analyze the showdown:';
      default:
        return 'You are an expert poker strategist. Analyze the situation:';
    }
  }

  /**
   * Parses the LLM response into a Recommendation.
   * Handles both strict JSON and loose text with JSON block.
   */
  static parseResponse(response: string): Recommendation | null {
    // Extract JSON block if present
    const jsonMatch = response.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return null;
    try {
      const obj = JSON.parse(jsonMatch[0]);
      if (
        typeof obj.action === 'string' &&
        typeof obj.confidence === 'number' &&
        typeof obj.rationale === 'string'
      ) {
        // Normalize action
        const action = PromptEngineering.normalizeAction(obj.action);
        if (!action) return null;
        return {
          action,
          confidence: Math.max(0, Math.min(1, obj.confidence)),
          rationale: obj.rationale.trim(),
          timestamp: Date.now(),
        };
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * Normalizes action string to PokerAction enum.
   */
  static normalizeAction(action: string): PokerAction | null {
    const a = action.trim().toLowerCase();
    switch (a) {
      case 'fold':
        return PokerAction.FOLD;
      case 'call':
        return PokerAction.CALL;
      case 'raise':
        return PokerAction.RAISE;
      case 'all-in':
      case 'allin':
      case 'all in':
        return PokerAction.ALL_IN;
      default:
        return null;
    }
  }
}