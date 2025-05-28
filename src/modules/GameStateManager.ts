/**
 * GameStateManager: Central state management for poker-helper.
 * - Tracks current GameState, applies efficient updates, emits events on significant changes.
 * - Uses Node.js EventEmitter for event bus.
 * - Rate-limits event emission to avoid overwhelming downstream modules.
 * - Validates incoming GameState objects.
 * - Optimized for <10ms update latency.
 */

import { EventEmitter } from "events";
import type { GameState } from "../shared/types/GameState";
import type {
  StateManagerConfig,
  EventPayload,
} from "../shared/types/StateManagement";
import { compareGameStates } from "./utils/StateDiff";

const DEFAULT_RATE_LIMIT_MS = 100;

import type { DecisionEngine } from "./DecisionEngine";

export class GameStateManager extends EventEmitter {
  private currentState: GameState | null = null;
  private lastUpdateTimestamp: number = 0;
  private config: StateManagerConfig;
  private decisionEngine: DecisionEngine | undefined;

  /**
   * @param config StateManagerConfig for state management
   * @param decisionEngine Optional injected DecisionEngine dependency
   */
  constructor(config: StateManagerConfig = {}, decisionEngine?: DecisionEngine) {
    super();
    this.config = {
      rateLimitMs: config.rateLimitMs ?? DEFAULT_RATE_LIMIT_MS,
      significanceThreshold: config.significanceThreshold ?? 1,
      ...(config.validateState !== undefined ? { validateState: config.validateState } : {}),
    };
    this.decisionEngine = decisionEngine;
  }

  /**
   * Returns the injected DecisionEngine instance, if any.
   */
  getDecisionEngine(): DecisionEngine | undefined {
    return this.decisionEngine;
  }

  /**
   * Returns the current game state.
   */
  getState(): GameState | null {
    return this.currentState;
  }

  /**
   * Validates a GameState object using custom or default logic.
   */
  private validate(state: GameState): boolean {
    if (this.config.validateState) {
      return this.config.validateState(state);
    }
    // Default: require at least one player and a stage
    return (
      Array.isArray(state.players) &&
      state.players.length > 0 &&
      typeof state.phase === "string"
    );
  }

  /**
   * Applies a new GameState, emits "GameStateUpdated" if significant changes detected.
   * Returns true if update was accepted and event emitted.
   */
  updateState(newState: GameState): boolean {
    const start = performance.now();

    if (!this.validate(newState)) {
      this.emit("InvalidGameState", { newState, reason: "Validation failed" });
      return false;
    }

    const { changes, significant } = compareGameStates(this.currentState, newState);

    // Only emit if significant changes and not rate-limited
    const now = Date.now();
    const enoughTimeElapsed = now - this.lastUpdateTimestamp >= (this.config.rateLimitMs ?? DEFAULT_RATE_LIMIT_MS);
    const significantChangeCount = changes.filter((c) => c.significant).length;

    if (significant && enoughTimeElapsed && significantChangeCount >= (this.config.significanceThreshold ?? 1)) {
      const payload: EventPayload = {
        newState,
        oldState: this.currentState,
        changes,
        timestamp: now,
      };
      this.emit("GameStateUpdated", payload);
      this.lastUpdateTimestamp = now;
    }

    this.currentState = newState;

    // Performance check
    const elapsed = performance.now() - start;
    if (elapsed > 10) {
      this.emit("PerformanceWarning", { elapsed });
    }

    return significant && enoughTimeElapsed && significantChangeCount >= (this.config.significanceThreshold ?? 1);
  }
}

export default GameStateManager;