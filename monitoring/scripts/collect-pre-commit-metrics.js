const fs = require('fs');
const path = require('path');

// This script is a placeholder and needs to be adapted based on how pre-commit hook performance is logged.
// Option 1: Husky/lint-staged might output timing information that can be captured.
// Option 2: Modify pre-commit scripts to log their duration to a specific file.

const PRE_COMMIT_LOG_FILE = process.env.PRE_COMMIT_LOG_FILE || 'pre-commit-times.log'; // Example log file
const METRICS_FILE_PATH = process.env.PRE_COMMIT_METRICS_FILE || path.join(__dirname, '..', 'metrics', 'pre_commit_hooks.prom');

function parsePreCommitLog(logData) {
    // This parsing logic is highly dependent on the log format.
    // Example: Assuming logs like "[lint-staged] Ran in 2.34s"
    const lines = logData.split('\n');
    const durations = {
        eslint: null,
        prettier: null,
        tsc: null, // Example: if you have a tsc hook
        overall: null
    };
    let totalDuration = 0;
    let hookCount = 0;

    lines.forEach(line => {
        // Regex to capture hook name and duration. Adjust as needed.
        const match = line.match(/\[(.*?)\] Ran in (\d+\.\d+)s/i) || line.match(/Hook (.*?) took (\d+\.\d+)s/i);
        if (match && match[1] && match[2]) {
            const hookName = match[1].toLowerCase().replace(/[^a-z0-9]/gi, ''); // Sanitize hook name
            const duration = parseFloat(match[2]);
            if (durations.hasOwnProperty(hookName)) {
                durations[hookName] = duration;
            }
            totalDuration += duration;
            hookCount++;
        }
        // Look for an overall duration if logged by a wrapper script
        const overallMatch = line.match(/Pre-commit hooks finished in (\d+\.\d+)s/i);
        if (overallMatch && overallMatch[1]) {
            durations.overall = parseFloat(overallMatch[1]);
        }
    });
    // If no specific overall duration, use sum of individual if available
    if (durations.overall === null && hookCount > 0) {
        // durations.overall = totalDuration; // Or keep it null if only individual hooks are of interest
    }

    return durations;
}

function formatPrometheusMetrics(durations) {
    let metrics = '# HELP pre_commit_hook_duration_seconds Duration of pre-commit hooks in seconds\n';
    metrics += '# TYPE pre_commit_hook_duration_seconds gauge\n';

    for (const [hook, duration] of Object.entries(durations)) {
        if (duration !== null) {
            metrics += `pre_commit_hook_duration_seconds{hook="${hook}"} ${duration}\n`;
        }
    }
    // Add a metric for the last updated time
    metrics += '# HELP pre_commit_last_run_timestamp_seconds Timestamp of the last pre-commit hook metric collection\n';
    metrics += '# TYPE pre_commit_last_run_timestamp_seconds gauge\n';
    metrics += `pre_commit_last_run_timestamp_seconds ${Date.now() / 1000}\n`;

    return metrics;
}

// Check if a log file exists. If not, pre-commit might not have run or logged.
if (!fs.existsSync(PRE_COMMIT_LOG_FILE)) {
    console.warn(`Pre-commit log file not found: ${PRE_COMMIT_LOG_FILE}. Writing empty metrics.`);
    const emptyMetrics = formatPrometheusMetrics({ overall: null }); // Default to overall or specific hooks as needed
    try {
        const metricsDir = path.dirname(METRICS_FILE_PATH);
        if (!fs.existsSync(metricsDir)) {
            fs.mkdirSync(metricsDir, { recursive: true });
        }
        fs.writeFileSync(METRICS_FILE_PATH, emptyMetrics);
        console.log(`Empty pre-commit metrics written to ${METRICS_FILE_PATH}`);
    } catch (writeError) {
        console.error(`Failed to write empty pre-commit metrics file: ${writeError}`);
    }
    process.exit(0); // Exit cleanly as this might be normal if no commits happened
    return;
}

fs.readFile(PRE_COMMIT_LOG_FILE, 'utf8', (err, data) => {
    if (err) {
        console.error(`Failed to read pre-commit log file (${PRE_COMMIT_LOG_FILE}):`, err);
        const errorMetrics = formatPrometheusMetrics({});
         try {
            fs.writeFileSync(METRICS_FILE_PATH, errorMetrics);
            console.log(`Error metrics for pre-commit hooks written to ${METRICS_FILE_PATH}`);
        } catch (writeError) {
            console.error(`Failed to write error pre-commit metrics file: ${writeError}`);
        }
        process.exit(1);
        return;
    }

    const durations = parsePreCommitLog(data);
    const prometheusMetrics = formatPrometheusMetrics(durations);

    try {
        const metricsDir = path.dirname(METRICS_FILE_PATH);
        if (!fs.existsSync(metricsDir)) {
            fs.mkdirSync(metricsDir, { recursive: true });
        }
        fs.writeFileSync(METRICS_FILE_PATH, prometheusMetrics);
        console.log(`Pre-commit hook metrics written to ${METRICS_FILE_PATH}`);
    } catch (writeError) {
        console.error(`Failed to write pre-commit hook metrics file: ${writeError}`);
        process.exit(1);
    }
});
