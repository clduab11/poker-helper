/**
 * Security-related types and enums for risk management, detection avoidance, and system monitoring.
 * All types are designed for use across modules to ensure type safety and maintainability.
 */

/**
 * Enum for detection avoidance strategies.
 * Used to specify anti-detection techniques.
 */
export enum DetectionAvoidanceStrategy {
  RandomizedDelays = 'RandomizedDelays',
  CPUThrottling = 'CPUThrottling',
  ProcessIsolation = 'ProcessIsolation',
  MemoryFootprintReduction = 'MemoryFootprintReduction',
  WindowBehaviorRandomization = 'WindowBehaviorRandomization',
  ProcessPriorityAdjustment = 'ProcessPriorityAdjustment',
}

/**
 * Enum for risk levels.
 * Used to classify the current security risk.
 */
export enum RiskLevel {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
}

/**
 * Interface for a security profile.
 * Defines the risk level and enabled strategies for a given profile.
 */
export interface SecurityProfile {
  name: string;
  riskLevel: RiskLevel;
  enabledStrategies: DetectionAvoidanceStrategy[];
  description?: string;
}

/**
 * Interface for system resource monitoring.
 * Used to track CPU and memory usage for footprint analysis.
 */
export interface SystemFootprint {
  cpuUsagePercent: number; // e.g., 0-100
  memoryUsageMB: number;
  timestamp: number; // Unix epoch ms
}

/**
 * Interface for security event logging.
 * Used to record significant security-related events.
 */
export interface SecurityEvent {
  timestamp: number;
  eventType: string;
  details: string;
  riskLevel: RiskLevel;
  profileName?: string;
}