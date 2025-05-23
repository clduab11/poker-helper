"""
Poker Analysis System - Main Entry Point

Real-time poker analysis and decision support system for research purposes.
This is the main application entry point that orchestrates all system components.
"""

import asyncio
import signal
import sys
import argparse
import time
import logging
from typing import Optional
from pathlib import Path

# Core imports
from src.core.screen_capture import ScreenCaptureEngine
from src.core.computer_vision import ComputerVisionPipeline
from src.core.ai_engine import AIAnalysisEngine
from src.core.decision_manager import DecisionManager

# Configuration and utilities
from src.utils.config import ConfigurationManager
from src.utils.logging_config import setup_logging
from src.utils.performance import PerformanceMonitor


class PokerAnalysisSystem:
    """
    Main application class that coordinates all system components.
    """
    
    def __init__(self, config_path: Optional[str] = None):
        """
        Initialize the poker analysis system
        
        Args:
            config_path: Optional path to configuration file
        """
        # Load configuration
        self.config = ConfigurationManager(config_path)
        
        # Setup logging
        setup_logging(self.config.get_logging_config())
        
        # Initialize components
        self.screen_capture: Optional[ScreenCaptureEngine] = None
        self.computer_vision: Optional[ComputerVisionPipeline] = None
        self.ai_engine: Optional[AIAnalysisEngine] = None
        self.decision_manager: Optional[DecisionManager] = None
        self.performance_monitor: Optional[PerformanceMonitor] = None
        
        # State tracking
        self.is_running = False
        self.is_initialized = False
        
        print("🎯 Poker Analysis System initialized")
    
    async def initialize(self) -> bool:
        """
        Initialize all system components
        
        Returns:
            True if initialization successful, False otherwise
        """
        try:
            print("🔧 Initializing system components...")
            
            # Initialize performance monitor
            self.performance_monitor = PerformanceMonitor()
            
            # Initialize screen capture engine
            capture_config = self.config.get_capture_config()
            self.screen_capture = ScreenCaptureEngine(
                capture_interval=capture_config.get('interval', 1.0)
            )
            print("✅ Screen capture engine initialized")
            
            # Initialize computer vision pipeline
            cv_config = self.config.get_cv_config()
            self.computer_vision = ComputerVisionPipeline(
                target_accuracy=cv_config.get('target_accuracy', 0.995)
            )
            print("✅ Computer vision pipeline initialized")
            
            # Initialize AI analysis engine
            ai_config = self.config.get_ai_config()
            self.ai_engine = AIAnalysisEngine(
                simulation_count=ai_config.get('simulation_count', 10000)
            )
            print("✅ AI analysis engine initialized")
            
            # Initialize decision manager
            ui_config = self.config.get_ui_config()
            self.decision_manager = DecisionManager(
                enable_voice=ui_config.get('enable_voice', True),
                enable_overlay=ui_config.get('enable_overlay', True),
                enable_api=ui_config.get('enable_api', False)
            )
            print("✅ Decision manager initialized")
            
            # Setup callbacks between components
            self._setup_component_callbacks()
            
            self.is_initialized = True
            print("🚀 System initialization complete!")
            return True
            
        except Exception as e:
            print(f"❌ System initialization failed: {e}")
            return False
    
    async def start(self) -> None:
        """Start the main analysis loop"""
        if not self.is_initialized:
            if not await self.initialize():
                print("❌ Cannot start system - initialization failed")
                return
        
        print("🎮 Starting poker analysis system...")
        self.is_running = True
        
        # Get capture region from config
        capture_config = self.config.get_capture_config()
        region = capture_config.get('region', {
            'x': 100, 'y': 100, 'width': 1200, 'height': 800
        })
        
        try:
            # Start screen capture
            self.screen_capture.start_continuous_capture(
                x=region['x'],
                y=region['y'], 
                width=region['width'],
                height=region['height']
            )
            
            print(f"📸 Screen capture started - Region: {region}")
            print("🧠 AI analysis running...")
            print("🎯 Decision system active...")
            print("\n" + "="*50)
            print("POKER ANALYSIS SYSTEM IS RUNNING")
            print("Press Ctrl+C to stop")
            print("="*50 + "\n")
            
            # Main processing loop
            await self._main_loop()
            
        except KeyboardInterrupt:
            print("\n⏹️  Shutdown requested by user")
        except Exception as e:
            print(f"❌ System error: {e}")
        finally:
            await self.stop()
    
    async def stop(self) -> None:
        """Stop the system and cleanup resources"""
        print("🛑 Stopping poker analysis system...")
        self.is_running = False
        
        if self.screen_capture and self.screen_capture.is_capturing():
            self.screen_capture.stop_capture()
            print("✅ Screen capture stopped")
        
        # Print performance statistics
        if self.performance_monitor:
            stats = self.performance_monitor.get_performance_stats()
            print(f"📊 Performance Summary:")
            print(f"   - Total frames processed: {stats.get('frames_processed', 0)}")
            print(f"   - Average processing time: {stats.get('avg_processing_time', 0):.2f}ms")
            print(f"   - System uptime: {stats.get('uptime_seconds', 0):.1f}s")
        
        print("👋 System shutdown complete")
    
    async def _main_loop(self) -> None:
        """Main processing loop"""
        frame_count = 0
        
        while self.is_running:
            try:
                # Get latest captured frame
                capture_result = self.screen_capture.get_latest_frame()
                
                if capture_result and capture_result.success and capture_result.image is not None:
                    frame_count += 1
                    
                    # Process frame through computer vision
                    game_state = self.computer_vision.process_frame(
                        capture_result.image,
                        platform="auto"
                    )
                    
                    # Only proceed if we have valid game state
                    if game_state.is_valid:
                        # Run AI analysis with performance tracking
                        analysis_start = time.time()
                        analysis = self.ai_engine.analyze_hand(game_state)
                        analysis_time = (time.time() - analysis_start) * 1000
                        
                        # Check performance targets
                        total_time = game_state.processing_time_ms + analysis_time
                        if total_time > 500:
                            logging.warning(f"Performance target missed: {total_time:.1f}ms (target: <500ms)")
                        
                        # Generate and output decision
                        decision = self.decision_manager.process_and_output(
                            analysis, game_state
                        )
                        
                        # Update performance stats
                        if self.performance_monitor:
                            self.performance_monitor.record_frame_processed(
                                processing_time=total_time,
                                success=True
                            )
                        
                        # Print periodic status
                        if frame_count % 10 == 0:
                            print(f"📊 Processed {frame_count} frames | "
                                  f"Confidence: {game_state.confidence_score:.1%} | "
                                  f"Processing: {game_state.processing_time_ms:.1f}ms")
                
                # Small delay to prevent excessive CPU usage
                await asyncio.sleep(0.1)
                
            except Exception as e:
                print(f"⚠️  Processing error: {e}")
                await asyncio.sleep(1.0)  # Longer delay on error
    
    def _setup_component_callbacks(self) -> None:
        """Setup callbacks between system components"""
        # This would setup callbacks for voice output, overlay updates, etc.
        # For now, using simple console output
        pass
    
    def get_system_status(self) -> dict:
        """Get current system status"""
        status = {
            "initialized": self.is_initialized,
            "running": self.is_running,
            "components": {}
        }
        
        if self.screen_capture:
            status["components"]["screen_capture"] = self.screen_capture.get_performance_stats()
        
        if self.computer_vision:
            status["components"]["computer_vision"] = self.computer_vision.get_performance_stats()
        
        if self.ai_engine:
            status["components"]["ai_engine"] = self.ai_engine.get_performance_stats()
        
        if self.decision_manager:
            status["components"]["decision_manager"] = self.decision_manager.get_performance_stats()
        
        return status


def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    print(f"\n📡 Received signal {signum}, initiating shutdown...")
    sys.exit(0)


def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Poker Analysis System - Real-time poker decision support"
    )
    
    parser.add_argument(
        "--config", "-c",
        type=str,
        help="Path to configuration file"
    )
    
    parser.add_argument(
        "--region", "-r",
        type=str,
        help="Capture region as 'x,y,width,height'"
    )
    
    parser.add_argument(
        "--platform", "-p",
        type=str,
        choices=["auto", "pokerstars", "888poker", "partypoker"],
        default="auto",
        help="Target poker platform"
    )
    
    parser.add_argument(
        "--debug", "-d",
        action="store_true",
        help="Enable debug mode"
    )
    
    parser.add_argument(
        "--no-voice",
        action="store_true",
        help="Disable voice output"
    )
    
    parser.add_argument(
        "--no-overlay", 
        action="store_true",
        help="Disable overlay interface"
    )
    
    return parser.parse_args()


async def main():
    """Main application entry point"""
    print("🎰 Poker Analysis System v1.0.0")
    print("For research and testing purposes only")
    print("-" * 40)
    
    # Parse command line arguments
    args = parse_arguments()
    
    # Setup signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Create and initialize system
    system = PokerAnalysisSystem(config_path=args.config)
    
    try:
        # Start the system
        await system.start()
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    # Run the application
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
        sys.exit(0)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        sys.exit(1)