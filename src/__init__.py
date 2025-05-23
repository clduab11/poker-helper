"""
Poker Analysis System - Core Package

A Python-based real-time poker analysis and decision support system
designed for research and isolated testing environments.

Version: 1.0.0
Author: Development Team
License: Research Use Only
"""

__version__ = "1.0.0"
__author__ = "Development Team"
__description__ = "Real-time Poker Analysis and Decision Support System"

# Core module imports
from .core import *
from .vision import *
from .ai import *
from .platforms import *
from .data import *
from .ui import *
from .utils import *

__all__ = [
    "__version__",
    "__author__", 
    "__description__"
]