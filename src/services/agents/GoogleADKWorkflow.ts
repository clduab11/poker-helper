import { Logger } from '../../utils/logger';
import { VisionModelService, VisionAnalysisResponse } from '../vision/VisionModelService';
import { EventEmitter } from 'events';
import { GameState } from '../../shared/types/GameState';

export interface AgentConfig {
  id: string;
  role: 'vision' | 'analysis' | 'strategy' | 'coordinator';
  model: string;
  provider: string;
  specialization?: string;
}

export interface WorkflowConfig {
  agents: AgentConfig[];
  coordinatorPrompt?: string;
  maxIterations?: number;
  consensusThreshold?: number;
}

export interface AgentMessage {
  agentId: string;
  role: string;
  content: any;
  timestamp: number;
  confidence?: number;
}

export interface WorkflowResult {
  recommendation: string;
  confidence: number;
  reasoning: string;
  agentContributions: AgentMessage[];
  metadata: Record<string, any>;
}

export class GoogleADKWorkflow extends EventEmitter {
  private config: WorkflowConfig;
  private logger: Logger;
  private visionService: VisionModelService;
  private agents: Map<string, AgentConfig> = new Map();
  private messageHistory: AgentMessage[] = [];

  constructor(
    config: WorkflowConfig,
    visionService: VisionModelService,
    logger: Logger
  ) {
    super();
    this.config = config;
    this.visionService = visionService;
    this.logger = logger;
    
    // Initialize agents
    this.initializeAgents();
  }

  private initializeAgents(): void {
    for (const agentConfig of this.config.agents) {
      this.agents.set(agentConfig.id, agentConfig);
      this.logger.info(`Initialized agent: ${agentConfig.id} (${agentConfig.role})`);
    }
  }

  public async processPokerScreenshot(
    screenshot: Buffer,
    gameState: GameState
  ): Promise<WorkflowResult> {
    try {
      const startTime = performance.now();
      this.messageHistory = [];

      // Step 1: Vision Agent - Extract visual information
      const visionAnalysis = await this.runVisionAgent(screenshot);
      
      // Step 2: Analysis Agent - Interpret game state
      const gameAnalysis = await this.runAnalysisAgent(visionAnalysis, gameState);
      
      // Step 3: Strategy Agent - Generate recommendations
      const strategyRecommendation = await this.runStrategyAgent(gameAnalysis, gameState);
      
      // Step 4: Coordinator Agent - Synthesize final decision
      const finalDecision = await this.runCoordinatorAgent(
        visionAnalysis,
        gameAnalysis,
        strategyRecommendation
      );

      const duration = performance.now() - startTime;
      this.logger.info(`Multi-agent workflow completed in ${duration.toFixed(2)}ms`);

      return finalDecision;
    } catch (error) {
      this.logger.error('Multi-agent workflow failed', error);
      throw error;
    }
  }

  private async runVisionAgent(screenshot: Buffer): Promise<AgentMessage> {
    const agent = this.getAgentByRole('vision');
    if (!agent) throw new Error('Vision agent not configured');

    this.emit('agent:start', { agentId: agent.id, role: agent.role });

    const prompt = `You are a specialized vision agent for poker table analysis.
Analyze this screenshot and extract ALL visible information:
- Player positions (seats 1-9)
- Chip counts for each player
- Cards (hole cards if visible, community cards)
- Bet amounts on the table
- Pot size
- Button position
- Action indicators (whose turn, fold/check/bet buttons)
- Any text overlays or notifications

Be extremely precise with numbers and card values. Double-check OCR results.
Format as structured JSON.`;

    const response = await this.visionService.analyzeImage({
      imageData: screenshot,
      prompt,
    });

    const message: AgentMessage = {
      agentId: agent.id,
      role: agent.role,
      content: this.parseJSON(response.analysis),
      timestamp: Date.now(),
      confidence: response.confidence,
    };

    this.messageHistory.push(message);
    this.emit('agent:complete', message);
    
    return message;
  }

  private async runAnalysisAgent(
    visionData: AgentMessage,
    gameState: GameState
  ): Promise<AgentMessage> {
    const agent = this.getAgentByRole('analysis');
    if (!agent) throw new Error('Analysis agent not configured');

    this.emit('agent:start', { agentId: agent.id, role: agent.role });

    const prompt = `You are a poker analysis agent. Given the visual data and game state, provide:

Visual Data: ${JSON.stringify(visionData.content)}
Current Game State: ${JSON.stringify(gameState)}

Analyze and provide:
1. Validated game state (reconcile visual data with stored state)
2. Player tendencies based on recent actions
3. Pot odds and implied odds
4. Position analysis
5. Stack-to-pot ratio (SPR) for each player
6. Identify any discrepancies between visual and stored data

Format as structured analysis with confidence scores for each element.`;

    // For now, simulate with a structured response
    const analysisResult = {
      validatedState: {
        ...gameState,
        // Merge with vision data
        pot: visionData.content.potSize || gameState.pot,
      },
      potOdds: this.calculatePotOdds(gameState),
      impliedOdds: this.estimateImpliedOdds(gameState),
      positionStrength: this.analyzePosition(gameState),
      stackAnalysis: this.analyzeStacks(gameState),
      confidence: 0.85,
    };

    const message: AgentMessage = {
      agentId: agent.id,
      role: agent.role,
      content: analysisResult,
      timestamp: Date.now(),
      confidence: 0.85,
    };

    this.messageHistory.push(message);
    this.emit('agent:complete', message);
    
    return message;
  }

  private async runStrategyAgent(
    analysis: AgentMessage,
    gameState: GameState
  ): Promise<AgentMessage> {
    const agent = this.getAgentByRole('strategy');
    if (!agent) throw new Error('Strategy agent not configured');

    this.emit('agent:start', { agentId: agent.id, role: agent.role });

    const strategyPrompt = `You are an expert poker strategy agent. Based on the analysis:

${JSON.stringify(analysis.content)}

Provide strategic recommendations:
1. Primary action (fold/check/call/raise)
2. Sizing recommendations if betting/raising
3. Alternative lines to consider
4. Risk assessment
5. EV calculation for each option
6. Bluffing frequency recommendations

Consider GTO principles while adapting to opponent tendencies.`;

    // Simulate strategy calculation
    const strategy = {
      primaryAction: this.determineAction(analysis.content, gameState),
      sizing: this.calculateOptimalSizing(analysis.content, gameState),
      alternatives: this.generateAlternatives(gameState),
      riskLevel: this.assessRisk(gameState),
      expectedValue: this.calculateEV(gameState),
      bluffFrequency: 0.33, // GTO baseline
      reasoning: 'Based on position, stack depth, and pot odds',
    };

    const message: AgentMessage = {
      agentId: agent.id,
      role: agent.role,
      content: strategy,
      timestamp: Date.now(),
      confidence: 0.78,
    };

    this.messageHistory.push(message);
    this.emit('agent:complete', message);
    
    return message;
  }

  private async runCoordinatorAgent(
    vision: AgentMessage,
    analysis: AgentMessage,
    strategy: AgentMessage
  ): Promise<WorkflowResult> {
    const agent = this.getAgentByRole('coordinator');
    if (!agent) throw new Error('Coordinator agent not configured');

    this.emit('agent:start', { agentId: agent.id, role: agent.role });

    // Synthesize all agent inputs
    const synthesis = {
      visualConfidence: vision.confidence || 0.8,
      analysisConfidence: analysis.confidence || 0.85,
      strategyConfidence: strategy.confidence || 0.78,
      consensus: this.calculateConsensus([vision, analysis, strategy]),
      conflicts: this.identifyConflicts([vision, analysis, strategy]),
    };

    // Generate final recommendation
    const recommendation = this.synthesizeRecommendation(
      vision.content,
      analysis.content,
      strategy.content,
      synthesis
    );

    const coordinatorMessage: AgentMessage = {
      agentId: agent.id,
      role: agent.role,
      content: recommendation,
      timestamp: Date.now(),
      confidence: synthesis.consensus,
    };

    this.messageHistory.push(coordinatorMessage);
    this.emit('agent:complete', coordinatorMessage);

    const result: WorkflowResult = {
      recommendation: recommendation.action,
      confidence: synthesis.consensus,
      reasoning: recommendation.reasoning,
      agentContributions: this.messageHistory,
      metadata: {
        processingTime: Date.now() - this.messageHistory[0].timestamp,
        agentCount: this.agents.size,
        iterations: 1,
      },
    };

    this.emit('workflow:complete', result);
    
    return result;
  }

  // Helper methods
  private getAgentByRole(role: string): AgentConfig | undefined {
    return Array.from(this.agents.values()).find(a => a.role === role);
  }

  private parseJSON(text: string): any {
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      return JSON.parse(text);
    } catch {
      // If not valid JSON, return as structured object
      return { rawText: text };
    }
  }

  private calculatePotOdds(gameState: GameState): number {
    if (!gameState.currentBet || gameState.currentBet === 0) return 0;
    return gameState.currentBet / (gameState.pot + gameState.currentBet);
  }

  private estimateImpliedOdds(gameState: GameState): number {
    // Simplified implied odds calculation
    const remainingStreets = this.getRemainingStreets(gameState.phase);
    const averageBetSize = gameState.pot * 0.67; // Common bet sizing
    return remainingStreets * averageBetSize;
  }

  private getRemainingStreets(phase: string): number {
    switch (phase) {
      case 'preflop': return 3;
      case 'flop': return 2;
      case 'turn': return 1;
      case 'river': return 0;
      default: return 0;
    }
  }

  private analyzePosition(gameState: GameState): string {
    const positions = ['BTN', 'CO', 'MP', 'EP', 'BB', 'SB'];
    const playerPosition = gameState.playerPosition || 0;
    
    if (playerPosition <= 2) return 'Late Position - Strong';
    if (playerPosition <= 4) return 'Middle Position - Moderate';
    return 'Early Position - Tight';
  }

  private analyzeStacks(gameState: GameState): any {
    const effectiveStack = Math.min(
      gameState.playerChips || 0,
      Math.max(...(gameState.players?.map(p => p.chips) || [0]))
    );
    
    const spr = gameState.pot > 0 ? effectiveStack / gameState.pot : 0;
    
    return {
      effectiveStack,
      spr,
      stackDepth: effectiveStack > 100 ? 'deep' : effectiveStack > 40 ? 'medium' : 'short',
    };
  }

  private determineAction(analysis: any, gameState: GameState): string {
    // Simplified action determination
    const potOdds = analysis.potOdds || 0;
    const position = analysis.positionStrength || '';
    
    if (gameState.playerHand?.length === 2) {
      // Have cards
      if (potOdds > 0.3) return 'fold';
      if (position.includes('Strong')) return 'raise';
      return 'call';
    }
    
    return 'fold';
  }

  private calculateOptimalSizing(analysis: any, gameState: GameState): number {
    const pot = gameState.pot || 0;
    const spr = analysis.stackAnalysis?.spr || 0;
    
    if (spr < 3) return Math.min(gameState.playerChips || 0, pot);
    if (spr < 10) return pot * 0.75;
    return pot * 0.67;
  }

  private generateAlternatives(gameState: GameState): string[] {
    const alternatives = [];
    
    if (gameState.currentBet === 0) {
      alternatives.push('check-raise');
    }
    
    if (gameState.playerChips && gameState.playerChips > gameState.pot * 3) {
      alternatives.push('overbet');
    }
    
    alternatives.push('time-bank for information');
    
    return alternatives;
  }

  private assessRisk(gameState: GameState): string {
    const stackRisk = (gameState.playerChips || 0) / (gameState.startingChips || 100);
    
    if (stackRisk < 0.2) return 'critical';
    if (stackRisk < 0.5) return 'high';
    if (stackRisk < 0.8) return 'medium';
    return 'low';
  }

  private calculateEV(gameState: GameState): Record<string, number> {
    // Simplified EV calculation
    const pot = gameState.pot || 0;
    const bet = gameState.currentBet || 0;
    
    return {
      fold: 0,
      call: pot * 0.3 - bet, // Assume 30% equity
      raise: pot * 0.4 - bet * 2.5, // Assume fold equity
    };
  }

  private calculateConsensus(messages: AgentMessage[]): number {
    const confidences = messages.map(m => m.confidence || 0.5);
    return confidences.reduce((a, b) => a + b, 0) / confidences.length;
  }

  private identifyConflicts(messages: AgentMessage[]): string[] {
    // Identify any conflicting recommendations between agents
    const conflicts = [];
    
    // Check if visual data conflicts with stored state
    const visionPot = messages[0]?.content?.potSize;
    const analysisPot = messages[1]?.content?.validatedState?.pot;
    
    if (visionPot && analysisPot && Math.abs(visionPot - analysisPot) > 1) {
      conflicts.push(`Pot size mismatch: vision=${visionPot}, analysis=${analysisPot}`);
    }
    
    return conflicts;
  }

  private synthesizeRecommendation(
    vision: any,
    analysis: any,
    strategy: any,
    synthesis: any
  ): any {
    // Weight recommendations by confidence
    const weights = {
      vision: synthesis.visualConfidence,
      analysis: synthesis.analysisConfidence,
      strategy: synthesis.strategyConfidence,
    };
    
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    
    // Primary action from strategy agent
    const action = strategy.primaryAction || 'check';
    const sizing = strategy.sizing || 0;
    
    // Build reasoning from all agents
    const reasoning = [
      `Position: ${analysis.positionStrength}`,
      `Pot Odds: ${(analysis.potOdds * 100).toFixed(1)}%`,
      `Stack Depth: ${analysis.stackAnalysis?.stackDepth}`,
      `Risk Level: ${strategy.riskLevel}`,
      synthesis.conflicts.length > 0 ? `Conflicts: ${synthesis.conflicts.join(', ')}` : '',
    ].filter(Boolean).join('; ');
    
    return {
      action: `${action}${sizing > 0 ? ` ${sizing}` : ''}`,
      confidence: synthesis.consensus,
      reasoning,
      alternatives: strategy.alternatives,
      metadata: {
        weights,
        conflicts: synthesis.conflicts,
      },
    };
  }

  public getMessageHistory(): AgentMessage[] {
    return [...this.messageHistory];
  }

  public clearHistory(): void {
    this.messageHistory = [];
  }
}