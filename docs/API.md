# CoinPoker Intelligence Assistant - API Documentation

## Table of Contents

- [Overview](#overview)
- [Module APIs](#module-apis)
  - [ScreenCaptureModule](#screencapturemodule)
  - [DataExtractionModule](#dataextractionmodule)
  - [GameStateManager](#gamestatemanager)
  - [DecisionEngine](#decisionengine)
  - [OverlayUIModule](#overlayuimodule)
  - [SecurityManager](#securitymanager)
- [Data Interfaces](#data-interfaces)
  - [ScreenCapture](#screencapture)
  - [GameState](#gamestate)
  - [Decision](#decision)
  - [Recommendation](#recommendation)
  - [Overlay](#overlay)
  - [Security](#security)
  - [Orchestration](#orchestration)
- [Event Specifications](#event-specifications)
- [Configuration Options](#configuration-options)
- [Code Examples](#code-examples)

## Overview

This document provides detailed API documentation for the CoinPoker Intelligence Assistant modules, interfaces, and events. Each module exposes a specific API for integration with other components of the system.

## Module APIs

### ScreenCaptureModule

The ScreenCaptureModule is responsible for capturing screenshots of the poker table.

#### Methods

| Method | Description | Parameters | Return Type |
|--------|-------------|------------|-------------|
| `capture()` | Captures a screenshot of the poker table | None | Promise\<ScreenCapture\> |
| `startCapturing(interval: number)` | Starts capturing screenshots at specified interval | interval: Time in ms between captures | void |
| `stopCapturing()` | Stops the screenshot capture process | None | void |
| `setRegion(region: CaptureRegion)` | Sets the screen region to capture | region: Coordinates and dimensions | void |
| `getLastCapture()` | Returns the most recent screenshot | None | ScreenCapture \| null |

#### Events

- `capture:success` - Emitted when a screenshot is successfully captured
- `capture:error` - Emitted when screenshot capture fails

#### Configuration

```typescript
interface ScreenCaptureConfig {
  interval: number;        // Milliseconds between captures
  region?: CaptureRegion;  // Optional specific region to capture
  format: 'png' | 'jpeg';  // Image format
  quality: number;         // Image quality (1-100)
}

interface CaptureRegion {
  x: number;               // X coordinate
  y: number;               // Y coordinate
  width: number;           // Width of region
  height: number;          // Height of region
}
```

### DataExtractionModule

The DataExtractionModule extracts structured game data from screenshots using OCR.

#### Methods

| Method | Description | Parameters | Return Type |
|--------|-------------|------------|-------------|
| `extract(capture: ScreenCapture)` | Extracts game data from screenshot | capture: Screenshot object | Promise\<GameState\> |
| `extractText(region: ImageRegion)` | Extracts text from a specific region | region: Region of the image | Promise\<string\> |
| `extractCards(region: ImageRegion)` | Extracts card information | region: Region of the image | Promise\<Card[]\> |
| `extractChips(region: ImageRegion)` | Extracts chip amounts | region: Region of the image | Promise\<number\> |
| `calibrate()` | Calibrates OCR for current table layout | None | Promise\<boolean\> |

#### Events

- `extraction:success` - Emitted when data extraction succeeds
- `extraction:error` - Emitted when data extraction fails
- `extraction:partial` - Emitted when only partial data could be extracted

#### Configuration

```typescript
interface DataExtractionConfig {
  ocrLanguage: string;           // OCR language (e.g., 'eng')
  confidenceThreshold: number;   // Minimum confidence for OCR results (0-1)
  preprocessingEnabled: boolean; // Whether to preprocess images
  patterns: OCRPatterns;         // Patterns for recognizing game elements
}

interface OCRPatterns {
  cards: RegExp;                 // Pattern for recognizing cards
  chips: RegExp;                 // Pattern for recognizing chip amounts
  playerNames: RegExp;           // Pattern for recognizing player names
  actions: RegExp;               // Pattern for recognizing player actions
}
```

### GameStateManager

The GameStateManager maintains and updates the current game state.

#### Methods

| Method | Description | Parameters | Return Type |
|--------|-------------|------------|-------------|
| `update(gameState: GameState)` | Updates the current game state | gameState: New game state | void |
| `getCurrent()` | Gets the current game state | None | GameState |
| `getHistory()` | Gets the history of game states | None | GameState[] |
| `reset()` | Resets the game state | None | void |
| `detectStateChange(newState: GameState)` | Detects significant changes in state | newState: New game state | StateChange |

#### Events

- `state:updated` - Emitted when game state is updated
- `state:significant-change` - Emitted when a significant change is detected
- `state:reset` - Emitted when game state is reset

#### Configuration

```typescript
interface GameStateManagerConfig {
  historySize: number;           // Number of historical states to keep
  significantChangeThreshold: number; // Threshold for significant changes
  stateDiffAlgorithm: 'simple' | 'detailed'; // Algorithm for state comparison
}
```

### DecisionEngine

The DecisionEngine interfaces with LLM APIs to generate poker recommendations.

#### Methods

| Method | Description | Parameters | Return Type |
|--------|-------------|------------|-------------|
| `recommend(gameState: GameState)` | Generates a recommendation | gameState: Current game state | Promise\<Recommendation\> |
| `explainRecommendation(recommendation: Recommendation)` | Explains reasoning | recommendation: Recommendation object | Promise\<string\> |
| `clearCache()` | Clears the recommendation cache | None | void |
| `setModel(model: string)` | Sets the LLM model to use | model: Model identifier | void |
| `getLastRecommendation()` | Gets the most recent recommendation | None | Recommendation \| null |

#### Events

- `recommendation:generated` - Emitted when a recommendation is generated
- `recommendation:error` - Emitted when recommendation generation fails
- `recommendation:cached` - Emitted when a cached recommendation is used

#### Configuration

```typescript
interface DecisionEngineConfig {
  provider: 'gemini' | 'openai';  // LLM provider
  model: string;                  // Model name (e.g., 'gemini-pro', 'gpt-4-turbo')
  apiEndpoint: string;            // API endpoint URL
  maxTokens: number;              // Maximum tokens for response
  temperature: number;            // Temperature for generation (0-1)
  cacheSize: number;              // Size of LRU cache
  timeout: number;                // API timeout in milliseconds
}
```

### OverlayUIModule

The OverlayUIModule displays recommendations as an overlay UI.

#### Methods

| Method | Description | Parameters | Return Type |
|--------|-------------|------------|-------------|
| `display(recommendation: Recommendation)` | Displays a recommendation | recommendation: Recommendation to display | void |
| `show()` | Shows the overlay | None | void |
| `hide()` | Hides the overlay | None | void |
| `setPosition(position: OverlayPosition)` | Sets overlay position | position: Position on screen | void |
| `setOpacity(opacity: number)` | Sets overlay opacity | opacity: Opacity value (0-1) | void |
| `setTheme(theme: OverlayTheme)` | Sets overlay theme | theme: UI theme | void |

#### Events

- `overlay:shown` - Emitted when overlay is shown
- `overlay:hidden` - Emitted when overlay is hidden
- `overlay:updated` - Emitted when overlay content is updated

#### Configuration

```typescript
interface OverlayUIConfig {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  opacity: number;                // Opacity (0-1)
  width: number;                  // Width in pixels
  height: number;                 // Height in pixels
  theme: 'light' | 'dark';        // UI theme
  fontSize: number;               // Font size in pixels
  showConfidence: boolean;        // Whether to show confidence scores
  showRationale: boolean;         // Whether to show reasoning
}
```

### SecurityManager

The SecurityManager implements anti-detection and process isolation.

#### Methods

| Method | Description | Parameters | Return Type |
|--------|-------------|------------|-------------|
| `applySecurityProfile(profile: SecurityProfile)` | Applies security settings | profile: Security profile | void |
| `randomizeTimings()` | Randomizes operation timings | None | void |
| `monitorResources()` | Monitors system resource usage | None | ResourceUsage |
| `isolateProcess()` | Ensures process isolation | None | boolean |
| `assessRisk()` | Assesses current detection risk | None | RiskAssessment |

#### Events

- `security:risk-detected` - Emitted when a security risk is detected
- `security:profile-applied` - Emitted when a security profile is applied
- `security:resource-warning` - Emitted when resource usage is high

#### Configuration

```typescript
interface SecurityManagerConfig {
  antiDetectionEnabled: boolean;  // Whether anti-detection is enabled
  randomizeTimings: boolean;      // Whether to randomize operation timings
  minProcessingDelay: number;     // Minimum processing delay in ms
  maxProcessingDelay: number;     // Maximum processing delay in ms
  resourceMonitoringInterval: number; // Resource monitoring interval in ms
  maxCpuUsage: number;            // Maximum CPU usage percentage
  maxMemoryUsage: number;         // Maximum memory usage in MB
}
```

## Data Interfaces

### ScreenCapture

```typescript
interface ScreenCapture {
  captureId: string;              // Unique identifier
  timestamp: number;              // Unix timestamp
  resolution: {                   // Resolution of capture
    width: number;
    height: number;
  };
  format: 'png' | 'jpeg';         // Image format
  rawData: Buffer;                // Raw image data
  base64Data?: string;            // Optional base64 encoded data
}
```

### GameState

```typescript
interface GameState {
  gameId: string;                 // Unique identifier for the game
  timestamp: number;              // Unix timestamp
  tableId?: string;               // Table identifier
  gameType: 'cash' | 'tournament'; // Game type
  
  // Player information
  playerHand: Card[];             // Player's cards
  playerChips: number;            // Player's chip count
  playerPosition: Position;       // Player's position
  
  // Community cards
  communityCards: Card[];         // Community cards
  
  // Game state
  currentPhase: GamePhase;        // Current phase of the game
  potSize: number;                // Current pot size
  currentBet: number;             // Current bet amount
  
  // Other players
  opponents: Opponent[];          // Information about opponents
  
  // History
  lastActions: Action[];          // Recent actions
}

type GamePhase = 'preflop' | 'flop' | 'turn' | 'river';

interface Card {
  rank: Rank;                     // Card rank
  suit: Suit;                     // Card suit
}

type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

type Position = 'SB' | 'BB' | 'UTG' | 'MP' | 'CO' | 'BTN';

interface Opponent {
  position: Position;             // Opponent's position
  chips: number;                  // Opponent's chip count
  lastAction?: Action;            // Opponent's last action
  betAmount?: number;             // Amount bet by opponent
}

interface Action {
  player: 'self' | Position;      // Player who took the action
  type: ActionType;               // Type of action
  amount?: number;                // Amount (for bet/raise)
  timestamp: number;              // When the action occurred
}

type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in';
```

### Decision

```typescript
interface Decision {
  decisionId: string;             // Unique identifier
  gameStateId: string;            // Associated game state
  timestamp: number;              // Unix timestamp
  
  // Decision details
  action: ActionType;             // Recommended action
  amount?: number;                // Amount (for bet/raise)
  confidence: number;             // Confidence score (0-1)
  
  // Reasoning
  factors: Factor[];              // Factors considered
  alternatives: Alternative[];    // Alternative actions considered
}

interface Factor {
  name: string;                   // Name of the factor
  weight: number;                 // Weight in decision (0-1)
  description: string;            // Description of the factor
}

interface Alternative {
  action: ActionType;             // Alternative action
  amount?: number;                // Amount (for bet/raise)
  confidence: number;             // Confidence score (0-1)
  reason: string;                 // Reason this wasn't chosen
}
```

### Recommendation

```typescript
interface Recommendation {
  recommendationId: string;       // Unique identifier
  gameStateId: string;            // Associated game state
  decisionId: string;             // Associated decision
  timestamp: number;              // Unix timestamp
  
  // Recommendation details
  action: ActionType;             // Recommended action
  amount?: number;                // Amount (for bet/raise)
  confidence: number;             // Confidence score (0-1)
  
  // Presentation
  summary: string;                // Short summary
  rationale: string;              // Detailed rationale
  urgency: 'low' | 'medium' | 'high'; // Urgency level
}
```

### Overlay

```typescript
interface OverlayConfig {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  opacity: number;                // Opacity (0-1)
  width: number;                  // Width in pixels
  height: number;                 // Height in pixels
  theme: 'light' | 'dark';        // UI theme
  fontSize: number;               // Font size in pixels
  showConfidence: boolean;        // Whether to show confidence scores
  showRationale: boolean;         // Whether to show reasoning
}

interface OverlayState {
  visible: boolean;               // Whether overlay is visible
  currentRecommendation?: Recommendation; // Current recommendation
  position: OverlayPosition;      // Current position
  opacity: number;                // Current opacity
}

interface OverlayPosition {
  x: number;                      // X coordinate
  y: number;                      // Y coordinate
}
```

### Security

```typescript
interface SecurityProfile {
  profileId: string;              // Unique identifier
  name: string;                   // Profile name
  description: string;            // Profile description
  
  // Anti-detection settings
  randomizeTimings: boolean;      // Whether to randomize timings
  minDelay: number;               // Minimum delay in ms
  maxDelay: number;               // Maximum delay in ms
  
  // Resource limits
  maxCpuUsage: number;            // Maximum CPU usage percentage
  maxMemoryUsage: number;         // Maximum memory usage in MB
  
  // Process isolation
  isolationLevel: 'low' | 'medium' | 'high'; // Level of process isolation
  
  // Last updated
  lastUpdated: number;            // Unix timestamp
}

interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high'; // Overall risk level
  factors: {                      // Risk factors
    resourceUsage: number;        // Resource usage risk (0-1)
    patternDetection: number;     // Pattern detection risk (0-1)
    timingAnalysis: number;       // Timing analysis risk (0-1)
  };
  recommendations: string[];      // Risk mitigation recommendations
}

interface ResourceUsage {
  cpu: number;                    // CPU usage percentage
  memory: number;                 // Memory usage in MB
  gpu?: number;                   // GPU usage percentage (if available)
  timestamp: number;              // Unix timestamp
}
```

### Orchestration

```typescript
interface OrchestrationConfig {
  modules: {                      // Enabled modules
    screenCapture: boolean;
    dataExtraction: boolean;
    gameState: boolean;
    decision: boolean;
    overlay: boolean;
    security: boolean;
  };
  eventBus: {                     // Event bus configuration
    bufferSize: number;           // Event buffer size
    maxListeners: number;         // Maximum event listeners
  };
  dependencies: {                 // Module dependencies
    [key: string]: string[];      // Module -> dependencies
  };
  startupSequence: string[];      // Module startup sequence
  shutdownSequence: string[];     // Module shutdown sequence
}
```

## Event Specifications

The system uses an event-driven architecture with the following core events:

### Core Events

| Event Name | Description | Payload |
|------------|-------------|---------|
| `capture:success` | Screenshot captured | ScreenCapture |
| `capture:error` | Screenshot capture failed | Error |
| `extraction:success` | Data extraction succeeded | GameState |
| `extraction:error` | Data extraction failed | Error |
| `state:updated` | Game state updated | GameState |
| `state:significant-change` | Significant state change | StateChange |
| `decision:generated` | Decision generated | Decision |
| `recommendation:generated` | Recommendation generated | Recommendation |
| `overlay:updated` | Overlay updated | OverlayState |
| `security:risk-detected` | Security risk detected | RiskAssessment |

### Event Subscription Example

```typescript
// Subscribe to events
eventBus.on('capture:success', (capture: ScreenCapture) => {
  console.log(`Capture successful: ${capture.captureId}`);
});

// Emit events
eventBus.emit('capture:success', captureObject);
```

## Configuration Options

The application can be configured through environment variables or a configuration file:

### Environment Variables

```
# LLM API Configuration
LLM_API_KEY=your_api_key_here
LLM_PROVIDER=gemini  # or 'openai'
LLM_MODEL=gemini-pro  # or 'gpt-4-turbo'
LLM_API_ENDPOINT=https://generativelanguage.googleapis.com/v1beta

# Application Settings
LOG_LEVEL=info  # debug, info, warn, error
PERFORMANCE_MONITORING=true
MAX_LATENCY_MS=200
SCREENSHOT_INTERVAL_MS=500

# UI Overlay Settings
OVERLAY_OPACITY=0.9
OVERLAY_POSITION=top-right  # top-left, top-right, bottom-left, bottom-right
OVERLAY_WIDTH=300
OVERLAY_HEIGHT=200

# OCR Configuration
OCR_LANGUAGE=eng
OCR_CONFIDENCE_THRESHOLD=0.8
IMAGE_PREPROCESSING=true

# Security Settings
ANTI_DETECTION_ENABLED=true
RANDOMIZE_TIMING=true
MIN_PROCESSING_DELAY_MS=50
MAX_PROCESSING_DELAY_MS=150
```

### Configuration File

Alternatively, create a `config.json` file:

```json
{
  "llm": {
    "provider": "gemini",
    "model": "gemini-pro",
    "apiEndpoint": "https://generativelanguage.googleapis.com/v1beta"
  },
  "application": {
    "logLevel": "info",
    "performanceMonitoring": true,
    "maxLatencyMs": 200,
    "screenshotIntervalMs": 500
  },
  "overlay": {
    "opacity": 0.9,
    "position": "top-right",
    "width": 300,
    "height": 200
  },
  "ocr": {
    "language": "eng",
    "confidenceThreshold": 0.8,
    "imagePreprocessing": true
  },
  "security": {
    "antiDetectionEnabled": true,
    "randomizeTiming": true,
    "minProcessingDelayMs": 50,
    "maxProcessingDelayMs": 150
  }
}
```

## Code Examples

### Basic Integration Example

```typescript
import { 
  ScreenCaptureModule, 
  DataExtractionModule,
  GameStateManager,
  DecisionEngine,
  OverlayUIModule,
  SecurityManager,
  MainOrchestrator
} from 'coinpoker-intelligence-assistant';

// Initialize the orchestrator
const orchestrator = new MainOrchestrator({
  modules: {
    screenCapture: true,
    dataExtraction: true,
    gameState: true,
    decision: true,
    overlay: true,
    security: true
  }
});

// Start the application
orchestrator.start()
  .then(() => {
    console.log('CoinPoker Intelligence Assistant started');
  })
  .catch(error => {
    console.error('Failed to start:', error);
  });

// Access individual modules if needed
const decisionEngine = orchestrator.getModule('decision') as DecisionEngine;
const overlay = orchestrator.getModule('overlay') as OverlayUIModule;

// Listen for recommendations
orchestrator.eventBus.on('recommendation:generated', (recommendation) => {
  console.log(`New recommendation: ${recommendation.action}`);
});

// Stop the application
function shutdown() {
  orchestrator.stop()
    .then(() => {
      console.log('CoinPoker Intelligence Assistant stopped');
    });
}
```

### Custom Module Integration

```typescript
import { BaseModule, GameState, Recommendation } from 'coinpoker-intelligence-assistant';

// Create a custom analytics module
class AnalyticsModule extends BaseModule {
  constructor() {
    super('analytics');
  }

  initialize() {
    // Subscribe to events
    this.eventBus.on('state:updated', this.analyzeState.bind(this));
    this.eventBus.on('recommendation:generated', this.trackRecommendation.bind(this));
    return Promise.resolve();
  }

  analyzeState(gameState: GameState) {
    // Analyze game state
    console.log(`Analyzing game state: ${gameState.gameId}`);
  }

  trackRecommendation(recommendation: Recommendation) {
    // Track recommendation
    console.log(`Tracking recommendation: ${recommendation.recommendationId}`);
  }
}

// Register with orchestrator
const orchestrator = new MainOrchestrator();
orchestrator.registerModule(new AnalyticsModule());
orchestrator.start();