/**
 * Core Type Definitions for CoinPoker Intelligence Assistant
 * 
 * Centralizes all TypeScript interfaces, types, and enums used throughout
 * the application. Provides type safety and consistency across all modules.
 */

// ===== CARD GAME TYPES =====

/**
 * Card suits in a standard deck
 */
export enum Suit {
  HEARTS = 'hearts',
  DIAMONDS = 'diamonds',
  CLUBS = 'clubs',
  SPADES = 'spades',
}

/**
 * Card ranks in poker
 */
export enum Rank {
  TWO = '2',
  THREE = '3',
  FOUR = '4',
  FIVE = '5',
  SIX = '6',
  SEVEN = '7',
  EIGHT = '8',
  NINE = '9',
  TEN = '10',
  JACK = 'J',
  QUEEN = 'Q',
  KING = 'K',
  ACE = 'A',
}

/**
 * Individual playing card
 */
export interface Card {
  rank: Rank;
  suit: Suit;
}

/**
 * Player's hole cards
 */
export interface HoleCards {
  card1: Card;
  card2: Card;
}

/**
 * Community cards on the board
 */
export interface CommunityCards {
  flop?: [Card, Card, Card];
  turn?: Card;
  river?: Card;
}

/**
 * Poker hand rankings
 */
export enum HandRanking {
  HIGH_CARD = 1,
  PAIR = 2,
  TWO_PAIR = 3,
  THREE_OF_KIND = 4,
  STRAIGHT = 5,
  FLUSH = 6,
  FULL_HOUSE = 7,
  FOUR_OF_KIND = 8,
  STRAIGHT_FLUSH = 9,
  ROYAL_FLUSH = 10,
}

/**
 * Player's best hand evaluation
 */
export interface HandEvaluation {
  ranking: HandRanking;
  cards: Card[];
  strength: number; // 0-1 relative strength
  description: string;
}

// ===== GAME STATE TYPES =====

/**
 * Current betting round
 */
export enum BettingRound {
  PREFLOP = 'preflop',
  FLOP = 'flop',
  TURN = 'turn',
  RIVER = 'river',
}

/**
 * Player actions
 */
export enum PlayerAction {
  FOLD = 'fold',
  CHECK = 'check',
  CALL = 'call',
  BET = 'bet',
  RAISE = 'raise',
  ALL_IN = 'all_in',
}

/**
 * Player position at the table
 */
export enum Position {
  SMALL_BLIND = 'SB',
  BIG_BLIND = 'BB',
  UNDER_THE_GUN = 'UTG',
  MIDDLE_POSITION = 'MP',
  CUTOFF = 'CO',
  BUTTON = 'BTN',
}

/**
 * Individual player information
 */
export interface Player {
  id: string;
  name: string;
  position: Position;
  stackSize: number;
  holeCards?: HoleCards;
  currentBet: number;
  isActive: boolean;
  isAllIn: boolean;
  hasFolded: boolean;
}

/**
 * Complete game state
 */
export interface GameState {
  tableId: string;
  players: Player[];
  communityCards: CommunityCards;
  potSize: number;
  currentBet: number;
  bettingRound: BettingRound;
  activePlayerId: string;
  smallBlind: number;
  bigBlind: number;
  timestamp: number;
}

// ===== OCR AND CAPTURE TYPES =====

/**
 * Screen capture configuration
 */
export interface CaptureConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  displayId?: number;
}

/**
 * OCR processing result
 */
export interface OCRResult {
  text: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  words: OCRWord[];
}

/**
 * Individual word from OCR
 */
export interface OCRWord {
  text: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Parsed game information from screen
 */
export interface ParsedGameInfo {
  players: Partial<Player>[];
  communityCards: Partial<CommunityCards>;
  potSize?: number;
  bettingRound?: BettingRound;
  confidence: number;
  timestamp: number;
}

// ===== STRATEGY AND ADVICE TYPES =====

/**
 * Action recommendation
 */
export interface ActionRecommendation {
  action: PlayerAction;
  confidence: number;
  reasoning: string;
  betSize?: number;
  alternatives: AlternativeAction[];
}

/**
 * Alternative action suggestion
 */
export interface AlternativeAction {
  action: PlayerAction;
  betSize?: number;
  reasoning: string;
  situationalFactors: string[];
}

/**
 * Equity calculation
 */
export interface EquityCalculation {
  winProbability: number;
  tieProbability: number;
  expectedValue: number;
  scenarios: EquityScenario[];
  sampleSize: number;
}

/**
 * Individual equity scenario
 */
export interface EquityScenario {
  boardCards: Card[];
  handRanking: HandRanking;
  probability: number;
}

/**
 * Pot odds calculation
 */
export interface PotOdds {
  callAmount: number;
  potSize: number;
  odds: number; // ratio (e.g., 3.5 for 3.5:1)
  percentage: number; // percentage needed to break even
  isGoodCall: boolean;
}

// ===== ERROR AND VALIDATION TYPES =====

/**
 * Application error categories
 */
export enum ErrorCategory {
  CAPTURE = 'capture',
  OCR = 'ocr',
  PARSING = 'parsing',
  STRATEGY = 'strategy',
  SYSTEM = 'system',
  VALIDATION = 'validation',
}

/**
 * Structured error information
 */
export interface AppError {
  category: ErrorCategory;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
  stack?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Individual validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: unknown;
}

/**
 * Individual validation warning
 */
export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

// ===== CONFIGURATION TYPES =====

/**
 * Table detection configuration
 */
export interface TableConfig {
  name: string;
  captureAreas: {
    players: CaptureConfig[];
    communityCards: CaptureConfig;
    pot: CaptureConfig;
    actions: CaptureConfig[];
  };
  ocrSettings: {
    language: string;
    confidence: number;
    preprocessingEnabled: boolean;
  };
  validationRules: {
    minPlayers: number;
    maxPlayers: number;
    requiredElements: string[];
  };
}

/**
 * Strategy configuration
 */
export interface StrategyConfig {
  aggressionLevel: number; // 0-1 scale
  bluffFrequency: number; // 0-1 scale
  positionAwareness: boolean;
  stackSizeConsideration: boolean;
  opponentModeling: boolean;
  riskTolerance: number; // 0-1 scale
}

// ===== EVENT AND MESSAGING TYPES =====

/**
 * System events
 */
export enum EventType {
  GAME_STATE_UPDATED = 'game_state_updated',
  ACTION_RECOMMENDED = 'action_recommended',
  ERROR_OCCURRED = 'error_occurred',
  CAPTURE_COMPLETED = 'capture_completed',
  OCR_COMPLETED = 'ocr_completed',
  PARSING_COMPLETED = 'parsing_completed',
}

/**
 * Event payload structure
 */
export interface EventPayload<T = unknown> {
  type: EventType;
  data: T;
  timestamp: number;
  source: string;
}

/**
 * MCP integration types
 */
export interface MCPRequest {
  method: string;
  params: Record<string, unknown>;
  id: string;
  timestamp: number;
}

/**
 * MCP response structure
 */
export interface MCPResponse<T = unknown> {
  id: string;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  timestamp: number;
}

// ===== UTILITY TYPES =====

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: AppError;
  timestamp: number;
  requestId: string;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Time range for data queries
 */
export interface TimeRange {
  start: number;
  end: number;
}

/**
 * Coordinate point
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Rectangle bounds
 */
export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ===== TYPE GUARDS =====

/**
 * Type guard for Card objects
 */
export const isCard = (obj: unknown): obj is Card => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'rank' in obj &&
    'suit' in obj &&
    Object.values(Rank).includes((obj as Card).rank) &&
    Object.values(Suit).includes((obj as Card).suit)
  );
};

/**
 * Type guard for Player objects
 */
export const isPlayer = (obj: unknown): obj is Player => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'position' in obj &&
    'stackSize' in obj &&
    typeof (obj as Player).id === 'string' &&
    typeof (obj as Player).name === 'string' &&
    Object.values(Position).includes((obj as Player).position) &&
    typeof (obj as Player).stackSize === 'number'
  );
};

/**
 * Type guard for GameState objects
 */
export const isGameState = (obj: unknown): obj is GameState => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'tableId' in obj &&
    'players' in obj &&
    'potSize' in obj &&
    'bettingRound' in obj &&
    typeof (obj as GameState).tableId === 'string' &&
    Array.isArray((obj as GameState).players) &&
    typeof (obj as GameState).potSize === 'number' &&
    Object.values(BettingRound).includes((obj as GameState).bettingRound)
  );
};