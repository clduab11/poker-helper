/**
 * StateDiff utility for deep comparison of GameState objects.
 * Detects significant changes and provides detailed change tracking.
 */

import type { GameState } from "../../shared/types/GameState";
import type {
  StateChange,
  StateComparisonResult,
} from "../../shared/types/StateManagement";

/**
 * Determines if a change at a given path is significant.
 * This logic can be extended as needed for domain-specific significance.
 */
function isSignificantChange(path: string, _oldValue: unknown, _newValue: unknown): { significant: boolean; reason?: string } {
  // Example: changes to "board", "players[*].cards", "pot", "stage" are significant
  if (
    path.startsWith("board") ||
    path.startsWith("pot") ||
    path.startsWith("stage") ||
    /^players\[\d+\]\.cards/.test(path) ||
    /^players\[\d+\]\.stack/.test(path) ||
    /^players\[\d+\]\.status/.test(path)
  ) {
    return { significant: true, reason: "core game element changed" };
  }
  // Minor UI or metadata changes are not significant
  return { significant: false };
}

/**
 * Recursively compares two objects and records all changes.
 */
function diffObjects(
  prev: any,
  next: any,
  path: string = ""
): StateChange[] {
  const changes: StateChange[] = [];

  // Handle primitives or direct value change
  if (typeof prev !== "object" || prev === null || typeof next !== "object" || next === null) {
    if (prev !== next) {
      const { significant, reason } = isSignificantChange(path, prev, next);
      const change: StateChange = reason !== undefined
        ? { path, oldValue: prev, newValue: next, significant, reason }
        : { path, oldValue: prev, newValue: next, significant };
      changes.push(change);
    }
    return changes;
  }

  // Handle arrays
  if (Array.isArray(prev) || Array.isArray(next)) {
    const maxLen = Math.max(prev?.length || 0, next?.length || 0);
    for (let i = 0; i < maxLen; i++) {
      const subPath = `${path}[${i}]`;
      changes.push(...diffObjects(prev?.[i], next?.[i], subPath));
    }
    return changes;
  }

  // Handle objects
  const keys = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]);
  for (const key of keys) {
    const subPath = path ? `${path}.${key}` : key;
    changes.push(...diffObjects(prev?.[key], next?.[key], subPath));
  }
  return changes;
}

/**
 * Compares two GameState objects and returns a list of changes,
 * marking which are significant.
 */
export function compareGameStates(
  prev: GameState | null,
  next: GameState
): StateComparisonResult {
  if (!prev) {
    // All fields are new, treat as significant initialization
    const changes = diffObjects({}, next);
    return {
      changes: changes.map((c) => ({ ...c, significant: true, reason: "initial state" })),
      significant: true,
    };
  }
  const changes = diffObjects(prev, next);
  const significant = changes.some((c) => c.significant);
  return { changes, significant };
}