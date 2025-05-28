/**
 * Central export file for all shared types
 * This ensures consistent imports across the application
 */

// Export all types from Decision module
export * from './Decision';

// Export all types from GameState module
export * from './GameState';

// Export all types from Orchestration module
export * from './Orchestration';

// Export all types from Overlay module
export * from './Overlay';

// Export all types from Recommendation module
export * from './Recommendation';

// Export all types from ScreenCapture module
export * from './ScreenCapture';

// Export all types from Security module
export * from './Security';

// Export all types from StateManagement module
export * from './StateManagement';

// Add Decision interface that modules expect to import
// This appears to be an alias for Recommendation based on usage patterns
export interface Decision {
  action: string;
  confidence: number;
  rationale: string;
  timestamp: number;
}