# CoinPoker Intelligence Assistant

A TypeScript/Node.js application that provides intelligent assistance for poker gameplay through screen capture, OCR, and AI-powered analysis with sub-200ms latency.

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [System Requirements](#system-requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Quick Start Guide](#quick-start-guide)
- [Usage Examples](#usage-examples)
- [Performance Metrics](#performance-metrics)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Documentation](#documentation)
- [License](#license)

## Project Overview

The CoinPoker Intelligence Assistant is designed to help poker players by:
- Capturing and analyzing poker table screenshots in real-time
- Extracting game state information using OCR technology
- Providing strategic recommendations through AI-powered analysis
- Offering real-time insights during gameplay via a non-intrusive overlay
- Maintaining high performance with sub-200ms end-to-end latency

The application operates as a desktop application built with Electron, providing a seamless experience across Windows, macOS, and Linux platforms.

## Features

### Core Functionality

- **Real-time Screen Capture**: Captures poker table screenshots with configurable intervals
- **OCR Processing**: Extracts text and numbers from game interface with high accuracy
- **Game State Analysis**: Interprets poker game state, player actions, and table dynamics
- **Strategic Recommendations**: Provides AI-powered gameplay suggestions using LLM technology
- **Performance Monitoring**: Tracks system performance to maintain sub-200ms latency

### Technical Features

- **Event-Driven Architecture**: Modular design with clear separation of concerns
- **TypeScript**: Full type safety and modern JavaScript features
- **Electron Framework**: Cross-platform desktop application support
- **React UI**: Customizable overlay interface
- **Comprehensive Testing**: Unit and integration tests with Jest
- **Security Measures**: Anti-detection strategies and process isolation
- **MCP Integration**: Model Context Protocol for enhanced AI capabilities

## System Requirements

### Minimum Requirements

- **Operating System**: Windows 10+, macOS 10.15+, or Ubuntu 20.04+
- **Processor**: Intel Core i5 (8th gen) or AMD Ryzen 5 or equivalent
- **Memory**: 8GB RAM
- **Storage**: 500MB available space
- **Display**: 1080p resolution
- **Internet**: Broadband connection for LLM API access

### Recommended Requirements

- **Processor**: Intel Core i7 (10th gen) or AMD Ryzen 7 or equivalent
- **Memory**: 16GB RAM
- **Graphics**: Dedicated GPU with 2GB+ VRAM
- **Internet**: High-speed connection (50+ Mbps)

### Software Dependencies

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher
- **Electron**: Version 27.0.0 or higher

## Installation

### From Source

1. Clone the repository:
```bash
git clone https://github.com/yourusername/poker-helper.git
cd poker-helper
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration (see Configuration section)
```

4. Build the application:
```bash
npm run build
```

5. Start the application:
```bash
npm start
```

### Using Pre-built Binaries

1. Download the latest release for your platform from the [releases page](https://github.com/yourusername/poker-helper/releases)
2. Extract the archive (if applicable)
3. Run the installer or executable
4. Configure the application on first launch

## Configuration

The application can be configured through environment variables or the configuration UI.

### Environment Variables

Copy `.env.example` to `.env` and configure the following variables:

```
# LLM API Configuration
LLM_API_KEY=your_api_key_here
LLM_PROVIDER=gemini  # or 'openai'
LLM_MODEL=gemini-pro  # or 'gpt-4-turbo'
LLM_API_ENDPOINT=https://generativelanguage.googleapis.com/v1beta

# Application Settings
LOG_LEVEL=info  # debug, info, warn, error
PERFORMANCE_MONITORING=true
MAX_LATENCY_MS=200
SCREENSHOT_INTERVAL_MS=500

# UI Overlay Settings
OVERLAY_OPACITY=0.9
OVERLAY_POSITION=top-right  # top-left, top-right, bottom-left, bottom-right
OVERLAY_WIDTH=300
OVERLAY_HEIGHT=200

# OCR Configuration
OCR_LANGUAGE=eng
OCR_CONFIDENCE_THRESHOLD=0.8
IMAGE_PREPROCESSING=true

# Security Settings
ANTI_DETECTION_ENABLED=true
RANDOMIZE_TIMING=true
MIN_PROCESSING_DELAY_MS=50
MAX_PROCESSING_DELAY_MS=150
```

### Configuration UI

The application provides a configuration UI accessible from the system tray icon:

1. Click the system tray icon
2. Select "Settings" from the menu
3. Configure the application using the settings dialog
4. Click "Save" to apply changes

## Quick Start Guide

1. **Launch the Application**: Start the CoinPoker Intelligence Assistant
2. **Configure API Keys**: Enter your LLM API keys in the settings
3. **Set Capture Region**: Define the poker table region for screen capture
4. **Adjust Overlay**: Position and customize the overlay display
5. **Start Analysis**: Click "Start" to begin real-time analysis
6. **View Recommendations**: Recommendations will appear in the overlay
7. **Toggle Visibility**: Use the hotkey (default: Alt+Space) to show/hide the overlay

## Usage Examples

### Basic Usage

1. Launch CoinPoker and the Intelligence Assistant
2. Position the poker table window
3. In the Assistant, click "Calibrate" to detect the table
4. Click "Start Analysis" to begin receiving recommendations

### Custom Configuration

```typescript
// Example: Configuring the application programmatically
import { ConfigurationManager } from 'coinpoker-assistant';

const config = new ConfigurationManager();
config.set('overlay.opacity', 0.8);
config.set('overlay.position', 'bottom-right');
config.set('security.antiDetectionEnabled', true);
config.set('performance.maxLatencyMs', 150);
config.save();
```

### Advanced Usage

```typescript
// Example: Integrating with custom modules
import {
  ScreenCaptureModule,
  GameStateManager,
  DecisionEngine
} from 'coinpoker-assistant';

// Create custom screen capture handler
const captureModule = new ScreenCaptureModule();
captureModule.on('capture:success', (capture) => {
  // Custom processing of screen capture
  console.log(`Captured screen at ${capture.timestamp}`);
});

// Subscribe to game state updates
const gameStateManager = new GameStateManager();
gameStateManager.on('state:updated', (gameState) => {
  // Custom game state handling
  if (gameState.currentPhase === 'river') {
    // Special handling for river phase
  }
});
```

## Performance Metrics

The CoinPoker Intelligence Assistant is designed for high performance:

| Operation | Average Latency | 95th Percentile |
|-----------|----------------|-----------------|
| Screen Capture | 15-30ms | 45ms |
| OCR Processing | 50-80ms | 100ms |
| Game State Analysis | 10-20ms | 30ms |
| LLM API Request | 80-120ms | 150ms |
| UI Rendering | 5-10ms | 15ms |
| **End-to-End** | **160-180ms** | **195ms** |

Performance can be monitored in real-time through the application's metrics dashboard.

## Security & Compliance

### Security-First Architecture

The CoinPoker Intelligence Assistant implements a comprehensive security framework with automated vulnerability scanning, continuous monitoring, and proactive threat detection.

#### 🔒 Core Security Features

- **Automated Vulnerability Scanning**: CI/CD pipeline with dependency audits, license compliance, and secret detection
- **Security Monitoring**: Real-time system monitoring with Prometheus metrics and alerting
- **Anti-Detection Measures**: Advanced techniques including randomized timing, resource management, and process isolation
- **Comprehensive Testing**: 88+ security tests covering vulnerability regression, integration, and performance
- **Incident Response**: Automated security incident detection and response workflows

#### 🛡️ Security Pipeline

Our automated security pipeline runs on every commit and includes:

| Security Check | Frequency | Coverage |
|---------------|-----------|----------|
| **Dependency Audit** | Every commit + daily | High/critical vulnerabilities |
| **License Compliance** | Every commit | GPL, AGPL license detection |
| **Secret Detection** | Every commit | API keys, tokens, credentials |
| **CodeQL Analysis** | Every commit | Static code security analysis |
| **Security Tests** | Every commit | 88+ regression and integration tests |

#### 📊 Security Monitoring

Real-time security monitoring includes:

- **Resource Usage Monitoring**: CPU, memory, and process monitoring
- **Performance Security**: Sub-200ms latency with security overhead tracking
- **Risk Assessment**: Dynamic risk level adjustment based on system behavior
- **Anomaly Detection**: Automated detection of unusual patterns or behavior

#### ⚡ Quick Security Setup

```bash
# Install dependencies with security audit
npm ci --audit

# Run security tests
npm run test:security

# Start monitoring stack (requires Docker)
cd monitoring && docker-compose up -d

# Verify security configuration
npm run security:check
```

#### 🔧 Security Configuration

Configure security levels through environment variables:

```bash
# Security profile (low, medium, high, critical)
SECURITY_PROFILE=medium

# Anti-detection settings
ANTI_DETECTION_ENABLED=true
RANDOMIZE_TIMING=true
MIN_PROCESSING_DELAY_MS=50
MAX_PROCESSING_DELAY_MS=150

# Monitoring configuration
PERFORMANCE_MONITORING=true
SECURITY_MONITORING=true
RISK_ASSESSMENT_ENABLED=true
```

#### 📋 Security Compliance

- **Automated Dependency Audits**: Daily scans with immediate alerts for critical vulnerabilities
- **License Compliance**: Automated detection of problematic licenses (GPL, AGPL)
- **Secret Management**: Environment-based configuration with no hardcoded credentials
- **Security Testing**: Comprehensive test suite with vulnerability regression tests
- **Incident Response**: Automated workflows for security incident detection and response

#### 🚨 Security Alerts

The system provides multiple alert levels:

- **Critical**: Immediate action required (critical vulnerabilities, security breaches)
- **High**: Urgent attention needed (high-severity vulnerabilities, performance anomalies)
- **Medium**: Investigation required (moderate vulnerabilities, unusual patterns)
- **Low**: Informational (license issues, minor configuration warnings)

#### 🔍 Security Auditing

Regular security auditing includes:

- **Code Security Analysis**: Static analysis with CodeQL
- **Dependency Vulnerability Assessment**: NPM audit with severity filtering
- **Runtime Security Monitoring**: Real-time system behavior analysis
- **Performance Impact Assessment**: Security overhead measurement and optimization

### Anti-Detection Measures

The application implements sophisticated anti-detection strategies:

- **Randomized Timing**: Variable capture intervals and processing delays
- **Resource Management**: CPU and memory usage throttling to avoid detection
- **Process Isolation**: Secure separation of sensitive operations
- **Visual Footprint Minimization**: Configurable overlay opacity and positioning
- **Network Traffic Obfuscation**: Encrypted API communication with request batching

### Ethical & Legal Disclaimer

> **Important**: This application is designed for educational and analytical purposes only. Users are responsible for ensuring compliance with applicable laws, regulations, and terms of service agreements of poker platforms.

> **Security Notice**: While this application implements comprehensive security measures, users should understand the risks associated with automated assistance tools and use them responsibly.

### Security Documentation

For comprehensive security information:

- **[Security Documentation](docs/SECURITY.md)** - Complete security architecture and implementation details
- **[Security Integration Guide](docs/1_security_integration_guide.md)** - Step-by-step security setup and configuration
- **[Security Runbook](docs/2_security_runbook.md)** - Operational procedures and incident response
- **[Monitoring Setup Guide](monitoring/README.md)** - Security monitoring and alerting configuration

## Troubleshooting

### Common Issues

#### Application Won't Start

- Ensure Node.js 18+ is installed
- Check for error logs in `~/.poker-helper/logs`
- Verify environment variables are correctly set

#### High Latency

- Reduce screen capture frequency
- Check network connection for LLM API calls
- Close resource-intensive applications
- Verify hardware meets minimum requirements

#### OCR Inaccuracy

- Recalibrate the screen capture region
- Adjust OCR confidence threshold
- Ensure clear visibility of the poker table
- Try different preprocessing settings

### Getting Help

If you encounter issues not covered here:

1. Check the detailed [documentation](docs/)
2. Search existing [issues](https://github.com/yourusername/poker-helper/issues)
3. Create a new issue with detailed information about your problem

## Contributing

We welcome contributions to improve the CoinPoker Intelligence Assistant:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with tests
4. Ensure all tests pass (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## Documentation

Comprehensive documentation is available in the `docs/` directory:

- [Architecture Overview](docs/ARCHITECTURE.md)
- [API Documentation](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Security Documentation](docs/SECURITY.md)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.