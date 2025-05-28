/**
 * TDD tests for GameStateManager.
 * Covers: initialization, updates, change detection, event emission, rate limiting, invalid input, and performance.
 */

import { GameStateManager } from "../../src/modules/GameStateManager";
import type { GameState, Player, Card } from "../../src/shared/types/GameState";
import { GamePhase } from "../../src/shared/types/GameState";

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    position: 0,
    chips: 1000,
    actions: [],
    isActive: true,
    ...overrides,
  };
}

function makeCard(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: GamePhase.Preflop,
    players: [makePlayer()],
    communityCards: [],
    pot: 0,
    heroPosition: 0,
    currentBet: 0,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("GameStateManager", () => {
  let manager: GameStateManager;

  beforeEach(() => {
    manager = new GameStateManager({ rateLimitMs: 50 });
  });

  it("initializes with null state", () => {
    expect(manager.getState()).toBeNull();
  });

  it("accepts and stores a valid initial state", () => {
    const state = makeState();
    expect(manager.updateState(state)).toBe(true);
    expect(manager.getState()).toEqual(state);
  });

  it("rejects invalid state (no players)", () => {
    const state = makeState({ players: [] });
    const spy = jest.fn();
    manager.on("InvalidGameState", spy);
    expect(manager.updateState(state)).toBe(false);
    expect(spy).toHaveBeenCalled();
  });

  it("emits GameStateUpdated only for significant changes", (done) => {
    const state1 = makeState();
    const state2 = makeState({ pot: 100 }); // significant change
    const state3 = makeState({ pot: 100, currentBet: 10 }); // insignificant change (currentBet not significant)

    let eventCount = 0;
    manager.on("GameStateUpdated", (payload: { changes: Array<{ path: string; significant: boolean }> }) => {
      eventCount++;
      if (eventCount === 1) {
        expect(payload.changes.some((c: any) => c.path === "pot" && c.significant)).toBe(true);
        done();
      }
    });

    manager.updateState(state1);
    manager.updateState(state2);
    manager.updateState(state3); // Should not emit again due to no significant change
  });

  it("rate limits rapid redundant updates", (done) => {
    const state1 = makeState();
    const state2 = makeState({ pot: 200 });

    let eventCount = 0;
    manager.on("GameStateUpdated", () => {
      eventCount++;
    });

    manager.updateState(state1);
    manager.updateState(state2);
    setTimeout(() => {
      manager.updateState({ ...state2, pot: 300 });
      expect(eventCount).toBe(2);
      done();
    }, 60);
  });

  it("handles performance: update completes in <10ms", () => {
    const state = makeState();
    const spy = jest.fn();
    manager.on("PerformanceWarning", spy);
    for (let i = 0; i < 10; i++) {
      manager.updateState({ ...state, pot: i * 10 });
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("tracks and reports changes accurately", () => {
    const state1 = makeState();
    const state2 = makeState({ pot: 50, phase: GamePhase.Flop });
    let payload: any = null;
    manager.on("GameStateUpdated", (p: { changes: Array<{ path: string; significant: boolean }> }) => (payload = p));
    manager.updateState(state1);
    manager.updateState(state2);
    expect(payload).not.toBeNull();
    expect(payload.changes.some((c: any) => c.path === "pot" && c.significant)).toBe(true);
    expect(payload.changes.some((c: any) => c.path === "phase" && c.significant)).toBe(true);
  });

  it("is compatible with DataExtractionModule output shape", () => {
    // Simulate a state as would be output by DataExtractionModule
    const state: GameState = {
      phase: GamePhase.Turn,
      players: [
        { position: 0, chips: 500, actions: ["call"], isActive: true },
        { position: 1, chips: 1500, actions: ["raise"], isActive: true },
      ],
      communityCards: [
        makeCard("A", "h"),
        makeCard("K", "d"),
        makeCard("Q", "s"),
        makeCard("J", "c"),
      ],
      pot: 200,
      heroPosition: 0,
      currentBet: 50,
      timestamp: Date.now(),
    };
    expect(manager.updateState(state)).toBe(true);
    expect(manager.getState()).toEqual(state);
  });
});