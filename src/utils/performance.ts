/**
 * Performance Monitoring Utility
 * 
 * Provides comprehensive performance tracking, metrics collection, and 
 * system resource monitoring for the poker helper application.
 * Tracks CPU, memory, and operation timing with configurable sampling.
 */

import { Logger } from './logger';
import { ConfigurationManager } from './config';

const logger = new Logger('PerformanceMonitor');

/**
 * Performance metric data structure
 */
export interface PerformanceMetric {
  timestamp: number;
  name: string;
  value: number;
  unit: string;
  category: 'memory' | 'cpu' | 'timing' | 'operation' | 'system';
  metadata?: Record<string, unknown>;
}

/**
 * System resource information
 */
export interface SystemResources {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  uptime: number;
}

/**
 * Operation timing tracker
 */
export class OperationTimer {
  private startTime: number;
  private name: string;

  constructor(name: string) {
    this.name = name;
    this.startTime = performance.now();
  }

  /**
   * End timing and return duration in milliseconds
   */
  public end(): number {
    const duration = performance.now() - this.startTime;
    return duration;
  }

  /**
   * End timing and log the result
   */
  public endAndLog(): number {
    const duration = this.end();
    logger.debug(`Operation "${this.name}" completed`, { 
      duration: `${duration.toFixed(2)}ms` 
    });
    return duration;
  }
}

/**
 * Performance monitoring and metrics collection system
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private config = ConfigurationManager.getInstance();
  private metrics: PerformanceMetric[] = [];
  private timers: Map<string, OperationTimer> = new Map();
  private lastCpuUsage: NodeJS.CpuUsage | null = null;
  private monitoringInterval?: NodeJS.Timeout | undefined;

  private constructor() {
    if (this.config.getValue('performance', 'enableMetrics')) {
      this.startMonitoring();
      logger.info('Performance monitoring enabled');
    }
  }

  /**
   * Get singleton instance of performance monitor
   */
  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start a new operation timer
   */
  public startTimer(name: string): OperationTimer {
    const timer = new OperationTimer(name);
    this.timers.set(name, timer);
    return timer;
  }

  /**
   * End a timer and record the metric
   */
  public endTimer(name: string): number | null {
    const timer = this.timers.get(name);
    if (!timer) {
      logger.warn(`Timer "${name}" not found`);
      return null;
    }

    const duration = timer.endAndLog();
    this.timers.delete(name);
    
    this.recordMetric({
      timestamp: Date.now(),
      name,
      value: duration,
      unit: 'ms',
      category: 'timing',
    });

    return duration;
  }

  /**
   * Time an async operation
   */
  public async timeOperation<T>(
    name: string,
    operation: () => Promise<T>
  ): Promise<T> {
    this.startTimer(name);
    try {
      const result = await operation();
      this.endTimer(name);
      return result;
    } catch (error) {
      this.endTimer(name);
      throw error;
    }
  }

  /**
   * Time a synchronous operation
   */
  public timeSync<T>(name: string, operation: () => T): T {
    this.startTimer(name);
    try {
      const result = operation();
      this.endTimer(name);
      return result;
    } catch (error) {
      this.endTimer(name);
      throw error;
    }
  }

  /**
   * Record a custom performance metric
   */
  public recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Keep metrics within reasonable bounds
    const maxMetrics = 1000;
    if (this.metrics.length > maxMetrics) {
      this.metrics = this.metrics.slice(-maxMetrics);
    }

    // Log warning if metric value is concerning
    this.checkMetricThresholds(metric);
  }

  /**
   * Get current system resources
   */
  public getSystemResources(): SystemResources {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage(this.lastCpuUsage || undefined);
    this.lastCpuUsage = process.cpuUsage();

    return {
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      },
      cpu: {
        usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
        loadAverage: [], // Not available in all environments
      },
      uptime: process.uptime(),
    };
  }

  /**
   * Get performance metrics within time range
   */
  public getMetrics(
    startTime?: number, 
    endTime?: number,
    category?: PerformanceMetric['category']
  ): PerformanceMetric[] {
    let filtered = this.metrics;

    if (startTime) {
      filtered = filtered.filter(m => m.timestamp >= startTime);
    }

    if (endTime) {
      filtered = filtered.filter(m => m.timestamp <= endTime);
    }

    if (category) {
      filtered = filtered.filter(m => m.category === category);
    }

    return [...filtered];
  }

  /**
   * Get performance summary statistics
   */
  public getSummary(timeWindow = 60000): Record<string, unknown> {
    const now = Date.now();
    const windowStart = now - timeWindow;
    const recentMetrics = this.getMetrics(windowStart, now);

    const categoriesStats: Record<string, unknown> = {};

    // Group by category and calculate stats
    const categories = recentMetrics.reduce((acc, metric) => {
      if (!acc[metric.category]) {
        acc[metric.category] = [];
      }
      acc[metric.category].push(metric.value);
      return acc;
    }, {} as Record<string, number[]>);

    for (const [category, values] of Object.entries(categories)) {
      if (values.length > 0) {
        categoriesStats[category] = {
          count: values.length,
          average: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
        };
      }
    }

    return {
      timeWindow: `${timeWindow / 1000}s`,
      totalMetrics: recentMetrics.length,
      categories: categoriesStats,
      systemResources: this.getSystemResources(),
    };
  }

  /**
   * Clear all stored metrics
   */
  public clearMetrics(): void {
    this.metrics = [];
    logger.debug('Performance metrics cleared');
  }

  /**
   * Start continuous system monitoring
   */
  private startMonitoring(): void {
    const sampleRate = this.config.getValue('performance', 'sampleRate');
    const interval = Math.max(1000, 1000 / sampleRate); // At least 1 second intervals

    this.monitoringInterval = setInterval(() => {
      const resources = this.getSystemResources();
      
      this.recordMetric({
        timestamp: Date.now(),
        name: 'memory_usage',
        value: resources.memory.percentage,
        unit: '%',
        category: 'memory',
      });

      this.recordMetric({
        timestamp: Date.now(),
        name: 'cpu_usage',
        value: resources.cpu.usage,
        unit: 'seconds',
        category: 'cpu',
      });
    }, interval);
  }

  /**
   * Check metric values against thresholds and log warnings
   */
  private checkMetricThresholds(metric: PerformanceMetric): void {
    const maxMemory = this.config.getValue('performance', 'maxMemoryUsage');

    switch (metric.category) {
      case 'memory':
        if (metric.name === 'memory_usage' && metric.value > 90) {
          logger.warn('High memory usage detected', { 
            usage: `${metric.value.toFixed(1)}%` 
          });
        }
        break;

      case 'timing':
        if (metric.value > 5000) { // Operations taking over 5 seconds
          logger.warn('Slow operation detected', { 
            operation: metric.name,
            duration: `${metric.value.toFixed(2)}ms` 
          });
        }
        break;

      case 'system':
        if (metric.name === 'heap_used' && metric.value > maxMemory) {
          logger.error('Memory limit exceeded', { 
            used: metric.value,
            limit: maxMemory 
          });
        }
        break;
    }
  }

  /**
   * Stop monitoring and cleanup
   */
  public stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.timers.clear();
    logger.info('Performance monitoring stopped');
  }

  /**
   * Get current active timers
   */
  public getActiveTimers(): string[] {
    return Array.from(this.timers.keys());
  }

  /**
   * Export metrics to JSON format
   */
  public exportMetrics(): string {
    return JSON.stringify({
      timestamp: Date.now(),
      summary: this.getSummary(),
      metrics: this.metrics,
      systemResources: this.getSystemResources(),
    }, null, 2);
  }
}