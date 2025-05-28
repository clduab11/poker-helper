# Security Integration Guide

This guide provides step-by-step instructions for setting up the complete security pipeline for the CoinPoker Intelligence Assistant, including monitoring, testing, and CI/CD security automation.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Setup](#quick-setup)
- [Security Pipeline Configuration](#security-pipeline-configuration)
- [Monitoring Infrastructure Setup](#monitoring-infrastructure-setup)
- [Security Testing Configuration](#security-testing-configuration)
- [Environment Configuration](#environment-configuration)
- [Verification and Validation](#verification-and-validation)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher  
- **Docker**: Version 20.10.0 or higher (for monitoring stack)
- **Docker Compose**: Version 2.0.0 or higher
- **Git**: Version 2.30.0 or higher

### Required Permissions

- GitHub repository access with Actions enabled
- Docker daemon running with appropriate permissions
- Network access for dependency downloads and monitoring

### Environment Preparation

```bash
# Verify prerequisites
node --version  # Should be 18.0.0+
npm --version   # Should be 8.0.0+
docker --version # Should be 20.10.0+
docker-compose --version # Should be 2.0.0+
```

## Quick Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/yourusername/poker-helper.git
cd poker-helper

# Install dependencies with security audit
npm ci --audit

# Verify installation
npm run test:security
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Configure security settings
cat >> .env << 'EOF'
# Security Configuration
SECURITY_PROFILE=medium
ANTI_DETECTION_ENABLED=true
RANDOMIZE_TIMING=true
MIN_PROCESSING_DELAY_MS=50
MAX_PROCESSING_DELAY_MS=150

# Monitoring Configuration
PERFORMANCE_MONITORING=true
SECURITY_MONITORING=true
RISK_ASSESSMENT_ENABLED=true

# GitHub Actions (for CI/CD security pipeline)
GITHUB_TOKEN=your_github_token_here
REPO_OWNER=yourusername
REPO_NAME=poker-helper
WORKFLOW_ID=security-scan.yml
EOF
```

### 3. Start Security Monitoring

```bash
# Start monitoring infrastructure
cd monitoring
docker-compose up -d

# Verify monitoring services
docker-compose ps
curl http://localhost:9090  # Prometheus
```

### 4. Run Security Validation

```bash
# Return to project root
cd ..

# Run comprehensive security tests
npm run test:security:full

# Generate security report
npm run security:audit
```

## Security Pipeline Configuration

### GitHub Actions Security Workflow

The automated security pipeline runs on every commit and includes multiple security checks.

#### Workflow Triggers

```yaml
# Configured in .github/workflows/security-scan.yml
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  workflow_dispatch:
```

#### Security Jobs Overview

| Job | Purpose | Frequency | Failure Action |
|-----|---------|-----------|----------------|
| **dependency-audit** | NPM vulnerability scanning | Every commit | Block merge |
| **license-check** | License compliance validation | Every commit | Block merge |
| **secret-scan** | Secret/credential detection | Every commit | Block merge |
| **security-tests** | Security regression testing | Every commit | Block merge |
| **codeql-analysis** | Static code security analysis | Every commit | Report only |

#### Configuring GitHub Secrets

Required secrets for the security pipeline:

```bash
# In GitHub repository settings > Secrets and variables > Actions
GITHUB_TOKEN          # For accessing GitHub API
SLACK_WEBHOOK_URL     # For security notifications (optional)
SECURITY_EMAIL        # For critical security alerts (optional)
```

### Pre-commit Hooks Configuration

Security checks run automatically before each commit:

```bash
# Install pre-commit hooks
npm run prepare

# Verify hooks are installed
ls -la .husky/
cat .husky/pre-commit
```

Pre-commit hook includes:
- ESLint security rules
- Dependency vulnerability check
- Secret detection scan
- Basic security test validation

## Monitoring Infrastructure Setup

### Prometheus Configuration

The monitoring stack uses Prometheus for metrics collection and alerting.

#### Starting Monitoring Services

```bash
cd monitoring

# Start all monitoring services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs prometheus
docker-compose logs metrics_file_server
```

#### Service Endpoints

| Service | URL | Purpose |
|---------|-----|---------|
| **Prometheus** | http://localhost:9090 | Metrics collection and querying |
| **Metrics Server** | http://localhost:8080 | Security metrics file serving |
| **Alertmanager** | http://localhost:9093 | Alert management (planned) |
| **Grafana** | http://localhost:3000 | Visualization dashboards (planned) |

### Metrics Collection Scripts

Security metrics are collected through automated scripts:

```bash
# Manual metric collection
cd monitoring

# Collect NPM audit metrics
node scripts/collect-npm-audit-metrics.js

# Collect GitHub Actions metrics
node scripts/collect-github-actions-metrics.js

# Collect Jest test metrics  
node scripts/collect-jest-test-metrics.js

# Collect pre-commit hook metrics
node scripts/collect-pre-commit-metrics.js

# Verify metrics files
ls -la metrics/
```

### Automated Metric Collection

Set up automated collection via cron jobs:

```bash
# Add to crontab (crontab -e)
# Run security metric collection every 5 minutes
*/5 * * * * cd /path/to/poker-helper/monitoring && node scripts/collect-npm-audit-metrics.js
*/10 * * * * cd /path/to/poker-helper/monitoring && node scripts/collect-github-actions-metrics.js
*/15 * * * * cd /path/to/poker-helper/monitoring && node scripts/collect-jest-test-metrics.js
```

## Security Testing Configuration

### Running Security Tests

The project includes comprehensive security tests covering multiple areas:

```bash
# Run all security tests
npm run test:security

# Run specific security test suites
npm run test -- tests/security/VulnerabilityRegression.test.ts
npm run test -- tests/integration/SecurityIntegration.test.ts
npm run test -- --testNamePattern="Security"

# Run tests with coverage
npm run test:security -- --coverage
```

### Security Test Categories

#### 1. Vulnerability Regression Tests

```bash
# Located in: tests/security/VulnerabilityRegression.test.ts
npm run test -- tests/security/VulnerabilityRegression.test.ts --verbose
```

**Coverage includes:**
- Security Manager core functionality
- Detection avoidance strategies
- Process isolation security
- System monitoring security
- Risk assessment mechanisms
- Anti-detection utilities
- Input validation security
- Error handling security

#### 2. Security Integration Tests

```bash
# Located in: tests/integration/SecurityIntegration.test.ts
npm run test -- tests/integration/SecurityIntegration.test.ts --verbose
```

**Coverage includes:**
- End-to-end security workflow testing
- Module interaction security validation
- Performance impact measurement
- Real-world scenario simulation

### Test Configuration

Jest configuration for security tests:

```javascript
// In jest.config.js
module.exports = {
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/tests/**/*.test.tsx'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 30000, // Extended for security tests
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts'
  ]
};
```

## Environment Configuration

### Security Profile Configuration

Configure security levels based on your environment:

```bash
# Development Environment
SECURITY_PROFILE=low
ANTI_DETECTION_ENABLED=false
PERFORMANCE_MONITORING=true
SECURITY_MONITORING=false

# Testing Environment  
SECURITY_PROFILE=medium
ANTI_DETECTION_ENABLED=true
PERFORMANCE_MONITORING=true
SECURITY_MONITORING=true

# Production Environment
SECURITY_PROFILE=high
ANTI_DETECTION_ENABLED=true
PERFORMANCE_MONITORING=true
SECURITY_MONITORING=true
RISK_ASSESSMENT_ENABLED=true
```

### Security Manager Configuration

```typescript
// Example: Programmatic security configuration
import { SecurityManager, SecurityProfile, RiskLevel } from './src/modules/SecurityManager';

const securityProfiles: SecurityProfile[] = [
  {
    name: 'development',
    riskLevel: RiskLevel.Low,
    enabledStrategies: ['RandomizedDelays'],
    description: 'Development environment with minimal security'
  },
  {
    name: 'production',
    riskLevel: RiskLevel.High,
    enabledStrategies: [
      'RandomizedDelays',
      'CPUThrottling', 
      'ProcessIsolation',
      'NetworkObfuscation'
    ],
    description: 'Production environment with full security measures'
  }
];

const securityManager = new SecurityManager(securityProfiles, 'production');
```

### Environment-Specific Settings

```bash
# .env.development
LOG_LEVEL=debug
SECURITY_PROFILE=low
PERFORMANCE_MONITORING=true
SECURITY_MONITORING=false

# .env.testing
LOG_LEVEL=info
SECURITY_PROFILE=medium
PERFORMANCE_MONITORING=true
SECURITY_MONITORING=true

# .env.production
LOG_LEVEL=warn
SECURITY_PROFILE=high
PERFORMANCE_MONITORING=true
SECURITY_MONITORING=true
RISK_ASSESSMENT_ENABLED=true
```

## Verification and Validation

### Security Pipeline Validation

Verify the complete security pipeline is working correctly:

```bash
# 1. Run dependency audit
npm audit --audit-level=moderate

# 2. Check for secrets
npm run security:secrets

# 3. Run security tests
npm run test:security

# 4. Verify monitoring
curl http://localhost:9090/metrics

# 5. Check GitHub Actions
# View workflow runs in GitHub Actions tab

# 6. Validate pre-commit hooks
git add .
git commit -m "test: security pipeline validation"
```

### Security Metrics Validation

Verify security metrics are being collected:

```bash
cd monitoring

# Check metric files exist
ls -la metrics/

# Verify metric content
cat metrics/npm_audit.prom
cat metrics/github_actions.prom
cat metrics/jest_tests.prom

# Query Prometheus metrics
curl http://localhost:9090/api/v1/query?query=npm_vulnerabilities
curl http://localhost:9090/api/v1/query?query=github_workflow_run_status
```

### Performance Impact Assessment

Measure security overhead:

```bash
# Run performance benchmarks
npm run test -- tests/integration/PerformanceBenchmark.test.ts

# Check latency impact
npm run benchmark:security

# Monitor resource usage
npm run monitor:resources
```

## Troubleshooting

### Common Issues

#### 1. Dependencies Installation Fails

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for audit issues
npm audit fix
```

#### 2. Docker Services Won't Start

```bash
# Check Docker daemon
systemctl status docker

# Check port conflicts
netstat -tlnp | grep :9090
netstat -tlnp | grep :8080

# Restart Docker services
cd monitoring
docker-compose down
docker-compose up -d
```

#### 3. Security Tests Failing

```bash
# Run tests with debug output
npm run test:security -- --verbose --no-cache

# Check security manager configuration
npm run debug:security

# Verify test environment
npm run test:env
```

#### 4. GitHub Actions Failing

**Common causes and solutions:**

- **Missing secrets**: Add required GitHub secrets
- **Permission issues**: Verify repository permissions
- **Workflow syntax**: Validate YAML syntax
- **Node version mismatch**: Update workflow Node.js version

```bash
# Validate workflow locally
act pull_request  # Requires 'act' tool

# Check workflow syntax
yamllint .github/workflows/security-scan.yml
```

#### 5. Monitoring Metrics Missing

```bash
# Check metric collection scripts
cd monitoring
node scripts/collect-npm-audit-metrics.js
node scripts/collect-github-actions-metrics.js

# Verify file permissions
ls -la metrics/
chmod 644 metrics/*.prom

# Restart metrics server
docker-compose restart metrics_file_server
```

#### 6. Performance Issues

```bash
# Profile security overhead
npm run profile:security

# Adjust security settings
# Edit .env and reduce security level if needed
SECURITY_PROFILE=low

# Monitor resource usage
npm run monitor:performance
```

### Getting Help

If you encounter issues not covered here:

1. **Check the logs**: Application logs are in `~/.poker-helper/logs`
2. **Review documentation**: See [SECURITY.md](SECURITY.md) for detailed security information
3. **GitHub Issues**: Search existing issues or create a new one
4. **Security Runbook**: See [2_security_runbook.md](2_security_runbook.md) for operational procedures

### Support Information

- **Documentation**: [docs/](docs/)
- **Security Issues**: Follow responsible disclosure in [SECURITY.md](SECURITY.md)
- **General Support**: [GitHub Issues](https://github.com/yourusername/poker-helper/issues)
- **Security Contact**: security@yourproject.com (if applicable)

---

## Next Steps

After completing this integration guide:

1. **Read the Security Runbook**: [2_security_runbook.md](2_security_runbook.md)
2. **Review Security Documentation**: [SECURITY.md](SECURITY.md)
3. **Configure Monitoring Dashboards**: Set up Grafana dashboards (optional)
4. **Implement Alerting**: Configure Alertmanager for security alerts
5. **Schedule Regular Reviews**: Set up periodic security review processes