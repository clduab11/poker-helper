# CoinPoker Intelligence Assistant - System Architecture

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
  - [Architectural Pattern](#architectural-pattern)
  - [Core Modules](#core-modules)
  - [Technology Stack](#technology-stack)
- [Data Flow](#data-flow)
- [Security Architecture](#security-architecture)
- [Performance Optimization](#performance-optimization)
- [MCP Integration](#mcp-integration)
- [Diagrams](#diagrams)

## Overview

The CoinPoker Intelligence Assistant is designed as a modular, event-driven application that provides real-time poker analysis through screen capture, OCR, and AI-powered recommendations. The system operates with strict performance requirements (sub-200ms latency) and robust security measures to ensure responsible usage.

## System Architecture

### Architectural Pattern

The application follows an **Event-Driven Modular Monolith** architecture:

- **Electron/Node.js Application**: Combines frontend and backend in a desktop application
- **Clear Service Boundaries**: Each module has well-defined responsibilities and interfaces
- **Event Bus Communication**: Modules communicate through an event system for loose coupling
- **Optional MCP Server**: Model Context Protocol server for orchestration and tool integration

### Core Modules

| Module | Description | Key Responsibilities |
|--------|-------------|----------------------|
| **ScreenCaptureModule** | Captures screenshots of CoinPoker window | Timed capture, resolution adaptation, error handling |
| **DataExtractionModule** | Extracts structured game data from screenshots | OCR, layout detection, error correction |
| **GameStateManager** | Maintains and updates current game state | State diffing, validation, event emission |
| **DecisionEngine** | Interfaces with LLM APIs for recommendations | API formatting, caching, fallback logic |
| **OverlayUIModule** | Displays recommendations as overlay UI | Rendering, customization, user interaction |
| **SecurityManager** | Implements anti-detection and process isolation | Randomization, resource monitoring, risk mitigation |
| **ConfigurationManager** | Manages user/system settings and credentials | Settings storage, validation, secure credential handling |
| **MCP Integration** | Custom MCP server for poker data management | Game state resource endpoints, tool interfaces, event streaming |

### Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | Electron, React | Cross-platform overlay UI with customization |
| Backend | Node.js, TypeScript | Type-safe, modular services with event-driven architecture |
| OCR | Tesseract.js (WebAssembly) | Fast, local text extraction without external dependencies |
| LLM API | Gemini Pro, GPT-4 Turbo | AI-powered decision logic with fallback options |
| MCP | Custom Node.js MCP server | Poker data orchestration and tool integration |
| IPC/Event | Node.js EventEmitter, WebSocket | Low-latency, event-driven communication |
| Security | OS process isolation, env vars | Anti-detection, secure credential management |
| Monitoring | Prometheus, custom logging | Telemetry, performance tracking, error monitoring |

## Data Flow

The system follows a clear event-driven data flow:

1. **Screen Capture**: `ScreenCaptureModule` captures poker table screenshots on a timer
2. **Data Extraction**: Images are processed by `DataExtractionModule` using OCR
3. **State Management**: Structured data is passed to `GameStateManager` for validation
4. **Decision Making**: On significant state changes, `DecisionEngine` queries LLM API
5. **UI Display**: Recommendations are sent to `OverlayUIModule` for display
6. **Security Monitoring**: `SecurityManager` monitors and adjusts behavior throughout
7. **Event Logging**: All modules emit events to MCP for logging and monitoring

```
[User] → [OverlayUIModule (Electron/React)] ↔ [Node.js Core Services]
                                                     ↓
                                               [ScreenCaptureModule]
                                                     ↓
                                               [DataExtractionModule]
                                                     ↓
                                               [GameStateManager]
                                                     ↓
                                               [DecisionEngine] → [LLM API]
                                                     ↓
                                               [SecurityManager]
                                                     ↓
                                               [ConfigurationManager]
                                                     ↓
                                               [MCP Integration] → [MCP Server]
```

## Security Architecture

The application implements several security measures:

- **Process Isolation**: Electron renderer (UI) and Node.js backend run in separate processes
- **Anti-Detection**: No direct CoinPoker API/memory access; randomized timing and minimal resource footprint
- **Credential Management**: All secrets via environment variables or secure OS store
- **Encrypted Communication**: Secure LLM API communication with proper authentication

## Performance Optimization

To meet the sub-200ms latency requirement:

- **Parallel Processing**: Screen capture, OCR, and LLM calls run in parallel where possible
- **Caching**: LRU cache for LLM responses to avoid redundant API calls
- **Fallback Mechanisms**: Last known good recommendation used on API timeout
- **Event Queue**: Proper backpressure handling to prevent system overload
- **Resource Monitoring**: Performance metrics tracked for optimization

## MCP Integration

The MCP (Model Context Protocol) server provides:

- **Game State Resource**: `/game-state` endpoints for current and historical state
- **Recommendation Tool**: `/recommend` endpoint for LLM queries
- **Event Stream**: WebSocket `/events` for real-time updates
- **Admin/Config**: `/config` endpoints for overlay and security settings

## Diagrams

### Component Diagram (ASCII)

```
[User]
   |
[OverlayUIModule (Electron/React)]
   |
[Node.js Core Services]
   |-- [ScreenCaptureModule]
   |-- [DataExtractionModule (Tesseract.js)]
   |-- [GameStateManager]
   |-- [DecisionEngine (LLM API Client)]
   |-- [SecurityManager]
   |-- [ConfigurationManager]
   |-- [MCP Integration]
   |
[LLM API (Gemini Pro/GPT-4)]   [MCP Server]
```

### Data Contracts

Key data structures that flow between modules:

- **ScreenCapture**: `{ captureId, timestamp, resolution, rawData }`
- **GameState**: `{ gameId, timestamp, playerHand, communityCards, potSize, playerChips, opponentActions, currentPhase }`
- **Recommendation**: `{ recommendationId, gameStateId, action, confidence, rationale, timestamp }`
- **OverlayConfig**: `{ position, transparency, visibleElements, fontSize }`
- **SecurityProfile**: `{ profileId, detectionAvoidanceStrategies, lastUpdated }`