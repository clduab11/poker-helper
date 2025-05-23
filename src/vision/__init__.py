"""
Computer Vision Components

This module contains specialized computer vision components:
- Card Detection (YOLO v8)
- OCR Engine (Text extraction)
- Table Parser (Layout recognition)
- Image Preprocessing
"""

from .card_detector import CardDetector, CardDetectionResult
from .ocr_engine import OCREngine, TextRegion
from .table_parser import TableParser, TableRegion
from .preprocessing import ImagePreprocessor, PreprocessingConfig
from .region_detector import RegionDetector, DetectionRegion

__all__ = [
    "CardDetector",
    "CardDetectionResult", 
    "OCREngine",
    "TextRegion",
    "TableParser", 
    "TableRegion",
    "ImagePreprocessor",
    "PreprocessingConfig",
    "RegionDetector",
    "DetectionRegion"
]