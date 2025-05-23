"""
Computer Vision Pipeline

Orchestrates the computer vision components for real-time poker table analysis.
Integrates card detection, OCR, table parsing, and platform-specific adapters.
"""

import time
import logging
import numpy as np
from typing import Optional, Dict, List, Any, Tuple
from dataclasses import dataclass, field
from abc import ABC, abstractmethod
from enum import Enum

try:
    import cv2
    from PIL import Image
except ImportError:
    raise ImportError("OpenCV and PIL required. Run: pip install opencv-python pillow")


class ProcessingStage(Enum):
    """Computer vision processing stages"""
    RAW_CAPTURE = "raw_capture"
    PREPROCESSING = "preprocessing"
    CARD_DETECTION = "card_detection"
    OCR_EXTRACTION = "ocr_extraction"
    TABLE_PARSING = "table_parsing"
    GAME_STATE_EXTRACTION = "game_state_extraction"


@dataclass
class Card:
    """Represents a playing card detected in the image"""
    rank: str  # A, K, Q, J, T, 9, 8, 7, 6, 5, 4, 3, 2
    suit: str  # h, d, c, s (hearts, diamonds, clubs, spades)
    confidence: float  # Detection confidence (0.0-1.0)
    position: Tuple[int, int]  # (x, y) center position
    bounding_box: Tuple[int, int, int, int]  # (x, y, width, height)
    
    @property
    def card_string(self) -> str:
        """Get card as string representation (e.g., 'Ah', 'Kd')"""
        return f"{self.rank}{self.suit}"
    
    def __str__(self) -> str:
        return f"{self.card_string} ({self.confidence:.3f})"


@dataclass
class TableLayout:
    """Represents the poker table layout and UI elements"""
    player_positions: List[Tuple[int, int]] = field(default_factory=list)
    community_card_area: Optional[Tuple[int, int, int, int]] = None  # (x, y, w, h)
    pot_area: Optional[Tuple[int, int, int, int]] = None
    action_buttons: Dict[str, Tuple[int, int, int, int]] = field(default_factory=dict)
    chat_area: Optional[Tuple[int, int, int, int]] = None
    table_center: Tuple[int, int] = (0, 0)


@dataclass
class GameInfo:
    """Extracted game information from OCR and image analysis"""
    pot_size: Optional[float] = None
    player_names: List[str] = field(default_factory=list)
    player_stacks: List[Optional[float]] = field(default_factory=list)
    blinds: Tuple[Optional[float], Optional[float]] = (None, None)  # (small, big)
    betting_round: Optional[str] = None  # preflop, flop, turn, river
    current_bet: Optional[float] = None
    time_remaining: Optional[int] = None


@dataclass
class GameState:
    """Complete game state extracted from visual analysis"""
    timestamp: float
    platform: str
    hole_cards: List[Card] = field(default_factory=list)
    community_cards: List[Card] = field(default_factory=list)
    game_info: GameInfo = field(default_factory=GameInfo)
    table_layout: TableLayout = field(default_factory=TableLayout)
    confidence_score: float = 0.0
    processing_time_ms: float = 0.0
    
    @property
    def is_valid(self) -> bool:
        """Check if game state contains minimum required information"""
        return (
            len(self.hole_cards) >= 2 and
            self.game_info.pot_size is not None and
            self.confidence_score > 0.5
        )


class ImagePreprocessor:
    """Handles image preprocessing for optimal computer vision performance"""
    
    def __init__(self):
        self.target_width = 1920  # Standard processing resolution
        self.target_height = 1080
    
    def preprocess(self, image: np.ndarray) -> np.ndarray:
        """
        Apply preprocessing pipeline to captured image
        
        Args:
            image: Raw captured image as numpy array
            
        Returns:
            Preprocessed image optimized for CV operations
        """
        if image is None:
            raise ValueError("Input image is None")
        
        # Convert to standard format if needed
        if len(image.shape) == 3 and image.shape[2] == 4:  # RGBA
            image = cv2.cvtColor(image, cv2.COLOR_RGBA2RGB)
        elif len(image.shape) == 3 and image.shape[2] == 3:  # Already RGB
            pass
        else:
            raise ValueError(f"Unsupported image format: {image.shape}")
        
        # Resize to target resolution for consistent processing
        if image.shape[:2] != (self.target_height, self.target_width):
            image = cv2.resize(image, (self.target_width, self.target_height))
        
        # Enhance image quality
        image = self._enhance_image(image)
        
        return image
    
    def _enhance_image(self, image: np.ndarray) -> np.ndarray:
        """Apply image enhancement techniques"""
        # Convert to LAB color space for better enhancement
        lab = cv2.cvtColor(image, cv2.COLOR_RGB2LAB)
        
        # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) to L channel
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        lab[:, :, 0] = clahe.apply(lab[:, :, 0])
        
        # Convert back to RGB
        enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)
        
        # Apply slight sharpening
        kernel = np.array([[-1, -1, -1],
                          [-1,  9, -1],
                          [-1, -1, -1]])
        sharpened = cv2.filter2D(enhanced, -1, kernel)
        
        # Blend original and sharpened (30% sharpening)
        result = cv2.addWeighted(enhanced, 0.7, sharpened, 0.3, 0)
        
        return result
    
    def extract_roi(self, image: np.ndarray, roi: Tuple[int, int, int, int]) -> np.ndarray:
        """
        Extract region of interest from image
        
        Args:
            image: Source image
            roi: (x, y, width, height) region to extract
            
        Returns:
            Extracted region as numpy array
        """
        x, y, w, h = roi
        return image[y:y+h, x:x+w]


class ComputerVisionPipeline:
    """
    Main computer vision pipeline that orchestrates all CV components.
    
    Processes captured screens through:
    1. Preprocessing and enhancement
    2. Platform detection
    3. Card detection (YOLO v8)
    4. OCR text extraction
    5. Game state synthesis
    """
    
    def __init__(self, target_accuracy: float = 0.995):
        """
        Initialize the computer vision pipeline
        
        Args:
            target_accuracy: Target card detection accuracy (default 99.5%)
        """
        self.target_accuracy = target_accuracy
        self.preprocessor = ImagePreprocessor()
        
        # Component modules (will be loaded lazily)
        self._card_detector = None
        self._ocr_engine = None
        self._table_parser = None
        self._platform_adapter = None
        
        # Performance tracking
        self.processing_stats = {
            "total_processed": 0,
            "successful_detections": 0,
            "average_processing_time": 0.0,
            "accuracy_rate": 0.0
        }
    
    def process_frame(self, image: np.ndarray, platform: str = "auto") -> GameState:
        """
        Process a captured frame to extract complete game state
        
        Args:
            image: Captured screen image
            platform: Target platform ("pokerstars", "888poker", "partypoker", "auto")
            
        Returns:
            GameState object containing all extracted information
        """
        start_time = time.time()
        
        try:
            # Stage 1: Preprocessing
            processed_image = self.preprocessor.preprocess(image)
            
            # Stage 2: Platform detection (if auto)
            if platform == "auto":
                platform = self._detect_platform(processed_image)
            
            # Stage 3: Set platform adapter
            self._set_platform_adapter(platform)
            
            # Stage 4: Extract table layout
            table_layout = self._extract_table_layout(processed_image)
            
            # Stage 5: Detect cards
            hole_cards = self._detect_hole_cards(processed_image, table_layout)
            community_cards = self._detect_community_cards(processed_image, table_layout)
            
            # Stage 6: Extract game information via OCR
            game_info = self._extract_game_info(processed_image, table_layout)
            
            # Stage 7: Calculate confidence and create game state
            confidence = self._calculate_confidence(hole_cards, community_cards, game_info)
            processing_time = (time.time() - start_time) * 1000  # Convert to ms
            
            game_state = GameState(
                timestamp=time.time(),
                platform=platform,
                hole_cards=hole_cards,
                community_cards=community_cards,
                game_info=game_info,
                table_layout=table_layout,
                confidence_score=confidence,
                processing_time_ms=processing_time
            )
            
            # Update statistics
            self._update_stats(game_state, processing_time)
            
            return game_state
            
        except Exception as e:
            # Return empty game state with error information
            processing_time = (time.time() - start_time) * 1000
            return GameState(
                timestamp=time.time(),
                platform=platform,
                confidence_score=0.0,
                processing_time_ms=processing_time
            )
    
    def detect_cards(self, image: np.ndarray) -> List[Card]:
        """
        Detect all cards in the image using YOLO v8
        
        Args:
            image: Image to analyze
            
        Returns:
            List of detected Card objects
        """
        if self._card_detector is None:
            self._load_card_detector()
        
        # This will be implemented when we create the card detection module
        # For now, return empty list
        return []
    
    def extract_text(self, image: np.ndarray) -> Dict[str, str]:
        """
        Extract text from image using OCR
        
        Args:
            image: Image to analyze
            
        Returns:
            Dictionary mapping region names to extracted text
        """
        if self._ocr_engine is None:
            self._load_ocr_engine()
        
        # This will be implemented when we create the OCR module
        # For now, return empty dict
        return {}
    
    def recognize_table_layout(self, image: np.ndarray) -> TableLayout:
        """
        Recognize and parse table layout
        
        Args:
            image: Image to analyze
            
        Returns:
            TableLayout object describing the table structure
        """
        if self._table_parser is None:
            self._load_table_parser()
        
        # This will be implemented when we create the table parser
        # For now, return empty layout
        return TableLayout()
    
    def get_game_state(self) -> Optional[GameState]:
        """Get the most recently processed game state"""
        # This will store the last processed state
        return None
    
    def set_platform_adapter(self, platform: str) -> None:
        """Set the platform-specific adapter"""
        self._set_platform_adapter(platform)
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics"""
        return self.processing_stats.copy()
    
    # Private methods
    
    def _detect_platform(self, image: np.ndarray) -> str:
        """Auto-detect the poker platform from image"""
        # This will be implemented with platform detection logic
        return "unknown"
    
    def _set_platform_adapter(self, platform: str) -> None:
        """Set the appropriate platform adapter"""
        # This will load the correct platform adapter
        pass
    
    def _extract_table_layout(self, image: np.ndarray) -> TableLayout:
        """Extract table layout using current platform adapter"""
        if self._platform_adapter:
            return self._platform_adapter.parse_table_layout(image)
        return TableLayout()
    
    def _detect_hole_cards(self, image: np.ndarray, layout: TableLayout) -> List[Card]:
        """Detect player's hole cards"""
        # This will use card detector on hole card regions
        return []
    
    def _detect_community_cards(self, image: np.ndarray, layout: TableLayout) -> List[Card]:
        """Detect community cards"""
        # This will use card detector on community card area
        return []
    
    def _extract_game_info(self, image: np.ndarray, layout: TableLayout) -> GameInfo:
        """Extract game information using OCR"""
        # This will use OCR engine on relevant regions
        return GameInfo()
    
    def _calculate_confidence(self, hole_cards: List[Card], 
                            community_cards: List[Card], 
                            game_info: GameInfo) -> float:
        """Calculate overall confidence score for the detection"""
        scores = []
        
        # Card detection confidence
        if hole_cards:
            card_conf = sum(card.confidence for card in hole_cards) / len(hole_cards)
            scores.append(card_conf)
        
        if community_cards:
            comm_conf = sum(card.confidence for card in community_cards) / len(community_cards)
            scores.append(comm_conf)
        
        # Game info confidence (based on successful extractions)
        info_conf = 0.0
        info_count = 0
        
        if game_info.pot_size is not None:
            info_conf += 1.0
            info_count += 1
        
        if game_info.betting_round is not None:
            info_conf += 1.0
            info_count += 1
        
        if info_count > 0:
            scores.append(info_conf / info_count)
        
        return sum(scores) / len(scores) if scores else 0.0
    
    def _update_stats(self, game_state: GameState, processing_time: float) -> None:
        """Update performance statistics"""
        self.processing_stats["total_processed"] += 1
        
        if game_state.is_valid:
            self.processing_stats["successful_detections"] += 1
        
        # Update average processing time
        total = self.processing_stats["total_processed"]
        current_avg = self.processing_stats["average_processing_time"]
        new_avg = ((current_avg * (total - 1)) + processing_time) / total
        self.processing_stats["average_processing_time"] = new_avg
        
        # Update accuracy rate
        success_rate = self.processing_stats["successful_detections"] / total
        self.processing_stats["accuracy_rate"] = success_rate
    
    def _load_card_detector(self) -> None:
        """Lazy load card detection module"""
        try:
            from ..vision.card_detector import get_card_detector
            self._card_detector = get_card_detector(use_gpu=True)
            logging.info("Card detector loaded successfully with GPU acceleration")
        except Exception as e:
            logging.error(f"Failed to load card detector: {e}")
    
    def _load_ocr_engine(self) -> None:
        """Lazy load OCR engine"""
        try:
            from ..vision.ocr_engine import get_ocr_engine
            self._ocr_engine = get_ocr_engine(use_gpu=True)
            logging.info("OCR engine loaded successfully with GPU acceleration")
        except Exception as e:
            logging.error(f"Failed to load OCR engine: {e}")
    
    def _load_table_parser(self) -> None:
        """Lazy load table parser"""
        try:
            from ..vision.table_parser import TableParser
            self._table_parser = TableParser()
            logging.info("Table parser loaded successfully")
        except Exception as e:
            logging.error(f"Failed to load table parser: {e}")


# Convenience functions
def create_cv_pipeline(accuracy_target: float = 0.995) -> ComputerVisionPipeline:
    """Create a new computer vision pipeline with specified accuracy target"""
    return ComputerVisionPipeline(target_accuracy=accuracy_target)


def quick_analyze(image: np.ndarray, platform: str = "auto") -> GameState:
    """
    Quick analysis of a single image
    
    Args:
        image: Image to analyze
        platform: Target platform
        
    Returns:
        GameState with extracted information
    """
    pipeline = create_cv_pipeline()
    return pipeline.process_frame(image, platform)