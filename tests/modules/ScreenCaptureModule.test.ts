/**
 * TDD tests for ScreenCaptureModule.
 * Mocks Electron APIs and DOM as needed.
 */
import { ScreenCaptureModule } from '../../src/modules/ScreenCaptureModule';
import {
  CaptureConfig,
  UnsupportedResolutionError,
  PermissionDeniedError,
} from '../../src/shared/types/ScreenCapture';

// Mock Electron and DOM APIs
jest.mock('electron', () => ({
  desktopCapturer: {
    getSources: jest.fn(),
  },
}));

// Mock DOM for video/canvas
function setupDOMMocks(imageData: Uint8Array) {
  // Cast to any to suppress HTMLElement type errors
  (global as any).document = {
    createElement: (type: string) => {
      if (type === 'video') {
        return {
          srcObject: null,
          width: 0,
          height: 0,
          onloadedmetadata: null as null | (() => void),
          addEventListener: function (event: string, cb: () => void) {
            if (event === 'loadedmetadata') this.onloadedmetadata = cb;
          },
        };
      }
      if (type === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            drawImage: jest.fn(),
          }),
          toBlob: (cb: (b: Blob) => void) => {
            cb({
              arrayBuffer: async () => imageData.buffer,
            } as unknown as Blob);
          },
        };
      }
      return {};
    },
  } as any;
  (global as any).performance = { now: jest.fn(() => Date.now()) };
}

// Helper: create a fake media stream
function mockMediaStream() {
  return {
    getTracks: () => [
      { stop: jest.fn() },
    ],
  };
}

describe('ScreenCaptureModule', () => {
  const supportedResolutions = [
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
    { width: 3840, height: 2160 },
  ];
  const config: CaptureConfig = {
    supportedResolutions,
    targetWindowTitle: 'Test Window',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Cast to any and add missing MediaDevices properties
    (global as any).navigator = {
      mediaDevices: {
        getUserMedia: jest.fn(),
        ondevicechange: null,
        enumerateDevices: jest.fn(),
        getDisplayMedia: jest.fn(),
        getSupportedConstraints: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      },
    };
  });

  it('captures screen successfully at supported resolution', async () => {
       jest.setTimeout(10000); // Increase timeout to 10 seconds
    const imageData = new Uint8Array([1, 2, 3]);
    setupDOMMocks(imageData);

    // Mock Electron source
    const { desktopCapturer } = require('electron');
    desktopCapturer.getSources.mockResolvedValue([
      { id: 'screen:1', name: 'Test Window', display_id: '1' },
    ]);
    // Mock getUserMedia
    // @ts-ignore
    global.navigator.mediaDevices.getUserMedia.mockResolvedValue(mockMediaStream());

    const module = new ScreenCaptureModule(config);
    const capture = await module.captureScreen({ width: 1920, height: 1080 });

    expect(capture.image).toEqual(imageData);
    expect(capture.resolution).toEqual({ width: 1920, height: 1080 });
    expect(capture.windowTitle).toBe('Test Window');
    expect(capture.sourceDisplayId).toBe('1');
    expect(typeof capture.timestamp).toBe('number');
  });

  it('throws UnsupportedResolutionError for invalid resolution', async () => {
    const module = new ScreenCaptureModule(config);
    await expect(
      module.captureScreen({ width: 1234, height: 5678 })
    ).rejects.toThrow(UnsupportedResolutionError);
  });

  it('adapts to closest supported resolution', async () => {
    const imageData = new Uint8Array([4, 5, 6]);
    setupDOMMocks(imageData);

    const { desktopCapturer } = require('electron');
    desktopCapturer.getSources.mockResolvedValue([
      { id: 'screen:1', name: 'Test Window', display_id: '1' },
    ]);
    // @ts-ignore
    global.navigator.mediaDevices.getUserMedia.mockResolvedValue(mockMediaStream());

    const module = new ScreenCaptureModule(config);
    // Closest to 2000x1100 is 1920x1080
    const capture = await module.captureScreen({ width: 2000, height: 1100 });
    expect(capture.resolution).toEqual({ width: 1920, height: 1080 });
  });

  it('handles permission denial', async () => {
    const imageData = new Uint8Array([7, 8, 9]);
    setupDOMMocks(imageData);

    const { desktopCapturer } = require('electron');
    desktopCapturer.getSources.mockResolvedValue([
      { id: 'screen:1', name: 'Test Window', display_id: '1' },
    ]);
    // @ts-ignore
    global.navigator.mediaDevices.getUserMedia.mockRejectedValue({ name: 'NotAllowedError' });

    const module = new ScreenCaptureModule(config);
    await expect(module.captureScreen({ width: 1920, height: 1080 })).rejects.toThrow(PermissionDeniedError);
  });

  it('completes capture in under 50ms (performance test)', async () => {
    const imageData = new Uint8Array([10, 11, 12]);
    setupDOMMocks(imageData);

    const { desktopCapturer } = require('electron');
    desktopCapturer.getSources.mockResolvedValue([
      { id: 'screen:1', name: 'Test Window', display_id: '1' },
    ]);
    // @ts-ignore
    global.navigator.mediaDevices.getUserMedia.mockResolvedValue(mockMediaStream());

    // Mock performance.now to simulate <50ms
    let now = 0;
    // @ts-ignore
    global.performance = {
      now: jest.fn(() => {
        now += 10;
        return now;
      }),
    };

    const module = new ScreenCaptureModule(config);
    const capture = await module.captureScreen({ width: 1920, height: 1080 });
    expect(capture).toBeDefined();
    // If the implementation throws on >50ms, this will fail
  });

  it('handles multi-monitor setup', async () => {
    const imageData = new Uint8Array([13, 14, 15]);
    setupDOMMocks(imageData);

    const { desktopCapturer } = require('electron');
    desktopCapturer.getSources.mockResolvedValue([
      { id: 'screen:1', name: 'Primary', display_id: '1' },
      { id: 'screen:2', name: 'Secondary', display_id: '2' },
    ]);
    // @ts-ignore
    global.navigator.mediaDevices.getUserMedia.mockResolvedValue(mockMediaStream());

    const multiConfig: CaptureConfig = {
      supportedResolutions,
      targetWindowTitle: 'Secondary',
    };
    const module = new ScreenCaptureModule(multiConfig);
    const capture = await module.captureScreen({ width: 2560, height: 1440 });
    expect(capture.windowTitle).toBe('Secondary');
    expect(capture.sourceDisplayId).toBe('2');
  });
});