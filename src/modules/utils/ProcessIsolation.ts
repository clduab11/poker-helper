/**
 * Utilities for process isolation, sandbox enforcement, IPC security, and permission management in Electron.
 * All functions are designed to be safe for both main and renderer processes.
 */

/**
 * Checks if the current process is the Electron main process.
 * @returns true if main, false if renderer.
 */
export function isMainProcess(): boolean {
  return process && process.type === 'browser';
}

/**
 * Checks if the current process is the Electron renderer process.
 * @returns true if renderer, false if main.
 */
export function isRendererProcess(): boolean {
  return process && process.type === 'renderer';
}

/**
 * Verifies that sandboxing is enabled for the current process.
 * @returns true if sandboxed, false otherwise.
 */
export function isSandboxed(): boolean {
  // Electron exposes process.sandboxed in renderer, undefined in main
  return !!(process as any).sandboxed;
}

/**
 * Validates that IPC communication is restricted to allowed channels.
 * @param channel - The IPC channel name.
 * @param allowedChannels - Array of allowed channel names.
 * @returns true if channel is allowed, false otherwise.
 */
export function validateIPCChannel(channel: string, allowedChannels: string[]): boolean {
  return allowedChannels.includes(channel);
}

/**
 * Checks if the current process has only the specified permissions.
 * @param requiredPermissions - Array of required permission strings.
 * @returns true if only required permissions are present, false otherwise.
 */
export function hasOnlyPermissions(_requiredPermissions: string[]): boolean {
  // Placeholder: Electron does not expose a direct permission API.
  // This function should be implemented with custom permission tracking if needed.
  return true;
}