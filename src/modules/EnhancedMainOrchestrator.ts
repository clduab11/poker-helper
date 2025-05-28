import { DependencyInjector } from './utils/DependencyInjector';
import { OrchestratorConfig, ModuleStatus, ModuleRegistry, PipelineMetrics, ErrorRecoveryStrategy } from '../shared/types/Orchestration';
import { ScreenCaptureModule } from './ScreenCaptureModule';
import { DataExtractionModule } from './DataExtractionModule';
import { GameStateManager } from './GameStateManager';
import { DecisionEngine } from './DecisionEngine';
import { OverlayUIModule } from './OverlayUIModule';
import { SecurityManager } from './SecurityManager';
import { ScreenshotManager, ScreenshotManagerConfig } from './ScreenshotManager';
import { VisionModelService, VisionModelConfig } from '../services/vision/VisionModelService';
import { GoogleADKWorkflow, WorkflowConfig } from '../services/agents/GoogleADKWorkflow';
import { Logger } from '../utils/logger';
import { GameState } from '../shared/types/GameState';
import { Decision, PokerAction } from '../shared/types/Decision';

export interface EnhancedOrchestratorConfig extends OrchestratorConfig {
  pollingIntervalMs: number;
  screenshotManager: ScreenshotManagerConfig;
  visionModel: VisionModelConfig;
  multiAgentWorkflow: WorkflowConfig;
  useMultiAgentMode: boolean;
}

/**
 * Enhanced MainOrchestrator with screenshot management and multi-agent AI workflow
 */
export class EnhancedMainOrchestrator {
  private injector: DependencyInjector;
  private config: EnhancedOrchestratorConfig;
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
  private screenshotManager?: ScreenshotManager;
  private visionService?: VisionModelService;
  private multiAgentWorkflow?: GoogleADKWorkflow;

  constructor(config: EnhancedOrchestratorConfig, errorRecovery: ErrorRecoveryStrategy) {
    this.config = config;
    this.injector = new DependencyInjector();
    this.errorRecovery = errorRecovery;
    this.registerModules();
  }

  /**
   * Register all modules including new AI services
   */
  private registerModules() {
    // Core modules
    this.injector.register('logger', () => new Logger('EnhancedOrchestrator'), [], true);

    this.injector.register(
      'screenCapture',
      () => new ScreenCaptureModule(this.config.moduleConfigs['screenCapture'] as any),
      [],
      true
    );

    this.injector.register(
      'dataExtraction',
      () => new DataExtractionModule(this.config.moduleConfigs['dataExtraction'] as any),
      [],
      true
    );

    this.injector.register(
      'gameStateManager',
      () => new GameStateManager(this.config.moduleConfigs['gameStateManager'] as any),
      [],
      true
    );

    this.injector.register(
      'decisionEngine',
      () => new DecisionEngine(this.config.moduleConfigs['decisionEngine'] as any),
      [],
      true
    );

    this.injector.register(
      'overlayUI',
      () => new OverlayUIModule(this.config.moduleConfigs['overlayUI'] as any),
      [],
      true
    );

    this.injector.register(
      'securityManager',
      () => new SecurityManager(
        this.config.moduleConfigs['securityManager'] as any,
        this.injector.resolve('logger')
      ),
      [],
      true
    );
  }

  /**
   * Initialize all modules and AI services
   */
  public async initialize() {
    try {
      const logger = this.injector.resolve('logger') as Logger;
      
      // Initialize core modules
      this.registry['logger'] = { status: ModuleStatus.Initializing, instance: logger };
      this.registry['screenCapture'] = { 
        status: ModuleStatus.Initializing, 
        instance: this.injector.resolve('screenCapture') 
      };
      this.registry['dataExtraction'] = { 
        status: ModuleStatus.Initializing, 
        instance: this.injector.resolve('dataExtraction') 
      };
      this.registry['gameStateManager'] = { 
        status: ModuleStatus.Initializing, 
        instance: this.injector.resolve('gameStateManager') 
      };
      this.registry['decisionEngine'] = { 
        status: ModuleStatus.Initializing, 
        instance: this.injector.resolve('decisionEngine') 
      };
      this.registry['overlayUI'] = { 
        status: ModuleStatus.Initializing, 
        instance: this.injector.resolve('overlayUI') 
      };
      this.registry['securityManager'] = { 
        status: ModuleStatus.Initializing, 
        instance: this.injector.resolve('securityManager') 
      };

      // Initialize screenshot manager
      this.screenshotManager = new ScreenshotManager(
        this.config.screenshotManager,
        this.registry['screenCapture'].instance as ScreenCaptureModule,
        logger
      );
      await this.screenshotManager.initialize();
      this.registry['screenshotManager'] = { 
        status: ModuleStatus.Ready, 
        instance: this.screenshotManager 
      };

      // Initialize vision model service
      this.visionService = new VisionModelService(this.config.visionModel, logger);
      this.registry['visionService'] = { 
        status: ModuleStatus.Ready, 
        instance: this.visionService 
      };

      // Initialize multi-agent workflow
      this.multiAgentWorkflow = new GoogleADKWorkflow(
        this.config.multiAgentWorkflow,
        this.visionService,
        logger
      );
      this.registry['multiAgentWorkflow'] = { 
        status: ModuleStatus.Ready, 
        instance: this.multiAgentWorkflow 
      };

      // Set up event listeners
      this.setupEnhancedPipeline();

      // Mark all as ready
      Object.keys(this.registry).forEach((name) => {
        if (this.registry[name].status === ModuleStatus.Initializing) {
          this.registry[name].status = ModuleStatus.Ready;
        }
      });

      this.running = true;
      logger.info('Enhanced MainOrchestrator initialized with AI capabilities');
    } catch (err) {
      const logger = this.registry['logger']?.instance as Logger;
      logger?.error('Initialization failed', err);
      throw err;
    }
  }

  /**
   * Set up enhanced pipeline with screenshot management and AI workflow
   */
  private setupEnhancedPipeline() {
    const logger = this.registry['logger'].instance as Logger;

    // Listen for screenshot events
    this.screenshotManager?.on('screenshot:captured', async (data) => {
      logger.debug(`New screenshot captured: ${data.id}`);
      
      if (this.config.useMultiAgentMode) {
        // Process with multi-agent workflow
        await this.processWithMultiAgent(data);
      }
    });

    this.screenshotManager?.on('screenshot:error', (error) => {
      logger.error('Screenshot capture error', error);
    });

    // Listen for multi-agent workflow events
    this.multiAgentWorkflow?.on('agent:start', (data) => {
      logger.debug(`Agent started: ${data.agentId} (${data.role})`);
    });

    this.multiAgentWorkflow?.on('agent:complete', (data) => {
      logger.debug(`Agent completed: ${data.agentId} with confidence ${data.confidence}`);
    });

    this.multiAgentWorkflow?.on('workflow:complete', (result) => {
      logger.info(`Workflow complete: ${result.recommendation} (${result.confidence})`);
    });

    // Start traditional pipeline with enhancements
    this.startEnhancedPipeline();
  }

  /**
   * Enhanced pipeline with AI integration
   */
  private startEnhancedPipeline() {
    const dataExtraction = this.registry['dataExtraction'].instance as DataExtractionModule;
    const gameStateManager = this.registry['gameStateManager'].instance as GameStateManager;
    const decisionEngine = this.registry['decisionEngine'].instance as DecisionEngine;
    const overlayUI = this.registry['overlayUI'].instance as OverlayUIModule;
    const logger = this.registry['logger'].instance as Logger;

    const poll = async () => {
      while (this.running) {
        const start = performance.now();
        try {
          // Get recent screenshots for context
          const recentScreenshots = this.screenshotManager?.getRecentScreenshots(5) || [];
          
          if (recentScreenshots.length > 0) {
            const latestScreenshot = recentScreenshots[0];
            const screenshotData = await this.screenshotManager?.getScreenshotData(latestScreenshot.id);
            
            if (screenshotData) {
              let decision: Decision;
              let gameState: GameState;

              if (this.config.useMultiAgentMode && this.multiAgentWorkflow) {
                // Use multi-agent workflow
                gameState = await (gameStateManager as any).getState();
                const workflowResult = await this.multiAgentWorkflow.processPokerScreenshot(
                  screenshotData,
                  gameState
                );
                
                decision = {
                  action: workflowResult.recommendation as PokerAction,
                  confidence: workflowResult.confidence,
                  reasoning: workflowResult.reasoning,
                  timestamp: Date.now(),
                  alternatives: workflowResult.agentContributions.map(a => ({
                    action: (a.content.action || 'fold') as PokerAction,
                    probability: a.confidence || 0,
                  })),
                };
              } else {
                // Traditional pipeline with vision enhancement
                const visionAnalysis = await this.visionService?.analyzePokerTable(screenshotData);
                
                // Merge vision analysis with OCR extraction
                const extracted = await (dataExtraction as any).extract({
                  image: screenshotData,
                  visionHints: visionAnalysis?.analysis,
                });
                
                gameState = await (gameStateManager as any).updateState(extracted);
                decision = await (decisionEngine as any).decide(gameState);
              }

              // Display decision
              await (overlayUI as any).display(decision);

              // Performance monitoring
              const latency = performance.now() - start;
              this.updateMetrics(latency);
              
              if (latency > this.config.maxPipelineLatencyMs) {
                logger.warn(`Pipeline latency exceeded: ${latency}ms`);
              }
            }
          }
        } catch (err) {
          logger.error('Enhanced pipeline error', err);
          this.handleModuleFailure('pipeline', err instanceof Error ? err : new Error(String(err)));
        }

        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    };

    poll();
  }

  /**
   * Process screenshot with multi-agent workflow
   */
  private async processWithMultiAgent(screenshotData: any) {
    const gameStateManager = this.registry['gameStateManager'].instance as GameStateManager;
    const overlayUI = this.registry['overlayUI'].instance as OverlayUIModule;
    const logger = this.registry['logger'].instance as Logger;

    try {
      const imageData = await this.screenshotManager?.getScreenshotData(screenshotData.id);
      if (!imageData) {return;}

      const gameState = await (gameStateManager as any).getState();
      const result = await this.multiAgentWorkflow?.processPokerScreenshot(imageData, gameState);

      if (result) {
        const decision: Decision = {
          action: result.recommendation as PokerAction,
          confidence: result.confidence,
          reasoning: result.reasoning,
          timestamp: Date.now(),
        };

        await (overlayUI as any).display(decision);
        logger.info(`AI recommendation: ${decision.action} (${decision.confidence})`);
      }
    } catch (error) {
      logger.error('Multi-agent processing failed', error);
    }
  }

  /**
   * Update pipeline performance metrics
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
   * Handle module failures
   */
  private handleModuleFailure(moduleName: string, error: Error) {
    const logger = this.registry['logger']?.instance as Logger;
    this.registry[moduleName] = this.registry[moduleName] || { 
      status: ModuleStatus.Error, 
      instance: undefined 
    };
    this.registry[moduleName].status = ModuleStatus.Error;
    this.registry[moduleName].lastError = error.message;
    this.metrics.lastError = error.message;

    const recovered = this.errorRecovery.recover(moduleName, error);
    if (!recovered && this.errorRecovery.fallback) {
      logger.warn(`Fallback for module: ${moduleName}`);
      this.errorRecovery.fallback(moduleName);
    }
  }

  /**
   * Start the orchestrator
   */
  public async start() {
    await this.initialize();
    await this.screenshotManager?.start();
    this.running = true;
    (this.registry['logger'].instance as Logger).info('Enhanced orchestrator started');
  }

  /**
   * Shutdown gracefully
   */
  public async shutdown() {
    this.running = false;
    await this.screenshotManager?.stop();
    await this.injector.shutdownAll();
    
    Object.keys(this.registry).forEach((name) => {
      this.registry[name].status = ModuleStatus.Shutdown;
    });
    
    (this.registry['logger']?.instance as Logger)?.info('Enhanced orchestrator shutdown complete');
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<EnhancedOrchestratorConfig>) {
    this.config = { ...this.config, ...newConfig };
    
    // Update vision service config if needed
    if (newConfig.visionModel) {
      this.visionService?.updateConfig(newConfig.visionModel);
    }

    // Propagate to other modules
    Object.keys(this.registry).forEach((name) => {
      const instance = this.registry[name].instance as any;
      if (typeof instance?.setConfig === 'function') {
        instance.setConfig(this.config.moduleConfigs[name]);
      }
    });
  }

  /**
   * Get metrics
   */
  public getMetrics(): PipelineMetrics {
    return { ...this.metrics };
  }

  /**
   * Get registry
   */
  public getRegistry(): ModuleRegistry {
    return { ...this.registry };
  }

  /**
   * Get screenshot statistics
   */
  public getScreenshotStats() {
    return {
      count: this.screenshotManager?.getScreenshotCount() || 0,
      oldest: this.screenshotManager?.getOldestTimestamp() || null,
      newest: this.screenshotManager?.getNewestTimestamp() || null,
    };
  }
}