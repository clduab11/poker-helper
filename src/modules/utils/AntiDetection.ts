import { SystemFootprint } from '../../shared/types/Security';

/**
 * Utility for introducing random timing jitter to evade detection.
 * @param baseMs - The base delay in milliseconds.
 * @param jitterMs - The maximum random jitter to add/subtract.
 * @returns Promise that resolves after the randomized delay.
 */
export async function randomizedDelay(baseMs: number, jitterMs: number = 50): Promise<void> {
  const jitter = Math.floor(Math.random() * (2 * jitterMs + 1)) - jitterMs;
  const delay = Math.max(0, baseMs + jitter);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Throttles CPU usage by introducing short sleeps in a loop.
 * @param durationMs - Total duration to throttle in ms.
 * @param throttlePercent - Target CPU usage percent (0-100).
 * @returns Promise that resolves after throttling.
 */
export async function cpuThrottling(durationMs: number, throttlePercent: number = 50): Promise<void> {
  const interval = 10; // ms
  const activeTime = (interval * throttlePercent) / 100;
  const idleTime = interval - activeTime;
  const end = Date.now() + durationMs;
  while (Date.now() < end) {
    const start = Date.now();
    while (Date.now() - start < activeTime) {
      // Busy-wait for activeTime ms
    }
    if (idleTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, idleTime));
    }
  }
}

/**
 * Monitors current system CPU and memory usage.
 * Note: In Electron, process.getCPUUsage() and process.memoryUsage() are available.
 * @returns SystemFootprint object with current resource usage.
 */
export function getSystemFootprint(): SystemFootprint {
  // Fallback for Node.js/Electron
  const cpuUsage = typeof process.getCPUUsage === 'function'
    ? process.getCPUUsage().percentCPUUsage * 100
    : 0;
  const memoryUsage = process.memoryUsage ? process.memoryUsage().rss / (1024 * 1024) : 0;
  return {
    cpuUsagePercent: Math.round(cpuUsage * 100) / 100,
    memoryUsageMB: Math.round(memoryUsage * 100) / 100,
    timestamp: Date.now(),
  };
}

/**
 * Adjusts process priority to reduce detection risk.
 * Note: Not supported natively in Node.js/Electron; this is a no-op for portability.
 * @param priority - 'low' | 'normal' | 'high'
 */
export function adjustProcessPriority(_priority: 'low' | 'normal' | 'high'): void {
  // Not implemented: process priority adjustment is not available in standard Node.js/Electron.
  // This function is a placeholder for future platform-specific implementations.
}

/**
 * Randomizes window behavior to evade detection heuristics.
 * @param win - Electron BrowserWindow instance
 */
export function randomizeWindowBehavior(win: any): void {
  if (!win) return;
  // Randomize window position and size slightly
  const [x, y] = win.getPosition();
  const [w, h] = win.getSize();
  const dx = Math.floor(Math.random() * 10) - 5;
  const dy = Math.floor(Math.random() * 10) - 5;
  const dw = Math.floor(Math.random() * 10) - 5;
  const dh = Math.floor(Math.random() * 10) - 5;
  win.setPosition(x + dx, y + dy);
  win.setSize(w + dw, h + dh);
}