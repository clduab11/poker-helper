// Orchestration types for MainOrchestrator and module management

/**
 * Configuration for the orchestrator and all modules.
 */
export interface OrchestratorConfig {
  environment: 'development' | 'production';
  enablePerformanceMonitoring: boolean;
  maxPipelineLatencyMs: number;
  moduleConfigs: Record<string, unknown>;
}

/**
 * Status of a module in the orchestration pipeline.
 */
export enum ModuleStatus {
  Initializing = 'initializing',
  Ready = 'ready',
  Error = 'error',
  Shutdown = 'shutdown',
}

/**
 * Metrics for tracking pipeline performance and latency.
 */
export interface PipelineMetrics {
  lastRunLatencyMs: number;
  averageLatencyMs: number;
  maxObservedLatencyMs: number;
  minObservedLatencyMs: number;
  runCount: number;
  lastError?: string;
  timestamp: number;
}

/**
 * Registry for all modules managed by the orchestrator.
 */
export interface ModuleRegistry {
  [moduleName: string]: {
    status: ModuleStatus;
    instance: unknown;
    lastError?: string;
    metrics?: PipelineMetrics;
  };
}

/**
 * Strategy for recovering from module or pipeline errors.
 */
export interface ErrorRecoveryStrategy {
  /**
   * Attempt to recover from a module failure.
   * @param moduleName Name of the failed module.
   * @param error The error that occurred.
   * @returns true if recovery was attempted, false otherwise.
   */
  recover(moduleName: string, error: Error): boolean;

  /**
   * Optional fallback to a degraded mode or alternative module.
   * @param moduleName Name of the failed module.
   */
  fallback?(moduleName: string): void;
}