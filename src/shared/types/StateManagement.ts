/**
 * StateManagement shared types for GameStateManager and related utilities.
 * Defines interfaces for state change tracking, configuration, event payloads, and comparison utilities.
 */

import type { GameState } from "./GameState";

/**
 * Describes a single change detected between two GameState objects.
 */
export interface StateChange {
  path: string; // e.g., "players[0].stack"
  oldValue: unknown;
  newValue: unknown;
  significant: boolean; // True if this change is considered significant for downstream consumers
  reason?: string; // Optional: why this change is significant (e.g., "new card dealt")
}

/**
 * Configuration options for the GameStateManager.
 */
export interface StateManagerConfig {
  rateLimitMs?: number; // Minimum ms between significant update events (default: 100)
  significanceThreshold?: number; // Minimum number of significant changes to trigger event (default: 1)
  validateState?: (state: GameState) => boolean; // Optional custom validation function
}

/**
 * Payload for GameStateManager "GameStateUpdated" events.
 */
export interface EventPayload {
  newState: GameState;
  oldState: GameState | null;
  changes: StateChange[];
  timestamp: number;
}

/**
 * Utility types for state comparison.
 */
export interface StateComparisonResult {
  changes: StateChange[];
  significant: boolean;
}

/**
 * Function signature for deep state comparison utilities.
 */
export type StateComparisonFn = (
  prev: GameState | null,
  next: GameState
) => StateComparisonResult;