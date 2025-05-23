"""
OCR Text Extraction Engine

Advanced OCR system for extracting poker-specific text including pot sizes,
player names, stack sizes, and betting information with error correction.
"""

import cv2
import numpy as np
import re
import time
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from pathlib import Path
import logging

try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    logging.warning("Tesseract not available. Install with: pip install pytesseract")

try:
    import easyocr
    EASYOCR_AVAILABLE = True
except ImportError:
    EASYOCR_AVAILABLE = False
    logging.warning("EasyOCR not available. Install with: pip install easyocr")


@dataclass
class TextRegion:
    """Represents text extracted from a specific region"""
    text: str
    confidence: float
    bounding_box: Tuple[int, int, int, int]  # (x, y, width, height)
    region_type: str  # "pot", "stack", "player_name", "blinds", "bet", "action"
    processed_value: Optional[Any] = None  # Parsed value (e.g., float for money)
    
    def __str__(self) -> str:
        return f"{self.region_type}: '{self.text}' ({self.confidence:.3f})"


class TextPreprocessor:
    """Preprocesses images for optimal OCR performance"""
    
    def __init__(self):
        self.clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    
    def preprocess_for_ocr(self, image: np.ndarray, region_type: str = "general") -> np.ndarray:
        """
        Preprocess image region for OCR
        
        Args:
            image: Input image region
            region_type: Type of content expected ("money", "text", "general")
            
        Returns:
            Preprocessed image optimized for OCR
        """
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()
        
        # Apply preprocessing chain based on region type
        if region_type == "money":
            processed = self._preprocess_money_text(gray)
        elif region_type == "player_name":
            processed = self._preprocess_player_names(gray)
        else:
            processed = self._preprocess_general_text(gray)
        
        return processed
    
    def _preprocess_money_text(self, gray: np.ndarray) -> np.ndarray:
        """Preprocess regions containing monetary values"""
        # Enhance contrast for digits and currency symbols
        enhanced = self.clahe.apply(gray)
        
        # Reduce noise while preserving text edges
        denoised = cv2.bilateralFilter(enhanced, 9, 75, 75)
        
        # Threshold to create high contrast text
        _, binary = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Morphological operations to clean up text
        kernel = np.ones((2, 2), np.uint8)
        cleaned = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
        
        return cleaned
    
    def _preprocess_player_names(self, gray: np.ndarray) -> np.ndarray:
        """Preprocess regions containing player names"""
        # Adaptive histogram equalization
        enhanced = self.clahe.apply(gray)
        
        # Gaussian blur to reduce noise
        blurred = cv2.GaussianBlur(enhanced, (3, 3), 0)
        
        # Adaptive threshold for varying lighting
        binary = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )
        
        return binary
    
    def _preprocess_general_text(self, gray: np.ndarray) -> np.ndarray:
        """General text preprocessing"""
        # Enhance contrast
        enhanced = self.clahe.apply(gray)
        
        # Apply Otsu thresholding
        _, binary = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        return binary
    
    def resize_for_ocr(self, image: np.ndarray, target_height: int = 40) -> np.ndarray:
        """
        Resize image to optimal height for OCR
        
        Args:
            image: Input image
            target_height: Target height in pixels
            
        Returns:
            Resized image
        """
        h, w = image.shape[:2]
        if h < target_height:
            # Scale up small text
            scale_factor = target_height / h
            new_width = int(w * scale_factor)
            resized = cv2.resize(image, (new_width, target_height), interpolation=cv2.INTER_CUBIC)
        else:
            resized = image
        
        return resized


class TextPostprocessor:
    """Post-processes OCR results for poker-specific content"""
    
    def __init__(self):
        # Money patterns
        self.money_patterns = [
            r'\$?([\d,]+\.?\d*)',  # $1,234.56 or 1234
            r'([\d,]+\.?\d*)\s*[k|K]',  # 1.5K
            r'([\d,]+\.?\d*)\s*[m|M]',  # 2.3M
        ]
        
        # Betting round patterns
        self.betting_rounds = {
            'preflop': ['preflop', 'pre-flop', 'pre flop'],
            'flop': ['flop'],
            'turn': ['turn'],
            'river': ['river']
        }
        
        # Action patterns
        self.action_patterns = {
            'fold': ['fold', 'folds'],
            'call': ['call', 'calls'],
            'check': ['check', 'checks'],
            'bet': ['bet', 'bets'],
            'raise': ['raise', 'raises', 'raise to'],
            'all-in': ['all-in', 'all in', 'allin']
        }
    
    def parse_money_value(self, text: str) -> Optional[float]:
        """
        Parse monetary value from text
        
        Args:
            text: Raw OCR text
            
        Returns:
            Parsed float value or None if not found
        """
        # Clean text
        cleaned = re.sub(r'[^\d.,kmKM$]', '', text)
        
        for pattern in self.money_patterns:
            match = re.search(pattern, cleaned, re.IGNORECASE)
            if match:
                value_str = match.group(1)
                
                # Handle K/M multipliers
                if 'k' in text.lower():
                    multiplier = 1000
                elif 'm' in text.lower():
                    multiplier = 1000000
                else:
                    multiplier = 1
                
                try:
                    # Remove commas and convert to float
                    value = float(value_str.replace(',', ''))
                    return value * multiplier
                except ValueError:
                    continue
        
        return None
    
    def parse_betting_round(self, text: str) -> Optional[str]:
        """Parse betting round from text"""
        text_lower = text.lower()
        
        for round_name, patterns in self.betting_rounds.items():
            for pattern in patterns:
                if pattern in text_lower:
                    return round_name
        
        return None
    
    def parse_action(self, text: str) -> Optional[str]:
        """Parse player action from text"""
        text_lower = text.lower()
        
        for action, patterns in self.action_patterns.items():
            for pattern in patterns:
                if pattern in text_lower:
                    return action
        
        return None
    
    def clean_player_name(self, text: str) -> str:
        """Clean and normalize player name"""
        # Remove common OCR artifacts
        cleaned = re.sub(r'[^\w\s-_.]', '', text)
        
        # Remove extra whitespace
        cleaned = ' '.join(cleaned.split())
        
        # Limit length
        if len(cleaned) > 20:
            cleaned = cleaned[:20]
        
        return cleaned.strip()
    
    def validate_text_confidence(self, text: str, confidence: float, region_type: str) -> float:
        """
        Validate and adjust confidence based on text content and region type
        
        Args:
            text: Extracted text
            confidence: OCR confidence
            region_type: Type of text region
            
        Returns:
            Adjusted confidence score
        """
        if not text or not text.strip():
            return 0.0
        
        # Base confidence adjustment
        adjusted = confidence
        
        # Boost confidence for valid patterns
        if region_type == "money" and self.parse_money_value(text) is not None:
            adjusted = min(1.0, confidence + 0.1)
        elif region_type == "betting_round" and self.parse_betting_round(text) is not None:
            adjusted = min(1.0, confidence + 0.15)
        elif region_type == "action" and self.parse_action(text) is not None:
            adjusted = min(1.0, confidence + 0.1)
        
        # Reduce confidence for suspicious patterns
        if len(text) < 2 or len(text) > 50:
            adjusted *= 0.8
        
        # Check for OCR artifacts
        if re.search(r'[^\w\s$.,%-]', text):
            adjusted *= 0.9
        
        return adjusted


class TesseractEngine:
    """Tesseract-based OCR engine with poker-specific optimizations"""
    
    def __init__(self):
        if not TESSERACT_AVAILABLE:
            raise ImportError("Tesseract not available")
        
        # Tesseract configurations for different content types
        self.configs = {
            'money': '--psm 8 -c tessedit_char_whitelist=0123456789$.,kKmM',
            'digits': '--psm 8 -c tessedit_char_whitelist=0123456789',
            'general': '--psm 6',
            'single_line': '--psm 7',
            'single_word': '--psm 8'
        }
    
    def extract_text(self, image: np.ndarray, config_type: str = "general") -> Tuple[str, float]:
        """
        Extract text using Tesseract
        
        Args:
            image: Preprocessed image
            config_type: Tesseract configuration type
            
        Returns:
            Tuple of (extracted_text, confidence)
        """
        try:
            config = self.configs.get(config_type, self.configs['general'])
            
            # Extract text with confidence
            data = pytesseract.image_to_data(image, config=config, output_type=pytesseract.Output.DICT)
            
            # Combine text and calculate average confidence
            text_parts = []
            confidences = []
            
            for i, word in enumerate(data['text']):
                if word.strip() and data['conf'][i] > 0:
                    text_parts.append(word)
                    confidences.append(data['conf'][i])
            
            combined_text = ' '.join(text_parts)
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
            
            return combined_text, avg_confidence / 100.0  # Convert to 0-1 range
            
        except Exception as e:
            logging.error(f"Tesseract extraction failed: {e}")
            return "", 0.0


class EasyOCREngine:
    """EasyOCR-based text extraction engine"""
    
    def __init__(self, languages: List[str] = ['en']):
        if not EASYOCR_AVAILABLE:
            raise ImportError("EasyOCR not available")
        
        self.reader = easyocr.Reader(languages, gpu=False)  # Set to True if GPU available
    
    def extract_text(self, image: np.ndarray) -> Tuple[str, float]:
        """
        Extract text using EasyOCR
        
        Args:
            image: Input image
            
        Returns:
            Tuple of (extracted_text, confidence)
        """
        try:
            results = self.reader.readtext(image)
            
            if not results:
                return "", 0.0
            
            # Combine all detected text
            text_parts = []
            confidences = []
            
            for bbox, text, confidence in results:
                if text.strip() and confidence > 0.3:  # Filter low confidence
                    text_parts.append(text)
                    confidences.append(confidence)
            
            combined_text = ' '.join(text_parts)
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
            
            return combined_text, avg_confidence
            
        except Exception as e:
            logging.error(f"EasyOCR extraction failed: {e}")
            return "", 0.0


class OCREngine:
    """
    Advanced OCR engine combining multiple OCR backends with poker-specific
    text processing and error correction.
    """
    
    def __init__(self, use_easyocr: bool = True, use_tesseract: bool = True):
        """
        Initialize OCR engine
        
        Args:
            use_easyocr: Enable EasyOCR backend
            use_tesseract: Enable Tesseract backend
        """
        self.preprocessor = TextPreprocessor()
        self.postprocessor = TextPostprocessor()
        
        # Initialize OCR engines
        self.tesseract_engine = None
        self.easyocr_engine = None
        
        if use_tesseract and TESSERACT_AVAILABLE:
            try:
                self.tesseract_engine = TesseractEngine()
            except Exception as e:
                logging.warning(f"Failed to initialize Tesseract: {e}")
        
        if use_easyocr and EASYOCR_AVAILABLE:
            try:
                self.easyocr_engine = EasyOCREngine()
            except Exception as e:
                logging.warning(f"Failed to initialize EasyOCR: {e}")
        
        # Performance tracking
        self.extraction_stats = {
            "total_extractions": 0,
            "successful_extractions": 0,
            "average_confidence": 0.0,
            "average_processing_time": 0.0
        }
    
    def extract_text_from_region(self, image: np.ndarray, 
                                roi: Tuple[int, int, int, int],
                                region_type: str = "general") -> TextRegion:
        """
        Extract text from specific image region
        
        Args:
            image: Full image
            roi: Region of interest (x, y, width, height)
            region_type: Type of content expected
            
        Returns:
            TextRegion object with extracted and processed text
        """
        start_time = time.time()
        
        # Extract ROI
        x, y, w, h = roi
        region_image = image[y:y+h, x:x+w]
        
        # Preprocess for OCR
        preprocessed = self.preprocessor.preprocess_for_ocr(region_image, region_type)
        
        # Resize if needed
        if region_type in ["money", "digits"]:
            preprocessed = self.preprocessor.resize_for_ocr(preprocessed, target_height=50)
        
        # Extract text using available engines
        text, confidence = self._extract_with_best_engine(preprocessed, region_type)
        
        # Post-process text
        processed_value = self._post_process_text(text, region_type)
        
        # Validate and adjust confidence
        final_confidence = self.postprocessor.validate_text_confidence(
            text, confidence, region_type
        )
        
        # Update statistics
        processing_time = time.time() - start_time
        self._update_stats(text, final_confidence, processing_time)
        
        return TextRegion(
            text=text,
            confidence=final_confidence,
            bounding_box=roi,
            region_type=region_type,
            processed_value=processed_value
        )
    
    def extract_pot_size(self, image: np.ndarray, pot_roi: Tuple[int, int, int, int]) -> Optional[float]:
        """Extract pot size from specified region"""
        region = self.extract_text_from_region(image, pot_roi, "money")
        return region.processed_value if region.processed_value else None
    
    def extract_player_stack(self, image: np.ndarray, stack_roi: Tuple[int, int, int, int]) -> Optional[float]:
        """Extract player stack size from specified region"""
        region = self.extract_text_from_region(image, stack_roi, "money")
        return region.processed_value if region.processed_value else None
    
    def extract_player_name(self, image: np.ndarray, name_roi: Tuple[int, int, int, int]) -> Optional[str]:
        """Extract player name from specified region"""
        region = self.extract_text_from_region(image, name_roi, "player_name")
        return region.processed_value if region.processed_value else None
    
    def extract_blinds(self, image: np.ndarray, blinds_roi: Tuple[int, int, int, int]) -> Tuple[Optional[float], Optional[float]]:
        """Extract small and big blind amounts"""
        region = self.extract_text_from_region(image, blinds_roi, "money")
        
        if region.text:
            # Look for pattern like "$5/$10" or "5/10"
            blind_pattern = r'(\d+(?:\.\d+)?)[/\s-]+(\d+(?:\.\d+)?)'
            match = re.search(blind_pattern, region.text)
            
            if match:
                try:
                    small_blind = float(match.group(1))
                    big_blind = float(match.group(2))
                    return small_blind, big_blind
                except ValueError:
                    pass
        
        return None, None
    
    def extract_betting_round(self, image: np.ndarray, round_roi: Tuple[int, int, int, int]) -> Optional[str]:
        """Extract current betting round"""
        region = self.extract_text_from_region(image, round_roi, "betting_round")
        return region.processed_value if region.processed_value else None
    
    def _extract_with_best_engine(self, image: np.ndarray, region_type: str) -> Tuple[str, float]:
        """Extract text using the best available engine for the region type"""
        results = []
        
        # Try Tesseract with appropriate config
        if self.tesseract_engine:
            try:
                config_type = self._get_tesseract_config(region_type)
                text, conf = self.tesseract_engine.extract_text(image, config_type)
                if text:
                    results.append(("tesseract", text, conf))
            except Exception as e:
                logging.debug(f"Tesseract extraction failed: {e}")
        
        # Try EasyOCR
        if self.easyocr_engine:
            try:
                text, conf = self.easyocr_engine.extract_text(image)
                if text:
                    results.append(("easyocr", text, conf))
            except Exception as e:
                logging.debug(f"EasyOCR extraction failed: {e}")
        
        if not results:
            return "", 0.0
        
        # Return best result based on confidence and content validation
        best_result = max(results, key=lambda x: self._score_result(x[1], x[2], region_type))
        return best_result[1], best_result[2]
    
    def _get_tesseract_config(self, region_type: str) -> str:
        """Get appropriate Tesseract configuration for region type"""
        config_map = {
            "money": "money",
            "digits": "digits",
            "player_name": "general",
            "betting_round": "single_word",
            "action": "single_word"
        }
        return config_map.get(region_type, "general")
    
    def _score_result(self, text: str, confidence: float, region_type: str) -> float:
        """Score OCR result based on confidence and content validation"""
        score = confidence
        
        # Boost score for valid content patterns
        if region_type == "money" and self.postprocessor.parse_money_value(text):
            score += 0.2
        elif region_type == "betting_round" and self.postprocessor.parse_betting_round(text):
            score += 0.3
        elif region_type == "action" and self.postprocessor.parse_action(text):
            score += 0.2
        
        return score
    
    def _post_process_text(self, text: str, region_type: str) -> Optional[Any]:
        """Post-process extracted text based on region type"""
        if not text:
            return None
        
        if region_type == "money":
            return self.postprocessor.parse_money_value(text)
        elif region_type == "player_name":
            return self.postprocessor.clean_player_name(text)
        elif region_type == "betting_round":
            return self.postprocessor.parse_betting_round(text)
        elif region_type == "action":
            return self.postprocessor.parse_action(text)
        else:
            return text.strip()
    
    def _update_stats(self, text: str, confidence: float, processing_time: float):
        """Update extraction statistics"""
        self.extraction_stats["total_extractions"] += 1
        
        if text and confidence > 0.5:
            self.extraction_stats["successful_extractions"] += 1
        
        # Update running averages
        total = self.extraction_stats["total_extractions"]
        
        # Update average confidence
        current_avg_conf = self.extraction_stats["average_confidence"]
        new_avg_conf = ((current_avg_conf * (total - 1)) + confidence) / total
        self.extraction_stats["average_confidence"] = new_avg_conf
        
        # Update average processing time
        current_avg_time = self.extraction_stats["average_processing_time"]
        new_avg_time = ((current_avg_time * (total - 1)) + processing_time) / total
        self.extraction_stats["average_processing_time"] = new_avg_time
    
    def get_extraction_stats(self) -> Dict[str, Any]:
        """Get OCR performance statistics"""
        stats = self.extraction_stats.copy()
        if stats["total_extractions"] > 0:
            stats["success_rate"] = stats["successful_extractions"] / stats["total_extractions"]
        else:
            stats["success_rate"] = 0.0
        return stats
    
    def batch_extract_regions(self, image: np.ndarray, 
                             regions: Dict[str, Tuple[int, int, int, int]]) -> Dict[str, TextRegion]:
        """
        Extract text from multiple regions in batch
        
        Args:
            image: Full image
            regions: Dictionary mapping region names to ROI coordinates
            
        Returns:
            Dictionary mapping region names to TextRegion objects
        """
        results = {}
        
        for region_name, roi in regions.items():
            # Infer region type from name
            region_type = self._infer_region_type(region_name)
            results[region_name] = self.extract_text_from_region(image, roi, region_type)
        
        return results
    
    def _infer_region_type(self, region_name: str) -> str:
        """Infer region type from region name"""
        name_lower = region_name.lower()
        
        if any(keyword in name_lower for keyword in ['pot', 'stack', 'bet', 'blind', 'chip']):
            return "money"
        elif any(keyword in name_lower for keyword in ['name', 'player']):
            return "player_name"
        elif any(keyword in name_lower for keyword in ['round', 'street']):
            return "betting_round"
        elif any(keyword in name_lower for keyword in ['action', 'move']):
            return "action"
        else:
            return "general"