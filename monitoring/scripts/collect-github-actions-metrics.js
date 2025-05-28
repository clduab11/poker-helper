const https = require('https');
const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.REPO_OWNER || 'your-repo-owner'; // Replace or set via ENV
const REPO_NAME = process.env.REPO_NAME || 'poker-helper'; // Replace or set via ENV
const WORKFLOW_ID = process.env.WORKFLOW_ID || 'security-scan.yml'; // ID or filename of the security workflow
const METRICS_FILE_PATH = process.env.GITHUB_ACTIONS_METRICS_FILE || path.join(__dirname, '..', 'metrics', 'github_actions.prom');

if (!GITHUB_TOKEN) {
    console.error('GITHUB_TOKEN environment variable is not set. Exiting.');
    process.exit(1);
}

function fetchWorkflowRuns(callback) {
    const options = {
        hostname: 'api.github.com',
        path: `/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_ID}/runs`,
        method: 'GET',
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'User-Agent': 'Node.js GitHub Actions Metrics Collector',
            'Accept': 'application/vnd.github.v3+json'
        }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                try {
                    callback(null, JSON.parse(data));
                } catch (e) {
                    callback(e);
                }
            } else {
                callback(new Error(`GitHub API request failed with status code ${res.statusCode}: ${data}`));
            }
        });
    });

    req.on('error', (error) => {
        callback(error);
    });

    req.end();
}

function formatPrometheusMetrics(workflowRuns) {
    let metrics = '# HELP github_workflow_run_status Status of GitHub Actions workflow runs (1 = success, 0 = failure/other)\n';
    metrics += '# TYPE github_workflow_run_status gauge\n';
    let metricsDuration = '# HELP github_workflow_run_duration_seconds Duration of GitHub Actions workflow runs in seconds\n';
    metricsDuration += '# TYPE github_workflow_run_duration_seconds gauge\n';

    let successCount = 0;
    let failureCount = 0;
    let otherCount = 0;

    if (workflowRuns && workflowRuns.workflow_runs) {
        workflowRuns.workflow_runs.forEach(run => {
            const labels = `workflow_id="${WORKFLOW_ID}",run_id="${run.id}",status="${run.status}",conclusion="${run.conclusion || 'unknown'}"`;
            const statusMetricValue = (run.conclusion === 'success') ? 1 : 0;
            metrics += `github_workflow_run_status{${labels}} ${statusMetricValue}\n`;

            if (run.conclusion === 'success') successCount++;
            else if (run.conclusion === 'failure') failureCount++;
            else otherCount++;

            // Calculate duration if possible
            if (run.created_at && run.updated_at) {
                const startTime = new Date(run.created_at).getTime();
                const endTime = new Date(run.updated_at).getTime();
                const durationSeconds = (endTime - startTime) / 1000;
                metricsDuration += `github_workflow_run_duration_seconds{${labels}} ${durationSeconds}\n`;
            }
        });
    }

    metrics += '# HELP github_workflow_runs_total Total number of GitHub Actions workflow runs by conclusion\n';
    metrics += '# TYPE github_workflow_runs_total gauge\n';
    metrics += `github_workflow_runs_total{workflow_id="${WORKFLOW_ID}",conclusion="success"} ${successCount}\n`;
    metrics += `github_workflow_runs_total{workflow_id="${WORKFLOW_ID}",conclusion="failure"} ${failureCount}\n`;
    metrics += `github_workflow_runs_total{workflow_id="${WORKFLOW_ID}",conclusion="other"} ${otherCount}\n`;

    return metrics + metricsDuration;
}

fetchWorkflowRuns((error, data) => {
    if (error) {
        console.error('Failed to fetch workflow runs:', error);
        // Write empty or error metrics
        const errorMetrics = formatPrometheusMetrics({ workflow_runs: [] }); // Empty data to generate 0 counts
        try {
            fs.writeFileSync(METRICS_FILE_PATH, errorMetrics);
            console.log(`Error metrics written to ${METRICS_FILE_PATH}`);
        } catch (writeError) {
            console.error(`Failed to write error metrics file: ${writeError}`);
        }
        process.exit(1);
        return;
    }

    const prometheusMetrics = formatPrometheusMetrics(data);

    try {
        const metricsDir = path.dirname(METRICS_FILE_PATH);
        if (!fs.existsSync(metricsDir)) {
            fs.mkdirSync(metricsDir, { recursive: true }); // Should be redundant now but good practice
        }
        fs.writeFileSync(METRICS_FILE_PATH, prometheusMetrics);
        console.log(`GitHub Actions metrics written to ${METRICS_FILE_PATH}`);
    } catch (writeError) {
        console.error(`Failed to write GitHub Actions metrics file: ${writeError}`);
        process.exit(1);
    }
});
