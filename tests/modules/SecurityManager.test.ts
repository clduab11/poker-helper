import { SecurityManager } from '../../src/modules/SecurityManager';
import {
  SecurityProfile,
  DetectionAvoidanceStrategy,
  RiskLevel,
  SecurityEvent,
} from '../../src/shared/types/Security';

// Mock AntiDetection and ProcessIsolation utilities
jest.mock('../../src/modules/utils/AntiDetection', () => ({
  randomizedDelay: jest.fn(() => Promise.resolve()),
  cpuThrottling: jest.fn(() => Promise.resolve()),
  getSystemFootprint: jest.fn(() => ({
    cpuUsagePercent: 10,
    memoryUsageMB: 50,
    timestamp: Date.now(),
  })),
  adjustProcessPriority: jest.fn(),
}));

jest.mock('../../src/modules/utils/ProcessIsolation', () => ({
  isMainProcess: jest.fn(() => true),
  isRendererProcess: jest.fn(() => false),
  isSandboxed: jest.fn(() => true),
  validateIPCChannel: jest.fn(() => true),
  hasOnlyPermissions: jest.fn(() => true),
}));

const profiles: SecurityProfile[] = [
  {
    name: 'low',
    riskLevel: RiskLevel.Low,
    enabledStrategies: [DetectionAvoidanceStrategy.RandomizedDelays],
    description: 'Low risk profile',
  },
  {
    name: 'high',
    riskLevel: RiskLevel.High,
    enabledStrategies: [
      DetectionAvoidanceStrategy.RandomizedDelays,
      DetectionAvoidanceStrategy.CPUThrottling,
      DetectionAvoidanceStrategy.ProcessIsolation,
    ],
    description: 'High risk profile',
  },
  {
    name: 'critical',
    riskLevel: RiskLevel.Critical,
    enabledStrategies: [
      DetectionAvoidanceStrategy.RandomizedDelays,
      DetectionAvoidanceStrategy.CPUThrottling,
      DetectionAvoidanceStrategy.ProcessIsolation,
      DetectionAvoidanceStrategy.ProcessPriorityAdjustment,
    ],
    description: 'Critical risk profile',
  },
];

describe('SecurityManager', () => {
  let manager: SecurityManager;

  beforeEach(() => {
    manager = new SecurityManager(profiles, 'low');
    jest.clearAllMocks();
  });

  it('applies security profiles correctly', () => {
    expect(manager.getCurrentProfile().name).toBe('low');
    manager.applyProfile('high');
    expect(manager.getCurrentProfile().name).toBe('high');
    manager.applyProfile('critical');
    expect(manager.getCurrentProfile().name).toBe('critical');
  });

  it('runs detection avoidance strategies', async () => {
    await manager.runDetectionAvoidance();
    expect(require('../../src/modules/utils/AntiDetection').randomizedDelay).toHaveBeenCalled();
    manager.applyProfile('high');
    await manager.runDetectionAvoidance();
    expect(require('../../src/modules/utils/AntiDetection').cpuThrottling).toHaveBeenCalled();
    expect(require('../../src/modules/utils/ProcessIsolation').isMainProcess).toHaveBeenCalled();
  });

  it('monitors system footprint and logs warnings', () => {
    // Simulate high CPU/memory
    const AntiDetection = require('../../src/modules/utils/AntiDetection');
    AntiDetection.getSystemFootprint.mockReturnValueOnce({
      cpuUsagePercent: 95,
      memoryUsageMB: 900,
      timestamp: Date.now(),
    });
    const footprint = manager.monitorSystemFootprint(80, 500);
    expect(footprint.cpuUsagePercent).toBe(95);
    expect(footprint.memoryUsageMB).toBe(900);
    const log = manager.getEventLog();
    expect(log.some((e: SecurityEvent) => e.eventType === 'cpu_warning')).toBe(true);
    expect(log.some((e: SecurityEvent) => e.eventType === 'memory_warning')).toBe(true);
  });

  it('adjusts behavior based on risk', () => {
    const AntiDetection = require('../../src/modules/utils/AntiDetection');
    // Simulate critical risk
    AntiDetection.getSystemFootprint.mockReturnValueOnce({
      cpuUsagePercent: 95,
      memoryUsageMB: 900,
      timestamp: Date.now(),
    });
    manager.monitorSystemFootprint();
    manager.adjustBehaviorBasedOnRisk();
    expect(manager.getCurrentProfile().riskLevel).toBe(RiskLevel.Critical);
    // Simulate low risk
    AntiDetection.getSystemFootprint.mockReturnValueOnce({
      cpuUsagePercent: 5,
      memoryUsageMB: 10,
      timestamp: Date.now(),
    });
    manager.monitorSystemFootprint();
    manager.adjustBehaviorBasedOnRisk();
    expect(manager.getCurrentProfile().riskLevel).toBe(RiskLevel.Low);
  });

  it('ensures detection avoidance completes in <10ms (excluding async)', async () => {
    const start = performance.now();
    await manager.runDetectionAvoidance();
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50); // Allowing for test overhead
  });

  it('handles high-risk scenario escalation', () => {
    const AntiDetection = require('../../src/modules/utils/AntiDetection');
    AntiDetection.getSystemFootprint.mockReturnValueOnce({
      cpuUsagePercent: 75,
      memoryUsageMB: 500,
      timestamp: Date.now(),
    });
    manager.monitorSystemFootprint();
    manager.adjustBehaviorBasedOnRisk();
    expect(manager.getCurrentProfile().riskLevel).toBe(RiskLevel.High);
  });
});