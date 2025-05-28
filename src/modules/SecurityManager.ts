import {
  SecurityProfile,
  DetectionAvoidanceStrategy,
  RiskLevel,
  SystemFootprint,
  SecurityEvent,
} from '../shared/types/Security';
import * as AntiDetection from './utils/AntiDetection';
import * as ProcessIsolation from './utils/ProcessIsolation';

interface SecurityManagerConfig {
  antiDetectionEnabled: boolean;
  processIsolationEnabled: boolean;
  riskProfile: 'low' | 'medium' | 'high';
}

/**
 * SecurityManager orchestrates anti-detection, process isolation, system monitoring,
 * dynamic risk assessment, and security profile management.
 */
export class SecurityManager {
  private profiles: Record<string, SecurityProfile>;
  private currentProfile: SecurityProfile;
  private eventLog: SecurityEvent[] = [];
  private lastFootprint: SystemFootprint | null = null;

  constructor(config: SecurityManagerConfig, _logger?: any) {
    // Create default profiles based on config
    const profiles: SecurityProfile[] = [
      {
        name: 'low',
        riskLevel: RiskLevel.Low,
        enabledStrategies: [DetectionAvoidanceStrategy.RandomizedDelays],
      },
      {
        name: 'medium',
        riskLevel: RiskLevel.Medium,
        enabledStrategies: [
          DetectionAvoidanceStrategy.RandomizedDelays,
          DetectionAvoidanceStrategy.CPUThrottling,
        ],
      },
      {
        name: 'high',
        riskLevel: RiskLevel.High,
        enabledStrategies: [
          DetectionAvoidanceStrategy.RandomizedDelays,
          DetectionAvoidanceStrategy.CPUThrottling,
          DetectionAvoidanceStrategy.ProcessIsolation,
          DetectionAvoidanceStrategy.MemoryFootprintReduction,
        ],
      },
    ];

    this.profiles = {};
    profiles.forEach((p) => (this.profiles[p.name] = p));
    this.currentProfile = this.profiles[config.riskProfile] || profiles[0];
    this.logEvent('init', `Initialized with profile: ${this.currentProfile.name}`, this.currentProfile.riskLevel);
  }

  /**
   * Applies a security profile by name.
   */
  applyProfile(profileName: string): void {
    if (this.profiles[profileName]) {
      this.currentProfile = this.profiles[profileName];
      this.logEvent('profile_change', `Switched to profile: ${profileName}`, this.currentProfile.riskLevel, profileName);
    }
  }

  /**
   * Runs all enabled detection avoidance strategies for the current profile.
   * Ensures all checks complete in <10ms (excluding async delays).
   */
  async runDetectionAvoidance(): Promise<void> {
    const strategies = this.currentProfile.enabledStrategies;
    const start = performance.now();
    for (const strategy of strategies) {
      switch (strategy) {
        case DetectionAvoidanceStrategy.RandomizedDelays:
          await AntiDetection.randomizedDelay(5, 5);
          break;
        case DetectionAvoidanceStrategy.CPUThrottling:
          await AntiDetection.cpuThrottling(5, 50);
          break;
        case DetectionAvoidanceStrategy.ProcessIsolation:
          this.checkProcessIsolation();
          break;
        case DetectionAvoidanceStrategy.MemoryFootprintReduction:
          // No-op: memory reduction is handled by GC and process design
          break;
        case DetectionAvoidanceStrategy.WindowBehaviorRandomization:
          // Requires window instance, handled externally
          break;
        case DetectionAvoidanceStrategy.ProcessPriorityAdjustment:
          AntiDetection.adjustProcessPriority('low');
          break;
      }
    }
    const elapsed = performance.now() - start;
    if (elapsed > 10) {
      this.logEvent('performance_warning', `Detection avoidance exceeded 10ms: ${elapsed.toFixed(2)}ms`, this.currentProfile.riskLevel);
    }
  }

  /**
   * Checks process isolation and logs any violations.
   */
  checkProcessIsolation(): void {
    if (!ProcessIsolation.isMainProcess() && !ProcessIsolation.isRendererProcess()) {
      this.logEvent('process_violation', 'Unknown process type', this.currentProfile.riskLevel);
    }
    if (!ProcessIsolation.isSandboxed()) {
      this.logEvent('sandbox_violation', 'Process is not sandboxed', this.currentProfile.riskLevel);
    }
  }

  /**
   * Monitors system footprint (CPU, memory) and logs if thresholds are exceeded.
   */
  monitorSystemFootprint(cpuThreshold = 80, memoryThresholdMB = 500): SystemFootprint {
    const footprint = AntiDetection.getSystemFootprint();
    this.lastFootprint = footprint;
    if (footprint.cpuUsagePercent > cpuThreshold) {
      this.logEvent('cpu_warning', `CPU usage high: ${footprint.cpuUsagePercent}%`, this.currentProfile.riskLevel);
    }
    if (footprint.memoryUsageMB > memoryThresholdMB) {
      this.logEvent('memory_warning', `Memory usage high: ${footprint.memoryUsageMB}MB`, this.currentProfile.riskLevel);
    }
    return footprint;
  }

  /**
   * Dynamically adjusts behavior based on risk assessment.
   * Escalates or de-escalates risk level and profile as needed.
   */
  adjustBehaviorBasedOnRisk(): void {
    if (!this.lastFootprint) {return;}
    let newRisk: RiskLevel = this.currentProfile.riskLevel;
    if (this.lastFootprint.cpuUsagePercent > 90 || this.lastFootprint.memoryUsageMB > 800) {
      newRisk = RiskLevel.Critical;
    } else if (this.lastFootprint.cpuUsagePercent > 70 || this.lastFootprint.memoryUsageMB > 400) {
      newRisk = RiskLevel.High;
    } else if (this.lastFootprint.cpuUsagePercent > 40 || this.lastFootprint.memoryUsageMB > 200) {
      newRisk = RiskLevel.Medium;
    } else {
      newRisk = RiskLevel.Low;
    }
    if (newRisk !== this.currentProfile.riskLevel) {
      // Find a profile with the new risk level, or stay on current
      const match = Object.values(this.profiles).find((p) => p.riskLevel === newRisk);
      if (match) {
        this.applyProfile(match.name);
      }
    }
  }

  /**
   * Logs a security event.
   */
  private logEvent(eventType: string, details: string, riskLevel: RiskLevel, profileName?: string): void {
    this.eventLog.push({
      timestamp: Date.now(),
      eventType,
      details,
      riskLevel,
      profileName: profileName ?? '',
    });
  }

  /**
   * Returns the current security event log.
   */
  getEventLog(): SecurityEvent[] {
    return this.eventLog.slice();
  }

  /**
   * Returns the current security profile.
   */
  getCurrentProfile(): SecurityProfile {
    return this.currentProfile;
  }

  /**
   * Returns the last measured system footprint.
   */
  getLastFootprint(): SystemFootprint | null {
    return this.lastFootprint;
  }
}
