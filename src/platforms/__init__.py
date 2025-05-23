"""
Platform Adapters

This module contains platform-specific adapters for different poker clients:
- PokerStars adapter
- 888poker adapter  
- PartyPoker adapter
- Generic adapter for unknown platforms
- Auto-detection system
"""

from .base_adapter import BasePlatformAdapter, PlatformInfo
from .pokerstars import PokerStarsAdapter
from .poker888 import Poker888Adapter
from .partypoker import PartyPokerAdapter
from .auto_detector import PlatformAutoDetector
from .platform_registry import PlatformRegistry

__all__ = [
    "BasePlatformAdapter",
    "PlatformInfo",
    "PokerStarsAdapter",
    "Poker888Adapter", 
    "PartyPokerAdapter",
    "PlatformAutoDetector",
    "PlatformRegistry"
]