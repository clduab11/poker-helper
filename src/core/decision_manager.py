"""
Decision Manager

Synthesizes AI analysis results into actionable recommendations and manages
output delivery through overlay interface, voice synthesis, and logging.
"""

import time
import json
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field, asdict
from enum import Enum
from abc import ABC, abstractmethod

# Internal imports
from .ai_engine import HandAnalysis, Recommendation, ActionType
from .computer_vision import GameState


class OutputChannel(Enum):
    """Available output channels for recommendations"""
    OVERLAY = "overlay"
    VOICE = "voice" 
    API = "api"
    LOG = "log"


class UrgencyLevel(Enum):
    """Urgency levels for recommendations"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class Decision:
    """Final decision output with all contextual information"""
    decision_id: str
    timestamp: float
    game_state_id: str
    
    # Core recommendation
    recommended_action: ActionType
    amount: Optional[float] = None
    confidence: float = 0.0
    
    # Analysis context
    hand_strength: float = 0.0
    equity: float = 0.0
    pot_odds: float = 0.0
    expected_value: float = 0.0
    
    # Reasoning and alternatives
    reasoning: str = ""
    risk_assessment: str = ""
    alternative_actions: List[Dict[str, Any]] = field(default_factory=list)
    
    # Output formatting
    display_text: str = ""
    voice_text: str = ""
    urgency: UrgencyLevel = UrgencyLevel.MEDIUM
    
    # Metadata
    processing_time_ms: float = 0.0
    analysis_confidence: float = 0.0


@dataclass 
class DecisionHistory:
    """Track decision history for learning and analysis"""
    decisions: List[Decision] = field(default_factory=list)
    max_history: int = 1000
    
    def add_decision(self, decision: Decision) -> None:
        """Add decision to history"""
        self.decisions.append(decision)
        
        # Maintain max history size
        if len(self.decisions) > self.max_history:
            self.decisions = self.decisions[-self.max_history:]
    
    def get_recent_decisions(self, count: int = 10) -> List[Decision]:
        """Get most recent decisions"""
        return self.decisions[-count:]
    
    def get_decisions_by_action(self, action: ActionType) -> List[Decision]:
        """Get all decisions for specific action type"""
        return [d for d in self.decisions if d.recommended_action == action]


class OutputFormatter:
    """Formats decisions for different output channels"""
    
    def __init__(self):
        self.format_templates = {
            OutputChannel.OVERLAY: self._format_for_overlay,
            OutputChannel.VOICE: self._format_for_voice,
            OutputChannel.API: self._format_for_api,
            OutputChannel.LOG: self._format_for_log
        }
    
    def format_decision(self, decision: Decision, channel: OutputChannel) -> str:
        """Format decision for specific output channel"""
        formatter = self.format_templates.get(channel)
        if formatter:
            return formatter(decision)
        return str(decision)
    
    def _format_for_overlay(self, decision: Decision) -> str:
        """Format decision for overlay display"""
        lines = []
        
        # Main recommendation
        action_text = decision.recommended_action.value.upper()
        if decision.amount:
            action_text += f" ${decision.amount:.2f}"
        
        lines.append(f"🎯 {action_text}")
        lines.append(f"Confidence: {decision.confidence:.0%}")
        
        # Key metrics
        lines.append(f"Hand Strength: {decision.hand_strength:.0%}")
        lines.append(f"Equity: {decision.equity:.0%}")
        
        if decision.pot_odds > 0:
            lines.append(f"Pot Odds: {decision.pot_odds:.1%}")
        
        # Expected value with color coding
        ev_text = f"EV: {decision.expected_value:+.2f}"
        if decision.expected_value > 0:
            ev_text = f"📈 {ev_text}"
        else:
            ev_text = f"📉 {ev_text}"
        lines.append(ev_text)
        
        # Risk assessment
        risk_emoji = {
            "Low": "🟢",
            "Medium": "🟡", 
            "High": "🔴"
        }
        risk_icon = risk_emoji.get(decision.risk_assessment, "⚪")
        lines.append(f"{risk_icon} Risk: {decision.risk_assessment}")
        
        return "\n".join(lines)
    
    def _format_for_voice(self, decision: Decision) -> str:
        """Format decision for voice synthesis"""
        action = decision.recommended_action.value
        
        # Simple voice message
        voice_text = f"Recommend {action}"
        
        if decision.amount:
            voice_text += f" {decision.amount:.0f} dollars"
        
        # Add confidence if high or low
        if decision.confidence >= 0.9:
            voice_text += " with high confidence"
        elif decision.confidence <= 0.5:
            voice_text += " with low confidence"
        
        # Add key reason
        if "strong" in decision.reasoning.lower():
            voice_text += ". Strong hand"
        elif "weak" in decision.reasoning.lower():
            voice_text += ". Weak hand"
        elif "odds" in decision.reasoning.lower():
            voice_text += ". Good odds"
        
        return voice_text
    
    def _format_for_api(self, decision: Decision) -> str:
        """Format decision as JSON for API consumption"""
        api_data = {
            "decision_id": decision.decision_id,
            "timestamp": decision.timestamp,
            "recommendation": {
                "action": decision.recommended_action.value,
                "amount": decision.amount,
                "confidence": decision.confidence
            },
            "analysis": {
                "hand_strength": decision.hand_strength,
                "equity": decision.equity,
                "pot_odds": decision.pot_odds,
                "expected_value": decision.expected_value
            },
            "reasoning": decision.reasoning,
            "risk": decision.risk_assessment,
            "alternatives": decision.alternative_actions,
            "urgency": decision.urgency.value
        }
        return json.dumps(api_data, indent=2)
    
    def _format_for_log(self, decision: Decision) -> str:
        """Format decision for logging"""
        return (f"[{time.strftime('%H:%M:%S', time.localtime(decision.timestamp))}] "
                f"Decision: {decision.recommended_action.value} "
                f"(Confidence: {decision.confidence:.1%}, "
                f"EV: {decision.expected_value:+.2f}) - {decision.reasoning}")


class DecisionManager:
    """
    Main decision manager that synthesizes AI analysis into actionable
    recommendations and manages output delivery.
    """
    
    def __init__(self, 
                 enable_voice: bool = True,
                 enable_overlay: bool = True,
                 enable_api: bool = False):
        """
        Initialize decision manager
        
        Args:
            enable_voice: Enable voice output
            enable_overlay: Enable overlay display
            enable_api: Enable API output
        """
        self.enable_voice = enable_voice
        self.enable_overlay = enable_overlay
        self.enable_api = enable_api
        
        # Components
        self.formatter = OutputFormatter()
        self.decision_history = DecisionHistory()
        
        # Output callbacks
        self._overlay_callback: Optional[Callable[[str], None]] = None
        self._voice_callback: Optional[Callable[[str], None]] = None
        self._api_callback: Optional[Callable[[str], None]] = None
        
        # Decision tracking
        self._decision_counter = 0
        self._last_decision: Optional[Decision] = None
        
        # Performance stats
        self.stats = {
            "decisions_made": 0,
            "voice_outputs": 0,
            "overlay_updates": 0,
            "api_calls": 0,
            "average_confidence": 0.0
        }
    
    def synthesize_recommendation(self, 
                                analysis: HandAnalysis,
                                game_state: GameState) -> Decision:
        """
        Synthesize AI analysis into final decision
        
        Args:
            analysis: HandAnalysis from AI engine
            game_state: Current game state
            
        Returns:
            Decision object with formatted recommendations
        """
        start_time = time.time()
        self._decision_counter += 1
        
        # Create decision ID
        decision_id = f"decision_{self._decision_counter}_{int(time.time())}"
        
        # Extract core recommendation data
        rec = analysis.recommendation
        
        # Calculate display values
        display_text = self.formatter.format_decision(
            Decision(decision_id, time.time(), "", rec.action), 
            OutputChannel.OVERLAY
        )
        
        voice_text = self.formatter.format_decision(
            Decision(decision_id, time.time(), "", rec.action),
            OutputChannel.VOICE
        )
        
        # Determine urgency based on confidence and situation
        urgency = self._calculate_urgency(analysis, game_state)
        
        # Format alternative actions
        alternatives = [
            {
                "action": alt_action.value,
                "confidence": alt_conf,
                "expected_value": alt_ev
            }
            for alt_action, alt_conf, alt_ev in rec.alternative_actions
        ]
        
        # Create final decision
        decision = Decision(
            decision_id=decision_id,
            timestamp=time.time(),
            game_state_id=f"game_{int(game_state.timestamp)}",
            recommended_action=rec.action,
            amount=rec.amount,
            confidence=rec.confidence,
            hand_strength=analysis.hand_strength.raw_strength,
            equity=analysis.hand_strength.equity,
            pot_odds=analysis.pot_odds,
            expected_value=rec.expected_value,
            reasoning=rec.reasoning,
            risk_assessment=rec.risk_assessment,
            alternative_actions=alternatives,
            display_text=display_text,
            voice_text=voice_text,
            urgency=urgency,
            processing_time_ms=(time.time() - start_time) * 1000,
            analysis_confidence=game_state.confidence_score
        )
        
        # Store decision
        self.decision_history.add_decision(decision)
        self._last_decision = decision
        
        # Update stats
        self._update_stats(decision)
        
        return decision
    
    def format_for_display(self, decision: Decision) -> str:
        """Format decision for overlay display"""
        return self.formatter.format_decision(decision, OutputChannel.OVERLAY)
    
    def trigger_voice_output(self, decision: Decision) -> None:
        """Trigger voice synthesis for decision"""
        if not self.enable_voice or not self._voice_callback:
            return
        
        try:
            voice_text = self.formatter.format_decision(decision, OutputChannel.VOICE)
            self._voice_callback(voice_text)
            self.stats["voice_outputs"] += 1
        except Exception as e:
            print(f"Voice output error: {e}")
    
    def trigger_overlay_update(self, decision: Decision) -> None:
        """Update overlay display with decision"""
        if not self.enable_overlay or not self._overlay_callback:
            return
        
        try:
            display_text = self.formatter.format_decision(decision, OutputChannel.OVERLAY)
            self._overlay_callback(display_text)
            self.stats["overlay_updates"] += 1
        except Exception as e:
            print(f"Overlay update error: {e}")
    
    def trigger_api_output(self, decision: Decision) -> None:
        """Send decision to API callback"""
        if not self.enable_api or not self._api_callback:
            return
        
        try:
            api_data = self.formatter.format_decision(decision, OutputChannel.API)
            self._api_callback(api_data)
            self.stats["api_calls"] += 1
        except Exception as e:
            print(f"API output error: {e}")
    
    def log_decision(self, decision: Decision) -> None:
        """Log decision to console/file"""
        log_text = self.formatter.format_decision(decision, OutputChannel.LOG)
        print(log_text)
    
    def process_and_output(self, 
                          analysis: HandAnalysis,
                          game_state: GameState) -> Decision:
        """
        Complete processing: synthesize decision and trigger all outputs
        
        Args:
            analysis: AI analysis results
            game_state: Current game state
            
        Returns:
            Final decision object
        """
        # Synthesize decision
        decision = self.synthesize_recommendation(analysis, game_state)
        
        # Trigger all enabled outputs
        if self.enable_overlay:
            self.trigger_overlay_update(decision)
        
        if self.enable_voice:
            self.trigger_voice_output(decision)
        
        if self.enable_api:
            self.trigger_api_output(decision)
        
        # Always log
        self.log_decision(decision)
        
        return decision
    
    def get_decision_history(self, count: int = 10) -> List[Decision]:
        """Get recent decision history"""
        return self.decision_history.get_recent_decisions(count)
    
    def get_last_decision(self) -> Optional[Decision]:
        """Get the most recent decision"""
        return self._last_decision
    
    def set_overlay_callback(self, callback: Callable[[str], None]) -> None:
        """Set callback for overlay updates"""
        self._overlay_callback = callback
    
    def set_voice_callback(self, callback: Callable[[str], None]) -> None:
        """Set callback for voice synthesis"""
        self._voice_callback = callback
    
    def set_api_callback(self, callback: Callable[[str], None]) -> None:
        """Set callback for API output"""
        self._api_callback = callback
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get decision manager performance statistics"""
        return self.stats.copy()
    
    def export_decision_history(self, filepath: str) -> None:
        """Export decision history to JSON file"""
        try:
            history_data = {
                "export_timestamp": time.time(),
                "total_decisions": len(self.decision_history.decisions),
                "decisions": [asdict(decision) for decision in self.decision_history.decisions]
            }
            
            with open(filepath, 'w') as f:
                json.dump(history_data, f, indent=2)
                
        except Exception as e:
            print(f"Failed to export decision history: {e}")
    
    # Private methods
    
    def _calculate_urgency(self, 
                          analysis: HandAnalysis, 
                          game_state: GameState) -> UrgencyLevel:
        """Calculate urgency level for decision"""
        
        # High urgency conditions
        if (analysis.recommendation.action == ActionType.ALL_IN or
            analysis.hand_strength.equity > 0.95 or
            analysis.hand_strength.equity < 0.05):
            return UrgencyLevel.HIGH
        
        # Medium urgency conditions  
        if (analysis.recommendation.confidence > 0.8 or
            analysis.pot_odds > 0.4):
            return UrgencyLevel.MEDIUM
        
        # Low urgency for routine decisions
        if analysis.recommendation.confidence > 0.6:
            return UrgencyLevel.LOW
        
        # Critical for very uncertain situations
        return UrgencyLevel.CRITICAL
    
    def _update_stats(self, decision: Decision) -> None:
        """Update performance statistics"""
        self.stats["decisions_made"] += 1
        
        # Update average confidence
        total_decisions = self.stats["decisions_made"]
        current_avg = self.stats["average_confidence"]
        new_avg = ((current_avg * (total_decisions - 1)) + decision.confidence) / total_decisions
        self.stats["average_confidence"] = new_avg


# Convenience functions
def create_decision_manager(voice: bool = True, 
                          overlay: bool = True, 
                          api: bool = False) -> DecisionManager:
    """Create a new decision manager with specified output options"""
    return DecisionManager(voice, overlay, api)


def format_decision_summary(decision: Decision) -> str:
    """Get a brief summary of a decision"""
    action = decision.recommended_action.value.upper()
    if decision.amount:
        action += f" ${decision.amount:.2f}"
    
    return (f"{action} ({decision.confidence:.0%} confidence, "
            f"{decision.expected_value:+.2f} EV)")