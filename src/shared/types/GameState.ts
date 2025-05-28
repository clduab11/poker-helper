// Poker Game State Types for Data Extraction Module
// See phase_2_domain_model.md for reference

/** Card suits */
export type Suit = 'h' | 'd' | 'c' | 's'; // hearts, diamonds, clubs, spades

/** Card ranks */
export type Rank =
  | 'A'
  | 'K'
  | 'Q'
  | 'J'
  | '10'
  | '9'
  | '8'
  | '7'
  | '6'
  | '5'
  | '4'
  | '3'
  | '2';

/** Card type */
export interface Card {
  rank: Rank;
  suit: Suit;
}

/** Player actions */
export type PlayerAction = 'fold' | 'call' | 'raise' | 'check' | 'all-in' | 'bet';

/** Game phases */
export enum GamePhase {
  Preflop = 'preflop',
  Flop = 'flop',
  Turn = 'turn',
  River = 'river',
  Showdown = 'showdown',
  Unknown = 'unknown'
}

/** Player interface */
export interface Player {
  position: number; // 0 = hero, 1 = left, etc.
  name?: string;
  chips: number;
  cards?: Card[]; // Only for hero or if visible
  actions: PlayerAction[];
  isActive: boolean;
  isDealer?: boolean;
  isHero?: boolean;
}

/** Extraction error types */
export type ExtractionErrorType =
  | 'ocr_failure'
  | 'layout_not_found'
  | 'pattern_mismatch'
  | 'incomplete_data'
  | 'multi_window_detected'
  | 'unknown';

/** Extraction error object */
export interface ExtractionError {
  type: ExtractionErrorType;
  message: string;
  details?: any;
}

/** Main GameState interface */
export interface GameState {
  phase: GamePhase;
  players: Player[];
  communityCards: Card[];
  pot: number;
  heroPosition: number;
  currentBet: number;
  lastAction?: PlayerAction | undefined;
  extractionErrors?: ExtractionError[] | undefined;
  timestamp: number; // ms since epoch
  multiWindowDetected?: boolean;
}