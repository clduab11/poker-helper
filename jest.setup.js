/**
 * Jest Setup Configuration
 * Global test setup and environment configuration
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Mock Electron in test environment
if (typeof window === 'undefined') {
  global.window = {
    require: jest.fn(),
  };
}

// Global test utilities - Remove problematic setTimeout mock
// The immediate execution of setTimeout was causing infinite loops
// global.setTimeout = jest.fn((fn) => fn());
global.clearTimeout = jest.fn();

// Suppress console output during tests
global.console = {
  ...console,
  // Uncomment to suppress logs during tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Setup performance timing mock
Object.defineProperty(global, 'performance', {
  writable: true,
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
  },
});