"""
Paulie Immersive CLI Interface

A sophisticated command-line interface that provides real-time feedback
and analysis display for the poker analysis system. Features dynamic
updates, professional styling, and immersive simulation of bot processes.
"""

import time
import random
import threading
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass
from enum import Enum
import sys
import os

# Terminal colors and styling
class Colors:
    RESET = '\033[0m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
    
    # Text colors
    BLACK = '\033[30m'
    RED = '\033[31m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    BLUE = '\033[34m'
    MAGENTA = '\033[35m'
    CYAN = '\033[36m'
    WHITE = '\033[37m'
    
    # Bright colors
    BRIGHT_RED = '\033[91m'
    BRIGHT_GREEN = '\033[92m'
    BRIGHT_YELLOW = '\033[93m'
    BRIGHT_BLUE = '\033[94m'
    BRIGHT_MAGENTA = '\033[95m'
    BRIGHT_CYAN = '\033[96m'
    BRIGHT_WHITE = '\033[97m'
    
    # Background colors
    BG_BLACK = '\033[40m'
    BG_RED = '\033[41m'
    BG_GREEN = '\033[42m'
    BG_YELLOW = '\033[43m'
    BG_BLUE = '\033[44m'
    BG_MAGENTA = '\033[45m'
    BG_CYAN = '\033[46m'
    BG_WHITE = '\033[47m'


class BoxStyle:
    """Box drawing characters for terminal UI"""
    # Single line box
    TOP_LEFT = '┌'
    TOP_RIGHT = '┐'
    BOTTOM_LEFT = '└'
    BOTTOM_RIGHT = '┘'
    HORIZONTAL = '─'
    VERTICAL = '│'
    
    # Double line box
    DOUBLE_TOP_LEFT = '╔'
    DOUBLE_TOP_RIGHT = '╗'
    DOUBLE_BOTTOM_LEFT = '╚'
    DOUBLE_BOTTOM_RIGHT = '╝'
    DOUBLE_HORIZONTAL = '═'
    DOUBLE_VERTICAL = '║'
    
    # T-junctions
    T_DOWN = '┬'
    T_UP = '┴'
    T_RIGHT = '├'
    T_LEFT = '┤'
    CROSS = '┼'


@dataclass
class GameState:
    """Simplified game state for display"""
    hole_cards: Optional[List[str]] = None
    community_cards: Optional[List[str]] = None
    pot_size: float = 0.0
    current_bet: float = 0.0
    our_stack: float = 0.0
    position: str = "Unknown"
    players_in_hand: int = 0
    betting_round: str = "Preflop"


@dataclass
class AnalysisResult:
    """Analysis results for display"""
    hand_strength: float = 0.0
    pot_odds: float = 0.0
    implied_odds: float = 0.0
    equity: float = 0.0
    recommended_action: str = "Fold"
    confidence: float = 0.0
    ev_fold: float = 0.0
    ev_call: float = 0.0
    ev_raise: float = 0.0


class ProcessingStatus(Enum):
    IDLE = "idle"
    CAPTURING = "capturing"
    ANALYZING = "analyzing"
    PROCESSING_CV = "processing_cv"
    CALCULATING_ODDS = "calculating_odds"
    GENERATING_STRATEGY = "generating_strategy"
    COMPLETE = "complete"


class PaulieCLI:
    """
    Immersive CLI interface for the Paulie system.
    Provides real-time feedback, analysis display, and professional styling.
    """
    
    def __init__(self, width: int = 100, height: int = 35):
        """
        Initialize the CLI interface
        
        Args:
            width: Terminal width in characters
            height: Terminal height in characters
        """
        self.width = width
        self.height = height
        self.running = False
        self.current_status = ProcessingStatus.IDLE
        self.game_state = GameState()
        self.analysis = AnalysisResult()
        self.last_update = time.time()
        
        # Animation and display state
        self.animation_frame = 0
        self.processing_dots = 0
        self.update_thread = None
        self.status_messages = []
        self.max_status_messages = 8
        
        # Statistics
        self.hands_analyzed = 0
        self.accuracy_rate = 0.985
        self.avg_processing_time = 0.35
        self.uptime_start = time.time()
        
        self._init_terminal()
    
    def _init_terminal(self):
        """Initialize terminal settings"""
        # Clear screen and hide cursor
        print('\033[2J\033[H\033[?25l', end='')
        
        # Set terminal title
        print('\033]0;Paulie v2.1 - Live Analysis\007', end='')
    
    def start(self):
        """Start the CLI interface"""
        self.running = True
        self.uptime_start = time.time()
        
        # Start update thread
        self.update_thread = threading.Thread(target=self._update_loop, daemon=True)
        self.update_thread.start()
        
        # Show initial interface
        self._draw_interface()
        
        # Add startup messages
        self._add_status_message("🤖 Paulie v2.1 initialized", Colors.BRIGHT_GREEN)
        self._add_status_message("🎯 Computer vision engine loaded", Colors.CYAN)
        self._add_status_message("🧠 AI analysis engine ready", Colors.CYAN)
        self._add_status_message("⚡ GPU acceleration enabled", Colors.YELLOW)
        self._add_status_message("🔍 Waiting for poker table...", Colors.WHITE)
    
    def stop(self):
        """Stop the CLI interface"""
        self.running = False
        if self.update_thread:
            self.update_thread.join(timeout=1.0)
        
        # Restore cursor and clear screen
        print('\033[?25h\033[2J\033[H', end='')
    
    def simulate_hand_analysis(self):
        """Simulate a complete hand analysis cycle"""
        if self.current_status != ProcessingStatus.IDLE:
            return
        
        # Simulate the analysis process
        threading.Thread(target=self._simulate_analysis_process, daemon=True).start()
    
    def update_game_state(self, hole_cards: Optional[List[str]] = None,
                         community_cards: Optional[List[str]] = None,
                         pot_size: Optional[float] = None,
                         our_stack: Optional[float] = None):
        """Update the current game state"""
        if hole_cards:
            self.game_state.hole_cards = hole_cards
        if community_cards:
            self.game_state.community_cards = community_cards
        if pot_size is not None:
            self.game_state.pot_size = pot_size
        if our_stack is not None:
            self.game_state.our_stack = our_stack
    
    def _simulate_analysis_process(self):
        """Simulate the complete analysis process with realistic timing"""
        # Stage 1: Screen capture
        self.current_status = ProcessingStatus.CAPTURING
        self._add_status_message("📸 Taking screenshot...", Colors.BRIGHT_BLUE)
        time.sleep(0.1 + random.uniform(0.05, 0.15))
        
        # Stage 2: Computer vision processing
        self.current_status = ProcessingStatus.PROCESSING_CV
        self._add_status_message("🔍 Analyzing image...", Colors.BRIGHT_CYAN)
        time.sleep(0.2 + random.uniform(0.1, 0.2))
        
        self._add_status_message("🎴 Detecting cards...", Colors.CYAN)
        time.sleep(0.15 + random.uniform(0.05, 0.1))
        
        # Simulate card detection
        self._simulate_card_detection()
        
        self._add_status_message("💰 Reading pot size...", Colors.CYAN)
        time.sleep(0.1 + random.uniform(0.03, 0.07))
        
        # Stage 3: AI analysis
        self.current_status = ProcessingStatus.CALCULATING_ODDS
        self._add_status_message("🧮 Calculating hand equity...", Colors.BRIGHT_YELLOW)
        time.sleep(0.2 + random.uniform(0.1, 0.15))
        
        self._add_status_message("📊 Analyzing pot odds...", Colors.YELLOW)
        time.sleep(0.15 + random.uniform(0.05, 0.1))
        
        # Stage 4: Strategy generation
        self.current_status = ProcessingStatus.GENERATING_STRATEGY
        self._add_status_message("⚡ Generating strategy...", Colors.BRIGHT_MAGENTA)
        time.sleep(0.18 + random.uniform(0.07, 0.12))
        
        # Simulate analysis results
        self._simulate_analysis_results()
        
        # Complete
        self.current_status = ProcessingStatus.COMPLETE
        self._add_status_message(f"✅ Analysis complete ({self.avg_processing_time:.2f}s)", Colors.BRIGHT_GREEN)
        
        self.hands_analyzed += 1
        time.sleep(2.0)  # Show results for 2 seconds
        
        self.current_status = ProcessingStatus.IDLE
        self._add_status_message("🔍 Monitoring for next hand...", Colors.WHITE)
    
    def _simulate_card_detection(self):
        """Simulate card detection with random realistic cards"""
        hole_cards = self._generate_random_hole_cards()
        community_cards = self._generate_random_community_cards()
        
        self.game_state.hole_cards = hole_cards
        self.game_state.community_cards = community_cards
        self.game_state.pot_size = random.uniform(50, 500)
        self.game_state.our_stack = random.uniform(800, 2000)
        self.game_state.current_bet = random.uniform(10, 50)
        self.game_state.players_in_hand = random.randint(2, 6)
        
        # Show detected cards
        cards_str = " ".join(hole_cards)
        self._add_status_message(f"🎴 Hole cards detected: {cards_str}", Colors.BRIGHT_WHITE)
        
        if community_cards:
            comm_str = " ".join(community_cards)
            self._add_status_message(f"🃏 Board: {comm_str}", Colors.WHITE)
    
    def _simulate_analysis_results(self):
        """Generate realistic analysis results"""
        # Calculate realistic metrics based on simulated cards
        self.analysis.hand_strength = random.uniform(0.2, 0.95)
        self.analysis.equity = random.uniform(0.15, 0.85)
        self.analysis.pot_odds = random.uniform(0.1, 0.4)
        self.analysis.implied_odds = self.analysis.pot_odds * random.uniform(1.2, 2.5)
        
        # Determine action based on strength
        if self.analysis.hand_strength > 0.8:
            self.analysis.recommended_action = "Raise"
            self.analysis.confidence = random.uniform(0.85, 0.98)
        elif self.analysis.hand_strength > 0.5:
            self.analysis.recommended_action = "Call"
            self.analysis.confidence = random.uniform(0.70, 0.88)
        else:
            self.analysis.recommended_action = "Fold"
            self.analysis.confidence = random.uniform(0.75, 0.95)
        
        # Calculate EVs
        self.analysis.ev_fold = 0.0
        self.analysis.ev_call = random.uniform(-20, 40)
        self.analysis.ev_raise = random.uniform(-30, 60)
    
    def _generate_random_hole_cards(self) -> List[str]:
        """Generate random hole cards"""
        suits = ['♠', '♥', '♦', '♣']
        ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
        
        card1 = random.choice(ranks) + random.choice(suits)
        card2 = random.choice(ranks) + random.choice(suits)
        
        return [card1, card2]
    
    def _generate_random_community_cards(self) -> List[str]:
        """Generate random community cards"""
        suits = ['♠', '♥', '♦', '♣']
        ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
        
        num_cards = random.choice([0, 3, 4, 5])  # Preflop, flop, turn, river
        
        cards = []
        for _ in range(num_cards):
            card = random.choice(ranks) + random.choice(suits)
            cards.append(card)
        
        if num_cards == 3:
            self.game_state.betting_round = "Flop"
        elif num_cards == 4:
            self.game_state.betting_round = "Turn"
        elif num_cards == 5:
            self.game_state.betting_round = "River"
        else:
            self.game_state.betting_round = "Preflop"
        
        return cards
    
    def _add_status_message(self, message: str, color: str = Colors.WHITE):
        """Add a status message to the display"""
        timestamp = time.strftime("%H:%M:%S")
        formatted_message = f"{color}[{timestamp}] {message}{Colors.RESET}"
        
        self.status_messages.append(formatted_message)
        
        # Keep only recent messages
        if len(self.status_messages) > self.max_status_messages:
            self.status_messages.pop(0)
    
    def _update_loop(self):
        """Main update loop for the interface"""
        while self.running:
            self._draw_interface()
            time.sleep(0.1)  # 10 FPS update rate
    
    def _draw_interface(self):
        """Draw the complete interface"""
        # Clear screen and move cursor to top
        print('\033[H', end='')
        
        lines = []
        
        # Header
        lines.extend(self._draw_header())
        
        # Main content area
        lines.extend(self._draw_main_content())
        
        # Footer
        lines.extend(self._draw_footer())
        
        # Output all lines
        for line in lines:
            print(line)
        
        # Increment animation frame
        self.animation_frame += 1
        if self.animation_frame > 100:
            self.animation_frame = 0
    
    def _draw_header(self) -> List[str]:
        """Draw the header section"""
        lines = []
        
        # Top border
        header_line = f"{Colors.BRIGHT_CYAN}{BoxStyle.DOUBLE_TOP_LEFT}"
        header_line += BoxStyle.DOUBLE_HORIZONTAL * (self.width - 2)
        header_line += f"{BoxStyle.DOUBLE_TOP_RIGHT}{Colors.RESET}"
        lines.append(header_line)
        
        # Title line
        title = "🤖 PAULIE v2.1 - LIVE ANALYSIS ENGINE"
        title_padding = (self.width - 2 - len(title)) // 2
        title_line = f"{Colors.BRIGHT_CYAN}{BoxStyle.DOUBLE_VERTICAL}{Colors.RESET}"
        title_line += f"{Colors.BOLD}{Colors.BRIGHT_WHITE}"
        title_line += " " * title_padding + title + " " * (self.width - 2 - len(title) - title_padding)
        title_line += f"{Colors.RESET}{Colors.BRIGHT_CYAN}{BoxStyle.DOUBLE_VERTICAL}{Colors.RESET}"
        lines.append(title_line)
        
        # Status line
        status_text = self._get_status_text()
        status_line = f"{Colors.BRIGHT_CYAN}{BoxStyle.DOUBLE_VERTICAL}{Colors.RESET}"
        status_line += f" {status_text}"
        status_line += " " * (self.width - 3 - len(self._strip_colors(status_text)))
        status_line += f"{Colors.BRIGHT_CYAN}{BoxStyle.DOUBLE_VERTICAL}{Colors.RESET}"
        lines.append(status_line)
        
        # Header bottom border
        bottom_line = f"{Colors.BRIGHT_CYAN}{BoxStyle.T_RIGHT}"
        bottom_line += BoxStyle.HORIZONTAL * (self.width - 2)
        bottom_line += f"{BoxStyle.T_LEFT}{Colors.RESET}"
        lines.append(bottom_line)
        
        return lines
    
    def _draw_main_content(self) -> List[str]:
        """Draw the main content area"""
        lines = []
        
        # Split into three columns
        col1_width = 30
        col2_width = 35
        col3_width = self.width - col1_width - col2_width - 5
        
        # Game state column
        game_lines = self._draw_game_state_box(col1_width)
        
        # Analysis column
        analysis_lines = self._draw_analysis_box(col2_width)
        
        # Status column
        status_lines = self._draw_status_box(col3_width)
        
        # Combine columns
        max_lines = max(len(game_lines), len(analysis_lines), len(status_lines))
        
        for i in range(max_lines):
            line = f"{Colors.BRIGHT_CYAN}{BoxStyle.VERTICAL}{Colors.RESET}"
            
            # Column 1
            if i < len(game_lines):
                line += game_lines[i]
            else:
                line += " " * col1_width
            
            line += f"{Colors.BRIGHT_CYAN}{BoxStyle.VERTICAL}{Colors.RESET}"
            
            # Column 2
            if i < len(analysis_lines):
                line += analysis_lines[i]
            else:
                line += " " * col2_width
            
            line += f"{Colors.BRIGHT_CYAN}{BoxStyle.VERTICAL}{Colors.RESET}"
            
            # Column 3
            if i < len(status_lines):
                line += status_lines[i]
            else:
                line += " " * col3_width
            
            line += f"{Colors.BRIGHT_CYAN}{BoxStyle.VERTICAL}{Colors.RESET}"
            lines.append(line)
        
        return lines
    
    def _draw_game_state_box(self, width: int) -> List[str]:
        """Draw the game state information box"""
        lines = []
        
        # Box title
        title = "🎮 GAME STATE"
        lines.append(f"{Colors.BOLD}{Colors.YELLOW}{title}{Colors.RESET}")
        lines.append("─" * (width - 1))
        
        # Hole cards
        if self.game_state.hole_cards:
            cards = " ".join(self.game_state.hole_cards)
            lines.append(f"{Colors.BRIGHT_WHITE}Hole Cards: {Colors.BRIGHT_YELLOW}{cards}{Colors.RESET}")
        else:
            lines.append(f"{Colors.DIM}Hole Cards: Waiting...{Colors.RESET}")
        
        # Community cards
        if self.game_state.community_cards:
            cards = " ".join(self.game_state.community_cards)
            lines.append(f"{Colors.WHITE}Board: {Colors.CYAN}{cards}{Colors.RESET}")
        else:
            lines.append(f"{Colors.DIM}Board: {self.game_state.betting_round}{Colors.RESET}")
        
        lines.append("")
        
        # Betting info
        lines.append(f"{Colors.WHITE}Pot: {Colors.GREEN}${self.game_state.pot_size:.0f}{Colors.RESET}")
        lines.append(f"{Colors.WHITE}Our Stack: {Colors.GREEN}${self.game_state.our_stack:.0f}{Colors.RESET}")
        lines.append(f"{Colors.WHITE}To Call: {Colors.YELLOW}${self.game_state.current_bet:.0f}{Colors.RESET}")
        lines.append(f"{Colors.WHITE}Players: {Colors.CYAN}{self.game_state.players_in_hand}{Colors.RESET}")
        
        # Pad to consistent height
        while len(lines) < 12:
            lines.append("")
        
        # Ensure all lines fit width
        return [line[:width-1].ljust(width-1) for line in lines]
    
    def _draw_analysis_box(self, width: int) -> List[str]:
        """Draw the analysis results box"""
        lines = []
        
        # Box title
        title = "🧠 AI ANALYSIS"
        lines.append(f"{Colors.BOLD}{Colors.MAGENTA}{title}{Colors.RESET}")
        lines.append("─" * (width - 1))
        
        if self.current_status in [ProcessingStatus.COMPLETE, ProcessingStatus.IDLE] and self.analysis.confidence > 0:
            # Hand strength
            strength_bar = self._create_progress_bar(self.analysis.hand_strength, 20)
            lines.append(f"{Colors.WHITE}Hand Strength:{Colors.RESET}")
            lines.append(f"  {strength_bar} {self.analysis.hand_strength:.1%}")
            
            # Equity
            equity_bar = self._create_progress_bar(self.analysis.equity, 20)
            lines.append(f"{Colors.WHITE}Equity:{Colors.RESET}")
            lines.append(f"  {equity_bar} {self.analysis.equity:.1%}")
            
            lines.append("")
            
            # Recommendation
            action_color = Colors.BRIGHT_GREEN if self.analysis.recommended_action == "Raise" else \
                          Colors.BRIGHT_YELLOW if self.analysis.recommended_action == "Call" else \
                          Colors.BRIGHT_RED
            
            lines.append(f"{Colors.WHITE}Recommendation:{Colors.RESET}")
            lines.append(f"  {action_color}{self.analysis.recommended_action.upper()}{Colors.RESET}")
            lines.append(f"  Confidence: {self.analysis.confidence:.1%}")
            
            lines.append("")
            
            # EVs
            lines.append(f"{Colors.WHITE}Expected Values:{Colors.RESET}")
            lines.append(f"  Fold: {Colors.RED}${self.analysis.ev_fold:.1f}{Colors.RESET}")
            lines.append(f"  Call: {Colors.YELLOW}${self.analysis.ev_call:.1f}{Colors.RESET}")
            lines.append(f"  Raise: {Colors.GREEN}${self.analysis.ev_raise:.1f}{Colors.RESET}")
            
        else:
            # Show processing status
            processing_text = self._get_processing_animation()
            lines.append(f"{Colors.YELLOW}{processing_text}{Colors.RESET}")
            lines.append("")
            
            for i in range(8):
                lines.append(f"{Colors.DIM}...{Colors.RESET}")
        
        # Pad to consistent height
        while len(lines) < 12:
            lines.append("")
        
        # Ensure all lines fit width
        return [line[:width-1].ljust(width-1) for line in lines]
    
    def _draw_status_box(self, width: int) -> List[str]:
        """Draw the status messages box"""
        lines = []
        
        # Box title
        title = "📡 SYSTEM STATUS"
        lines.append(f"{Colors.BOLD}{Colors.CYAN}{title}{Colors.RESET}")
        lines.append("─" * (width - 1))
        
        # Recent status messages
        for message in self.status_messages[-10:]:  # Show last 10 messages
            # Strip colors for width calculation, then truncate if needed
            clean_message = self._strip_colors(message)
            if len(clean_message) > width - 1:
                # Truncate but preserve color codes
                lines.append(message[:width-4] + "...")
            else:
                lines.append(message)
        
        # Pad to consistent height
        while len(lines) < 12:
            lines.append("")
        
        # Ensure all lines fit width
        return [line[:width-1].ljust(width-1) for line in lines]
    
    def _draw_footer(self) -> List[str]:
        """Draw the footer section"""
        lines = []
        
        # Footer separator
        sep_line = f"{Colors.BRIGHT_CYAN}{BoxStyle.T_RIGHT}"
        sep_line += BoxStyle.HORIZONTAL * (self.width - 2)
        sep_line += f"{BoxStyle.T_LEFT}{Colors.RESET}"
        lines.append(sep_line)
        
        # Statistics
        uptime = time.time() - self.uptime_start
        uptime_str = f"{int(uptime // 3600):02d}:{int((uptime % 3600) // 60):02d}:{int(uptime % 60):02d}"
        
        stats = f"📊 Hands: {self.hands_analyzed} | ⚡ Avg: {self.avg_processing_time:.2f}s | 🎯 Accuracy: {self.accuracy_rate:.1%} | ⏱️  Uptime: {uptime_str}"
        
        stats_line = f"{Colors.BRIGHT_CYAN}{BoxStyle.DOUBLE_VERTICAL}{Colors.RESET}"
        stats_line += f" {Colors.WHITE}{stats}{Colors.RESET}"
        stats_line += " " * (self.width - 3 - len(stats))
        stats_line += f"{Colors.BRIGHT_CYAN}{BoxStyle.DOUBLE_VERTICAL}{Colors.RESET}"
        lines.append(stats_line)
        
        # Bottom border
        bottom_line = f"{Colors.BRIGHT_CYAN}{BoxStyle.DOUBLE_BOTTOM_LEFT}"
        bottom_line += BoxStyle.DOUBLE_HORIZONTAL * (self.width - 2)
        bottom_line += f"{BoxStyle.DOUBLE_BOTTOM_RIGHT}{Colors.RESET}"
        lines.append(bottom_line)
        
        return lines
    
    def _get_status_text(self) -> str:
        """Get current status text with animation"""
        if self.current_status == ProcessingStatus.IDLE:
            return f"{Colors.GREEN}● READY{Colors.RESET} - Monitoring for poker table"
        elif self.current_status == ProcessingStatus.CAPTURING:
            return f"{Colors.BRIGHT_BLUE}● CAPTURING{Colors.RESET} - Taking screenshot"
        elif self.current_status == ProcessingStatus.PROCESSING_CV:
            return f"{Colors.BRIGHT_CYAN}● ANALYZING{Colors.RESET} - Processing computer vision"
        elif self.current_status == ProcessingStatus.CALCULATING_ODDS:
            return f"{Colors.BRIGHT_YELLOW}● CALCULATING{Colors.RESET} - Computing hand equity"
        elif self.current_status == ProcessingStatus.GENERATING_STRATEGY:
            return f"{Colors.BRIGHT_MAGENTA}● STRATEGIZING{Colors.RESET} - Generating recommendations"
        elif self.current_status == ProcessingStatus.COMPLETE:
            return f"{Colors.BRIGHT_GREEN}● COMPLETE{Colors.RESET} - Analysis ready"
        else:
            return f"{Colors.WHITE}● UNKNOWN{Colors.RESET}"
    
    def _get_processing_animation(self) -> str:
        """Get animated processing text"""
        dots = "." * (self.animation_frame % 4)
        return f"Processing{dots}"
    
    def _create_progress_bar(self, value: float, width: int) -> str:
        """Create a colored progress bar"""
        filled = int(value * width)
        empty = width - filled
        
        # Color based on value
        if value >= 0.7:
            color = Colors.BRIGHT_GREEN
        elif value >= 0.4:
            color = Colors.BRIGHT_YELLOW
        else:
            color = Colors.BRIGHT_RED
        
        bar = f"{color}{'█' * filled}{Colors.DIM}{'░' * empty}{Colors.RESET}"
        return bar
    
    def _strip_colors(self, text: str) -> str:
        """Remove ANSI color codes from text"""
        import re
        ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
        return ansi_escape.sub('', text)


def main():
    """Demo function to show the CLI in action"""
    cli = PaulieCLI()
    
    try:
        cli.start()
        
        # Simulate poker hands
        while True:
            time.sleep(random.uniform(3, 8))  # Wait between hands
            cli.simulate_hand_analysis()
            
    except KeyboardInterrupt:
        print(f"\n{Colors.BRIGHT_YELLOW}Shutting down Paulie...{Colors.RESET}")
    finally:
        cli.stop()


if __name__ == "__main__":
    main()