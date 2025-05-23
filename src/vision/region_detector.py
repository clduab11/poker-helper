"""
Region Detection Engine

Adaptive region-of-interest detection for poker table analysis.
Automatically identifies and tracks relevant screen regions across different
poker platforms and table configurations.
"""

import cv2
import numpy as np
import time
from typing import Dict, List, Optional, Tuple, Any, Union
from dataclasses import dataclass, field
from enum import Enum
import logging
import math


class RegionType(Enum):
    """Types of detectable regions"""
    TABLE_AREA = "table_area"
    PLAYER_REGION = "player_region"
    HOLE_CARDS = "hole_cards"
    COMMUNITY_CARDS = "community_cards"
    POT_DISPLAY = "pot_display"
    CHAT_AREA = "chat_area"
    ACTION_BUTTONS = "action_buttons"
    BLINDS_INFO = "blinds_info"
    TIMER_DISPLAY = "timer_display"
    STACK_INFO = "stack_info"
    BET_AMOUNT = "bet_amount"
    DEALER_BUTTON = "dealer_button"


@dataclass
class DetectionRegion:
    """Represents a detected region of interest"""
    region_type: RegionType
    bounding_box: Tuple[int, int, int, int]  # (x, y, width, height)
    confidence: float
    center: Tuple[int, int]
    stability_score: float = 0.0  # How stable this region is over time
    last_seen: float = 0.0  # Timestamp when last detected
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def area(self) -> int:
        """Calculate region area"""
        return self.bounding_box[2] * self.bounding_box[3]
    
    def overlaps_with(self, other: 'DetectionRegion', threshold: float = 0.5) -> bool:
        """Check if this region overlaps significantly with another"""
        return self._calculate_overlap(other) > threshold
    
    def _calculate_overlap(self, other: 'DetectionRegion') -> float:
        """Calculate overlap ratio with another region"""
        x1, y1, w1, h1 = self.bounding_box
        x2, y2, w2, h2 = other.bounding_box
        
        # Calculate intersection
        left = max(x1, x2)
        top = max(y1, y2)
        right = min(x1 + w1, x2 + w2)
        bottom = min(y1 + h1, y2 + h2)
        
        if left < right and top < bottom:
            intersection = (right - left) * (bottom - top)
            union = self.area + other.area - intersection
            return intersection / union if union > 0 else 0
        
        return 0
    
    def __str__(self) -> str:
        return f"{self.region_type.value}: {self.bounding_box} (conf: {self.confidence:.3f})"


class ColorRegionDetector:
    """Detects regions based on color characteristics"""
    
    def __init__(self):
        # Define color ranges for different poker elements
        self.color_ranges = {
            'green_felt': {
                'lower': np.array([35, 40, 40]),
                'upper': np.array([85, 255, 255])
            },
            'card_white': {
                'lower': np.array([0, 0, 200]),
                'upper': np.array([180, 30, 255])
            },
            'red_suits': {
                'lower': np.array([0, 120, 70]),
                'upper': np.array([10, 255, 255])
            },
            'blue_ui': {
                'lower': np.array([100, 150, 50]),
                'upper': np.array([130, 255, 255])
            }
        }
    
    def detect_table_felt(self, image: np.ndarray) -> List[DetectionRegion]:
        """Detect green felt table areas"""
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        
        # Create mask for green felt
        mask = cv2.inRange(hsv, self.color_ranges['green_felt']['lower'], 
                          self.color_ranges['green_felt']['upper'])
        
        # Clean up mask
        kernel = np.ones((5, 5), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        
        # Find contours
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        regions = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if area > 10000:  # Minimum table area
                x, y, w, h = cv2.boundingRect(contour)
                confidence = min(1.0, area / 100000)
                
                region = DetectionRegion(
                    region_type=RegionType.TABLE_AREA,
                    bounding_box=(x, y, w, h),
                    confidence=confidence,
                    center=(x + w // 2, y + h // 2),
                    metadata={'area': area}
                )
                regions.append(region)
        
        return regions
    
    def detect_card_regions(self, image: np.ndarray) -> List[DetectionRegion]:
        """Detect white card-like regions"""
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        
        # Create mask for white/light colored cards
        mask = cv2.inRange(hsv, self.color_ranges['card_white']['lower'],
                          self.color_ranges['card_white']['upper'])
        
        # Find contours
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        regions = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if 300 < area < 5000:  # Card-sized area
                x, y, w, h = cv2.boundingRect(contour)
                aspect_ratio = w / h
                
                # Cards have specific aspect ratio
                if 0.6 <= aspect_ratio <= 0.8:
                    confidence = 0.8
                    
                    # Determine if hole cards or community cards based on position
                    height, width = image.shape[:2]
                    center_x, center_y = x + w // 2, y + h // 2
                    
                    # Community cards are typically in center
                    if (width * 0.3 < center_x < width * 0.7 and 
                        height * 0.3 < center_y < height * 0.7):
                        region_type = RegionType.COMMUNITY_CARDS
                    else:
                        region_type = RegionType.HOLE_CARDS
                    
                    region = DetectionRegion(
                        region_type=region_type,
                        bounding_box=(x, y, w, h),
                        confidence=confidence,
                        center=(center_x, center_y),
                        metadata={'aspect_ratio': aspect_ratio}
                    )
                    regions.append(region)
        
        return regions


class RegionDetector:
    """
    Main region detection engine that coordinates detection methods
    to identify regions of interest in poker table images.
    """
    
    def __init__(self):
        self.color_detector = ColorRegionDetector()
        
        # Performance tracking
        self.detection_stats = {
            "total_detections": 0,
            "regions_detected": 0,
            "average_processing_time": 0.0
        }
    
    def detect_regions(self, image: np.ndarray) -> List[DetectionRegion]:
        """
        Detect all regions of interest in image
        
        Args:
            image: Input image
            
        Returns:
            List of detected regions
        """
        start_time = time.time()
        
        all_regions = []
        
        try:
            # Color-based detection
            table_regions = self.color_detector.detect_table_felt(image)
            card_regions = self.color_detector.detect_card_regions(image)
            
            all_regions.extend(table_regions)
            all_regions.extend(card_regions)
            
            # Update statistics
            processing_time = time.time() - start_time
            self._update_stats(len(all_regions), processing_time)
            
            return all_regions
            
        except Exception as e:
            logging.error(f"Region detection failed: {e}")
            processing_time = time.time() - start_time
            self._update_stats(0, processing_time)
            return []
    
    def _update_stats(self, detected_count: int, processing_time: float):
        """Update detection statistics"""
        self.detection_stats["total_detections"] += 1
        self.detection_stats["regions_detected"] += detected_count
        
        # Update average processing time
        total = self.detection_stats["total_detections"]
        current_avg = self.detection_stats["average_processing_time"]
        new_avg = ((current_avg * (total - 1)) + processing_time) / total
        self.detection_stats["average_processing_time"] = new_avg
    
    def get_detection_stats(self) -> Dict[str, Any]:
        """Get detection performance statistics"""
        return self.detection_stats.copy()