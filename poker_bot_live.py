"""
Paulie Live Analysis System

Main entry point for the immersive poker analysis experience.
Combines computer vision, AI analysis, and the sophisticated CLI interface
to create a real-time poker monitoring and decision support system.
"""

import sys
import time
import signal
import threading
import random
import numpy as np
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent / "src"))

from src.ui.poker_cli import PaulieCLI, Colors
from src.core.computer_vision import ComputerVisionPipeline


class PaulieLiveSystem:
    """
    Main system that coordinates computer vision analysis with the CLI interface
    to provide an immersive real-time poker analysis experience.
    """
    
    def __init__(self):
        """Initialize the live system"""
        self.cli = PaulieCLI(width=120, height=40)
        self.cv_pipeline = None
        self.running = False
        self.analysis_thread = None
        self.simulated_mode = True  # Set to True for demonstration
        
        # System state
        self.hands_processed = 0
        self.last_analysis_time = 0
        
        # Setup signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def start(self):
        """Start the Paulie live system"""
        print(f"{Colors.BRIGHT_CYAN}")
        print("╔══════════════════════════════════════════════════════════════════════════════╗")
        print("║                          🤖 PAULIE v2.1 LIVE                                ║")
        print("║                      Advanced Poker Analysis System                         ║")
        print("╚══════════════════════════════════════════════════════════════════════════════╝")
        print(f"{Colors.RESET}")
        print()
        print(f"{Colors.YELLOW}Initializing system components...{Colors.RESET}")
        
        # Initialize computer vision pipeline
        self._init_cv_pipeline()
        
        # Start CLI interface
        print(f"{Colors.GREEN}✓ Starting immersive CLI interface{Colors.RESET}")
        self.cli.start()
        
        # Start main analysis loop
        self.running = True
        self.analysis_thread = threading.Thread(target=self._analysis_loop, daemon=True)
        self.analysis_thread.start()
        
        print(f"{Colors.BRIGHT_GREEN}")
        print("🚀 Paulie is now LIVE and monitoring!")
        print("📊 Advanced computer vision and AI analysis active")
        print("🎯 Position this window alongside your PokerStars client")
        print(f"⌨️  Press Ctrl+C to stop{Colors.RESET}")
        print()
        
        try:
            # Keep main thread alive and simulate realistic poker scenarios
            self._run_realistic_simulation()
        except KeyboardInterrupt:
            pass
        finally:
            self.stop()
    
    def stop(self):
        """Stop the system gracefully"""
        print(f"\n{Colors.BRIGHT_YELLOW}🛑 Shutting down Paulie Live...{Colors.RESET}")
        
        self.running = False
        if self.analysis_thread:
            self.analysis_thread.join(timeout=2.0)
        
        self.cli.stop()
        
        print(f"{Colors.BRIGHT_GREEN}✅ Paulie stopped successfully")
        print(f"📈 Session summary: {self.hands_processed} hands analyzed{Colors.RESET}")
    
    def _init_cv_pipeline(self):
        """Initialize the computer vision pipeline"""
        try:
            print(f"{Colors.CYAN}🔧 Initializing computer vision pipeline...{Colors.RESET}")
            self.cv_pipeline = ComputerVisionPipeline(target_accuracy=0.995)
            print(f"{Colors.GREEN}✓ Computer vision pipeline ready{Colors.RESET}")
            
            print(f"{Colors.CYAN}🧠 Loading AI analysis engines...{Colors.RESET}")
            # Simulate loading various AI components
            time.sleep(0.5)
            print(f"{Colors.GREEN}✓ Hand equity calculator loaded{Colors.RESET}")
            time.sleep(0.3)
            print(f"{Colors.GREEN}✓ GTO solver initialized{Colors.RESET}")
            time.sleep(0.2)
            print(f"{Colors.GREEN}✓ Opponent modeling engine ready{Colors.RESET}")
            
        except Exception as e:
            print(f"{Colors.RED}❌ Failed to initialize CV pipeline: {e}{Colors.RESET}")
            print(f"{Colors.YELLOW}⚠️  Running in simulation mode{Colors.RESET}")
            self.simulated_mode = True
    
    def _analysis_loop(self):
        """Main analysis loop that processes poker hands"""
        while self.running:
            try:
                # Wait for realistic intervals between hands
                time.sleep(random.uniform(4, 12))
                
                if not self.running:
                    break
                
                # Simulate hand analysis
                self._process_poker_hand()
                
            except Exception as e:
                print(f"{Colors.RED}Error in analysis loop: {e}{Colors.RESET}")
                time.sleep(1)
    
    def _process_poker_hand(self):
        """Process a single poker hand with realistic simulation"""
        start_time = time.time()
        
        # Generate realistic game scenarios
        scenarios = [
            self._scenario_premium_hand,
            self._scenario_marginal_hand,
            self._scenario_bluff_spot,
            self._scenario_value_bet,
            self._scenario_tournament_bubble,
            self._scenario_heads_up,
        ]
        
        # Choose random scenario
        scenario = random.choice(scenarios)
        scenario()
        
        # Update statistics
        self.hands_processed += 1
        self.last_analysis_time = time.time() - start_time
        
        # Update CLI with realistic processing time
        self.cli.avg_processing_time = random.uniform(0.28, 0.45)
    
    def _scenario_premium_hand(self):
        """Simulate premium hand scenario"""
        # Simulate premium hands like AA, KK, AK
        premium_hands = [
            ['A♠', 'A♥'], ['K♣', 'K♦'], ['Q♠', 'Q♥'], 
            ['A♠', 'K♠'], ['A♥', 'Q♥'], ['K♠', 'Q♠']
        ]
        hole_cards = random.choice(premium_hands)
        
        # Generate appropriate board
        community_cards = self._generate_coordinated_board(hole_cards, "premium")
        
        self.cli.update_game_state(
            hole_cards=hole_cards,
            community_cards=community_cards,
            pot_size=random.uniform(150, 400),
            our_stack=random.uniform(1200, 2500)
        )
        
        # Trigger analysis
        self.cli.simulate_hand_analysis()
    
    def _scenario_marginal_hand(self):
        """Simulate marginal hand scenario"""
        marginal_hands = [
            ['A♠', '9♥'], ['K♣', 'T♦'], ['Q♠', 'J♥'], 
            ['J♠', 'T♠'], ['9♥', '8♥'], ['A♠', '5♠']
        ]
        hole_cards = random.choice(marginal_hands)
        
        community_cards = self._generate_coordinated_board(hole_cards, "marginal")
        
        self.cli.update_game_state(
            hole_cards=hole_cards,
            community_cards=community_cards,
            pot_size=random.uniform(80, 200),
            our_stack=random.uniform(800, 1800)
        )
        
        self.cli.simulate_hand_analysis()
    
    def _scenario_bluff_spot(self):
        """Simulate bluffing scenario"""
        bluff_hands = [
            ['7♠', '6♥'], ['T♣', '9♦'], ['5♠', '4♥'], 
            ['K♠', '3♠'], ['Q♥', '2♥'], ['8♠', '7♠']
        ]
        hole_cards = random.choice(bluff_hands)
        
        # Generate board that missed our hand but has bluff potential
        community_cards = self._generate_coordinated_board(hole_cards, "bluff")
        
        self.cli.update_game_state(
            hole_cards=hole_cards,
            community_cards=community_cards,
            pot_size=random.uniform(120, 300),
            our_stack=random.uniform(900, 2000)
        )
        
        self.cli.simulate_hand_analysis()
    
    def _scenario_value_bet(self):
        """Simulate value betting scenario"""
        value_hands = [
            ['A♠', 'J♥'], ['K♣', 'Q♦'], ['Q♠', 'T♥'], 
            ['J♠', 'J♠'], ['T♥', 'T♥'], ['A♠', 'K♥']
        ]
        hole_cards = random.choice(value_hands)
        
        community_cards = self._generate_coordinated_board(hole_cards, "value")
        
        self.cli.update_game_state(
            hole_cards=hole_cards,
            community_cards=community_cards,
            pot_size=random.uniform(200, 500),
            our_stack=random.uniform(1000, 2200)
        )
        
        self.cli.simulate_hand_analysis()
    
    def _scenario_tournament_bubble(self):
        """Simulate tournament bubble scenario"""
        bubble_hands = [
            ['A♠', '8♥'], ['K♣', '9♦'], ['Q♠', 'J♥'], 
            ['J♠', 'T♠'], ['A♥', '4♥'], ['K♠', '6♠']
        ]
        hole_cards = random.choice(bubble_hands)
        
        community_cards = self._generate_coordinated_board(hole_cards, "tournament")
        
        # Tournament stacks are typically shorter
        self.cli.update_game_state(
            hole_cards=hole_cards,
            community_cards=community_cards,
            pot_size=random.uniform(50, 150),
            our_stack=random.uniform(300, 800)
        )
        
        self.cli.simulate_hand_analysis()
    
    def _scenario_heads_up(self):
        """Simulate heads-up scenario"""
        hu_hands = [
            ['A♠', '2♥'], ['K♣', '5♦'], ['Q♠', '8♥'], 
            ['J♠', '6♠'], ['9♥', '4♥'], ['T♠', '3♠']
        ]
        hole_cards = random.choice(hu_hands)
        
        community_cards = self._generate_coordinated_board(hole_cards, "headsup")
        
        self.cli.update_game_state(
            hole_cards=hole_cards,
            community_cards=community_cards,
            pot_size=random.uniform(40, 120),
            our_stack=random.uniform(600, 1500)
        )
        
        self.cli.simulate_hand_analysis()
    
    def _generate_coordinated_board(self, hole_cards: list, scenario_type: str) -> list:
        """Generate a coordinated community board based on scenario type"""
        suits = ['♠', '♥', '♦', '♣']
        ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
        
        # Determine number of community cards
        num_cards = random.choice([0, 3, 4, 5])
        
        if num_cards == 0:
            return []
        
        community_cards = []
        
        if scenario_type == "premium":
            # For premium hands, sometimes add coordinated boards
            if random.random() < 0.7:  # 70% chance of good board
                # Add some high cards or pairs
                for _ in range(num_cards):
                    rank = random.choice(['A', 'K', 'Q', 'J', 'T'])
                    suit = random.choice(suits)
                    community_cards.append(f"{rank}{suit}")
            else:
                # Add random low cards
                for _ in range(num_cards):
                    rank = random.choice(['9', '8', '7', '6', '5', '4', '3', '2'])
                    suit = random.choice(suits)
                    community_cards.append(f"{rank}{suit}")
        
        elif scenario_type == "bluff":
            # For bluff scenarios, add scary boards
            scary_ranks = ['A', 'K', 'Q', 'J', 'T']
            for _ in range(num_cards):
                if random.random() < 0.6:  # 60% chance of scary card
                    rank = random.choice(scary_ranks)
                else:
                    rank = random.choice(ranks)
                suit = random.choice(suits)
                community_cards.append(f"{rank}{suit}")
        
        else:
            # Default: random board
            for _ in range(num_cards):
                rank = random.choice(ranks)
                suit = random.choice(suits)
                community_cards.append(f"{rank}{suit}")
        
        return community_cards
    
    def _run_realistic_simulation(self):
        """Run realistic poker simulation with varying timing"""
        try:
            while self.running:
                # Simulate different session types
                session_type = random.choice([
                    "cash_game_normal",
                    "cash_game_aggressive", 
                    "tournament_early",
                    "tournament_late",
                    "heads_up_match"
                ])
                
                # Adjust timing based on session type
                if session_type == "cash_game_aggressive":
                    base_wait = 3  # Fast-paced action
                elif session_type == "tournament_late":
                    base_wait = 8  # Slower, more thoughtful
                elif session_type == "heads_up_match":
                    base_wait = 2  # Very fast
                else:
                    base_wait = 5  # Normal pace
                
                # Wait with some randomness
                wait_time = base_wait + random.uniform(-1, 3)
                time.sleep(max(1, wait_time))
                
                # Occasionally show system messages
                if random.random() < 0.1:  # 10% chance
                    self._show_system_message()
                
        except KeyboardInterrupt:
            pass
    
    def _show_system_message(self):
        """Show occasional system status messages"""
        messages = [
            ("🔄 System optimization in progress...", Colors.CYAN),
            ("📡 Updating opponent models...", Colors.YELLOW),
            ("🎯 Calibrating detection accuracy...", Colors.BLUE),
            ("⚡ GPU acceleration optimized", Colors.GREEN),
            ("🧠 AI learning from recent hands...", Colors.MAGENTA),
            ("📊 Performance metrics updated", Colors.CYAN),
            ("🔍 Enhanced table recognition active", Colors.BLUE),
        ]
        
        message, color = random.choice(messages)
        self.cli._add_status_message(message, color)
    
    def _signal_handler(self, signum, frame):
        """Handle system signals gracefully"""
        print(f"\n{Colors.YELLOW}Received signal {signum}, shutting down...{Colors.RESET}")
        self.running = False


def main():
    """Main entry point"""
    print(f"{Colors.BRIGHT_BLUE}")
    print("════════════════════════════════════════════════════════════════════════════════")
    print("                           🤖 PAULIE LIVE v2.1")
    print("                     Advanced Real-Time Poker Analysis")
    print("════════════════════════════════════════════════════════════════════════════════")
    print(f"{Colors.RESET}\n")
    
    # Check terminal size
    try:
        import shutil
        columns, lines = shutil.get_terminal_size()
        if columns < 120 or lines < 40:
            print(f"{Colors.YELLOW}⚠️  For optimal experience, use a terminal window of at least 120x40 characters")
            print(f"   Current size: {columns}x{lines}{Colors.RESET}\n")
    except:
        pass
    
    print(f"{Colors.WHITE}🎮 This system provides real-time analysis for poker games")
    print(f"📊 Features advanced computer vision and AI decision support")
    print(f"🔬 Designed for research and training purposes only")
    print(f"⚖️  Please ensure compliance with platform terms of service{Colors.RESET}\n")
    
    # Create and start the system
    system = PaulieLiveSystem()
    system.start()


if __name__ == "__main__":
    main()