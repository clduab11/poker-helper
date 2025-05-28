# CoinPoker Real-Time Analysis Tool - Domain Model

## Overview
This document outlines the domain model for the CoinPoker real-time analysis tool, identifying core entities, their attributes, relationships, and data structures. The model supports the functional requirements defined in `phase_1_requirements.md` and ensures a clear understanding of the system's data and behavior.

## Core Entities and Attributes

### 1. GameState
- **Description**: Represents the current state of a poker game on CoinPoker as extracted from screenshots.
- **Attributes**:
  - `gameId`: Unique identifier for the game session.
  - `timestamp`: Time of the latest state capture.
  - `playerHand`: Array of cards held by the user (e.g., [{suit, value}]).
  - `communityCards`: Array of shared cards on the table.
  - `potSize`: Current amount in the pot.
  - `playerChips`: User's current chip count.
  - `opponentActions`: Array of recent actions by opponents (e.g., [{playerId, action, amount}]).
  - `currentPhase`: Current game phase (e.g., pre-flop, flop, turn, river).
- **Validation Rules**:
  - `playerHand` must contain 0-2 cards before flop, exactly 2 post-flop.
  - `communityCards` must range from 0-5 based on game phase.
  - `potSize` and `playerChips` must be non-negative.

### 2. Recommendation
- **Description**: Represents the decision support output from the LLM for the current game state.
- **Attributes**:
  - `recommendationId`: Unique identifier for the recommendation.
  - `gameStateId`: Reference to associated GameState.
  - `action`: Recommended action (bet, raise, call, fold).
  - `confidence`: Confidence level of the recommendation (0-1).
  - `rationale`: Brief explanation of the recommendation logic.
  - `timestamp`: Time of recommendation generation.
- **Validation Rules**:
  - `action` must be one of the predefined options.
  - `confidence` must be between 0 and 1.

### 3. ScreenCapture
- **Description**: Represents raw data from a screenshot of the CoinPoker interface.
- **Attributes**:
  - `captureId`: Unique identifier for the capture.
  - `timestamp`: Time of capture.
  - `resolution`: Screen resolution at time of capture (e.g., {width, height}).
  - `rawData`: Reference to the image data (placeholder for actual storage).
  - `extractedData`: Structured data extracted from the screenshot (links to GameState).
- **Validation Rules**:
  - `resolution` must match supported configurations.
  - `timestamp` must be current within system clock tolerance.

### 4. OverlayConfiguration
- **Description**: Represents user preferences for the UI overlay displaying recommendations.
- **Attributes**:
  - `configId`: Unique identifier for the configuration.
  - `position`: Overlay position on screen (e.g., {x, y}).
  - `transparency`: Transparency level (0-1).
  - `visibleElements`: Array of elements to display (e.g., action, confidence, rationale).
  - `fontSize`: Size of text in overlay.
- **Validation Rules**:
  - `transparency` must be between 0 and 1.
  - `position` must be within screen bounds.
  - `visibleElements` must contain at least one element.

### 5. SecurityProfile
- **Description**: Represents settings and strategies to evade detection by CoinPoker security.
- **Attributes**:
  - `profileId`: Unique identifier for the security profile.
  - `detectionAvoidanceStrategies`: Array of active strategies (e.g., randomized delays, minimal system footprint).
  - `lastUpdated`: Timestamp of last profile update.
- **Validation Rules**:
  - `detectionAvoidanceStrategies` must not be empty.

## Relationships
- **GameState to Recommendation**: One-to-Many (one game state can have multiple recommendations over time, but typically one per decision cycle).
- **ScreenCapture to GameState**: One-to-One (each capture results in one game state update).
- **OverlayConfiguration to User Session**: One-to-One (each user session has a specific overlay configuration).
- **SecurityProfile to System**: One-to-One (a single active security profile for the application).

## Data Structures
Below are the conceptual data structures for key entities, focusing on logical organization without implementation details.

### GameState Structure
```
GameState {
  gameId: String
  timestamp: DateTime
  playerHand: Array<Card> // Card: {suit: String, value: String}
  communityCards: Array<Card>
  potSize: Number
  playerChips: Number
  opponentActions: Array<Action> // Action: {playerId: String, action: String, amount: Number}
  currentPhase: String
}
```

### Recommendation Structure
```
Recommendation {
  recommendationId: String
  gameStateId: String
  action: String // Enum: ["bet", "raise", "call", "fold"]
  confidence: Number // Range: 0-1
  rationale: String
  timestamp: DateTime
}
```

### ScreenCapture Structure
```
ScreenCapture {
  captureId: String
  timestamp: DateTime
  resolution: Object // {width: Number, height: Number}
  rawData: Reference // Placeholder for image data
  extractedData: Reference // Links to GameState
}
```

## State Transitions
- **GameState**: Transitions based on game phase (pre-flop → flop → turn → river → showdown) driven by screenshot updates.
- **Recommendation**: Generated per decision cycle, state changes from pending to delivered once displayed in overlay.
- **ScreenCapture**: Moves from raw capture to processed state after data extraction.

## Business Rules and Invariants
- **Rule 1**: A new GameState must be created only when significant changes are detected in screenshot data.
- **Rule 2**: Recommendations must be tied to the most recent GameState to ensure relevance.
- **Invariant 1**: OverlayConfiguration must always have at least one visible element to ensure usability.
- **Invariant 2**: SecurityProfile must always be active to minimize detection risk.

## Events and Event Flows
- **Event 1: ScreenCaptureTriggered**
  - Trigger: Periodic timer or user action.
  - Flow: Capture screenshot → Extract data → Update GameState.
- **Event 2: GameStateUpdated**
  - Trigger: New data extracted from screenshot.
  - Flow: Update GameState → Request Recommendation from LLM → Update Overlay.
- **Event 3: RecommendationReceived**
  - Trigger: LLM API response.
  - Flow: Store Recommendation → Update Overlay display.
- **Event 4: OverlayConfigurationChanged**
  - Trigger: User updates settings.
  - Flow: Update OverlayConfiguration → Refresh UI display.

## Aggregate Boundaries
- **Game Analysis Aggregate**: Includes GameState, ScreenCapture, and Recommendation. Ensures consistency in game data and decision support.
- **UI Aggregate**: Includes OverlayConfiguration. Manages user interface preferences independently.
- **Security Aggregate**: Includes SecurityProfile. Handles anti-detection measures as a separate concern.

## Queries and Read Models
- **Query 1: CurrentGameState**
  - Purpose: Retrieve the latest game state for analysis or display.
  - Data: Latest GameState entity.
- **Query 2: LatestRecommendation**
  - Purpose: Fetch the most recent recommendation for the current game state.
  - Data: Latest Recommendation linked to current GameState.
- **Query 3: OverlaySettings**
  - Purpose: Retrieve current overlay configuration for UI rendering.
  - Data: Current OverlayConfiguration.

## Glossary
- **Card**: Representation of a poker card with suit (hearts, diamonds, clubs, spades) and value (2-10, J, Q, K, A).
- **Action**: A player’s move in the game, such as bet, raise, call, or fold, often with an associated chip amount.
- **Decision Cycle**: The process from capturing game state to displaying a recommendation.