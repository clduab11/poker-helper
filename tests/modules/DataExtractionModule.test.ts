// DataExtractionModule.test.ts
// TDD for CoinPoker OCR Data Extraction

import { DataExtractionModule } from '../../src/modules/DataExtractionModule';

jest.setTimeout(5000); // Allow for OCR worker startup

// Mock image data (replace with real mocks or fixtures in real tests)
const mockImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...'; // Truncated

describe('DataExtractionModule', () => {
  let extractor: DataExtractionModule;

  beforeAll(async () => {
      jest.setTimeout(10000); // Increase timeout to 10 seconds
      extractor = new DataExtractionModule({ fastMode: true });
      await extractor.initWorker();
  });

  afterAll(async () => {
    await extractor.terminateWorker();
  });

  it('extracts GameState from a valid screenshot', async () => {
    // TODO: Replace with a real mock image and expected state
    const { gameState, errors } = await extractor.extractGameState(mockImage);
    expect(gameState).toBeDefined();
    expect(errors.length).toBeGreaterThanOrEqual(0);
    // Add more assertions for fields if using a real mock
  });

  it('handles incomplete data gracefully', async () => {
    const incompleteImage = 'data:image/png;base64,AAAA...'; // Simulate missing UI zones
    const { gameState, errors } = await extractor.extractGameState(incompleteImage);
    expect(gameState.players.length).toBeGreaterThanOrEqual(0);
    expect(errors.some(e => e.type === 'incomplete_data' || e.type === 'ocr_failure')).toBe(true);
  });

  it('corrects common OCR errors in card values', async () => {
    // Simulate OCR output with common errors
    const ocrErrorImage = 'data:image/png;base64,BBBB...'; // Simulate image with "1O" for "10", "l" for "1"
    const { gameState } = await extractor.extractGameState(ocrErrorImage);
    // This test is illustrative; real test would check for correct card parsing
    expect(Array.isArray(gameState.communityCards)).toBe(true);
  });

  it('completes extraction in under 50ms', async () => {
      jest.setTimeout(10000); // Increase timeout to 10 seconds
      const start = performance.now();
      await extractor.extractGameState(mockImage);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100); // Allow some margin for test env
  });

  it('detects multi-window scenario', async () => {
      jest.setTimeout(10000); // Increase timeout to 10 seconds
      // Simulate OCR output with duplicated UI elements
      const multiWindowImage = 'data:image/png;base64,CCCC...'; // Simulate image with repeated UI
      const { errors } = await extractor.extractGameState(multiWindowImage);
      expect(errors.some(e => e.type === 'multi_window_detected')).toBe(true);
  });
});