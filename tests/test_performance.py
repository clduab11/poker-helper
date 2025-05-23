"""
Performance Tests for Poker Helper System

Tests performance metrics and targets:
- Response time < 500ms
- Accuracy > 99.5%
- Memory usage < 50MB
"""

import unittest
import time
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from src.utils.performance import PerformanceMonitor, PerformanceMetrics


class TestPerformanceMonitor(unittest.TestCase):
    """Test performance monitoring functionality"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.monitor = PerformanceMonitor(target_accuracy=0.995, target_response_ms=500)
    
    def test_performance_metrics_creation(self):
        """Test creation of performance metrics"""
        metrics = PerformanceMetrics(
            timestamp=time.time(),
            processing_time_ms=250.0,
            accuracy=0.998,
            memory_usage_mb=35.0,
            cpu_usage_percent=15.0,
            component="test_component",
            success=True
        )
        
        self.assertIsInstance(metrics, PerformanceMetrics)
        self.assertEqual(metrics.processing_time_ms, 250.0)
        self.assertEqual(metrics.accuracy, 0.998)
        self.assertEqual(metrics.component, "test_component")
        self.assertTrue(metrics.success)
    
    def test_record_operation_success(self):
        """Test recording successful operations"""
        # Record a successful operation
        self.monitor.record_operation(
            component="card_detection",
            processing_time_ms=180.0,
            accuracy=0.999,
            success=True
        )
        
        stats = self.monitor.get_performance_stats()
        
        self.assertEqual(stats['frames_processed'], 1)
        self.assertEqual(stats['avg_processing_time'], 180.0)
        self.assertEqual(stats['success_rate'], 1.0)
    
    def test_performance_targets_met(self):
        """Test that good performance doesn't trigger alerts"""
        initial_alert_count = len(self.monitor.alerts)
        
        # Record operation that meets all targets
        self.monitor.record_operation(
            component="ai_analysis",
            processing_time_ms=300.0,  # Under 500ms target
            accuracy=0.997,  # Above 99.5% target
            success=True
        )
        
        # Should not trigger any new alerts
        self.assertEqual(len(self.monitor.alerts), initial_alert_count)
    
    def test_performance_targets_exceeded(self):
        """Test that poor performance triggers alerts"""
        initial_alert_count = len(self.monitor.alerts)
        
        # Record operation that exceeds response time target
        self.monitor.record_operation(
            component="slow_component",
            processing_time_ms=750.0,  # Over 500ms target
            accuracy=0.990,  # Below 99.5% target
            success=True
        )
        
        # Should trigger alerts
        self.assertGreater(len(self.monitor.alerts), initial_alert_count)
        
        # Check that alerts contain expected messages
        recent_alerts = self.monitor.alerts[-2:]
        alert_text = " ".join(recent_alerts)
        
        self.assertIn("Response time", alert_text)
        self.assertIn("Accuracy", alert_text)
    
    def test_component_statistics(self):
        """Test component-specific statistics tracking"""
        # Record multiple operations for the same component
        for i in range(5):
            self.monitor.record_operation(
                component="card_detection",
                processing_time_ms=200.0 + i * 10,  # 200, 210, 220, 230, 240
                accuracy=0.995 + i * 0.001,  # Increasing accuracy
                success=True
            )
        
        # Check component stats
        card_stats = self.monitor.component_stats['card_detection']
        
        self.assertEqual(card_stats['count'], 5)
        self.assertEqual(card_stats['total_time'], 1100.0)  # Sum of processing times
        self.assertEqual(card_stats['errors'], 0)
        
        # Check average accuracy calculation
        expected_avg_accuracy = (0.995 + 0.996 + 0.997 + 0.998 + 0.999) / 5
        self.assertAlmostEqual(card_stats['accuracy'], expected_avg_accuracy, places=3)
    
    def test_multiple_components(self):
        """Test tracking multiple components separately"""
        components = ['screen_capture', 'card_detection', 'ai_analysis']
        
        for i, component in enumerate(components):
            self.monitor.record_operation(
                component=component,
                processing_time_ms=100.0 * (i + 1),
                accuracy=0.99 + i * 0.001,
                success=True
            )
        
        stats = self.monitor.get_performance_stats()
        
        # Should have 3 total operations
        self.assertEqual(stats['frames_processed'], 3)
        
        # Each component should have 1 operation
        for component in components:
            comp_stats = self.monitor.component_stats[component]
            self.assertEqual(comp_stats['count'], 1)
    
    def test_frame_processing_convenience_method(self):
        """Test convenience method for frame processing"""
        self.monitor.record_frame_processed(processing_time=250.0, success=True)
        
        stats = self.monitor.get_performance_stats()
        self.assertEqual(stats['frames_processed'], 1)
        self.assertEqual(stats['avg_processing_time'], 250.0)


class TestPerformanceBenchmarks(unittest.TestCase):
    """Benchmark tests to ensure performance targets are realistic"""
    
    def test_monitor_overhead(self):
        """Test that performance monitoring itself has minimal overhead"""
        monitor = PerformanceMonitor()
        
        # Measure time to record 1000 operations
        start_time = time.time()
        
        for i in range(1000):
            monitor.record_operation(
                component="benchmark_test",
                processing_time_ms=100.0,
                accuracy=0.999,
                success=True
            )
        
        total_time = (time.time() - start_time) * 1000  # Convert to milliseconds
        avg_overhead = total_time / 1000
        
        # Monitoring overhead should be less than 1ms per operation
        self.assertLess(avg_overhead, 1.0, 
                       f"Performance monitoring overhead too high: {avg_overhead:.2f}ms per operation")
    
    def test_memory_usage_tracking(self):
        """Test that memory usage is tracked correctly"""
        monitor = PerformanceMonitor()
        
        # Record operation (this will trigger memory measurement)
        monitor.record_operation(
            component="memory_test",
            processing_time_ms=100.0,
            accuracy=0.999,
            success=True
        )
        
        # Check that memory metrics were recorded
        latest_metrics = list(monitor.metrics_history)[-1]
        
        self.assertIsInstance(latest_metrics.memory_usage_mb, float)
        self.assertGreater(latest_metrics.memory_usage_mb, 0)
        
        # Memory usage should be reasonable for this test
        self.assertLess(latest_metrics.memory_usage_mb, 500,  # Less than 500MB
                       f"Unexpected high memory usage: {latest_metrics.memory_usage_mb:.1f}MB")


if __name__ == '__main__':
    # Run performance tests
    unittest.main(verbosity=2)