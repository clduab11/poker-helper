"""
Performance Monitoring and Optimization Utilities for Paulie

Tracks system performance metrics and ensures targets are met:
- 99.5%+ accuracy
- Sub-500ms response times
"""

import time
import psutil
import logging
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from collections import deque
import threading
import json


@dataclass
class PerformanceMetrics:
    """Container for performance metrics"""
    timestamp: float
    processing_time_ms: float
    accuracy: float
    memory_usage_mb: float
    cpu_usage_percent: float
    gpu_usage_percent: Optional[float] = None
    component: str = "system"
    success: bool = True


class PerformanceMonitor:
    """
    Real-time performance monitoring for Paulie poker analysis system.
    Tracks accuracy, response times, and resource usage.
    """
    
    def __init__(self, target_accuracy: float = 0.995, target_response_ms: float = 500):
        """
        Initialize performance monitor
        
        Args:
            target_accuracy: Target accuracy threshold (99.5%)
            target_response_ms: Target response time in milliseconds (500ms)
        """
        self.target_accuracy = target_accuracy
        self.target_response_ms = target_response_ms
        
        # Metrics storage
        self.metrics_history = deque(maxlen=10000)
        self.component_metrics: Dict[str, deque] = {}
        
        # Real-time stats
        self.total_operations = 0
        self.successful_operations = 0
        self.total_processing_time = 0.0
        
        # Performance alerts
        self.alerts: List[str] = []
        self.alert_callbacks: List[Callable[[str], None]] = []
        
        # Resource monitoring
        self.process = psutil.Process()
        self.start_time = time.time()
        
        # Component-specific trackers
        self.component_stats = {
            'screen_capture': {'count': 0, 'total_time': 0.0, 'errors': 0},
            'card_detection': {'count': 0, 'total_time': 0.0, 'accuracy': 0.0},
            'ocr': {'count': 0, 'total_time': 0.0, 'accuracy': 0.0},
            'ai_analysis': {'count': 0, 'total_time': 0.0, 'accuracy': 0.0},
            'decision_output': {'count': 0, 'total_time': 0.0, 'errors': 0}
        }
        
        # GPU monitoring (if available)
        self.gpu_available = self._check_gpu_availability()
    
    def _check_gpu_availability(self) -> bool:
        """Check if GPU monitoring is available"""
        try:
            import pynvml
            pynvml.nvmlInit()
            return True
        except:
            return False
    
    def record_operation(self, component: str, processing_time_ms: float, 
                        accuracy: Optional[float] = None, success: bool = True):
        """
        Record a single operation's performance metrics
        
        Args:
            component: Component name (e.g., 'card_detection', 'ai_analysis')
            processing_time_ms: Processing time in milliseconds
            accuracy: Accuracy score (0-1) if applicable
            success: Whether operation was successful
        """
        # Get current resource usage
        memory_mb = self.process.memory_info().rss / 1024 / 1024
        cpu_percent = self.process.cpu_percent(interval=0.1)
        gpu_percent = self._get_gpu_usage() if self.gpu_available else None
        
        # Create metrics record
        metrics = PerformanceMetrics(
            timestamp=time.time(),
            processing_time_ms=processing_time_ms,
            accuracy=accuracy or 1.0,
            memory_usage_mb=memory_mb,
            cpu_usage_percent=cpu_percent,
            gpu_usage_percent=gpu_percent,
            component=component,
            success=success
        )
        
        # Store metrics
        self.metrics_history.append(metrics)
        
        if component not in self.component_metrics:
            self.component_metrics[component] = deque(maxlen=1000)
        self.component_metrics[component].append(metrics)
        
        # Update statistics
        self.total_operations += 1
        if success:
            self.successful_operations += 1
        self.total_processing_time += processing_time_ms
        
        # Update component stats
        if component in self.component_stats:
            stats = self.component_stats[component]
            stats['count'] += 1
            stats['total_time'] += processing_time_ms
            if accuracy is not None:
                # Update running average accuracy
                prev_avg = stats['accuracy']
                stats['accuracy'] = (prev_avg * (stats['count'] - 1) + accuracy) / stats['count']
            if not success:
                stats['errors'] = stats.get('errors', 0) + 1
        
        # Check performance targets
        self._check_performance_targets(metrics)
    
    def _get_gpu_usage(self) -> Optional[float]:
        """Get current GPU usage percentage"""
        if not self.gpu_available:
            return None
        
        try:
            import pynvml
            handle = pynvml.nvmlDeviceGetHandleByIndex(0)
            util = pynvml.nvmlDeviceGetUtilizationRates(handle)
            return float(util.gpu)
        except:
            return None
    
    def _check_performance_targets(self, metrics: PerformanceMetrics):
        """Check if performance targets are being met"""
        # Check response time
        if metrics.processing_time_ms > self.target_response_ms:
            alert = f"Response time {metrics.processing_time_ms:.1f}ms exceeds target {self.target_response_ms}ms for {metrics.component}"
            self._raise_alert(alert)
        
        # Check accuracy
        if metrics.accuracy < self.target_accuracy:
            alert = f"Accuracy {metrics.accuracy:.3f} below target {self.target_accuracy} for {metrics.component}"
            self._raise_alert(alert)
        
        # Check resource usage
        if metrics.memory_usage_mb > 100:  # 100MB threshold
            alert = f"High memory usage: {metrics.memory_usage_mb:.1f}MB"
            self._raise_alert(alert)
        
        if metrics.cpu_usage_percent > 50:  # 50% CPU threshold
            alert = f"High CPU usage: {metrics.cpu_usage_percent:.1f}%"
            self._raise_alert(alert)
    
    def _raise_alert(self, alert_message: str):
        """Raise performance alert"""
        self.alerts.append(alert_message)
        logging.warning(f"Performance Alert: {alert_message}")
        
        # Notify callbacks
        for callback in self.alert_callbacks:
            try:
                callback(alert_message)
            except Exception as e:
                logging.error(f"Alert callback error: {e}")
    
    def add_alert_callback(self, callback: Callable[[str], None]):
        """Add callback for performance alerts"""
        self.alert_callbacks.append(callback)
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """Get comprehensive performance summary"""
        if self.total_operations == 0:
            return {
                'status': 'No operations recorded',
                'uptime_seconds': time.time() - self.start_time
            }
        
        # Calculate overall metrics
        avg_response_time = self.total_processing_time / self.total_operations
        success_rate = self.successful_operations / self.total_operations
        
        # Get recent metrics for trend analysis
        recent_metrics = list(self.metrics_history)[-100:]
        recent_avg_time = sum(m.processing_time_ms for m in recent_metrics) / len(recent_metrics) if recent_metrics else 0
        recent_avg_accuracy = sum(m.accuracy for m in recent_metrics) / len(recent_metrics) if recent_metrics else 0
        
        # Component performance
        component_summary = {}
        for comp, stats in self.component_stats.items():
            if stats['count'] > 0:
                component_summary[comp] = {
                    'operations': stats['count'],
                    'avg_time_ms': stats['total_time'] / stats['count'],
                    'accuracy': stats.get('accuracy', 1.0),
                    'error_rate': stats.get('errors', 0) / stats['count']
                }
        
        return {
            'uptime_seconds': time.time() - self.start_time,
            'total_operations': self.total_operations,
            'success_rate': success_rate,
            'overall_metrics': {
                'avg_response_time_ms': avg_response_time,
                'meets_response_target': avg_response_time <= self.target_response_ms,
                'recent_avg_time_ms': recent_avg_time,
                'recent_avg_accuracy': recent_avg_accuracy,
                'meets_accuracy_target': recent_avg_accuracy >= self.target_accuracy
            },
            'component_performance': component_summary,
            'resource_usage': {
                'current_memory_mb': self.process.memory_info().rss / 1024 / 1024,
                'current_cpu_percent': self.process.cpu_percent(interval=0.1),
                'current_gpu_percent': self._get_gpu_usage() if self.gpu_available else None
            },
            'recent_alerts': self.alerts[-10:],  # Last 10 alerts
            'performance_grade': self._calculate_performance_grade(avg_response_time, recent_avg_accuracy)
        }
    
    def _calculate_performance_grade(self, avg_response_time: float, avg_accuracy: float) -> str:
        """Calculate overall performance grade"""
        if avg_response_time <= self.target_response_ms and avg_accuracy >= self.target_accuracy:
            return "A+ (Exceeds all targets)"
        elif avg_response_time <= self.target_response_ms * 1.1 and avg_accuracy >= self.target_accuracy * 0.99:
            return "A (Meets targets)"
        elif avg_response_time <= self.target_response_ms * 1.25 and avg_accuracy >= self.target_accuracy * 0.95:
            return "B (Acceptable)"
        elif avg_response_time <= self.target_response_ms * 1.5 and avg_accuracy >= self.target_accuracy * 0.90:
            return "C (Needs improvement)"
        else:
            return "D (Below standards)"
    
    def record_frame_processed(self, processing_time: float, success: bool = True):
        """Convenience method for recording frame processing"""
        self.record_operation('frame_processing', processing_time, success=success)
    
    def export_metrics(self, filepath: str):
        """Export performance metrics to JSON file"""
        try:
            summary = self.get_performance_summary()
            
            # Add detailed metrics history
            summary['metrics_history'] = [
                {
                    'timestamp': m.timestamp,
                    'component': m.component,
                    'processing_time_ms': m.processing_time_ms,
                    'accuracy': m.accuracy,
                    'memory_mb': m.memory_usage_mb,
                    'cpu_percent': m.cpu_usage_percent,
                    'gpu_percent': m.gpu_usage_percent
                }
                for m in list(self.metrics_history)[-1000:]  # Last 1000 records
            ]
            
            with open(filepath, 'w') as f:
                json.dump(summary, f, indent=2)
                
            logging.info(f"Performance metrics exported to {filepath}")
            
        except Exception as e:
            logging.error(f"Failed to export metrics: {e}")
    
    def reset_metrics(self):
        """Reset all performance metrics"""
        self.metrics_history.clear()
        self.component_metrics.clear()
        self.total_operations = 0
        self.successful_operations = 0
        self.total_processing_time = 0.0
        self.alerts.clear()
        
        for stats in self.component_stats.values():
            stats['count'] = 0
            stats['total_time'] = 0.0
            stats['accuracy'] = 0.0
            stats['errors'] = 0
    
    def start_monitoring_thread(self, interval: float = 60.0):
        """Start background thread for periodic performance reporting"""
        def monitor_loop():
            while True:
                time.sleep(interval)
                summary = self.get_performance_summary()
                logging.info(f"Performance Report: Grade={summary['performance_grade']}, "
                           f"Avg Response={summary['overall_metrics']['avg_response_time_ms']:.1f}ms, "
                           f"Accuracy={summary['overall_metrics']['recent_avg_accuracy']:.3f}")
        
        thread = threading.Thread(target=monitor_loop, daemon=True)
        thread.start()


# Singleton instance
_monitor_instance = None

def get_performance_monitor() -> PerformanceMonitor:
    """Get singleton performance monitor instance"""
    global _monitor_instance
    if _monitor_instance is None:
        _monitor_instance = PerformanceMonitor()
    return _monitor_instance