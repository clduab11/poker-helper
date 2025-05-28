const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const METRICS_FILE_PATH = process.env.NPM_AUDIT_METRICS_FILE || path.join(__dirname, '..', 'metrics', 'npm_audit.prom');

function formatPrometheusMetrics(vulnerabilities) {
    let metrics = '# HELP npm_vulnerabilities Number of npm vulnerabilities\n';
    metrics += '# TYPE npm_vulnerabilities gauge\n';
    metrics += `npm_vulnerabilities{severity="critical"} ${vulnerabilities.critical || 0}\n`;
    metrics += `npm_vulnerabilities{severity="high"} ${vulnerabilities.high || 0}\n`;
    metrics += `npm_vulnerabilities{severity="moderate"} ${vulnerabilities.moderate || 0}\n`; // npm uses moderate, not medium
    metrics += `npm_vulnerabilities{severity="low"} ${vulnerabilities.low || 0}\n`;
    metrics += `npm_vulnerabilities{severity="info"} ${vulnerabilities.info || 0}\n`; // npm uses info

    const totalVulnerabilities = Object.values(vulnerabilities).reduce((sum, count) => sum + count, 0);
    metrics += '# HELP npm_total_vulnerabilities Total number of npm vulnerabilities\n';
    metrics += '# TYPE npm_total_vulnerabilities gauge\n';
    metrics += `npm_total_vulnerabilities ${totalVulnerabilities}\n`;

    return metrics;
}

exec('npm audit --json', { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => { // Increased maxBuffer
    if (stderr && !error) { // npm audit often outputs to stderr even on success (e.g. summary)
        // Check if stderr contains actual error messages vs. summary info
        // For now, let's proceed if stdout has JSON, assuming stderr might be informational
        // A more robust check might be needed depending on `npm audit` behavior
    }

    let auditData;
    try {
        auditData = JSON.parse(stdout);
    } catch (parseError) {
        // If stdout is not valid JSON, it might be an error message itself or npm audit failed severely
        console.error('Failed to parse npm audit JSON output:', parseError);
        console.error('stdout:', stdout);
        console.error('stderr:', stderr);
        // If `error` object exists, it usually means the command failed to execute or exited with error code
        if (error) {
            console.error('npm audit command execution error:', error);
        }
        // Create a metrics file indicating failure or 0 vulnerabilities if parsing fails
        const errorVulnerabilities = { critical: 0, high: 0, moderate: 0, low: 0, info: 0 };
        const errorMetrics = formatPrometheusMetrics(errorVulnerabilities);
         try {
            const metricsDir = path.dirname(METRICS_FILE_PATH);
            if (!fs.existsSync(metricsDir)) {
                fs.mkdirSync(metricsDir, { recursive: true });
            }
            fs.writeFileSync(METRICS_FILE_PATH, errorMetrics);
            console.log(`Error metrics written to ${METRICS_FILE_PATH}`);
        } catch (writeError) {
            console.error(`Failed to write error metrics file: ${writeError}`);
        }
        process.exit(1); // Exit with error code
        return;
    }

    const vulnerabilities = auditData.metadata && auditData.metadata.vulnerabilities ? auditData.metadata.vulnerabilities : {
        critical: 0,
        high: 0,
        moderate: 0,
        low: 0,
        info: 0
    };
    
    // Handle cases where auditData.vulnerabilities might be the structure (older npm versions?)
    // Or if auditData.actions exists, it might contain info too.
    // For simplicity, sticking to `auditData.metadata.vulnerabilities` which is common in recent npm versions.
    // If `auditData.metadata` is not present, it implies a different format or an error.
    // A more robust script would handle various npm audit JSON structures.

    const metricsOutput = formatPrometheusMetrics(vulnerabilities);

    try {
        const metricsDir = path.dirname(METRICS_FILE_PATH);
        if (!fs.existsSync(metricsDir)) {
            fs.mkdirSync(metricsDir, { recursive: true });
        }
        fs.writeFileSync(METRICS_FILE_PATH, metricsOutput);
        console.log(`Metrics written to ${METRICS_FILE_PATH}`);
    } catch (writeError) {
        console.error(`Failed to write metrics file: ${writeError}`);
        process.exit(1);
    }
});
