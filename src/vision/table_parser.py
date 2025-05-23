"""
Table Parsing Engine

Advanced table layout recognition system that identifies player positions,
community card areas, pot regions, and UI elements across different poker platforms.
"""

import cv2
import numpy as np
import time
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from enum import Enum
import logging
import math


class TableRegionType(Enum):
    """Types of table regions"""
    PLAYER_POSITION = "player_position"
    COMMUNITY_CARDS = "community_cards"
    POT_AREA = "pot_area"
    ACTION_BUTTON = "action_button"
    CHAT_AREA = "chat_area"
    DEALER_BUTTON = "dealer_button"
    BLINDS_INFO = "blinds_info"
    TIMER = "timer"
    STACK_DISPLAY = "stack_display"
    BET_AMOUNT = "bet_amount"


@dataclass
class TableRegion:
    """Represents a detected table region"""
    region_type: TableRegionType
    bounding_box: Tuple[int, int, int, int]  # (x, y, width, height)
    confidence: float
    center_point: Tuple[int, int]
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def area(self) -> int:
        """Calculate region area"""
        return self.bounding_box[2] * self.bounding_box[3]
    
    def __str__(self) -> str:
        return f"{self.region_type.value}: {self.bounding_box} ({self.confidence:.3f})"


@dataclass
class PlayerSeat:
    """Represents a player seat at the table"""
    seat_number: int
    position: Tuple[int, int]  # Center of seat
    hole_cards_region: Optional[Tuple[int, int, int, int]] = None
    name_region: Optional[Tuple[int, int, int, int]] = None
    stack_region: Optional[Tuple[int, int, int, int]] = None
    bet_region: Optional[Tuple[int, int, int, int]] = None
    action_region: Optional[Tuple[int, int, int, int]] = None
    is_hero: bool = False  # True if this is the player's seat
    confidence: float = 0.0


class GeometricTableDetector:
    """Detects table geometry and layout using contour analysis"""
    
    def __init__(self):
        self.min_table_area = 50000  # Minimum table area in pixels
        self.table_aspect_ratio_range = (0.8, 2.5)  # Width/height ratio range
        
    def detect_table_boundary(self, image: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
        """
        Detect the main table boundary
        
        Args:
            image: Input image
            
        Returns:
            Table bounding box (x, y, width, height) or None if not found
        """
        # Convert to grayscale
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        # Apply Gaussian blur to reduce noise
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Edge detection
        edges = cv2.Canny(blurred, 50, 150)
        
        # Find contours
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Filter contours by size and shape
        table_candidates = []
        
        for contour in contours:
            area = cv2.contourArea(contour)
            if area > self.min_table_area:
                # Get bounding rectangle
                x, y, w, h = cv2.boundingRect(contour)
                aspect_ratio = w / h
                
                if self.table_aspect_ratio_range[0] <= aspect_ratio <= self.table_aspect_ratio_range[1]:
                    # Check if contour approximates an ellipse or rectangle
                    hull = cv2.convexHull(contour)
                    hull_area = cv2.contourArea(hull)
                    solidity = area / hull_area if hull_area > 0 else 0
                    
                    if solidity > 0.6:  # Reasonably solid shape
                        table_candidates.append((x, y, w, h, area, solidity))
        
        if not table_candidates:
            return None
        
        # Select the largest candidate
        best_table = max(table_candidates, key=lambda x: x[4])  # Sort by area
        return best_table[:4]  # Return (x, y, w, h)
    
    def detect_elliptical_table(self, image: np.ndarray) -> Optional[Tuple[Tuple[int, int], Tuple[int, int], float]]:
        """
        Detect elliptical table shape
        
        Returns:
            ((center_x, center_y), (major_axis, minor_axis), rotation_angle) or None
        """
        # Convert to grayscale
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        # Apply adaptive threshold
        thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                     cv2.THRESH_BINARY, 11, 2)
        
        # Find contours
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Look for elliptical shapes
        for contour in contours:
            if len(contour) >= 5:  # Need at least 5 points to fit ellipse
                try:
                    ellipse = cv2.fitEllipse(contour)
                    center, axes, angle = ellipse
                    
                    # Check if ellipse is reasonable size
                    major_axis, minor_axis = axes
                    if (major_axis > 200 and minor_axis > 100 and 
                        0.3 <= minor_axis/major_axis <= 0.8):
                        return ellipse
                except:
                    continue
        
        return None


class PlayerPositionDetector:
    """Detects player positions around the table"""
    
    def __init__(self, max_players: int = 9):
        self.max_players = max_players
        self.min_seat_distance = 80  # Minimum distance between seats
        
    def detect_player_positions(self, image: np.ndarray, 
                              table_center: Tuple[int, int],
                              table_boundary: Optional[Tuple[int, int, int, int]] = None) -> List[PlayerSeat]:
        """
        Detect player seat positions around the table
        
        Args:
            image: Input image
            table_center: Center point of the table
            table_boundary: Optional table boundary for constraint
            
        Returns:
            List of detected player seats
        """
        height, width = image.shape[:2]
        center_x, center_y = table_center
        
        # Define search areas around table perimeter
        if table_boundary:
            table_x, table_y, table_w, table_h = table_boundary
            # Use table boundary to constrain search
            search_radius_x = table_w // 2 + 50
            search_radius_y = table_h // 2 + 50
        else:
            # Use image dimensions as fallback
            search_radius_x = min(width // 3, 300)
            search_radius_y = min(height // 3, 200)
        
        # Generate candidate positions in circular/elliptical pattern
        candidate_positions = self._generate_seat_candidates(
            center_x, center_y, search_radius_x, search_radius_y
        )
        
        # Analyze each candidate position for player indicators
        detected_seats = []
        
        for i, (x, y) in enumerate(candidate_positions):
            confidence = self._analyze_seat_position(image, x, y)
            
            if confidence > 0.3:  # Threshold for seat detection
                seat = PlayerSeat(
                    seat_number=i,
                    position=(x, y),
                    confidence=confidence
                )
                
                # Detect seat-specific regions
                self._detect_seat_regions(image, seat)
                
                detected_seats.append(seat)
        
        # Sort by confidence and limit to max_players
        detected_seats.sort(key=lambda s: s.confidence, reverse=True)
        return detected_seats[:self.max_players]
    
    def _generate_seat_candidates(self, center_x: int, center_y: int, 
                                radius_x: int, radius_y: int) -> List[Tuple[int, int]]:
        """Generate candidate seat positions around table perimeter"""
        positions = []
        
        # Generate positions in elliptical pattern
        for i in range(self.max_players):
            angle = (2 * math.pi * i) / self.max_players
            
            # Add some randomness to avoid perfect circle
            x = center_x + int(radius_x * math.cos(angle))
            y = center_y + int(radius_y * math.sin(angle))
            
            positions.append((x, y))
        
        return positions
    
    def _analyze_seat_position(self, image: np.ndarray, x: int, y: int) -> float:
        """
        Analyze a potential seat position for player indicators
        
        Returns:
            Confidence score (0.0 - 1.0)
        """
        height, width = image.shape[:2]
        
        # Ensure position is within image bounds
        if x < 20 or x >= width - 20 or y < 20 or y >= height - 20:
            return 0.0
        
        # Extract region around potential seat
        region_size = 80
        x1 = max(0, x - region_size // 2)
        y1 = max(0, y - region_size // 2)
        x2 = min(width, x + region_size // 2)
        y2 = min(height, y + region_size // 2)
        
        region = image[y1:y2, x1:x2]
        
        # Analyze region for player indicators
        confidence = 0.0
        
        # Check for card-like rectangles
        card_confidence = self._detect_card_shapes(region)
        confidence += card_confidence * 0.4
        
        # Check for text patterns (player names, stack sizes)
        text_confidence = self._detect_text_patterns(region)
        confidence += text_confidence * 0.3
        
        # Check for UI elements (buttons, highlights)
        ui_confidence = self._detect_ui_elements(region)
        confidence += ui_confidence * 0.3
        
        return min(1.0, confidence)
    
    def _detect_card_shapes(self, region: np.ndarray) -> float:
        """Detect card-like rectangular shapes in region"""
        if len(region.shape) == 3:
            gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
        else:
            gray = region
        
        # Edge detection
        edges = cv2.Canny(gray, 50, 150)
        
        # Find contours
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        card_like_shapes = 0
        
        for contour in contours:
            area = cv2.contourArea(contour)
            if 200 < area < 2000:  # Card-sized area
                # Check if rectangular
                approx = cv2.approxPolyDP(contour, 0.02 * cv2.arcLength(contour, True), True)
                if len(approx) == 4:  # Rectangular
                    x, y, w, h = cv2.boundingRect(contour)
                    aspect_ratio = w / h
                    if 0.6 <= aspect_ratio <= 0.8:  # Card-like aspect ratio
                        card_like_shapes += 1
        
        return min(1.0, card_like_shapes / 2.0)  # Expect up to 2 hole cards
    
    def _detect_text_patterns(self, region: np.ndarray) -> float:
        """Detect text patterns that indicate player presence"""
        if len(region.shape) == 3:
            gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
        else:
            gray = region
        
        # Apply threshold
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Find connected components that could be text
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        text_like_regions = 0
        
        for contour in contours:
            area = cv2.contourArea(contour)
            if 20 < area < 500:  # Text-sized area
                x, y, w, h = cv2.boundingRect(contour)
                aspect_ratio = w / h
                if 1.0 <= aspect_ratio <= 8.0:  # Text-like aspect ratio
                    text_like_regions += 1
        
        return min(1.0, text_like_regions / 10.0)
    
    def _detect_ui_elements(self, region: np.ndarray) -> float:
        """Detect UI elements like buttons or highlights"""
        if len(region.shape) == 3:
            # Look for colored elements (buttons often have distinct colors)
            hsv = cv2.cvtColor(region, cv2.COLOR_BGR2HSV)
            
            # Define color ranges for common UI elements
            # Green for call/check buttons
            green_lower = np.array([40, 50, 50])
            green_upper = np.array([80, 255, 255])
            green_mask = cv2.inRange(hsv, green_lower, green_upper)
            
            # Red for fold/bet buttons
            red_lower = np.array([0, 50, 50])
            red_upper = np.array([20, 255, 255])
            red_mask = cv2.inRange(hsv, red_lower, red_upper)
            
            # Blue for informational elements
            blue_lower = np.array([100, 50, 50])
            blue_upper = np.array([140, 255, 255])
            blue_mask = cv2.inRange(hsv, blue_lower, blue_upper)
            
            # Count colored pixels
            colored_pixels = cv2.countNonZero(green_mask) + cv2.countNonZero(red_mask) + cv2.countNonZero(blue_mask)
            total_pixels = region.shape[0] * region.shape[1]
            
            return min(1.0, colored_pixels / (total_pixels * 0.1))
        
        return 0.0
    
    def _detect_seat_regions(self, image: np.ndarray, seat: PlayerSeat) -> None:
        """Detect specific regions for a player seat"""
        x, y = seat.position
        
        # Define region sizes
        card_region_size = (60, 40)  # Width, height for hole cards
        name_region_size = (100, 20)
        stack_region_size = (80, 20)
        bet_region_size = (60, 20)
        action_region_size = (80, 30)
        
        # Calculate regions relative to seat position
        # Hole cards typically below seat center
        seat.hole_cards_region = (
            x - card_region_size[0] // 2,
            y + 20,
            card_region_size[0],
            card_region_size[1]
        )
        
        # Player name typically above seat
        seat.name_region = (
            x - name_region_size[0] // 2,
            y - 40,
            name_region_size[0],
            name_region_size[1]
        )
        
        # Stack info near name
        seat.stack_region = (
            x - stack_region_size[0] // 2,
            y - 20,
            stack_region_size[0],
            stack_region_size[1]
        )
        
        # Bet amount near seat
        seat.bet_region = (
            x - bet_region_size[0] // 2,
            y + 60,
            bet_region_size[0],
            bet_region_size[1]
        )
        
        # Action buttons area
        seat.action_region = (
            x - action_region_size[0] // 2,
            y + 80,
            action_region_size[0],
            action_region_size[1]
        )


class UIElementDetector:
    """Detects specific UI elements like pot area, community cards, etc."""
    
    def __init__(self):
        self.template_matching_threshold = 0.7
        
    def detect_community_card_area(self, image: np.ndarray, 
                                 table_center: Tuple[int, int]) -> Optional[Tuple[int, int, int, int]]:
        """
        Detect the community card area (board)
        
        Args:
            image: Input image
            table_center: Center of the table
            
        Returns:
            Community card area (x, y, width, height) or None
        """
        center_x, center_y = table_center
        
        # Community cards are typically in the center of the table
        # Search area around table center
        search_width = 300
        search_height = 100
        
        search_x = center_x - search_width // 2
        search_y = center_y - search_height // 2
        
        # Ensure search area is within image bounds
        height, width = image.shape[:2]
        search_x = max(0, search_x)
        search_y = max(0, search_y)
        search_width = min(search_width, width - search_x)
        search_height = min(search_height, height - search_y)
        
        # Extract search region
        search_region = image[search_y:search_y + search_height, 
                            search_x:search_x + search_width]
        
        # Look for card-like rectangles in horizontal arrangement
        card_positions = self._detect_horizontal_cards(search_region)
        
        if len(card_positions) >= 3:  # At least flop cards
            # Calculate bounding box for all cards
            min_x = min(pos[0] for pos in card_positions)
            max_x = max(pos[0] + pos[2] for pos in card_positions)
            min_y = min(pos[1] for pos in card_positions)
            max_y = max(pos[1] + pos[3] for pos in card_positions)
            
            # Adjust coordinates to full image
            return (
                search_x + min_x,
                search_y + min_y,
                max_x - min_x,
                max_y - min_y
            )
        
        return None
    
    def detect_pot_area(self, image: np.ndarray, 
                       table_center: Tuple[int, int]) -> Optional[Tuple[int, int, int, int]]:
        """
        Detect the pot display area
        
        Args:
            image: Input image
            table_center: Center of the table
            
        Returns:
            Pot area (x, y, width, height) or None
        """
        center_x, center_y = table_center
        
        # Pot is typically displayed above or below community cards
        search_areas = [
            (center_x - 100, center_y - 80, 200, 30),  # Above center
            (center_x - 100, center_y + 50, 200, 30),  # Below center
        ]
        
        height, width = image.shape[:2]
        
        for search_x, search_y, search_w, search_h in search_areas:
            # Ensure within bounds
            search_x = max(0, search_x)
            search_y = max(0, search_y)
            search_w = min(search_w, width - search_x)
            search_h = min(search_h, height - search_y)
            
            if search_w > 0 and search_h > 0:
                search_region = image[search_y:search_y + search_h,
                                    search_x:search_x + search_w]
                
                # Look for text patterns that indicate pot amount
                confidence = self._analyze_pot_region(search_region)
                
                if confidence > 0.5:
                    return (search_x, search_y, search_w, search_h)
        
        return None
    
    def detect_action_buttons(self, image: np.ndarray) -> List[TableRegion]:
        """
        Detect action buttons (Fold, Call, Raise, etc.)
        
        Args:
            image: Input image
            
        Returns:
            List of detected button regions
        """
        # Action buttons are typically at the bottom of the screen
        height, width = image.shape[:2]
        
        # Search in bottom portion of image
        search_y = int(height * 0.7)
        search_region = image[search_y:, :]
        
        button_regions = []
        
        # Look for rectangular UI elements with text
        if len(search_region.shape) == 3:
            gray = cv2.cvtColor(search_region, cv2.COLOR_BGR2GRAY)
        else:
            gray = search_region
        
        # Apply threshold to highlight buttons
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Find contours
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for contour in contours:
            area = cv2.contourArea(contour)
            if 1000 < area < 10000:  # Button-sized area
                x, y, w, h = cv2.boundingRect(contour)
                aspect_ratio = w / h
                
                if 1.5 <= aspect_ratio <= 4.0:  # Button-like aspect ratio
                    # Adjust coordinates to full image
                    full_y = search_y + y
                    center_point = (x + w // 2, full_y + h // 2)
                    
                    region = TableRegion(
                        region_type=TableRegionType.ACTION_BUTTON,
                        bounding_box=(x, full_y, w, h),
                        confidence=0.7,  # Fixed confidence for now
                        center_point=center_point,
                        metadata={"button_type": "unknown"}
                    )
                    button_regions.append(region)
        
        return button_regions
    
    def _detect_horizontal_cards(self, region: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """Detect horizontally arranged cards in a region"""
        if len(region.shape) == 3:
            gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
        else:
            gray = region
        
        # Edge detection
        edges = cv2.Canny(gray, 50, 150)
        
        # Find contours
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        card_candidates = []
        
        for contour in contours:
            area = cv2.contourArea(contour)
            if 500 < area < 3000:  # Card-sized area
                x, y, w, h = cv2.boundingRect(contour)
                aspect_ratio = w / h
                
                if 0.6 <= aspect_ratio <= 0.8:  # Card aspect ratio
                    card_candidates.append((x, y, w, h))
        
        # Sort by x position (left to right)
        card_candidates.sort(key=lambda c: c[0])
        
        # Filter for cards that are roughly aligned horizontally
        aligned_cards = []
        if card_candidates:
            reference_y = card_candidates[0][1]
            
            for card in card_candidates:
                if abs(card[1] - reference_y) < 20:  # Vertically aligned threshold
                    aligned_cards.append(card)
        
        return aligned_cards
    
    def _analyze_pot_region(self, region: np.ndarray) -> float:
        """Analyze region for pot amount indicators"""
        # Simple analysis - look for currency symbols and numbers
        if len(region.shape) == 3:
            gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
        else:
            gray = region
        
        # Apply threshold
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Count white pixels (text)
        white_pixels = cv2.countNonZero(thresh)
        total_pixels = region.shape[0] * region.shape[1]
        
        # Simple heuristic: pot regions should have moderate text density
        text_density = white_pixels / total_pixels
        
        if 0.1 <= text_density <= 0.4:
            return 0.7
        else:
            return 0.2


class TableParser:
    """
    Main table parsing engine that coordinates all detection components
    to create a comprehensive table layout analysis.
    """
    
    def __init__(self, max_players: int = 9):
        """
        Initialize table parser
        
        Args:
            max_players: Maximum number of players to detect
        """
        self.max_players = max_players
        
        # Initialize detection components
        self.geometric_detector = GeometricTableDetector()
        self.position_detector = PlayerPositionDetector(max_players)
        self.ui_detector = UIElementDetector()
        
        # Performance tracking
        self.parsing_stats = {
            "total_parses": 0,
            "successful_parses": 0,
            "average_processing_time": 0.0,
            "average_confidence": 0.0
        }
    
    def parse_table_layout(self, image: np.ndarray, 
                          platform_hint: Optional[str] = None) -> Dict[str, Any]:
        """
        Parse complete table layout from image
        
        Args:
            image: Input poker table image
            platform_hint: Optional platform hint for optimization
            
        Returns:
            Dictionary containing all detected table elements
        """
        start_time = time.time()
        
        layout = {
            "table_boundary": None,
            "table_center": None,
            "player_seats": [],
            "community_card_area": None,
            "pot_area": None,
            "action_buttons": [],
            "confidence": 0.0,
            "processing_time_ms": 0.0
        }
        
        try:
            # Step 1: Detect table boundary and center
            table_boundary = self.geometric_detector.detect_table_boundary(image)
            
            if table_boundary:
                x, y, w, h = table_boundary
                table_center = (x + w // 2, y + h // 2)
            else:
                # Fallback to image center
                height, width = image.shape[:2]
                table_center = (width // 2, height // 2)
            
            layout["table_boundary"] = table_boundary
            layout["table_center"] = table_center
            
            # Step 2: Detect player positions
            player_seats = self.position_detector.detect_player_positions(
                image, table_center, table_boundary
            )
            layout["player_seats"] = player_seats
            
            # Step 3: Detect community card area
            community_area = self.ui_detector.detect_community_card_area(
                image, table_center
            )
            layout["community_card_area"] = community_area
            
            # Step 4: Detect pot area
            pot_area = self.ui_detector.detect_pot_area(image, table_center)
            layout["pot_area"] = pot_area
            
            # Step 5: Detect action buttons
            action_buttons = self.ui_detector.detect_action_buttons(image)
            layout["action_buttons"] = action_buttons
            
            # Step 6: Calculate overall confidence
            confidence = self._calculate_layout_confidence(layout)
            layout["confidence"] = confidence
            
            # Update statistics
            processing_time = (time.time() - start_time) * 1000
            layout["processing_time_ms"] = processing_time
            self._update_stats(layout, processing_time)
            
        except Exception as e:
            logging.error(f"Table parsing failed: {e}")
            layout["confidence"] = 0.0
            layout["processing_time_ms"] = (time.time() - start_time) * 1000
        
        return layout
    
    def detect_hero_position(self, image: np.ndarray, 
                           layout: Dict[str, Any]) -> Optional[int]:
        """
        Detect which seat belongs to the hero (main player)
        
        Args:
            image: Input image
            layout: Previously parsed layout
            
        Returns:
            Seat number of hero or None if not found
        """
        player_seats = layout.get("player_seats", [])
        
        if not player_seats:
            return None
        
        # Hero is typically indicated by:
        # 1. Action buttons being visible/active
        # 2. Cards being face-up (visible ranks/suits)
        # 3. Different UI styling
        
        hero_scores = []
        
        for seat in player_seats:
            score = 0.0
            
            # Check for action buttons near this seat
            action_buttons = layout.get("action_buttons", [])
            for button in action_buttons:
                button_center = button.center_point
                seat_pos = seat.position
                
                # If action button is close to seat, likely hero
                distance = math.sqrt((button_center[0] - seat_pos[0])**2 + 
                                   (button_center[1] - seat_pos[1])**2)
                if distance < 200:  # Threshold for "close"
                    score += 0.5
            
            # Check if hole cards region has face-up cards
            if seat.hole_cards_region:
                card_confidence = self._analyze_hole_cards_visibility(
                    image, seat.hole_cards_region
                )
                score += card_confidence * 0.5
            
            hero_scores.append((seat.seat_number, score))
        
        # Return seat with highest hero score
        if hero_scores:
            best_seat = max(hero_scores, key=lambda x: x[1])
            if best_seat[1] > 0.3:  # Minimum confidence threshold
                return best_seat[0]
        
        return None
    
    def _calculate_layout_confidence(self, layout: Dict[str, Any]) -> float:
        """Calculate overall confidence for the parsed layout"""
        scores = []
        
        # Table detection confidence
        if layout["table_boundary"]:
            scores.append(0.8)
        else:
            scores.append(0.3)
        
        # Player detection confidence
        player_seats = layout.get("player_seats", [])
        if player_seats:
            avg_seat_confidence = sum(seat.confidence for seat in player_seats) / len(player_seats)
            scores.append(avg_seat_confidence)
        else:
            scores.append(0.0)
        
        # UI element detection confidence
        if layout["community_card_area"]:
            scores.append(0.7)
        
        if layout["pot_area"]:
            scores.append(0.6)
        
        if layout["action_buttons"]:
            avg_button_confidence = sum(btn.confidence for btn in layout["action_buttons"]) / len(layout["action_buttons"])
            scores.append(avg_button_confidence)
        
        return sum(scores) / len(scores) if scores else 0.0
    
    def _analyze_hole_cards_visibility(self, image: np.ndarray, 
                                     cards_roi: Tuple[int, int, int, int]) -> float:
        """Analyze if hole cards are visible (face-up) vs face-down"""
        x, y, w, h = cards_roi
        
        # Ensure ROI is within image bounds
        height, width = image.shape[:2]
        x = max(0, min(x, width - 1))
        y = max(0, min(y, height - 1))
        w = min(w, width - x)
        h = min(h, height - y)
        
        if w <= 0 or h <= 0:
            return 0.0
        
        card_region = image[y:y+h, x:x+w]
        
        # Face-up cards typically have more visual complexity
        # (ranks, suits, colors) vs face-down cards (uniform back pattern)
        
        if len(card_region.shape) == 3:
            # Color analysis - face-up cards have red/black contrast
            hsv = cv2.cvtColor(card_region, cv2.COLOR_BGR2HSV)
            
            # Look for red elements (hearts, diamonds)
            red_lower = np.array([0, 50, 50])
            red_upper = np.array([20, 255, 255])
            red_mask = cv2.inRange(hsv, red_lower, red_upper)
            red_pixels = cv2.countNonZero(red_mask)
            
            # Look for black elements (text, clubs, spades)
            gray = cv2.cvtColor(card_region, cv2.COLOR_BGR2GRAY)
            _, thresh = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY)
            black_pixels = cv2.countNonZero(255 - thresh)
            
            total_pixels = card_region.shape[0] * card_region.shape[1]
            
            # Face-up cards should have reasonable amount of red and black
            red_ratio = red_pixels / total_pixels
            black_ratio = black_pixels / total_pixels
            
            if red_ratio > 0.05 and black_ratio > 0.1:
                return 0.8  # High confidence face-up
            elif black_ratio > 0.2:
                return 0.5  # Medium confidence (black suits only)
            else:
                return 0.2  # Low confidence (probably face-down)
        
        return 0.3  # Default medium confidence
    
    def _update_stats(self, layout: Dict[str, Any], processing_time: float):
        """Update parsing statistics"""
        self.parsing_stats["total_parses"] += 1
        
        if layout["confidence"] > 0.5:
            self.parsing_stats["successful_parses"] += 1
        
        # Update running averages
        total = self.parsing_stats["total_parses"]
        
        # Update average confidence
        current_avg_conf = self.parsing_stats["average_confidence"]
        new_avg_conf = ((current_avg_conf * (total - 1)) + layout["confidence"]) / total
        self.parsing_stats["average_confidence"] = new_avg_conf
        
        # Update average processing time
        current_avg_time = self.parsing_stats["average_processing_time"]
        new_avg_time = ((current_avg_time * (total - 1)) + processing_time) / total
        self.parsing_stats["average_processing_time"] = new_avg_time
    
    def get_parsing_stats(self) -> Dict[str, Any]:
        """Get table parsing performance statistics"""
        stats = self.parsing_stats.copy()
        if stats["total_parses"] > 0:
            stats["success_rate"] = stats["successful_parses"] / stats["total_parses"]
        else:
            stats["success_rate"] = 0.0
        return stats
    
    def optimize_for_platform(self, platform: str):
        """Optimize parsing parameters for specific platform"""
        if platform.lower() == "pokerstars":
            # PokerStars-specific optimizations
            self.position_detector.max_players = 9
            self.geometric_detector.table_aspect_ratio_range = (1.2, 2.0)
        elif platform.lower() == "888poker":
            # 888poker-specific optimizations
            self.position_detector.max_players = 8
            self.geometric_detector.table_aspect_ratio_range = (1.0, 1.8)
        elif platform.lower() == "partypoker":
            # PartyPoker-specific optimizations
            self.position_detector.max_players = 6
            self.geometric_detector.table_aspect_ratio_range = (1.1, 1.9)
        # Add more platform-specific optimizations as needed