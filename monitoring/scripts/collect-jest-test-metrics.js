const fs = require('fs');
const path = require('path');

// Assumes Jest is configured to output results in JSON format
// e.g., jest --json --outputFile=jest-results.json
const JEST_RESULTS_FILE = process.env.JEST_RESULTS_FILE || 'jest-results.json'; // Path to Jest's JSON output
const METRICS_FILE_PATH = process.env.JEST_METRICS_FILE || path.join(__dirname, '..', 'metrics', 'jest_tests.prom');

function formatPrometheusMetrics(testResults) {
    let metrics = '';

    const numTotalTests = testResults.numTotalTests || 0;
    const numPassedTests = testResults.numPassedTests || 0;
    const numFailedTests = testResults.numFailedTests || 0;
    const numPendingTests = testResults.numPendingTests || 0;
    const startTime = testResults.startTime ? new Date(testResults.startTime).getTime() / 1000 : 0;

    metrics += '# HELP jest_tests_total Total number of tests\n';
    metrics += '# TYPE jest_tests_total gauge\n';
    metrics += `jest_tests_total ${numTotalTests}\n`;

    metrics += '# HELP jest_tests_passed_total Number of passed tests\n';
    metrics += '# TYPE jest_tests_passed_total gauge\n';
    metrics += `jest_tests_passed_total ${numPassedTests}\n`;

    metrics += '# HELP jest_tests_failed_total Number of failed tests\n';
    metrics += '# TYPE jest_tests_failed_total gauge\n';
    metrics += `jest_tests_failed_total ${numFailedTests}\n`;

    metrics += '# HELP jest_tests_pending_total Number of pending/skipped tests\n';
    metrics += '# TYPE jest_tests_pending_total gauge\n';
    metrics += `jest_tests_pending_total ${numPendingTests}\n`;

    metrics += '# HELP jest_last_run_timestamp_seconds Timestamp of the last test run\n';
    metrics += '# TYPE jest_last_run_timestamp_seconds gauge\n';
    metrics += `jest_last_run_timestamp_seconds ${startTime}\n`;

    // Individual test suite metrics (optional, can be verbose)
    metrics += '# HELP jest_test_suite_duration_seconds Duration of individual test suites in seconds\n';
    metrics += '# TYPE jest_test_suite_duration_seconds gauge\n';
    metrics += '# HELP jest_test_suite_status Status of individual test suites (1 pass, 0 fail)\n';
    metrics += '# TYPE jest_test_suite_status gauge\n';

    if (testResults.testResults) {
        testResults.testResults.forEach(suite => {
            const suitePathLabel = suite.name.replace(/\W+/g, '_'); // Sanitize path for label
            const suiteDuration = (suite.endTime && suite.startTime) ? (suite.endTime - suite.startTime) / 1000 : 0;
            const suiteStatus = (suite.status === 'passed') ? 1 : 0;
            metrics += `jest_test_suite_duration_seconds{suite="${suitePathLabel}"} ${suiteDuration}\n`;
            metrics += `jest_test_suite_status{suite="${suitePathLabel}"} ${suiteStatus}\n`;
        });
    }

    return metrics;
}

fs.readFile(JEST_RESULTS_FILE, 'utf8', (err, data) => {
    if (err) {
        console.error(`Failed to read Jest results file (${JEST_RESULTS_FILE}):`, err);
        // Write empty or error metrics
        const errorMetrics = formatPrometheusMetrics({});
        try {
            fs.writeFileSync(METRICS_FILE_PATH, errorMetrics);
            console.log(`Error metrics for Jest written to ${METRICS_FILE_PATH}`);
        } catch (writeError) {
            console.error(`Failed to write error Jest metrics file: ${writeError}`);
        }
        process.exit(1);
        return;
    }

    try {
        const testResults = JSON.parse(data);
        const prometheusMetrics = formatPrometheusMetrics(testResults);

        const metricsDir = path.dirname(METRICS_FILE_PATH);
        if (!fs.existsSync(metricsDir)) {
            fs.mkdirSync(metricsDir, { recursive: true });
        }
        fs.writeFileSync(METRICS_FILE_PATH, prometheusMetrics);
        console.log(`Jest test metrics written to ${METRICS_FILE_PATH}`);

    } catch (parseError) {
        console.error('Failed to parse Jest results JSON:', parseError);
        const errorMetrics = formatPrometheusMetrics({});
        try {
            fs.writeFileSync(METRICS_FILE_PATH, errorMetrics);
            console.log(`Error metrics for Jest written to ${METRICS_FILE_PATH}`);
        } catch (writeError) {
            console.error(`Failed to write error Jest metrics file: ${writeError}`);
        }
        process.exit(1);
    }
});
