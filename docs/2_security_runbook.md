# Security Runbook

This runbook provides operational procedures for managing the security of the CoinPoker Intelligence Assistant, including daily operations, incident response, maintenance tasks, and performance monitoring.

## Table of Contents

- [Daily Security Operations](#daily-security-operations)
- [Incident Response Procedures](#incident-response-procedures)
- [Security Maintenance Tasks](#security-maintenance-tasks)
- [Performance Monitoring](#performance-monitoring)
- [Emergency Procedures](#emergency-procedures)
- [Escalation Matrix](#escalation-matrix)
- [Security Metrics and KPIs](#security-metrics-and-kpis)

## Daily Security Operations

### Morning Security Checklist

Execute daily security checks to ensure system integrity and identify potential issues.

#### 1. System Health Verification

```bash
# Check security monitoring services
cd monitoring
docker-compose ps

# Verify Prometheus is collecting metrics
curl -s http://localhost:9090/api/v1/query?query=up | jq '.data.result'

# Check metrics file server
curl -s http://localhost:8080/metrics/npm_audit.prom | head -5
```

#### 2. Security Metrics Review

```bash
# Review overnight security scans
cd monitoring

# Check NPM audit results
node scripts/collect-npm-audit-metrics.js
cat metrics/npm_audit.prom | grep npm_vulnerabilities

# Review GitHub Actions security runs
node scripts/collect-github-actions-metrics.js
cat metrics/github_actions.prom | grep github_workflow_run_status
```

#### 3. Log Analysis

```bash
# Check application logs for security events
tail -100 ~/.poker-helper/logs/security.log | grep -E "(ERROR|WARN|SECURITY)"

# Review system performance logs
tail -50 ~/.poker-helper/logs/performance.log | grep -E "(latency|resource)"

# Check for failed security tests
npm run test:security -- --silent | grep -E "(FAIL|ERROR)"
```

### Security Status Dashboard

Monitor key security indicators throughout the day:

| Metric | Good | Warning | Critical | Action |
|--------|------|---------|----------|--------|
| **Vulnerabilities** | 0 critical/high | 1-2 high | 3+ high or any critical | Immediate fix |
| **Test Failures** | 0 failures | 1-2 failures | 3+ failures | Investigate |
| **Resource Usage** | <70% CPU/Memory | 70-85% | >85% | Throttle/optimize |
| **Latency** | <200ms | 200-300ms | >300ms | Performance review |
| **Failed Builds** | 0 failed | 1 failed | 2+ failed | Code review |

### Automated Monitoring Commands

```bash
#!/bin/bash
# save as: scripts/daily-security-check.sh

echo "=== Daily Security Check $(date) ==="

# 1. Check service health
echo "1. Service Health:"
cd monitoring && docker-compose ps --format "table {{.Name}}\t{{.Status}}"

# 2. Collect fresh metrics
echo "2. Collecting Metrics:"
node scripts/collect-npm-audit-metrics.js
node scripts/collect-github-actions-metrics.js

# 3. Check for vulnerabilities
echo "3. Vulnerability Status:"
CRITICAL=$(cat metrics/npm_audit.prom | grep 'npm_vulnerabilities{severity="critical"}' | cut -d' ' -f2)
HIGH=$(cat metrics/npm_audit.prom | grep 'npm_vulnerabilities{severity="high"}' | cut -d' ' -f2)
echo "Critical: ${CRITICAL:-0}, High: ${HIGH:-0}"

# 4. Check recent workflow status
echo "4. Recent Workflow Status:"
WORKFLOW_STATUS=$(cat metrics/github_actions.prom | grep 'github_workflow_run_status{status="success"}' | cut -d' ' -f2)
echo "Success Rate: ${WORKFLOW_STATUS:-0}%"

# 5. Performance check
echo "5. Performance Check:"
cd ..
npm run test:performance -- --silent | tail -3

echo "=== Check Complete ==="
```

## Incident Response Procedures

### Incident Classification

#### Severity Levels

| Level | Description | Response Time | Escalation |
|-------|-------------|---------------|------------|
| **P0 - Critical** | Security breach, critical vulnerabilities | Immediate | Security team + Management |
| **P1 - High** | High-severity vulnerabilities, test failures | 1 hour | Security team |
| **P2 - Medium** | Moderate issues, performance degradation | 4 hours | Development team |
| **P3 - Low** | Minor issues, informational alerts | 24 hours | Regular workflow |

### Critical Security Incident Response

#### Step 1: Immediate Assessment

```bash
# Emergency security assessment script
#!/bin/bash
# save as: scripts/emergency-security-assessment.sh

echo "=== EMERGENCY SECURITY ASSESSMENT ==="
echo "Timestamp: $(date)"
echo "Operator: $(whoami)"

# Check for active vulnerabilities
echo "1. VULNERABILITY SCAN:"
npm audit --audit-level=critical --json > emergency-audit.json
CRITICAL_COUNT=$(cat emergency-audit.json | jq '.metadata.vulnerabilities.critical // 0')
HIGH_COUNT=$(cat emergency-audit.json | jq '.metadata.vulnerabilities.high // 0')

echo "Critical vulnerabilities: $CRITICAL_COUNT"
echo "High vulnerabilities: $HIGH_COUNT"

if [ "$CRITICAL_COUNT" -gt 0 ] || [ "$HIGH_COUNT" -gt 5 ]; then
    echo "🚨 SECURITY ALERT: Immediate action required"
else
    echo "✅ No critical security issues detected"
fi

# Check system integrity
echo "2. SYSTEM INTEGRITY:"
npm run test:security -- --silent
TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -ne 0 ]; then
    echo "🚨 SECURITY TEST FAILURES DETECTED"
else
    echo "✅ Security tests passing"
fi

# Check for secret exposure
echo "3. SECRET SCAN:"
# Run TruffleHog scan on recent commits
if command -v trufflehog &> /dev/null; then
    trufflehog git file://. --since-commit HEAD~10 --fail
    SECRET_EXIT_CODE=$?
    if [ $SECRET_EXIT_CODE -ne 0 ]; then
        echo "🚨 POTENTIAL SECRETS DETECTED"
    else
        echo "✅ No secrets detected in recent commits"
    fi
fi

echo "=== ASSESSMENT COMPLETE ==="
```

#### Step 2: Immediate Containment

```bash
# Emergency containment procedures
#!/bin/bash
# save as: scripts/emergency-containment.sh

echo "=== EMERGENCY CONTAINMENT ==="

# 1. Stop application if running
echo "1. Stopping application..."
pkill -f "poker-helper" || echo "Application not running"

# 2. Switch to maximum security profile
echo "2. Enabling maximum security..."
cat > .env.emergency << 'EOF'
SECURITY_PROFILE=critical
ANTI_DETECTION_ENABLED=true
PERFORMANCE_MONITORING=true
SECURITY_MONITORING=true
RISK_ASSESSMENT_ENABLED=true
EMERGENCY_MODE=true
EOF

# 3. Backup current state
echo "3. Creating emergency backup..."
mkdir -p emergency-backup/$(date +%Y%m%d-%H%M%S)
cp -r logs/ emergency-backup/$(date +%Y%m%d-%H%M%S)/
cp .env emergency-backup/$(date +%Y%m%d-%H%M%S)/

# 4. Enable enhanced logging
echo "4. Enabling enhanced logging..."
export LOG_LEVEL=debug
export SECURITY_MONITORING=true

echo "=== CONTAINMENT COMPLETE ==="
```

#### Step 3: Investigation and Remediation

1. **Evidence Collection**
   ```bash
   # Collect security evidence
   mkdir -p incident-$(date +%Y%m%d-%H%M%S)
   
   # Collect logs
   cp -r logs/ incident-$(date +%Y%m%d-%H%M%S)/
   
   # Collect system state
   npm audit --json > incident-$(date +%Y%m%d-%H%M%S)/audit-report.json
   
   # Collect test results
   npm run test:security -- --json > incident-$(date +%Y%m%d-%H%M%S)/test-results.json
   
   # Collect monitoring data
   cp -r monitoring/metrics/ incident-$(date +%Y%m%d-%H%M%S)/
   ```

2. **Root Cause Analysis**
   - Review security test failures
   - Analyze vulnerability reports
   - Check recent code changes
   - Review system logs for anomalies

3. **Remediation Steps**
   ```bash
   # Common remediation actions
   
   # Update vulnerable dependencies
   npm audit fix --force
   
   # Regenerate security configurations
   npm run security:reset
   
   # Clear potentially compromised data
   npm run security:clean
   
   # Restart with clean state
   npm run start:secure
   ```

### Vulnerability Response Workflow

#### High/Critical Vulnerability Detected

```bash
#!/bin/bash
# Vulnerability response script
echo "=== VULNERABILITY RESPONSE ==="

# 1. Assess vulnerability impact
npm audit --audit-level=moderate --json > vuln-assessment.json

# 2. Check if vulnerability affects running code
AFFECTED_PACKAGES=$(cat vuln-assessment.json | jq -r '.vulnerabilities | keys[]')
echo "Affected packages: $AFFECTED_PACKAGES"

# 3. Apply fixes
echo "Applying vulnerability fixes..."
npm audit fix

# 4. Test fixes
echo "Testing fixes..."
npm run test:security

# 5. Deploy fixes if tests pass
if [ $? -eq 0 ]; then
    echo "✅ Fixes applied successfully"
    git add package*.json
    git commit -m "security: fix vulnerabilities"
else
    echo "❌ Fixes failed validation"
    exit 1
fi
```

## Security Maintenance Tasks

### Weekly Security Tasks

#### 1. Dependency Updates and Security Review

```bash
#!/bin/bash
# Weekly security maintenance
echo "=== WEEKLY SECURITY MAINTENANCE ==="

# 1. Update dependencies
echo "1. Updating dependencies..."
npm update
npm audit

# 2. Review security policies
echo "2. Reviewing security policies..."
npm run security:policy-check

# 3. Update security configurations
echo "3. Updating security configurations..."
npm run security:config-update

# 4. Full security test suite
echo "4. Running full security test suite..."
npm run test:security:comprehensive

# 5. Performance impact assessment
echo "5. Assessing security performance impact..."
npm run benchmark:security

echo "=== MAINTENANCE COMPLETE ==="
```

#### 2. Security Metrics Analysis

```bash
# Weekly metrics analysis
cd monitoring

# Collect week's worth of metrics
for i in {0..6}; do
    date_str=$(date -d "$i days ago" +%Y-%m-%d)
    echo "Analyzing metrics for $date_str"
    
    # Archive daily metrics
    mkdir -p archive/$date_str
    cp metrics/*.prom archive/$date_str/
done

# Generate weekly report
echo "=== WEEKLY SECURITY REPORT ===" > weekly-report.md
echo "Period: $(date -d '6 days ago' +%Y-%m-%d) to $(date +%Y-%m-%d)" >> weekly-report.md
echo "" >> weekly-report.md

# Analyze vulnerability trends
echo "## Vulnerability Trends" >> weekly-report.md
echo "Critical: $(grep -h 'critical' archive/*/npm_audit.prom | tail -7 | cut -d' ' -f2 | paste -sd,)" >> weekly-report.md
echo "High: $(grep -h 'high' archive/*/npm_audit.prom | tail -7 | cut -d' ' -f2 | paste -sd,)" >> weekly-report.md
```

### Monthly Security Tasks

#### 1. Security Architecture Review

- Review security policies and procedures
- Assess new threat intelligence
- Update security training materials
- Review access controls and permissions

#### 2. Penetration Testing

```bash
# Monthly security assessment
npm run security:penetration-test
npm run security:vulnerability-scan
npm run security:compliance-check
```

## Performance Monitoring

### Security Performance Metrics

Monitor the performance impact of security measures:

```bash
#!/bin/bash
# Security performance monitoring
echo "=== SECURITY PERFORMANCE MONITORING ==="

# 1. Measure baseline performance
echo "1. Baseline performance (no security):"
SECURITY_PROFILE=none npm run benchmark:latency

# 2. Measure low security performance
echo "2. Low security performance:"
SECURITY_PROFILE=low npm run benchmark:latency

# 3. Measure medium security performance
echo "3. Medium security performance:"
SECURITY_PROFILE=medium npm run benchmark:latency

# 4. Measure high security performance
echo "4. High security performance:"
SECURITY_PROFILE=high npm run benchmark:latency

# 5. Calculate overhead
echo "5. Security overhead analysis:"
npm run analyze:security-overhead
```

### Performance Thresholds

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| **End-to-End Latency** | <200ms | 200-250ms | >250ms |
| **Security Overhead** | <20ms | 20-40ms | >40ms |
| **CPU Usage** | <70% | 70-85% | >85% |
| **Memory Usage** | <500MB | 500-750MB | >750MB |

### Automated Performance Monitoring

```bash
#!/bin/bash
# save as: scripts/monitor-security-performance.sh

echo "=== SECURITY PERFORMANCE MONITOR ==="

while true; do
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Measure current performance
    LATENCY=$(npm run benchmark:latency -- --silent | grep "Average:" | cut -d' ' -f2)
    CPU=$(ps -p $$ -o %cpu | tail -1 | tr -d ' ')
    MEMORY=$(ps -p $$ -o rss | tail -1)
    
    # Log performance metrics
    echo "$TIMESTAMP,latency,$LATENCY" >> performance-log.csv
    echo "$TIMESTAMP,cpu,$CPU" >> performance-log.csv
    echo "$TIMESTAMP,memory,$MEMORY" >> performance-log.csv
    
    # Check thresholds
    if (( $(echo "$LATENCY > 250" | bc -l) )); then
        echo "🚨 CRITICAL: Latency exceeded threshold ($LATENCY ms)"
    elif (( $(echo "$LATENCY > 200" | bc -l) )); then
        echo "⚠️  WARNING: Latency approaching threshold ($LATENCY ms)"
    fi
    
    sleep 60
done
```

## Emergency Procedures

### Security Breach Response

#### Immediate Actions (0-5 minutes)

```bash
#!/bin/bash
# EMERGENCY: Security breach response
echo "🚨 SECURITY BREACH RESPONSE ACTIVATED 🚨"

# 1. Immediate isolation
echo "1. Isolating application..."
pkill -f "poker-helper"
docker-compose -f monitoring/docker-compose.yml down

# 2. Preserve evidence
echo "2. Preserving evidence..."
INCIDENT_ID="breach-$(date +%Y%m%d-%H%M%S)"
mkdir -p incidents/$INCIDENT_ID
cp -r logs/ incidents/$INCIDENT_ID/
cp .env incidents/$INCIDENT_ID/
npm audit --json > incidents/$INCIDENT_ID/audit-snapshot.json

# 3. Activate emergency mode
echo "3. Activating emergency mode..."
export EMERGENCY_MODE=true
export LOG_LEVEL=debug
export SECURITY_MONITORING=true

# 4. Notify security team
echo "4. Notification sent to security team"
echo "Incident ID: $INCIDENT_ID" | tee incidents/$INCIDENT_ID/incident-summary.txt
echo "Timestamp: $(date)" | tee -a incidents/$INCIDENT_ID/incident-summary.txt
echo "Operator: $(whoami)" | tee -a incidents/$INCIDENT_ID/incident-summary.txt

echo "🚨 IMMEDIATE RESPONSE COMPLETE 🚨"
echo "Incident ID: $INCIDENT_ID"
```

#### Recovery Procedures

```bash
#!/bin/bash
# Security breach recovery
echo "=== SECURITY BREACH RECOVERY ==="

# 1. System cleanup
echo "1. Performing system cleanup..."
npm run security:clean
rm -rf node_modules/
npm ci --audit

# 2. Security hardening
echo "2. Applying security hardening..."
export SECURITY_PROFILE=critical
npm run security:harden

# 3. Verification
echo "3. Verifying system integrity..."
npm run test:security:comprehensive
npm audit --audit-level=moderate

# 4. Gradual restart
echo "4. Restarting with enhanced monitoring..."
SECURITY_MONITORING=true npm start

echo "=== RECOVERY COMPLETE ==="
```

## Escalation Matrix

### Contact Information

| Role | Primary Contact | Backup Contact | Response Time |
|------|-----------------|----------------|---------------|
| **Security Lead** | security-lead@company.com | backup-security@company.com | 15 minutes |
| **DevOps Team** | devops@company.com | devops-oncall@company.com | 30 minutes |
| **Development Lead** | dev-lead@company.com | senior-dev@company.com | 1 hour |
| **Management** | management@company.com | exec-oncall@company.com | 2 hours |

### Escalation Triggers

#### Automatic Escalation

- Critical vulnerabilities detected
- Security test failures >3
- System breach indicators
- Performance degradation >50%

#### Manual Escalation

```bash
#!/bin/bash
# Manual escalation script
echo "=== SECURITY ESCALATION ==="

SEVERITY=$1
ISSUE=$2

case $SEVERITY in
    "critical")
        echo "🚨 CRITICAL ESCALATION: $ISSUE"
        # Notify security team immediately
        ;;
    "high")
        echo "⚠️  HIGH ESCALATION: $ISSUE"
        # Notify security team within 1 hour
        ;;
    "medium")
        echo "📢 MEDIUM ESCALATION: $ISSUE"
        # Notify development team within 4 hours
        ;;
    *)
        echo "Invalid severity level"
        exit 1
        ;;
esac
```

## Security Metrics and KPIs

### Key Performance Indicators

#### Security Metrics

| Metric | Target | Current | Trend |
|--------|--------|---------|--------|
| **Vulnerability Resolution Time** | <24 hours | TBD | ➡️ |
| **Security Test Coverage** | >90% | TBD | ⬆️ |
| **Security Test Success Rate** | >95% | TBD | ➡️ |
| **Security Overhead** | <20ms | TBD | ⬇️ |

#### Operational Metrics

| Metric | Target | Current | Trend |
|--------|--------|---------|--------|
| **MTTR (Mean Time to Recovery)** | <2 hours | TBD | ⬇️ |
| **Security Incident Rate** | <1/month | TBD | ⬇️ |
| **False Positive Rate** | <5% | TBD | ⬇️ |
| **Compliance Score** | >95% | TBD | ⬆️ |

### Metrics Collection

```bash
#!/bin/bash
# Collect security KPI data
echo "=== SECURITY METRICS COLLECTION ==="

# 1. Vulnerability metrics
echo "1. Vulnerability Metrics:"
npm audit --json | jq '.metadata.vulnerabilities'

# 2. Test metrics
echo "2. Test Metrics:"
npm run test:security -- --json | jq '.numPassedTests, .numFailedTests'

# 3. Performance metrics
echo "3. Performance Metrics:"
npm run benchmark:security | grep -E "(Average|Overhead)"

# 4. Operational metrics
echo "4. Operational Metrics:"
wc -l logs/security.log | cut -d' ' -f1
grep -c "ERROR" logs/security.log
```

---

## Summary

This runbook provides comprehensive operational procedures for maintaining the security of the CoinPoker Intelligence Assistant. Regular execution of these procedures ensures:

- **Proactive Security**: Daily monitoring prevents issues from escalating
- **Rapid Response**: Clear incident response procedures minimize impact
- **Continuous Improvement**: Regular maintenance keeps security measures current
- **Performance Balance**: Monitoring ensures security doesn't compromise functionality

For additional security information, see:
- [Security Integration Guide](1_security_integration_guide.md)
- [Security Documentation](SECURITY.md)
- [Monitoring Setup](../monitoring/README.md)