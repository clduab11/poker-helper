/**
 * CoinPoker Intelligence Assistant MCP Server
 * 
 * Provides HTTP REST API and WebSocket server for poker game state management,
 * LLM tool orchestration, and real-time event streaming.
 * 
 * Features:
 * - Game state resource endpoints
 * - Recommendation tool interfaces
 * - Real-time WebSocket event streaming
 * - Configuration management
 * - Performance monitoring
 */

import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import * as http from 'http';
import { GameState } from '../shared/types/GameState';
import { Recommendation } from '../shared/types/Recommendation';
import { DecisionEngine } from '../modules/DecisionEngine';
import { GameStateManager } from '../modules/GameStateManager';
import { SecurityManager } from '../modules/SecurityManager';
import { Logger } from '../utils/logger';

interface MCPServerConfig {
  port?: number;
  enableWebSocket?: boolean;
  enableMetrics?: boolean;
  maxGameStates?: number;
  cacheTimeout?: number;
}

interface GameStateResource {
  gameState: GameState;
  timestamp: number;
  id: string;
}

interface RecommendationCache {
  recommendation: Recommendation;
  timestamp: number;
  gameStateId: string;
}



/**
 * MCP Server for CoinPoker Intelligence Assistant
 * Manages game state resources, recommendation tools, and event streaming
 */
export class PokerMCPServer extends EventEmitter {
  private httpServer?: http.Server;
  private wsServer?: WebSocketServer;
  private gameStates: Map<string, GameStateResource> = new Map();
  private recommendations: Map<string, RecommendationCache> = new Map();
  private decisionEngine: DecisionEngine | undefined;
  private gameStateManager: GameStateManager | undefined;
  private securityManager: SecurityManager | undefined;
  private config: MCPServerConfig;
  private logger: Logger;
  private metrics = {
    gameStatesProcessed: 0,
    recommendationsGenerated: 0,
    wsConnections: 0,
    errors: 0,
    avgResponseTime: 0,
    httpRequests: 0,
  };

  constructor(config: MCPServerConfig = {}) {
    super();
    this.config = {
      port: 3001,
      enableWebSocket: true,
      enableMetrics: true,
      maxGameStates: 100,
      cacheTimeout: 300000, // 5 minutes
      ...config,
    };

    this.logger = new Logger('PokerMCPServer');
    this.startCleanupTimer();
  }

  /**
   * Initialize the MCP server with required dependencies
   */
  async initialize(
    decisionEngine?: DecisionEngine,
    gameStateManager?: GameStateManager,
    securityManager?: SecurityManager
  ): Promise<void> {
    try {
      this.decisionEngine = decisionEngine;
      this.gameStateManager = gameStateManager;
      this.securityManager = securityManager;

      // Setup event listeners for real-time updates
      if (this.gameStateManager) {
        this.gameStateManager.on('GameStateUpdated', this.handleGameStateUpdate.bind(this));
      }

      this.logger.info('PokerMCPServer initialized successfully', {
        port: this.config.port,
        webSocket: this.config.enableWebSocket,
        metrics: this.config.enableMetrics,
      });
    } catch (error) {
      this.logger.error('Failed to initialize PokerMCPServer', { error });
      throw error;
    }
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    try {
      // Create HTTP server
      this.httpServer = http.createServer(this.handleHttpRequest.bind(this));
      
      // Initialize WebSocket server if enabled
      if (this.config.enableWebSocket) {
        await this.initializeWebSocket();
      }

      // Start listening
      this.httpServer.listen(this.config.port, () => {
        this.emit('server:started');
        this.logger.info('PokerMCPServer started successfully', { port: this.config.port });
      });
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Failed to start PokerMCPServer', { error });
      throw error;
    }
  }

  /**
   * Stop the MCP server and cleanup resources
   */
  async stop(): Promise<void> {
    try {
      if (this.wsServer) {
        this.wsServer.close();
      }
      
      if (this.httpServer) {
        this.httpServer.close();
      }
      
      this.emit('server:stopped');
      this.logger.info('PokerMCPServer stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping PokerMCPServer', { error });
      throw error;
    }
  }

  /**
   * Handle HTTP requests
   */
  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const startTime = Date.now();
    this.metrics.httpRequests++;

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = req.url || '';
    const method = req.method || 'GET';

    try {
      if (method === 'GET') {
        this.handleGetRequest(url, res);
      } else if (method === 'POST') {
        this.handlePostRequest(url, req, res);
      } else {
        this.sendError(res, 405, 'Method not allowed');
      }
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Error handling HTTP request', { url, method, error });
      this.sendError(res, 500, 'Internal server error');
    } finally {
      this.updateResponseTime(Date.now() - startTime);
    }
  }

  /**
   * Handle GET requests
   */
  private handleGetRequest(url: string, res: http.ServerResponse): void {
    switch (url) {
      case '/api/game-state/current':
        this.sendResponse(res, this.getCurrentGameState());
        break;
      case '/api/game-state/history':
        this.sendResponse(res, this.getGameStateHistory());
        break;
      case '/api/recommendations/current':
        this.sendResponse(res, this.getCurrentRecommendations());
        break;
      case '/api/metrics':
        this.sendResponse(res, this.getServerMetrics());
        break;
      case '/api/security/status':
        this.handleSecurityStatus(res);
        break;
      case '/health':
        this.sendResponse(res, { status: 'healthy', timestamp: Date.now() });
        break;
      default:
        this.sendError(res, 404, 'Not found');
    }
  }

  /**
   * Handle POST requests
   */
  private handlePostRequest(url: string, req: http.IncomingMessage, res: http.ServerResponse): void {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        
        switch (url) {
          case '/api/recommendations/generate':
            await this.handleGenerateRecommendation(data, res);
            break;
          case '/api/game-state/update':
            await this.handleUpdateGameState(data, res);
            break;
          default:
            this.sendError(res, 404, 'Not found');
        }
      } catch (error) {
        this.metrics.errors++;
        this.logger.error('Error parsing request body', { error });
        this.sendError(res, 400, 'Invalid JSON');
      }
    });
  }

  /**
   * Initialize WebSocket server for real-time events
   */
  private async initializeWebSocket(): Promise<void> {
    this.wsServer = new WebSocketServer({ 
      port: this.config.port! + 1,
      perMessageDeflate: false 
    });

    this.wsServer.on('connection', (ws: WebSocket) => {
      this.metrics.wsConnections++;
      this.logger.info('WebSocket client connected', { totalConnections: this.metrics.wsConnections });

      ws.on('close', () => {
        this.metrics.wsConnections--;
        this.logger.info('WebSocket client disconnected', { totalConnections: this.metrics.wsConnections });
      });

      ws.on('error', (error: Error) => {
        this.metrics.errors++;
        this.logger.error('WebSocket error', { error });
      });

      // Send initial state
      ws.send(JSON.stringify({
        type: 'connection',
        data: { status: 'connected', timestamp: Date.now() },
      }));
    });

    this.logger.info('WebSocket server initialized', { port: this.config.port! + 1 });
  }

  /**
   * Handle game state updates from GameStateManager
   */
  private handleGameStateUpdate(gameState: GameState): void {
    const id = `gs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.gameStates.set(id, {
      gameState,
      timestamp: Date.now(),
      id,
    });

    this.metrics.gameStatesProcessed++;

    // Broadcast to WebSocket clients
    this.broadcastEvent('game_state_updated', { gameState, id });

    // Cleanup old states
    this.cleanupOldGameStates();
  }

  /**
   * Handle generate recommendation request
   */
  private async handleGenerateRecommendation(data: any, res: http.ServerResponse): Promise<void> {
    if (!this.decisionEngine) {
      this.sendError(res, 503, 'DecisionEngine not available');
      return;
    }

    try {
      const { gameState, options = {} } = data;
      const recommendation = await this.decisionEngine.getRecommendation(gameState, options);
      
      const id = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.recommendations.set(id, {
        recommendation,
        timestamp: Date.now(),
        gameStateId: gameState.id || 'unknown',
      });

      this.metrics.recommendationsGenerated++;

      // Broadcast to WebSocket clients
      this.broadcastEvent('recommendation_generated', { recommendation, id });

      this.sendResponse(res, { recommendation, id });
    } catch (error) {
      this.logger.error('Error generating recommendation', { error });
      this.sendError(res, 500, 'Failed to generate recommendation');
    }
  }

  /**
   * Handle update game state request
   */
  private async handleUpdateGameState(data: any, res: http.ServerResponse): Promise<void> {
    if (!this.gameStateManager) {
      this.sendError(res, 503, 'GameStateManager not available');
      return;
    }

    try {
      const { gameState } = data;
      const success = this.gameStateManager.updateState(gameState);
      this.sendResponse(res, { success, timestamp: Date.now() });
    } catch (error) {
      this.logger.error('Error updating game state', { error });
      this.sendError(res, 500, 'Failed to update game state');
    }
  }

  /**
   * Handle security status request
   */
  private handleSecurityStatus(res: http.ServerResponse): void {
    if (!this.securityManager) {
      this.sendResponse(res, { status: 'unavailable', message: 'SecurityManager not available' });
      return;
    }

    try {
      const profile = this.securityManager.getCurrentProfile();
      const footprint = this.securityManager.getLastFootprint();
      const events = this.securityManager.getEventLog().slice(-10); // Last 10 events

      this.sendResponse(res, {
        profile: profile.name,
        footprint,
        recentEvents: events,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error('Error getting security status', { error });
      this.sendResponse(res, { status: 'error', message: 'Failed to get security status' });
    }
  }

  /**
   * Send JSON response
   */
  private sendResponse(res: http.ServerResponse, data: any): void {
    res.writeHead(200);
    res.end(JSON.stringify(data, null, 2));
  }

  /**
   * Send error response
   */
  private sendError(res: http.ServerResponse, code: number, message: string): void {
    res.writeHead(code);
    res.end(JSON.stringify({
      error: {
        code,
        message,
        timestamp: Date.now(),
      }
    }));
  }

  /**
   * Get current game state
   */
  private getCurrentGameState(): any {
    const states = Array.from(this.gameStates.values());
    const latest = states.sort((a, b) => b.timestamp - a.timestamp)[0];
    
    return latest ? latest.gameState : null;
  }

  /**
   * Get game state history
   */
  private getGameStateHistory(): any {
    const states = Array.from(this.gameStates.values());
    return states.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get current recommendations
   */
  private getCurrentRecommendations(): any {
    const recs = Array.from(this.recommendations.values());
    return recs.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get server metrics
   */
  private getServerMetrics(): any {
    return {
      ...this.metrics,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: Date.now(),
    };
  }

  /**
   * Broadcast event to all WebSocket clients
   */
  private broadcastEvent(type: string, data: any): void {
    if (!this.wsServer) return;

    const message = JSON.stringify({ type, data, timestamp: Date.now() });
    
    this.wsServer.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Update average response time metric
   */
  private updateResponseTime(responseTime: number): void {
    this.metrics.avgResponseTime = 
      (this.metrics.avgResponseTime + responseTime) / 2;
  }

  /**
   * Cleanup old game states to prevent memory leaks
   */
  private cleanupOldGameStates(): void {
    const now = Date.now();
    const maxAge = this.config.cacheTimeout!;

    for (const [id, state] of this.gameStates.entries()) {
      if (now - state.timestamp > maxAge) {
        this.gameStates.delete(id);
      }
    }

    // Ensure we don't exceed max states
    if (this.gameStates.size > this.config.maxGameStates!) {
      const states = Array.from(this.gameStates.entries());
      states.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toDelete = states.slice(0, states.length - this.config.maxGameStates!);
      toDelete.forEach(([id]) => {
        this.gameStates.delete(id);
      });
    }
  }

  /**
   * Start cleanup timer for periodic maintenance
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupOldGameStates();
      
      // Cleanup old recommendations
      const now = Date.now();
      for (const [id, rec] of this.recommendations.entries()) {
        if (now - rec.timestamp > this.config.cacheTimeout!) {
          this.recommendations.delete(id);
        }
      }
    }, 60000); // Run every minute
  }
}

// Export singleton instance
export const mcpServer = new PokerMCPServer();
