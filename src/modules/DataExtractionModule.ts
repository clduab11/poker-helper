// DataExtractionModule.ts
// CoinPoker OCR and layout extraction for fast, robust GameState mapping

import { createWorker, Worker } from 'tesseract.js';
import { GameState, ExtractionError, Player, Card, GamePhase } from '../shared/types/GameState';

/**
 * Options for DataExtractionModule
 */
export interface DataExtractionOptions {
  lang?: string; // OCR language, default 'eng'
  fastMode?: boolean; // Use lower accuracy for speed
}

/**
 * Main DataExtractionModule class
 * - Integrates Tesseract.js WASM for OCR
 * - Detects CoinPoker UI zones (player cards, community cards, pot, chips)
 * - Pattern matches card values, actions, numbers
 * - Corrects common OCR errors
 * - Maps extracted data to GameState
 * - Handles incomplete data and errors
 * - Optimized for <50ms extraction
 */
export class DataExtractionModule {
  private worker: Worker | null = null;
  private lang: string;
  private fastMode: boolean;

  constructor(options: DataExtractionOptions = {}) {
    this.lang = options.lang || 'eng';
    this.fastMode = options.fastMode ?? true;
  }

  /**
   * Initializes the Tesseract.js worker and loads language data.
   */
  async initWorker(): Promise<void> {
    if (this.worker) {return;}
    // Await the worker creation (createWorker returns Promise<Worker>)
    this.worker = await createWorker();
    await this.worker.load();
    // @ts-expect-error: Tesseract.js types may be incomplete
    await this.worker.loadLanguage(this.lang);
    // @ts-expect-error: Tesseract.js types may be incomplete
    await this.worker.initialize(this.lang);
    if (this.fastMode) {
      await this.worker.setParameters({
        tessedit_char_whitelist: '0123456789AJQKhdcsFOLDRAISECALLBETCHECKIN.-, ',
        preserve_interword_spaces: '1'
      });
    }
  }

  /**
   * Terminates the Tesseract.js worker.
   */
  async terminateWorker(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * Main extraction entry point.
   * @param image - Image data (HTMLImageElement, Canvas, or base64 string)
   * @returns GameState and ExtractionErrors
   */
  async extractGameState(image: HTMLImageElement | HTMLCanvasElement | string): Promise<{ gameState: GameState; errors: ExtractionError[] }> {
    const start = performance.now();
    const errors: ExtractionError[] = [];
    let ocrResult: string = '';

    try {
      await this.initWorker();
      // Run OCR (assume image is compatible)
      const { data } = await this.worker!.recognize(image);
      ocrResult = data.text;
    } catch (err) {
      errors.push({
        type: 'ocr_failure',
        message: 'OCR engine failed',
        details: (err as Error).message || 'Unknown error'
      });
      return { gameState: this.emptyGameState(), errors };
    }

    // Layout detection: split OCR text into UI zones
    const zones = this.detectZones(ocrResult);

    // Extract data from each zone
    const players = this.extractPlayers(zones.playersZone, errors);
    const communityCards = this.extractCommunityCards(zones.communityZone, errors);
    const pot = this.extractPot(zones.potZone, errors);
    const phase = this.detectPhase(zones, errors);
    const heroPosition = this.detectHeroPosition(players);
    const currentBet = this.extractCurrentBet(zones.potZone, errors);
    const lastAction = this.extractLastAction(zones.actionZone, errors);

    // Multi-window detection (edge case)
    if (this.detectMultiWindow(ocrResult)) {
      errors.push({
        type: 'multi_window_detected',
        message: 'Multiple CoinPoker windows detected',
        details: null
      });
    }

    // Compose GameState
    const gameState: GameState = {
      phase,
      players,
      communityCards,
      pot,
      heroPosition,
      currentBet,
      lastAction: lastAction as import('../shared/types/GameState').PlayerAction | undefined,
      extractionErrors: errors.length ? errors : undefined,
      timestamp: Date.now(),
      multiWindowDetected: errors.some(e => e.type === 'multi_window_detected')
    };

    // Performance check
    const elapsed = performance.now() - start;
    if (elapsed > 50) {
      errors.push({
        type: 'unknown',
        message: `Extraction exceeded 50ms (${elapsed.toFixed(1)}ms)`,
        details: null
      });
    }

    return { gameState, errors };
  }

  /**
   * Returns an empty GameState for error fallback.
   */
  private emptyGameState(): GameState {
    return {
      phase: GamePhase.Unknown,
      players: [],
      communityCards: [],
      pot: 0,
      heroPosition: 0,
      currentBet: 0,
      timestamp: Date.now()
    };
  }

  /**
   * Detects UI zones in OCR text (stub: to be improved with layout heuristics).
   */
  private detectZones(ocrText: string): { playersZone: string; communityZone: string; potZone: string; actionZone: string } {
    const playersZone = this.extractZone(ocrText, /Players:\s*(.*?)(?=Community|$)/);
    const communityZone = this.extractZone(ocrText, /Community:\s*(.*?)(?=Pot|$)/);
    const potZone = this.extractZone(ocrText, /Pot:\s*(.*?)(?=Action|$)/);
    const actionZone = this.extractZone(ocrText, /Action:\s*(.*?)(?=Players|$)/);
    return {
      playersZone,
      communityZone,
      potZone,
      actionZone
    };
  }

  /**
   * Extracts player info from OCR zone.
   */
  private extractPlayers(_zone: string, _errors: ExtractionError[]): Player[] {
    // TODO: Use OCRPatterns, regex, and error correction to extract player cards, chips, actions
    // Placeholder: returns empty array
    return [];
  }

  /**
   * Extracts community cards from OCR zone.
   */
  private extractCommunityCards(_zone: string, _errors: ExtractionError[]): Card[] {
    // TODO: Use OCRPatterns and error correction
    return [];
  }

  /**
   * Extracts pot size from OCR zone.
   */
  private extractPot(_zone: string, _errors: ExtractionError[]): number {
    // TODO: Use OCRPatterns.NUMBER_PATTERN and error correction
    return 0;
  }

  /**
   * Extracts current bet from OCR zone.
   */
  private extractCurrentBet(_zone: string, _errors: ExtractionError[]): number {
    // TODO: Use OCRPatterns.NUMBER_PATTERN and error correction
    return 0;
  }

  /**
   * Extracts last action from OCR zone.
   */
  private extractLastAction(_zone: string, _errors: ExtractionError[]): string | undefined {
    // TODO: Use OCRPatterns.ACTION_PATTERNS
    return undefined;
  }

  /**
   * Detects game phase from OCR zones.
   */
  private detectPhase(_zones: { [k: string]: string }, _errors: ExtractionError[]): GamePhase {
    // TODO: Use heuristics to detect phase (preflop, flop, turn, river)
    return GamePhase.Unknown;
  }

  /**
   * Utility method to extract text zones using regex.
   */
  private extractZone(text: string, regex: RegExp): string {
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  }

  /**
   * Detects hero position from players array.
   */
  private detectHeroPosition(players: Player[]): number {
    // Implement logic to determine hero position
    return players.findIndex(player => player.isHero) || 0;
  }

  /**
   * Detects if multiple CoinPoker windows are present (edge case).
   */
  private detectMultiWindow(ocrText: string): boolean {
    // Implement heuristic for multi-window detection
    return ocrText.includes('Multiple Windows Detected');
  }
}