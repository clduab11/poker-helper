/**
 * Supported screen capture resolutions.
 * - Standard: 1920x1080, 2560x1440, 3840x2160
 * - Custom: { width: number, height: number }
 */
export type SupportedResolution =
  | { width: 1920; height: 1080 }
  | { width: 2560; height: 1440 }
  | { width: 3840; height: 2160 }
  | { width: number; height: number }; // Custom

/**
 * Configuration for screen capture.
 */
export interface CaptureConfig {
  supportedResolutions: SupportedResolution[];
  targetWindowTitle?: string; // Optional: user-selected window
  captureFrequencyMs?: number;
}

/**
 * Result of a screen capture operation.
 */
export interface ScreenCapture {
  image: Buffer | Uint8Array; // Raw image data (PNG or JPEG)
  resolution: { width: number; height: number };
  timestamp: number; // Unix epoch ms
  sourceDisplayId?: string | undefined; // For multi-monitor support
  windowTitle?: string | undefined; // If window capture
}

/**
 * Error thrown when the requested resolution is not supported.
 */
export class UnsupportedResolutionError extends Error {
  constructor(message: string, public attemptedResolution: { width: number; height: number }) {
    super(message);
    this.name = 'UnsupportedResolutionError';
  }
}

/**
 * Error thrown when screen capture permissions are denied.
 */
export class PermissionDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

/**
 * Error thrown when the screen capture fails for other reasons.
 */
export class CaptureFailureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CaptureFailureError';
  }
}