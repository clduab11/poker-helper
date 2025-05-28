import { DependencyInjector } from './utils/DependencyInjector';
import { OrchestratorConfig, ModuleStatus, ModuleRegistry, PipelineMetrics, ErrorRecoveryStrategy } from '../shared/types/Orchestration';
import { ScreenCaptureModule } from './ScreenCaptureModule';
import { DataExtractionModule } from './DataExtractionModule';
import { GameStateManager } from './GameStateManager';
import { DecisionEngine } from './DecisionEngine';
import { OverlayUIModule } from './OverlayUIModule';
import { SecurityManager } from './SecurityManager';
import { Logger } from '../utils/logger';
// Use performance.now() directly for timing

/**
 * MainOrchestrator coordinates all modules, manages the data pipeline,
 * enforces latency, handles errors, and manages configuration and shutdown.
 */
export class MainOrchestrator {
  private injector: DependencyInjector;
  private config: OrchestratorConfig;
  private registry: ModuleRegistry = {};
  private metrics: PipelineMetrics = {
    lastRunLatencyMs: 0,
    averageLatencyMs: 0,
    maxObservedLatencyMs: 0,
    minObservedLatencyMs: Number.POSITIVE_INFINITY,
    runCount: 0,
    timestamp: Date.now(),
  };
  private errorRecovery: ErrorRecoveryStrategy;
  private running: boolean = false;

  constructor(config: OrchestratorConfig, errorRecovery: ErrorRecoveryStrategy) {
    this.config = config;
    this.injector = new DependencyInjector();
    this.errorRecovery = errorRecovery;
    this.registerModules();
  }

  /**
   * Register all modules and their dependencies with the injector.
   */
  private registerModules() {
    // Register modules with their dependencies and configs
    // Logger may require a label or config; pass a default label
    this.injector.register('logger', () => new Logger('MainOrchestrator'), [], true);

    this.injector.register(
      'screenCapture',
      () => new ScreenCaptureModule(this.config.moduleConfigs['screenCapture'] as import('../shared/types/ScreenCapture').CaptureConfig),
      [],
      true,
      this.config.moduleConfigs['screenCapture']
    );
    this.injector.register(
      'dataExtraction',
      () => new DataExtractionModule(this.config.moduleConfigs['dataExtraction'] as any),
      [],
      true,
      this.config.moduleConfigs['dataExtraction']
    );
    this.injector.register(
      'gameStateManager',
      () => new GameStateManager(this.config.moduleConfigs['gameStateManager'] as any),
      [],
      true,
      this.config.moduleConfigs['gameStateManager']
    );
    this.injector.register(
      'decisionEngine',
      () => new DecisionEngine(this.config.moduleConfigs['decisionEngine'] as any),
      [],
      true,
      this.config.moduleConfigs['decisionEngine']
    );
    this.injector.register(
      'overlayUI',
      () => new OverlayUIModule(this.config.moduleConfigs['overlayUI'] as any),
      [],
      true,
      this.config.moduleConfigs['overlayUI']
    );
    // SecurityManager may require config and/or logger
    this.injector.register(
      'securityManager',
      () => new SecurityManager(this.config.moduleConfigs['securityManager'] as any, this.injector.resolve('logger')),
      [],
      true,
      this.config.moduleConfigs['securityManager']
    );
  }

  /**
   * Initialize all modules and set up event listeners for the pipeline.
   */
  public async initialize() {
    try {
      this.registry['logger'] = { status: ModuleStatus.Initializing, instance: this.injector.resolve('logger') };
      this.registry['screenCapture'] = { status: ModuleStatus.Initializing, instance: this.injector.resolve('screenCapture') };
      this.registry['dataExtraction'] = { status: ModuleStatus.Initializing, instance: this.injector.resolve('dataExtraction') };
      this.registry['gameStateManager'] = { status: ModuleStatus.Initializing, instance: this.injector.resolve('gameStateManager') };
      this.registry['decisionEngine'] = { status: ModuleStatus.Initializing, instance: this.injector.resolve('decisionEngine') };
      this.registry['overlayUI'] = { status: ModuleStatus.Initializing, instance: this.injector.resolve('overlayUI') };
      this.registry['securityManager'] = { status: ModuleStatus.Initializing, instance: this.injector.resolve('securityManager') };

      // Set up event listeners for pipeline flow
      this.setupPipelineEvents();

      // Mark all as ready
      Object.keys(this.registry).forEach((name) => {
        this.registry[name].status = ModuleStatus.Ready;
      });

      this.running = true;
      (this.registry['logger'].instance as Logger).info('MainOrchestrator initialized.');
    } catch (err) {
      (this.registry['logger']?.instance as Logger)?.error('Initialization failed', err);
      throw err;
    }
  }

  /**
   * Set up the polling pipeline: capture → extract → manage state → decide → display.
   * This replaces event-driven wiring with a polling loop.
   */
  private setupPipelineEvents() {
    const screenCapture = this.registry['screenCapture'].instance as ScreenCaptureModule;
    const dataExtraction = this.registry['dataExtraction'].instance as DataExtractionModule;
    const gameStateManager = this.registry['gameStateManager'].instance as GameStateManager;
    const decisionEngine = this.registry['decisionEngine'].instance as DecisionEngine;
    const overlayUI = this.registry['overlayUI'].instance as OverlayUIModule;
    const logger = this.registry['logger'].instance as Logger;

    // Start polling loop for the pipeline
    const poll = async () => {
      while (this.running) {
        const start = performance.now();
        try {
          // Capture a frame (single image)
          const frame = await screenCapture.captureScreen();
          // Extract data from frame
          const extracted = await (dataExtraction as any).extract(frame);
          // Update game state
          const state = await (gameStateManager as any).updateState(extracted);
          // Make decision
          const decision = await (decisionEngine as any).decide(state);
          // Display overlay
          await (overlayUI as any).display(decision);

          // Performance monitoring
          const latency = performance.now() - start;
          this.updateMetrics(latency);
          if (latency > this.config.maxPipelineLatencyMs) {
            logger.warn(`Pipeline latency exceeded: ${latency}ms`);
          }
        } catch (err) {
          logger.error('Pipeline error', err);
          this.handleModuleFailure('pipeline', err instanceof Error ? err : new Error(String(err)));
        }
        // Optionally, add a small delay to avoid 100% CPU usage
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    };

    // Start the polling loop (do not await)
    poll();
  }

  /**
   * Update pipeline performance metrics.
   */
  private updateMetrics(latency: number) {
    this.metrics.lastRunLatencyMs = latency;
    this.metrics.maxObservedLatencyMs = Math.max(this.metrics.maxObservedLatencyMs, latency);
    this.metrics.minObservedLatencyMs = Math.min(this.metrics.minObservedLatencyMs, latency);
    this.metrics.runCount += 1;
    this.metrics.averageLatencyMs =
      ((this.metrics.averageLatencyMs * (this.metrics.runCount - 1)) + latency) / this.metrics.runCount;
    this.metrics.timestamp = Date.now();
  }

  /**
   * Handle module or pipeline failures with recovery or fallback.
   */
  private handleModuleFailure(moduleName: string, error: Error) {
    const logger = this.registry['logger']?.instance as Logger;
    this.registry[moduleName] = this.registry[moduleName] || { status: ModuleStatus.Error, instance: undefined };
    this.registry[moduleName].status = ModuleStatus.Error;
    this.registry[moduleName].lastError = error.message;
    this.metrics.lastError = error.message;

    // Attempt recovery
    const recovered = this.errorRecovery.recover(moduleName, error);
    if (!recovered && this.errorRecovery.fallback) {
      logger.warn(`Fallback for module: ${moduleName}`);
      this.errorRecovery.fallback(moduleName);
    }
  }

  /**
   * Start the orchestrator and begin the pipeline.
   */
  public async start() {
    await this.initialize();
    // Set running flag and start polling pipeline
    this.running = true;
    (this.registry['logger'].instance as Logger).info('MainOrchestrator started.');
  }

  /**
   * Gracefully shutdown all modules and clean up resources.
   */
  public async shutdown() {
    this.running = false;
    await this.injector.shutdownAll();
    Object.keys(this.registry).forEach((name) => {
      this.registry[name].status = ModuleStatus.Shutdown;
    });
    (this.registry['logger']?.instance as Logger)?.info('MainOrchestrator shutdown complete.');
  }

  /**
   * Update configuration for orchestrator and modules.
   */
  public updateConfig(newConfig: Partial<OrchestratorConfig>) {
    this.config = { ...this.config, ...newConfig };
    // Optionally propagate config changes to modules
    // (Assumes modules have a setConfig method)
    Object.keys(this.registry).forEach((name) => {
      const instance = this.registry[name].instance as any;
      if (typeof instance?.setConfig === 'function') {
        instance.setConfig(this.config.moduleConfigs[name]);
      }
    });
  }

  /**
   * Expose current metrics for monitoring.
   */
  public getMetrics(): PipelineMetrics {
    return { ...this.metrics };
  }

  /**
   * Expose current module registry for diagnostics.
   */
  public getRegistry(): ModuleRegistry {
    return { ...this.registry };
  }
}