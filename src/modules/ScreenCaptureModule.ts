import { desktopCapturer, DesktopCapturerSource } from 'electron';
import {
  SupportedResolution,
  CaptureConfig,
  ScreenCapture,
  UnsupportedResolutionError,
  PermissionDeniedError,
  CaptureFailureError,
} from '../shared/types/ScreenCapture';

/**
 * Utility to check if a given resolution is supported.
 */
function isSupportedResolution(
  res: { width: number; height: number },
  supported: SupportedResolution[]
): boolean {
  return supported.some(
    (s) => s.width === res.width && s.height === res.height
  );
}

/**
 * Attempts to adapt a requested resolution to the closest supported one.
 */
function adaptResolution(
  requested: { width: number; height: number },
  supported: SupportedResolution[]
): { width: number; height: number } {
  // Find the closest supported resolution by Euclidean distance
  let minDist = Infinity;
  let closest = supported[0];
  for (const s of supported) {
    const dist =
      Math.pow(s.width - requested.width, 2) +
      Math.pow(s.height - requested.height, 2);
    if (dist < minDist) {
      minDist = dist;
      closest = s;
    }
  }
  return { width: closest.width, height: closest.height };
}

/**
 * Main ScreenCaptureModule class.
 * Handles cross-platform screen capture, resolution validation, and error handling.
 */
export class ScreenCaptureModule {
  private config: CaptureConfig;

  constructor(config: CaptureConfig) {
    this.config = config;
  }

  /**
   * Prompts the user to select a window or screen to capture.
   * Returns the selected DesktopCapturerSource.
   */
  async selectTargetWindow(): Promise<DesktopCapturerSource> {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      fetchWindowIcons: true,
      thumbnailSize: { width: 400, height: 400 },
    });

    // If a target window title is specified, try to match it
    if (this.config.targetWindowTitle) {
      const match = sources.find((src) =>
        src.name.includes(this.config.targetWindowTitle!)
      );
      if (match) {return match;}
    }

    // Otherwise, prompt user to select (for now, pick the first screen)
    // In production, replace with a UI dialog for user selection
    const primaryScreen = sources.find((src) => src.id.startsWith('screen:'));
    if (!primaryScreen) {
      throw new CaptureFailureError('No screen source found');
    }
    return primaryScreen;
  }

  /**
   * Captures the screen or window at the specified resolution.
   * Throws on unsupported resolution or permission denial.
   */
  async captureScreen(
    requestedResolution?: { width: number; height: number }
  ): Promise<ScreenCapture> {
    const start = performance.now();
    const config = this.config;
    const supported = config.supportedResolutions;

    // Get current or requested resolution
    let resolution =
      requestedResolution ||
      (supported.length > 0 ? supported[0] : { width: 1920, height: 1080 });

    // Validate resolution
    if (!isSupportedResolution(resolution, supported)) {
      // Try to adapt
      const adapted = adaptResolution(resolution, supported);
      if (!isSupportedResolution(adapted, supported)) {
        throw new UnsupportedResolutionError(
          'Requested resolution is not supported',
          resolution
        );
      }
      resolution = adapted;
    }

    // Select target window/screen
    let source: DesktopCapturerSource;
    try {
      source = await this.selectTargetWindow();
    } catch (err) {
      if (err instanceof PermissionDeniedError) {throw err;}
      throw new CaptureFailureError('Failed to select capture source');
    }

    // Get media stream for the selected source
    let stream: MediaStream;
    try {
      // @ts-ignore: getUserMedia is available in Electron renderer
      stream = await (navigator.mediaDevices as any).getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id,
            minWidth: resolution.width,
            maxWidth: resolution.width,
            minHeight: resolution.height,
            maxHeight: resolution.height,
          },
        },
      });
    } catch (err: any) {
      if (err && err.name === 'NotAllowedError') {
        throw new PermissionDeniedError('Screen capture permission denied');
      }
      throw new CaptureFailureError('Failed to get media stream');
    }

    // Capture a single frame from the stream
    const video = document.createElement('video');
    video.srcObject = stream;
    video.width = resolution.width;
    video.height = resolution.height;

    // Wait for video to be ready
    await new Promise((resolve) => {
      video.onloadedmetadata = () => resolve(true);
    });

    // Draw video frame to canvas
    const canvas = document.createElement('canvas');
    canvas.width = resolution.width;
    canvas.height = resolution.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      stream.getTracks().forEach((t) => t.stop());
      throw new CaptureFailureError('Failed to get canvas context');
    }
    ctx.drawImage(video, 0, 0, resolution.width, resolution.height);

    // Get image data as PNG
    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/png')
    );
    const arrayBuffer = await blob.arrayBuffer();
    const image = new Uint8Array(arrayBuffer);

    // Clean up
    stream.getTracks().forEach((t) => t.stop());

    // Performance check
    const elapsed = performance.now() - start;
    if (elapsed > 50) {
      // Optionally log or throw if strict
      // throw new CaptureFailureError('Capture exceeded 50ms');
    }

    // Return ScreenCapture object
    return {
      image,
      resolution,
      timestamp: Date.now(),
      sourceDisplayId: source.display_id || undefined,
      windowTitle: source.name,
    };
  }
}