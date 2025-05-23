"""
Multi-threaded Screen Capture Engine

Cross-platform screen capture with adaptive frame rates and region-specific capture.
Supports Windows and macOS with optimized performance and minimal memory footprint.
"""

import threading
import time
import platform
import queue
from typing import Optional, Tuple, Callable, Any
from dataclasses import dataclass
from abc import ABC, abstractmethod

try:
    import numpy as np
    from PIL import Image
except ImportError:
    raise ImportError("Required dependencies not installed. Run: pip install numpy pillow")

# Platform-specific imports
if platform.system() == "Windows":
    try:
        import mss
        import win32gui
        import win32con
        import win32api
        WINDOWS_AVAILABLE = True
    except ImportError:
        WINDOWS_AVAILABLE = False
        print("Warning: Windows-specific libraries not available")

elif platform.system() == "Darwin":
    try:
        import Quartz
        import CoreGraphics
        from AppKit import NSWorkspace
        MACOS_AVAILABLE = True
    except ImportError:
        MACOS_AVAILABLE = False
        print("Warning: macOS-specific libraries not available")


@dataclass
class CaptureRegion:
    """Defines a screen region to capture"""
    x: int
    y: int
    width: int
    height: int
    monitor: int = 0  # Monitor index for multi-monitor setups


@dataclass
class CaptureResult:
    """Result of a screen capture operation"""
    image: Optional[np.ndarray]
    timestamp: float
    region: CaptureRegion
    success: bool
    error_message: Optional[str] = None


class BaseCaptureBackend(ABC):
    """Abstract base class for platform-specific capture backends"""
    
    @abstractmethod
    def capture_region(self, region: CaptureRegion) -> CaptureResult:
        """Capture a specific region of the screen"""
        pass
    
    @abstractmethod
    def get_screen_size(self, monitor: int = 0) -> Tuple[int, int]:
        """Get the size of the specified monitor"""
        pass
    
    @abstractmethod
    def get_monitor_count(self) -> int:
        """Get the number of available monitors"""
        pass


class WindowsCaptureBackend(BaseCaptureBackend):
    """Windows-specific screen capture implementation using MSS"""
    
    def __init__(self):
        if not WINDOWS_AVAILABLE:
            raise RuntimeError("Windows capture backend not available")
        self.sct = mss.mss()
    
    def capture_region(self, region: CaptureRegion) -> CaptureResult:
        """Capture screen region using MSS (fastest method on Windows)"""
        try:
            # MSS monitor format: {"top": y, "left": x, "width": w, "height": h}
            monitor = {
                "top": region.y,
                "left": region.x, 
                "width": region.width,
                "height": region.height
            }
            
            # Capture the screen
            screenshot = self.sct.grab(monitor)
            
            # Convert to numpy array (RGB format)
            img_array = np.frombuffer(screenshot.rgb, dtype=np.uint8)
            img_array = img_array.reshape((screenshot.height, screenshot.width, 3))
            
            return CaptureResult(
                image=img_array,
                timestamp=time.time(),
                region=region,
                success=True
            )
            
        except Exception as e:
            return CaptureResult(
                image=None,
                timestamp=time.time(),
                region=region,
                success=False,
                error_message=str(e)
            )
    
    def get_screen_size(self, monitor: int = 0) -> Tuple[int, int]:
        """Get screen dimensions for specified monitor"""
        try:
            monitors = self.sct.monitors
            if monitor >= len(monitors):
                monitor = 1  # Primary monitor
            
            mon = monitors[monitor]
            return mon["width"], mon["height"]
        except Exception:
            return win32api.GetSystemMetrics(0), win32api.GetSystemMetrics(1)
    
    def get_monitor_count(self) -> int:
        """Get number of available monitors"""
        return len(self.sct.monitors) - 1  # Subtract 1 for "All in One" monitor


class MacOSCaptureBackend(BaseCaptureBackend):
    """macOS-specific screen capture implementation using Quartz"""
    
    def __init__(self):
        if not MACOS_AVAILABLE:
            raise RuntimeError("macOS capture backend not available")
    
    def capture_region(self, region: CaptureRegion) -> CaptureResult:
        """Capture screen region using Quartz (Core Graphics)"""
        try:
            # Create CGRect for capture region
            capture_rect = CoreGraphics.CGRect(
                (region.x, region.y),
                (region.width, region.height)
            )
            
            # Capture the screen region
            image_ref = CoreGraphics.CGWindowListCreateImage(
                capture_rect,
                CoreGraphics.kCGWindowListOptionOnScreenOnly,
                CoreGraphics.kCGNullWindowID,
                CoreGraphics.kCGWindowImageDefault
            )
            
            if not image_ref:
                raise Exception("Failed to capture screen region")
            
            # Convert CGImage to numpy array
            width = CoreGraphics.CGImageGetWidth(image_ref)
            height = CoreGraphics.CGImageGetHeight(image_ref)
            
            # Create bitmap context
            bytes_per_pixel = 4
            bytes_per_row = bytes_per_pixel * width
            color_space = CoreGraphics.CGColorSpaceCreateDeviceRGB()
            
            # Create buffer for image data
            buffer = np.zeros((height, width, 4), dtype=np.uint8)
            context = CoreGraphics.CGBitmapContextCreate(
                buffer,
                width,
                height,
                8,
                bytes_per_row,
                color_space,
                CoreGraphics.kCGImageAlphaPremultipliedLast
            )
            
            # Draw image to context
            CoreGraphics.CGContextDrawImage(
                context,
                CoreGraphics.CGRect((0, 0), (width, height)),
                image_ref
            )
            
            # Convert RGBA to RGB
            rgb_buffer = buffer[:, :, :3]
            
            return CaptureResult(
                image=rgb_buffer,
                timestamp=time.time(),
                region=region,
                success=True
            )
            
        except Exception as e:
            return CaptureResult(
                image=None,
                timestamp=time.time(),
                region=region,
                success=False,
                error_message=str(e)
            )
    
    def get_screen_size(self, monitor: int = 0) -> Tuple[int, int]:
        """Get screen dimensions for specified monitor"""
        try:
            displays = Quartz.CGGetActiveDisplayList(32, None, None)[1]
            if monitor >= len(displays):
                monitor = 0
            
            display_id = displays[monitor]
            mode = Quartz.CGDisplayCopyDisplayMode(display_id)
            width = Quartz.CGDisplayModeGetWidth(mode)
            height = Quartz.CGDisplayModeGetHeight(mode)
            
            return int(width), int(height)
        except Exception:
            return 1920, 1080  # Fallback resolution
    
    def get_monitor_count(self) -> int:
        """Get number of available monitors"""
        try:
            return len(Quartz.CGGetActiveDisplayList(32, None, None)[1])
        except Exception:
            return 1


class ScreenCaptureEngine:
    """
    Multi-threaded screen capture engine with adaptive frame rates.
    
    Features:
    - Cross-platform support (Windows/macOS)
    - Adaptive capture intervals (0.5-2s)
    - Region-specific capture
    - Multi-monitor support
    - Memory-efficient operation
    """
    
    def __init__(self, capture_interval: float = 1.0, max_queue_size: int = 10):
        """
        Initialize the screen capture engine
        
        Args:
            capture_interval: Time between captures in seconds (0.5-2.0)
            max_queue_size: Maximum number of frames to queue
        """
        self.capture_interval = max(0.5, min(2.0, capture_interval))
        self.max_queue_size = max_queue_size
        
        # Initialize platform-specific backend
        self.backend = self._create_backend()
        
        # Threading components
        self._capture_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._frame_queue: queue.Queue[CaptureResult] = queue.Queue(maxsize=max_queue_size)
        
        # State tracking
        self._is_capturing = False
        self._capture_region: Optional[CaptureRegion] = None
        self._frame_callback: Optional[Callable[[CaptureResult], None]] = None
        
        # Performance monitoring
        self._capture_count = 0
        self._error_count = 0
        self._start_time = 0.0
    
    def _create_backend(self) -> BaseCaptureBackend:
        """Create platform-specific capture backend"""
        system = platform.system()
        
        if system == "Windows" and WINDOWS_AVAILABLE:
            return WindowsCaptureBackend()
        elif system == "Darwin" and MACOS_AVAILABLE:
            return MacOSCaptureBackend()
        else:
            raise RuntimeError(f"Unsupported platform: {system}")
    
    def set_capture_interval(self, interval: float) -> None:
        """
        Set the capture interval (adaptive frame rate)
        
        Args:
            interval: Time between captures in seconds (0.5-2.0)
        """
        self.capture_interval = max(0.5, min(2.0, interval))
    
    def set_frame_callback(self, callback: Callable[[CaptureResult], None]) -> None:
        """
        Set callback function to be called for each captured frame
        
        Args:
            callback: Function that receives CaptureResult objects
        """
        self._frame_callback = callback
    
    def capture_region(self, x: int, y: int, width: int, height: int, monitor: int = 0) -> CaptureResult:
        """
        Capture a specific region of the screen once
        
        Args:
            x: X coordinate of top-left corner
            y: Y coordinate of top-left corner
            width: Width of capture region
            height: Height of capture region
            monitor: Monitor index for multi-monitor setups
            
        Returns:
            CaptureResult containing the captured image
        """
        region = CaptureRegion(x, y, width, height, monitor)
        return self.backend.capture_region(region)
    
    def start_continuous_capture(self, x: int, y: int, width: int, height: int, monitor: int = 0) -> None:
        """
        Start continuous screen capture in a separate thread
        
        Args:
            x: X coordinate of top-left corner
            y: Y coordinate of top-left corner
            width: Width of capture region
            height: Height of capture region
            monitor: Monitor index for multi-monitor setups
        """
        if self._is_capturing:
            self.stop_capture()
        
        self._capture_region = CaptureRegion(x, y, width, height, monitor)
        self._stop_event.clear()
        self._is_capturing = True
        self._start_time = time.time()
        self._capture_count = 0
        self._error_count = 0
        
        # Start capture thread
        self._capture_thread = threading.Thread(
            target=self._capture_loop,
            name="ScreenCaptureThread",
            daemon=True
        )
        self._capture_thread.start()
    
    def stop_capture(self) -> None:
        """Stop continuous screen capture"""
        if not self._is_capturing:
            return
        
        self._stop_event.set()
        self._is_capturing = False
        
        if self._capture_thread and self._capture_thread.is_alive():
            self._capture_thread.join(timeout=2.0)
        
        # Clear remaining frames
        while not self._frame_queue.empty():
            try:
                self._frame_queue.get_nowait()
            except queue.Empty:
                break
    
    def get_latest_frame(self) -> Optional[CaptureResult]:
        """
        Get the most recent captured frame
        
        Returns:
            Most recent CaptureResult or None if no frames available
        """
        try:
            return self._frame_queue.get_nowait()
        except queue.Empty:
            return None
    
    def is_capturing(self) -> bool:
        """Check if continuous capture is active"""
        return self._is_capturing
    
    def get_screen_size(self, monitor: int = 0) -> Tuple[int, int]:
        """Get screen dimensions for specified monitor"""
        return self.backend.get_screen_size(monitor)
    
    def get_monitor_count(self) -> int:
        """Get number of available monitors"""
        return self.backend.get_monitor_count()
    
    def get_performance_stats(self) -> dict:
        """Get performance statistics"""
        runtime = time.time() - self._start_time if self._start_time > 0 else 0
        fps = self._capture_count / runtime if runtime > 0 else 0
        
        return {
            "capture_count": self._capture_count,
            "error_count": self._error_count,
            "runtime_seconds": runtime,
            "average_fps": fps,
            "queue_size": self._frame_queue.qsize(),
            "is_capturing": self._is_capturing
        }
    
    def _capture_loop(self) -> None:
        """Main capture loop running in separate thread"""
        if not self._capture_region:
            return
        
        while not self._stop_event.is_set():
            try:
                # Capture frame
                result = self.backend.capture_region(self._capture_region)
                self._capture_count += 1
                
                if not result.success:
                    self._error_count += 1
                
                # Add to queue (non-blocking)
                try:
                    self._frame_queue.put_nowait(result)
                except queue.Full:
                    # Remove oldest frame and add new one
                    try:
                        self._frame_queue.get_nowait()
                        self._frame_queue.put_nowait(result)
                    except queue.Empty:
                        pass
                
                # Call frame callback if set
                if self._frame_callback:
                    try:
                        self._frame_callback(result)
                    except Exception as e:
                        print(f"Frame callback error: {e}")
                
                # Wait for next capture
                self._stop_event.wait(self.capture_interval)
                
            except Exception as e:
                self._error_count += 1
                print(f"Capture loop error: {e}")
                self._stop_event.wait(0.1)  # Brief pause before retry
    
    def __del__(self):
        """Cleanup when object is destroyed"""
        if self._is_capturing:
            self.stop_capture()


# Convenience functions for quick access
def create_capture_engine(interval: float = 1.0) -> ScreenCaptureEngine:
    """Create a new screen capture engine with specified interval"""
    return ScreenCaptureEngine(capture_interval=interval)


def quick_capture(x: int, y: int, width: int, height: int) -> Optional[np.ndarray]:
    """
    Quick one-time screen capture
    
    Returns:
        Numpy array containing the captured image, or None if capture failed
    """
    try:
        engine = create_capture_engine()
        result = engine.capture_region(x, y, width, height)
        return result.image if result.success else None
    except Exception as e:
        print(f"Quick capture failed: {e}")
        return None