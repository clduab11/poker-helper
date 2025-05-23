"""
Image Preprocessing Pipeline

High-performance image preprocessing optimized for poker table analysis.
Includes enhancement, filtering, normalization, and GPU acceleration support
for both CUDA (NVIDIA) and Metal (Apple Silicon) architectures.
"""

import cv2
import numpy as np
import time
import platform
from typing import Dict, List, Optional, Tuple, Any, Union
from dataclasses import dataclass, field
from enum import Enum
import logging

# GPU acceleration imports
try:
    import cupy as cp
    CUDA_AVAILABLE = True
except ImportError:
    CUDA_AVAILABLE = False
    cp = None

# Apple Metal support via PyTorch MPS
try:
    import torch
    METAL_AVAILABLE = (platform.system() == "Darwin" and 
                      hasattr(torch.backends, 'mps') and 
                      torch.backends.mps.is_available())
except ImportError:
    METAL_AVAILABLE = False
    torch = None

# OpenCV Metal support check
OPENCV_METAL_AVAILABLE = False
try:
    # Check if OpenCV was compiled with Metal support
    if hasattr(cv2, 'setUseOptimized'):
        cv2.setUseOptimized(True)
        OPENCV_METAL_AVAILABLE = True
except:
    pass

logging.info(f"GPU Support - CUDA: {CUDA_AVAILABLE}, Metal: {METAL_AVAILABLE}, OpenCV Metal: {OPENCV_METAL_AVAILABLE}")


class PreprocessingMode(Enum):
    """Image preprocessing modes"""
    FAST = "fast"  # Minimal processing for speed
    BALANCED = "balanced"  # Balance of quality and speed
    QUALITY = "quality"  # Maximum quality processing
    CARD_DETECTION = "card_detection"  # Optimized for card detection
    OCR_OPTIMIZED = "ocr_optimized"  # Optimized for text extraction


@dataclass
class PreprocessingConfig:
    """Configuration for image preprocessing"""
    mode: PreprocessingMode = PreprocessingMode.BALANCED
    target_resolution: Tuple[int, int] = (1920, 1080)  # Target width, height
    enable_gpu: bool = True
    gpu_backend: str = "auto"  # "auto", "cuda", "metal", "cpu"
    preserve_aspect_ratio: bool = True
    
    # Enhancement parameters
    contrast_enhancement: bool = True
    clahe_clip_limit: float = 2.0
    clahe_tile_size: Tuple[int, int] = (8, 8)
    
    # Noise reduction
    noise_reduction: bool = True
    bilateral_d: int = 9
    bilateral_sigma_color: float = 75
    bilateral_sigma_space: float = 75
    
    # Sharpening
    sharpening: bool = True
    sharpen_strength: float = 0.3
    
    # Color adjustments
    gamma_correction: bool = True
    gamma_value: float = 1.2
    saturation_boost: float = 1.1
    
    # Stability
    motion_blur_detection: bool = True
    auto_white_balance: bool = True


class GPUBackendManager:
    """Manages GPU backend selection and operations"""
    
    def __init__(self, config: PreprocessingConfig):
        self.config = config
        self.backend = self._select_backend()
        self.device = None
        
        if self.backend == "cuda":
            self._init_cuda()
        elif self.backend == "metal":
            self._init_metal()
        
        logging.info(f"Using GPU backend: {self.backend}")
    
    def _select_backend(self) -> str:
        """Select optimal GPU backend"""
        if not self.config.enable_gpu or self.config.gpu_backend == "cpu":
            return "cpu"
        
        if self.config.gpu_backend == "cuda" and CUDA_AVAILABLE:
            return "cuda"
        elif self.config.gpu_backend == "metal" and METAL_AVAILABLE:
            return "metal"
        elif self.config.gpu_backend == "auto":
            # Auto-select best available
            if METAL_AVAILABLE and platform.system() == "Darwin":
                return "metal"  # Prefer Metal on Apple systems
            elif CUDA_AVAILABLE:
                return "cuda"
            else:
                return "cpu"
        
        return "cpu"
    
    def _init_cuda(self):
        """Initialize CUDA backend"""
        if CUDA_AVAILABLE:
            try:
                # Test CUDA functionality
                test_array = cp.array([1, 2, 3])
                _ = cp.sum(test_array)
                self.device = "cuda"
                logging.info("CUDA backend initialized successfully")
            except Exception as e:
                logging.warning(f"CUDA initialization failed: {e}")
                self.backend = "cpu"
    
    def _init_metal(self):
        """Initialize Metal backend"""
        if METAL_AVAILABLE:
            try:
                # Test Metal functionality
                test_tensor = torch.tensor([1, 2, 3], device="mps")
                _ = torch.sum(test_tensor)
                self.device = torch.device("mps")
                logging.info("Metal backend initialized successfully")
            except Exception as e:
                logging.warning(f"Metal initialization failed: {e}")
                self.backend = "cpu"
    
    def to_gpu(self, image: np.ndarray) -> Union[np.ndarray, 'cp.ndarray', 'torch.Tensor']:
        """Move image to GPU memory"""
        if self.backend == "cuda" and CUDA_AVAILABLE:
            try:
                return cp.asarray(image)
            except Exception:
                return image
        elif self.backend == "metal" and METAL_AVAILABLE:
            try:
                # Convert numpy to torch tensor and move to Metal
                tensor = torch.from_numpy(image.copy())
                return tensor.to(self.device)
            except Exception:
                return image
        
        return image
    
    def to_cpu(self, data: Union[np.ndarray, 'cp.ndarray', 'torch.Tensor']) -> np.ndarray:
        """Move data back to CPU"""
        if self.backend == "cuda" and hasattr(data, 'get'):
            try:
                return cp.asnumpy(data)
            except Exception:
                return data
        elif self.backend == "metal" and hasattr(data, 'cpu'):
            try:
                return data.cpu().numpy()
            except Exception:
                return data
        
        return np.asarray(data)
    
    def gpu_resize(self, image: Union[np.ndarray, 'cp.ndarray', 'torch.Tensor'], 
                   target_size: Tuple[int, int]) -> Union[np.ndarray, 'cp.ndarray', 'torch.Tensor']:
        """GPU-accelerated image resize"""
        if self.backend == "cuda" and hasattr(image, 'get'):
            try:
                import cupyx.scipy.ndimage as gpu_ndimage
                
                height, width = image.shape[:2]
                target_width, target_height = target_size
                
                scale_x = target_width / width
                scale_y = target_height / height
                
                if len(image.shape) == 3:
                    resized = gpu_ndimage.zoom(image, (scale_y, scale_x, 1), order=1)
                else:
                    resized = gpu_ndimage.zoom(image, (scale_y, scale_x), order=1)
                
                return resized
            except Exception:
                return self.to_cpu(image)
        
        elif self.backend == "metal" and hasattr(image, 'cpu'):
            try:
                # PyTorch resize on Metal
                if len(image.shape) == 3:
                    # Convert HWC to CHW for PyTorch
                    image_tensor = image.permute(2, 0, 1).unsqueeze(0).float()
                else:
                    image_tensor = image.unsqueeze(0).unsqueeze(0).float()
                
                # Use PyTorch interpolation
                resized = torch.nn.functional.interpolate(
                    image_tensor, size=target_size[::-1], mode='bilinear', align_corners=False
                )
                
                if len(image.shape) == 3:
                    return resized.squeeze(0).permute(1, 2, 0).to(torch.uint8)
                else:
                    return resized.squeeze(0).squeeze(0).to(torch.uint8)
            except Exception:
                return self.to_cpu(image)
        
        return image
    
    def gpu_filter(self, image: Union[np.ndarray, 'cp.ndarray', 'torch.Tensor'], 
                   kernel: np.ndarray) -> Union[np.ndarray, 'cp.ndarray', 'torch.Tensor']:
        """GPU-accelerated convolution filtering"""
        if self.backend == "cuda" and hasattr(image, 'get'):
            try:
                import cupyx.scipy.ndimage as gpu_ndimage
                kernel_gpu = cp.asarray(kernel)
                return gpu_ndimage.convolve(image, kernel_gpu)
            except Exception:
                return self.to_cpu(image)
        
        elif self.backend == "metal" and hasattr(image, 'cpu'):
            try:
                # Convert kernel to torch
                kernel_tensor = torch.from_numpy(kernel).float().to(self.device)
                
                if len(image.shape) == 3:
                    # Handle color image
                    image_tensor = image.permute(2, 0, 1).unsqueeze(0).float()
                    kernel_tensor = kernel_tensor.unsqueeze(0).unsqueeze(0)
                    
                    # Apply convolution to each channel
                    filtered_channels = []
                    for c in range(image_tensor.shape[1]):
                        channel = image_tensor[:, c:c+1, :, :]
                        filtered = torch.nn.functional.conv2d(
                            channel, kernel_tensor, padding='same'
                        )
                        filtered_channels.append(filtered)
                    
                    result = torch.cat(filtered_channels, dim=1)
                    return result.squeeze(0).permute(1, 2, 0).to(torch.uint8)
                else:
                    # Handle grayscale image
                    image_tensor = image.unsqueeze(0).unsqueeze(0).float()
                    kernel_tensor = kernel_tensor.unsqueeze(0).unsqueeze(0)
                    
                    filtered = torch.nn.functional.conv2d(
                        image_tensor, kernel_tensor, padding='same'
                    )
                    return filtered.squeeze(0).squeeze(0).to(torch.uint8)
            except Exception:
                return self.to_cpu(image)
        
        return image


class ImageEnhancer:
    """Advanced image enhancement algorithms with GPU acceleration"""
    
    def __init__(self, config: PreprocessingConfig):
        self.config = config
        self.gpu_manager = GPUBackendManager(config)
        
        # Initialize CLAHE
        self.clahe = cv2.createCLAHE(
            clipLimit=config.clahe_clip_limit,
            tileGridSize=config.clahe_tile_size
        )
    
    def enhance_contrast(self, image: np.ndarray) -> np.ndarray:
        """Apply contrast enhancement using CLAHE"""
        if not self.config.contrast_enhancement:
            return image
        
        if len(image.shape) == 3:
            # Convert to LAB color space for better enhancement
            lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
            
            # Apply CLAHE to L channel
            lab[:, :, 0] = self.clahe.apply(lab[:, :, 0])
            
            # Convert back to BGR
            enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
        else:
            # Grayscale image
            enhanced = self.clahe.apply(image)
        
        return enhanced
    
    def reduce_noise(self, image: np.ndarray) -> np.ndarray:
        """Apply noise reduction using bilateral filtering"""
        if not self.config.noise_reduction:
            return image
        
        # Try GPU acceleration first
        if self.gpu_manager.backend != "cpu":
            gpu_image = self.gpu_manager.to_gpu(image)
            
            if self.gpu_manager.backend == "cuda":
                # Use CuPy for CUDA acceleration
                try:
                    import cupyx.scipy.ndimage as gpu_ndimage
                    # Approximate bilateral filter with Gaussian
                    denoised = gpu_ndimage.gaussian_filter(gpu_image, sigma=1.0)
                    return self.gpu_manager.to_cpu(denoised)
                except Exception:
                    pass
            
            elif self.gpu_manager.backend == "metal":
                # Use PyTorch for Metal acceleration
                try:
                    if hasattr(gpu_image, 'cpu'):
                        # Simple Gaussian smoothing on Metal
                        if len(gpu_image.shape) == 3:
                            smoothed = torch.nn.functional.avg_pool2d(
                                gpu_image.permute(2, 0, 1).unsqueeze(0).float(),
                                kernel_size=3, stride=1, padding=1
                            )
                            denoised = smoothed.squeeze(0).permute(1, 2, 0).to(torch.uint8)
                        else:
                            smoothed = torch.nn.functional.avg_pool2d(
                                gpu_image.unsqueeze(0).unsqueeze(0).float(),
                                kernel_size=3, stride=1, padding=1
                            )
                            denoised = smoothed.squeeze(0).squeeze(0).to(torch.uint8)
                        
                        return self.gpu_manager.to_cpu(denoised)
                except Exception:
                    pass
        
        # Fallback to CPU bilateral filter
        denoised = cv2.bilateralFilter(
            image,
            self.config.bilateral_d,
            self.config.bilateral_sigma_color,
            self.config.bilateral_sigma_space
        )
        
        return denoised
    
    def apply_sharpening(self, image: np.ndarray) -> np.ndarray:
        """Apply unsharp masking for image sharpening with GPU acceleration"""
        if not self.config.sharpening:
            return image
        
        # Sharpening kernel
        kernel = np.array([[-1, -1, -1],
                          [-1,  9, -1],
                          [-1, -1, -1]], dtype=np.float32)
        
        # Try GPU acceleration
        if self.gpu_manager.backend != "cpu":
            gpu_image = self.gpu_manager.to_gpu(image.astype(np.float32))
            sharpened_gpu = self.gpu_manager.gpu_filter(gpu_image, kernel)
            
            if sharpened_gpu is not gpu_image:  # GPU processing succeeded
                sharpened = self.gpu_manager.to_cpu(sharpened_gpu)
                
                # Blend with original
                blended = cv2.addWeighted(
                    image, 1.0 - self.config.sharpen_strength,
                    np.clip(sharpened, 0, 255).astype(np.uint8), self.config.sharpen_strength,
                    0
                )
                return blended
        
        # Fallback to CPU processing
        sharpened = cv2.filter2D(image, -1, kernel)
        blended = cv2.addWeighted(image, 1.0 - self.config.sharpen_strength,
                                sharpened, self.config.sharpen_strength, 0)
        
        return blended
    
    def apply_gamma_correction(self, image: np.ndarray) -> np.ndarray:
        """Apply gamma correction for brightness adjustment"""
        if not self.config.gamma_correction:
            return image
        
        # Build lookup table for gamma correction
        inv_gamma = 1.0 / self.config.gamma_value
        table = np.array([((i / 255.0) ** inv_gamma) * 255 
                         for i in np.arange(0, 256)]).astype("uint8")
        
        # Try GPU acceleration for large images
        if (self.gpu_manager.backend != "cpu" and 
            image.shape[0] * image.shape[1] > 1000000):  # > 1MP
            
            gpu_image = self.gpu_manager.to_gpu(image)
            
            if self.gpu_manager.backend == "metal" and hasattr(gpu_image, 'cpu'):
                try:
                    # Apply gamma on Metal
                    normalized = gpu_image.float() / 255.0
                    gamma_corrected = torch.pow(normalized, inv_gamma)
                    result = (gamma_corrected * 255.0).to(torch.uint8)
                    return self.gpu_manager.to_cpu(result)
                except Exception:
                    pass
        
        # Fallback to CPU LUT
        corrected = cv2.LUT(image, table)
        return corrected
    
    def adjust_saturation(self, image: np.ndarray) -> np.ndarray:
        """Adjust color saturation"""
        if not self.config.saturation_boost or len(image.shape) != 3:
            return image
        
        # Convert to HSV for saturation adjustment
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV).astype(np.float32)
        
        # Boost saturation channel
        hsv[:, :, 1] = hsv[:, :, 1] * self.config.saturation_boost
        hsv[:, :, 1] = np.clip(hsv[:, :, 1], 0, 255)
        
        # Convert back to BGR
        enhanced = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
        
        return enhanced
    
    def auto_white_balance(self, image: np.ndarray) -> np.ndarray:
        """Apply automatic white balance correction"""
        if not self.config.auto_white_balance or len(image.shape) != 3:
            return image
        
        # Simple gray world algorithm
        b, g, r = cv2.split(image)
        
        # Calculate average values for each channel
        b_avg = np.mean(b)
        g_avg = np.mean(g)
        r_avg = np.mean(r)
        
        # Calculate scaling factors
        gray_avg = (b_avg + g_avg + r_avg) / 3
        
        if b_avg > 0 and g_avg > 0 and r_avg > 0:
            b_scale = gray_avg / b_avg
            g_scale = gray_avg / g_avg
            r_scale = gray_avg / r_avg
            
            # Apply scaling with limits
            b_scale = np.clip(b_scale, 0.5, 2.0)
            g_scale = np.clip(g_scale, 0.5, 2.0)
            r_scale = np.clip(r_scale, 0.5, 2.0)
            
            # Scale channels
            b = np.clip(b.astype(np.float32) * b_scale, 0, 255).astype(np.uint8)
            g = np.clip(g.astype(np.float32) * g_scale, 0, 255).astype(np.uint8)
            r = np.clip(r.astype(np.float32) * r_scale, 0, 255).astype(np.uint8)
            
            # Merge channels back
            balanced = cv2.merge([b, g, r])
            return balanced
        
        return image


class MotionAnalyzer:
    """Analyzes and compensates for motion blur"""
    
    def __init__(self):
        self.previous_frame = None
        self.motion_threshold = 50.0
    
    def detect_motion_blur(self, image: np.ndarray) -> Tuple[bool, float]:
        """
        Detect motion blur in image
        
        Returns:
            (is_blurred, blur_metric)
        """
        # Convert to grayscale
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        # Calculate Laplacian variance (measure of sharpness)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        
        # Lower variance indicates more blur
        is_blurred = laplacian_var < self.motion_threshold
        
        return is_blurred, laplacian_var
    
    def estimate_motion_vector(self, current_frame: np.ndarray) -> Optional[Tuple[float, float]]:
        """Estimate motion vector between frames"""
        if self.previous_frame is None:
            self.previous_frame = current_frame.copy()
            return None
        
        # Convert to grayscale
        if len(current_frame.shape) == 3:
            current_gray = cv2.cvtColor(current_frame, cv2.COLOR_BGR2GRAY)
            prev_gray = cv2.cvtColor(self.previous_frame, cv2.COLOR_BGR2GRAY)
        else:
            current_gray = current_frame
            prev_gray = self.previous_frame
        
        # Calculate optical flow
        try:
            # Use sparse optical flow for speed
            p0 = cv2.goodFeaturesToTrack(prev_gray, maxCorners=100, 
                                        qualityLevel=0.3, minDistance=7, 
                                        blockSize=7)
            
            if p0 is not None:
                p1, st, err = cv2.calcOpticalFlowPyrLK(
                    prev_gray, current_gray, p0, None,
                    winSize=(15, 15), maxLevel=2
                )
                
                # Calculate average motion vector
                good_old = p0[st == 1]
                good_new = p1[st == 1]
                
                if len(good_old) > 0:
                    motion_vectors = good_new - good_old
                    avg_motion = np.mean(motion_vectors, axis=0)
                    
                    self.previous_frame = current_frame.copy()
                    return tuple(avg_motion)
        
        except Exception as e:
            logging.debug(f"Motion estimation failed: {e}")
        
        self.previous_frame = current_frame.copy()
        return None


class ImageStabilizer:
    """Image stabilization for consistent processing"""
    
    def __init__(self, buffer_size: int = 5):
        self.buffer_size = buffer_size
        self.frame_buffer = []
        self.reference_frame = None
    
    def add_frame(self, frame: np.ndarray) -> np.ndarray:
        """Add frame to stabilization buffer and return stabilized frame"""
        self.frame_buffer.append(frame.copy())
        
        # Maintain buffer size
        if len(self.frame_buffer) > self.buffer_size:
            self.frame_buffer.pop(0)
        
        # Set reference frame
        if self.reference_frame is None:
            self.reference_frame = frame.copy()
            return frame
        
        # Stabilize current frame
        stabilized = self._stabilize_frame(frame)
        
        # Update reference occasionally
        if len(self.frame_buffer) % 10 == 0:
            self._update_reference()
        
        return stabilized
    
    def _stabilize_frame(self, frame: np.ndarray) -> np.ndarray:
        """Stabilize frame against reference"""
        try:
            # Convert to grayscale for feature detection
            if len(frame.shape) == 3:
                frame_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                ref_gray = cv2.cvtColor(self.reference_frame, cv2.COLOR_BGR2GRAY)
            else:
                frame_gray = frame
                ref_gray = self.reference_frame
            
            # Detect features
            detector = cv2.ORB_create()
            kp1, des1 = detector.detectAndCompute(ref_gray, None)
            kp2, des2 = detector.detectAndCompute(frame_gray, None)
            
            if des1 is not None and des2 is not None:
                # Match features
                matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
                matches = matcher.match(des1, des2)
                
                if len(matches) > 10:
                    # Extract matched points
                    src_pts = np.float32([kp1[m.queryIdx].pt for m in matches]).reshape(-1, 1, 2)
                    dst_pts = np.float32([kp2[m.trainIdx].pt for m in matches]).reshape(-1, 1, 2)
                    
                    # Find homography
                    homography, mask = cv2.findHomography(dst_pts, src_pts, cv2.RANSAC, 5.0)
                    
                    if homography is not None:
                        # Apply transformation
                        height, width = frame.shape[:2]
                        stabilized = cv2.warpPerspective(frame, homography, (width, height))
                        return stabilized
        
        except Exception as e:
            logging.debug(f"Frame stabilization failed: {e}")
        
        return frame
    
    def _update_reference(self):
        """Update reference frame using median of buffer"""
        if len(self.frame_buffer) >= 3:
            # Use median frame as new reference
            stacked = np.stack(self.frame_buffer, axis=0)
            self.reference_frame = np.median(stacked, axis=0).astype(np.uint8)


class ImagePreprocessor:
    """
    Main image preprocessing pipeline with adaptive GPU acceleration
    supporting both CUDA (NVIDIA) and Metal (Apple Silicon) architectures.
    """
    
    def __init__(self, config: Optional[PreprocessingConfig] = None):
        """
        Initialize image preprocessor
        
        Args:
            config: Preprocessing configuration
        """
        self.config = config or PreprocessingConfig()
        self.enhancer = ImageEnhancer(self.config)
        self.motion_analyzer = MotionAnalyzer()
        self.stabilizer = ImageStabilizer()
        
        # Performance tracking
        self.processing_stats = {
            "total_processed": 0,
            "gpu_processed": 0,
            "cpu_processed": 0,
            "average_processing_time": 0.0,
            "gpu_backend": self.enhancer.gpu_manager.backend
        }
        
        # Mode-specific configurations
        self._configure_for_mode()
    
    def _configure_for_mode(self):
        """Configure preprocessing based on mode"""
        if self.config.mode == PreprocessingMode.FAST:
            self.config.contrast_enhancement = True
            self.config.noise_reduction = False
            self.config.sharpening = False
            self.config.motion_blur_detection = False
            
        elif self.config.mode == PreprocessingMode.CARD_DETECTION:
            self.config.contrast_enhancement = True
            self.config.sharpening = True
            self.config.noise_reduction = True
            self.config.gamma_correction = True
            
        elif self.config.mode == PreprocessingMode.OCR_OPTIMIZED:
            self.config.contrast_enhancement = True
            self.config.sharpening = True
            self.config.noise_reduction = True
            self.config.gamma_value = 1.1  # Less aggressive gamma
            
        elif self.config.mode == PreprocessingMode.QUALITY:
            # Enable all enhancements
            self.config.contrast_enhancement = True
            self.config.noise_reduction = True
            self.config.sharpening = True
            self.config.gamma_correction = True
            self.config.auto_white_balance = True
            self.config.motion_blur_detection = True
    
    def preprocess(self, image: np.ndarray, region_type: str = "general") -> np.ndarray:
        """
        Apply full preprocessing pipeline to image
        
        Args:
            image: Input image
            region_type: Type of region being processed ("general", "cards", "text")
            
        Returns:
            Preprocessed image
        """
        start_time = time.time()
        
        if image is None or image.size == 0:
            raise ValueError("Invalid input image")
        
        # Track GPU usage
        used_gpu = self.enhancer.gpu_manager.backend != "cpu"
        
        try:
            # Step 1: Resize if needed
            processed = self._resize_image(image)
            
            # Step 2: Motion analysis and stabilization
            if self.config.motion_blur_detection:
                is_blurred, blur_metric = self.motion_analyzer.detect_motion_blur(processed)
                
                if is_blurred:
                    logging.debug(f"Motion blur detected: {blur_metric:.2f}")
                    processed = self.stabilizer.add_frame(processed)
            
            # Step 3: Auto white balance
            processed = self.enhancer.auto_white_balance(processed)
            
            # Step 4: Contrast enhancement
            processed = self.enhancer.enhance_contrast(processed)
            
            # Step 5: Noise reduction
            processed = self.enhancer.reduce_noise(processed)
            
            # Step 6: Gamma correction
            processed = self.enhancer.apply_gamma_correction(processed)
            
            # Step 7: Saturation adjustment
            processed = self.enhancer.adjust_saturation(processed)
            
            # Step 8: Sharpening (last to preserve details)
            processed = self.enhancer.apply_sharpening(processed)
            
            # Step 9: Region-specific optimizations
            processed = self._apply_region_optimizations(processed, region_type)
            
            # Update statistics
            processing_time = time.time() - start_time
            self._update_stats(processing_time, used_gpu)
            
            return processed
            
        except Exception as e:
            logging.error(f"Preprocessing failed: {e}")
            processing_time = time.time() - start_time
            self._update_stats(processing_time, False)
            return image  # Return original on failure
    
    def _resize_image(self, image: np.ndarray) -> np.ndarray:
        """Resize image to target resolution"""
        height, width = image.shape[:2]
        target_width, target_height = self.config.target_resolution
        
        if width == target_width and height == target_height:
            return image
        
        if self.config.preserve_aspect_ratio:
            # Calculate scaling factor to fit within target while preserving aspect ratio
            scale_w = target_width / width
            scale_h = target_height / height
            scale = min(scale_w, scale_h)
            
            new_width = int(width * scale)
            new_height = int(height * scale)
        else:
            new_width, new_height = target_width, target_height
        
        # Try GPU resize
        if self.enhancer.gpu_manager.backend != "cpu":
            gpu_image = self.enhancer.gpu_manager.to_gpu(image)
            resized_gpu = self.enhancer.gpu_manager.gpu_resize(gpu_image, (new_width, new_height))
            
            if resized_gpu is not gpu_image:  # GPU processing succeeded
                return self.enhancer.gpu_manager.to_cpu(resized_gpu)
        
        # Fallback to CPU resize
        return cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)
    
    def _apply_region_optimizations(self, image: np.ndarray, region_type: str) -> np.ndarray:
        """Apply region-specific optimizations"""
        if region_type == "cards":
            # Enhance for card detection
            if len(image.shape) == 3:
                # Slightly boost saturation for better suit recognition
                hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
                hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 1.15, 0, 255)
                image = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
            
        elif region_type == "text":
            # Optimize for OCR
            if len(image.shape) == 3:
                # Convert to grayscale for better OCR
                image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Apply additional contrast enhancement
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(4, 4))
            image = clahe.apply(image)
        
        return image
    
    def preprocess_for_card_detection(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image optimized for card detection"""
        old_mode = self.config.mode
        self.config.mode = PreprocessingMode.CARD_DETECTION
        self._configure_for_mode()
        
        result = self.preprocess(image, "cards")
        
        self.config.mode = old_mode
        self._configure_for_mode()
        
        return result
    
    def preprocess_for_ocr(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image optimized for OCR"""
        old_mode = self.config.mode
        self.config.mode = PreprocessingMode.OCR_OPTIMIZED
        self._configure_for_mode()
        
        result = self.preprocess(image, "text")
        
        self.config.mode = old_mode
        self._configure_for_mode()
        
        return result
    
    def batch_preprocess(self, images: List[np.ndarray], 
                        region_types: Optional[List[str]] = None) -> List[np.ndarray]:
        """
        Preprocess multiple images in batch
        
        Args:
            images: List of input images
            region_types: Optional list of region types for each image
            
        Returns:
            List of preprocessed images
        """
        if region_types is None:
            region_types = ["general"] * len(images)
        
        results = []
        for image, region_type in zip(images, region_types):
            processed = self.preprocess(image, region_type)
            results.append(processed)
        
        return results
    
    def _update_stats(self, processing_time: float, used_gpu: bool):
        """Update processing statistics"""
        self.processing_stats["total_processed"] += 1
        
        if used_gpu:
            self.processing_stats["gpu_processed"] += 1
        else:
            self.processing_stats["cpu_processed"] += 1
        
        # Update average processing time
        total = self.processing_stats["total_processed"]
        current_avg = self.processing_stats["average_processing_time"]
        new_avg = ((current_avg * (total - 1)) + processing_time) / total
        self.processing_stats["average_processing_time"] = new_avg
    
    def get_processing_stats(self) -> Dict[str, Any]:
        """Get preprocessing performance statistics"""
        stats = self.processing_stats.copy()
        total = stats["total_processed"]
        
        if total > 0:
            stats["gpu_usage_rate"] = stats["gpu_processed"] / total
            stats["cpu_usage_rate"] = stats["cpu_processed"] / total
        else:
            stats["gpu_usage_rate"] = 0.0
            stats["cpu_usage_rate"] = 0.0
        
        return stats
    
    def optimize_for_platform(self, platform: str):
        """Optimize preprocessing for specific poker platform"""
        if platform.lower() == "pokerstars":
            # PokerStars typically has good image quality
            self.config.noise_reduction = False
            self.config.sharpening = True
            
        elif platform.lower() == "888poker":
            # 888poker may need more noise reduction
            self.config.noise_reduction = True
            self.config.bilateral_d = 7
            
        elif platform.lower() == "partypoker":
            # PartyPoker optimization
            self.config.contrast_enhancement = True
            self.config.gamma_value = 1.15
        
        # Reconfigure for new settings
        self._configure_for_mode()


# Convenience functions
def create_preprocessor(mode: PreprocessingMode = PreprocessingMode.BALANCED,
                       enable_gpu: bool = True,
                       gpu_backend: str = "auto") -> ImagePreprocessor:
    """Create image preprocessor with specified configuration"""
    config = PreprocessingConfig(
        mode=mode,
        enable_gpu=enable_gpu,
        gpu_backend=gpu_backend
    )
    return ImagePreprocessor(config)


def quick_preprocess(image: np.ndarray, 
                    mode: PreprocessingMode = PreprocessingMode.FAST) -> np.ndarray:
    """Quick preprocessing of a single image"""
    preprocessor = create_preprocessor(mode)
    return preprocessor.preprocess(image)