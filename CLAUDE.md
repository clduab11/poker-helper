# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Build & Development
- `npm run build` - Clean and build TypeScript
- `npm run dev` - Run concurrent build watch + electron dev mode
- `npm start` - Build and start the electron application

### Code Quality
- `npm run lint` - Run ESLint on all TypeScript files
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Format code with Prettier
- `npm run type-check` - Run TypeScript type checking

### Testing
- `npm test` - Run all Jest tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report
- To run a single test: `npm test -- path/to/test.ts`

## Architecture Overview

This is a **CoinPoker Intelligence Assistant** - a real-time poker analysis tool that provides LLM-powered strategic recommendations through an overlay interface.

### Core Architecture Pattern
Event-driven modular monolith built with Electron and TypeScript, designed for sub-200ms end-to-end latency.

### Key Modules & Data Flow

1. **ScreenCaptureModule** (`src/modules/ScreenCaptureModule.ts`)
   - Captures poker table screenshots
   - Interfaces with Electron's desktopCapturer API

2. **DataExtractionModule** (`src/modules/DataExtractionModule.ts`)
   - Performs OCR using Tesseract.js (WebAssembly)
   - Extracts game state from screenshots

3. **GameStateManager** (`src/modules/GameStateManager.ts`)
   - Maintains current game state with efficient diffing
   - Only updates changed properties to minimize processing

4. **DecisionEngine** (`src/modules/DecisionEngine.ts`)
   - Integrates with LLM APIs (Gemini Pro / GPT-4 Turbo)
   - Generates strategic recommendations based on game state

5. **OverlayUIModule** (`src/modules/OverlayUIModule.ts`)
   - React-based transparent overlay window
   - Displays recommendations without interfering with gameplay

6. **SecurityManager** (`src/modules/SecurityManager.ts`)
   - Implements anti-detection measures
   - Manages process isolation for security

7. **MainOrchestrator** (`src/modules/MainOrchestrator.ts`)
   - Coordinates the entire pipeline
   - Ensures <200ms latency requirement is met

### Important Architectural Decisions

- **Process Isolation**: Security-critical operations run in isolated processes
- **Performance-First**: All modules designed with latency constraints in mind
- **Event-Driven**: Modules communicate via events to maintain loose coupling
- **Type Safety**: Comprehensive TypeScript types in `src/shared/types/`
- **Testing Strategy**: Unit tests for modules, integration tests for workflows

### Entry Points
- Main process: `src/electron/main.ts`
- Renderer process: `src/frontend/index.tsx`
- Backend services: `src/index.ts`