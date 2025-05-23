"""
Setup configuration for Poker Analysis System
"""

from setuptools import setup, find_packages
from pathlib import Path

# Read the README file
README_PATH = Path(__file__).parent / "README.md"
long_description = README_PATH.read_text(encoding="utf-8") if README_PATH.exists() else ""

# Read requirements
REQUIREMENTS_PATH = Path(__file__).parent / "requirements.txt"
requirements = []
if REQUIREMENTS_PATH.exists():
    with open(REQUIREMENTS_PATH, 'r', encoding='utf-8') as f:
        requirements = [line.strip() for line in f if line.strip() and not line.startswith('#')]

setup(
    name="poker-helper",
    version="1.0.0",
    author="Development Team",
    author_email="dev@poker-helper.com",
    description="Real-time poker analysis and decision support system for research purposes",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/clduab11/poker-helper",
    project_urls={
        "Bug Tracker": "https://github.com/clduab11/poker-helper/issues",
        "Documentation": "https://github.com/clduab11/poker-helper/docs",
        "Source Code": "https://github.com/clduab11/poker-helper",
    },
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Science/Research",
        "Intended Audience :: Education",
        "License :: Other/Proprietary License",
        "Operating System :: Microsoft :: Windows :: Windows 10",
        "Operating System :: MacOS :: MacOS X",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "Topic :: Scientific/Engineering :: Image Recognition",
        "Topic :: Games/Entertainment",
    ],
    python_requires=">=3.11",
    install_requires=requirements,
    extras_require={
        "gpu": ["cupy-cuda11x>=12.2.0"],
        "dev": [
            "pytest>=7.4.0",
            "pytest-asyncio>=0.21.0",
            "pytest-cov>=4.1.0",
            "black>=23.7.0",
            "flake8>=6.0.0",
            "mypy>=1.5.0",
            "pre-commit>=3.3.0",
        ],
        "docs": [
            "sphinx>=7.1.0",
            "sphinx-rtd-theme>=1.3.0",
            "mkdocs>=1.5.0",
        ]
    },
    entry_points={
        "console_scripts": [
            "poker-helper=main:main",
        ],
    },
    include_package_data=True,
    package_data={
        "src": ["**/*.json", "**/*.yaml", "**/*.yml"],
        "models": ["**/*.pt", "**/*.onnx", "**/*.pkl"],
        "data": ["**/*.json", "**/*.csv"],
    },
    zip_safe=False,
    keywords=[
        "poker", "analysis", "computer-vision", "ai", "machine-learning",
        "real-time", "decision-support", "research", "opencv", "yolo"
    ],
    platforms=["Windows", "macOS"],
)