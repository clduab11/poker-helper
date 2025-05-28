import { EventEmitter } from 'events';

interface ScreenshotData {
  data: string;
  timestamp: number;
}

interface ExtractedData {
  text: string;
  cards: string[];
  timestamp: number;
  sequence?: number | undefined;
}

interface GameState {
  rawText: string;
  communityCards: string[];
  playerHand: string[];
  pot: number;
  activePlayer: string;
  timestamp: number;
  sequence?: number | undefined; 
}

interface Decision {
  action: string;
  reason: string;
  confidence: number;
  timestamp: number;
}

interface ModuleConfig {
  someSetting?: string;
  threshold?: number;
  anotherSetting?: boolean; 
}

// Mock ScreenCaptureModule
class MockScreenCaptureModule {
  public shutdown = jest.fn(async () => { /* console.log('ScreenCapture shutdown'); */ });
  constructor(private eventEmitter: EventEmitter) {
    this.eventEmitter.on('initiateShutdown', () => this.shutdown());
  }

  async captureAndEmit(screenshotContent: string = 'mock_screenshot_data_content', sequence?: number) {
    const mockScreenshotData: ScreenshotData & { sequence?: number } = { data: screenshotContent, timestamp: Date.now() };
    if (sequence !== undefined) mockScreenshotData.sequence = sequence;
    this.eventEmitter.emit('screenshotCaptured', mockScreenshotData); 
    return mockScreenshotData;
  }
}

// Mock DataExtractionModule
class MockDataExtractionModule {
  public handleScreenshot = jest.fn(); 
  private shouldFail = false;
  public config: ModuleConfig = { someSetting: 'defaultDataExtraction' };
  public shutdown = jest.fn(async () => { /* console.log('DataExtraction shutdown'); */ });

  simulateFailure(fail: boolean) {
    this.shouldFail = fail;
  }

  setConfig(newConfig: ModuleConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  async extractAndEmit(screenshotData: ScreenshotData & { sequence?: number }) {
    if (this.shouldFail) {
      throw new Error('Simulated DataExtractionModule failure');
    }
    const mockExtractedData: ExtractedData = { 
      text: `extracted_from_${screenshotData.data}_config:${this.config.someSetting}`, 
      cards: screenshotData.data.includes('flop') ? ['Ah', 'Kd', 'Qc'] : ['Ah', 'Kd'], 
      timestamp: Date.now(),
      sequence: screenshotData.sequence
    };
    this.eventEmitter.emit('dataExtracted', mockExtractedData);
    return mockExtractedData;
  }

  constructor(private eventEmitter: EventEmitter) {
    this.eventEmitter.on('screenshotCaptured', (data) => this.handleScreenshot(data));
    this.eventEmitter.on('configChanged', (newConfig: ModuleConfig) => this.setConfig(newConfig));
    this.eventEmitter.on('initiateShutdown', () => this.shutdown());
  }
}

// Mock GameStateManager
class MockGameStateManager {
  public handleExtractedData = jest.fn();
  public internalState: Partial<GameState> = {};
  public config: ModuleConfig = { someSetting: 'defaultGameState' };
  public shutdown = jest.fn(async () => { /* console.log('GameStateManager shutdown'); */ });
  
  setConfig(newConfig: ModuleConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  async updateAndEmitState(extractedData: ExtractedData) {
    const newGameState: GameState = { 
      rawText: extractedData.text, 
      communityCards: extractedData.cards, 
      playerHand: ['Qh', 'Js'], 
      pot: this.internalState.pot && extractedData.sequence !== 1 && this.internalState.sequence === (extractedData.sequence! -1) ? (this.internalState.pot + 50) : 100,
      activePlayer: `Player${extractedData.sequence || 1}`,
      timestamp: Date.now(),
      sequence: extractedData.sequence
    };
    this.internalState = newGameState; 
    this.eventEmitter.emit('gameStateUpdated', this.internalState);
    return this.internalState;
  }

  constructor(private eventEmitter: EventEmitter) {
    this.eventEmitter.on('dataExtracted', (data) => this.handleExtractedData(data));
    this.handleExtractedData.mockImplementation(async (data) => { 
       await this.updateAndEmitState(data); 
    });
    this.eventEmitter.on('configChanged', (newConfig: ModuleConfig) => this.setConfig(newConfig));
    this.eventEmitter.on('initiateShutdown', () => this.shutdown());
  }
}

// Mock DecisionEngine
class MockDecisionEngine {
  public handleNewGameState = jest.fn();
  public config: ModuleConfig = { threshold: 150 }; 
  public shutdown = jest.fn(async () => { /* console.log('DecisionEngine shutdown'); */ });

  setConfig(newConfig: ModuleConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  async processAndEmitDecision(gameState: GameState) {
    const mockDecision: Decision = {
      action: gameState.pot > (this.config.threshold || 150) ? 'raise' : 'fold', 
      reason: `Based on game state: ${gameState.rawText} sequence: ${gameState.sequence} with threshold ${this.config.threshold}`,
      confidence: 0.95,
      timestamp: Date.now()
    };
    this.eventEmitter.emit('decisionMade', mockDecision);
    return mockDecision;
  }

  constructor(private eventEmitter: EventEmitter) {
    this.eventEmitter.on('gameStateUpdated', (data) => this.handleNewGameState(data));
     this.handleNewGameState.mockImplementation(async (data) => { 
      await this.processAndEmitDecision(data); 
    });
    this.eventEmitter.on('configChanged', (newConfig: ModuleConfig) => this.setConfig(newConfig));
    this.eventEmitter.on('initiateShutdown', () => this.shutdown());
  }
}

// Mock OverlayUIModule
class MockOverlayUIModule {
  public handleDecision = jest.fn();
  public config: ModuleConfig = { someSetting: 'defaultOverlay' };
  public shutdown = jest.fn(async () => { /* console.log('OverlayUIModule shutdown'); */ });

  setConfig(newConfig: ModuleConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  constructor(private eventEmitter: EventEmitter) {
    this.eventEmitter.on('decisionMade', (data) => this.handleDecision(data));
    this.eventEmitter.on('configChanged', (newConfig: ModuleConfig) => this.setConfig(newConfig));
    this.eventEmitter.on('initiateShutdown', () => this.shutdown());
  }
}

describe('CoinPoker Intelligence Assistant - Module Interaction Tests', () => {
  let eventEmitter: EventEmitter;
  let screenCaptureModule: MockScreenCaptureModule; 
  let dataExtractionModule: MockDataExtractionModule;
  let gameStateManager: MockGameStateManager;
  let decisionEngine: MockDecisionEngine;
  let overlayUIModule: MockOverlayUIModule;

  beforeEach(() => {
    eventEmitter = new EventEmitter();
    eventEmitter.setMaxListeners(20); 
    screenCaptureModule = new MockScreenCaptureModule(eventEmitter); 
    dataExtractionModule = new MockDataExtractionModule(eventEmitter);
    gameStateManager = new MockGameStateManager(eventEmitter);
    decisionEngine = new MockDecisionEngine(eventEmitter);
    overlayUIModule = new MockOverlayUIModule(eventEmitter);

    dataExtractionModule.handleScreenshot.mockImplementation(async (data) => {
        await dataExtractionModule.extractAndEmit(data);
    });
  });

  it('should correctly pass screenshot data from ScreenCaptureModule to DataExtractionModule via event', async () => {
    await screenCaptureModule.captureAndEmit();
    await new Promise(resolve => setTimeout(resolve, 50)); 
    expect(dataExtractionModule.handleScreenshot).toHaveBeenCalledWith(
      expect.objectContaining({
        data: 'mock_screenshot_data_content',
        timestamp: expect.any(Number),
      })
    );
    expect(gameStateManager.handleExtractedData).toHaveBeenCalled();
  });

  it('should correctly pass extracted data from DataExtractionModule to GameStateManager via event', async () => {
    const mockScreenshotPayload: ScreenshotData & { sequence?: number } = { data: 'some_screenshot_data', timestamp: Date.now(), sequence: 1 };
    eventEmitter.emit('screenshotCaptured', mockScreenshotPayload); 
    await new Promise(resolve => setTimeout(resolve, 50)); 
    expect(gameStateManager.handleExtractedData).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'extracted_from_some_screenshot_data_config:defaultDataExtraction',
        cards: ['Ah', 'Kd'],
        sequence: 1,
        timestamp: expect.any(Number),
      })
    );
  });

  it('should correctly pass game state from GameStateManager to DecisionEngine via event', async () => {
    const mockExtractedDataPayload: ExtractedData = { text: 'some_text', cards: ['As', 'Ks'], timestamp: Date.now(), sequence: 1 };
    eventEmitter.emit('dataExtracted', mockExtractedDataPayload);
    await new Promise(resolve => setTimeout(resolve, 50)); 
    expect(decisionEngine.handleNewGameState).toHaveBeenCalledWith(
      expect.objectContaining({
        rawText: 'some_text',
        communityCards: ['As', 'Ks'],
        playerHand: ['Qh', 'Js'],
        pot: 100, 
        activePlayer: 'Player1',
        sequence: 1,
        timestamp: expect.any(Number),
      })
    );
  });

  it('should correctly pass decision from DecisionEngine to OverlayUIModule via event', async () => {
    const mockGameStatePayload: GameState = { rawText: 'complex_game_situation', communityCards: ['Ac', 'Kc', 'Qc'], playerHand: ['Jc', 'Tc'], pot: 500, activePlayer: 'Hero', timestamp: Date.now(), sequence: 1 };
    eventEmitter.emit('gameStateUpdated', mockGameStatePayload);
    await new Promise(resolve => setTimeout(resolve, 50)); 
    expect(overlayUIModule.handleDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'raise', 
        reason: expect.stringContaining('complex_game_situation sequence: 1 with threshold 150'),
        confidence: 0.95, 
        timestamp: expect.any(Number),
      })
    );
  });

  it('should maintain state consistency when ScreenCaptureModule produces new data', async () => {
    await screenCaptureModule.captureAndEmit('initial_screenshot', 1);
    await new Promise(resolve => setTimeout(resolve, 150)); 

    await screenCaptureModule.captureAndEmit('updated_screenshot_flop', 2);
    await new Promise(resolve => setTimeout(resolve, 150)); 

    expect(gameStateManager.internalState).toEqual(
      expect.objectContaining({
        rawText: 'extracted_from_updated_screenshot_flop_config:defaultDataExtraction', 
        communityCards: ['Ah', 'Kd', 'Qc'], 
        pot: 150, 
        activePlayer: 'Player2', 
        sequence: 2 
      })
    );
  });
  
  it('should recover if DataExtractionModule fails and restarts', async () => {
    const screenshot1: ScreenshotData & { sequence?: number } = { data: 'screenshot_before_fail', timestamp: Date.now(), sequence: 1 };
    const screenshot2: ScreenshotData & { sequence?: number } = { data: 'screenshot_after_recovery', timestamp: Date.now(), sequence: 2 };
    
    gameStateManager.handleExtractedData.mockClear(); 

    dataExtractionModule.simulateFailure(true);
    dataExtractionModule.handleScreenshot.mockImplementationOnce(async (data) => {
      try {
        await dataExtractionModule.extractAndEmit(data);
      } catch (error) {
        // Error is expected
      }
    });
    await screenCaptureModule.captureAndEmit(screenshot1.data, screenshot1.sequence);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(gameStateManager.handleExtractedData).not.toHaveBeenCalled();

    dataExtractionModule.simulateFailure(false);
    dataExtractionModule.handleScreenshot.mockImplementationOnce(async (data) => { 
       await dataExtractionModule.extractAndEmit(data);
    });
    
    await screenCaptureModule.captureAndEmit(screenshot2.data, screenshot2.sequence);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(gameStateManager.handleExtractedData).toHaveBeenCalledWith(
       expect.objectContaining({
         text: 'extracted_from_screenshot_after_recovery_config:defaultDataExtraction', 
         cards: ['Ah', 'Kd'], 
         sequence: 2,
       })
    );
  });

  it('should propagate configuration changes to relevant modules', async () => {
    const newConfig: ModuleConfig = { someSetting: 'newGlobalSetting', threshold: 300, anotherSetting: true };
    
    eventEmitter.emit('configChanged', newConfig);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(dataExtractionModule.config.someSetting).toBe('newGlobalSetting'); 
    expect(gameStateManager.config.someSetting).toBe('newGlobalSetting');
    expect(decisionEngine.config.threshold).toBe(300);
    expect(overlayUIModule.config.someSetting).toBe('newGlobalSetting');
    expect(overlayUIModule.config.anotherSetting).toBe(true);
  });

  it('should execute graceful shutdown sequence for all modules', async () => {
    eventEmitter.emit('initiateShutdown');
    await new Promise(resolve => setTimeout(resolve, 10));

    // For Green Phase: Assert shutdown methods were called
    expect(screenCaptureModule.shutdown).toHaveBeenCalled();
    expect(dataExtractionModule.shutdown).toHaveBeenCalled();
    expect(gameStateManager.shutdown).toHaveBeenCalled();
    expect(decisionEngine.shutdown).toHaveBeenCalled();
    expect(overlayUIModule.shutdown).toHaveBeenCalled();
  });
});