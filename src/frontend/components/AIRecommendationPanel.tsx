import React, { useState, useEffect } from 'react';
import { Decision } from '../../shared/types';
import { WorkflowResult } from '../../services/agents/GoogleADKWorkflow';

interface AIRecommendationPanelProps {
  decision?: Decision;
  workflowResult?: WorkflowResult;
  screenshotStats?: {
    count: number;
    oldest: number | null;
    newest: number | null;
  };
}

export const AIRecommendationPanel: React.FC<AIRecommendationPanelProps> = ({
  decision,
  workflowResult,
  screenshotStats,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [agentDetails, setAgentDetails] = useState<Record<string, any>>({});

  useEffect(() => {
    if (workflowResult) {
      const details: Record<string, any> = {};
      workflowResult.agentContributions.forEach((contribution) => {
        details[contribution.agentId] = {
          role: contribution.role,
          confidence: contribution.confidence,
          timestamp: new Date(contribution.timestamp).toLocaleTimeString(),
          content: contribution.content,
        };
      });
      setAgentDetails(details);
    }
  }, [workflowResult]);

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) {
      return '#4CAF50';
    }
    if (confidence >= 0.6) {
      return '#FFC107';
    }
    return '#F44336';
  };

  const formatAction = (action: string): string => {
    const parts = action.split(' ');
    const mainAction = parts[0].toUpperCase();
    const amount = parts[1] || '';
    return `${mainAction} ${amount}`.trim();
  };

  return (
    <div className="ai-recommendation-panel">
      {/* Main Recommendation */}
      <div className="recommendation-header">
        <h3>AI Recommendation</h3>
        {screenshotStats && (
          <div className="screenshot-stats">
            <span>📸 {screenshotStats.count} screenshots</span>
          </div>
        )}
      </div>

      {decision && (
        <div className="main-recommendation">
          <div className="action-display">
            <span className="action-text">{formatAction(decision.action)}</span>
            <div 
              className="confidence-bar"
              style={{
                width: `${decision.confidence * 100}%`,
                backgroundColor: getConfidenceColor(decision.confidence),
              }}
            />
            <span className="confidence-text">
              {(decision.confidence * 100).toFixed(0)}% confident
            </span>
          </div>
          
          <div className="reasoning">
            <p>{decision.rationale}</p>
          </div>


        </div>
      )}

      {/* Multi-Agent Details */}
      {workflowResult && (
        <div className="multi-agent-section">
          <button 
            className="toggle-details"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? '▼' : '▶'} Agent Analysis Details
          </button>

          {showDetails && (
            <div className="agent-details">
              {Object.entries(agentDetails).map(([agentId, details]) => (
                <div key={agentId} className="agent-card">
                  <div className="agent-header">
                    <span className="agent-role">{details.role}</span>
                    <span className="agent-time">{details.timestamp}</span>
                  </div>
                  
                  <div className="agent-confidence">
                    <div 
                      className="confidence-indicator"
                      style={{
                        backgroundColor: getConfidenceColor(details.confidence || 0.5),
                      }}
                    />
                    <span>{((details.confidence || 0.5) * 100).toFixed(0)}%</span>
                  </div>

                  <div className="agent-content">
                    {typeof details.content === 'string' ? (
                      <p>{details.content}</p>
                    ) : (
                      <pre>{JSON.stringify(details.content, null, 2)}</pre>
                    )}
                  </div>
                </div>
              ))}

              {workflowResult.metadata && (
                <div className="workflow-metadata">
                  <h5>Workflow Metrics</h5>
                  <ul>
                    <li>Processing Time: {workflowResult.metadata['processingTime']}ms</li>
                    <li>Agents Used: {workflowResult.metadata['agentCount']}</li>
                    <li>Consensus: {(workflowResult.confidence * 100).toFixed(0)}%</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        .ai-recommendation-panel {
          background: rgba(20, 20, 20, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 16px;
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 400px;
        }

        .recommendation-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .recommendation-header h3 {
          margin: 0;
          font-size: 18px;
          color: #fff;
        }

        .screenshot-stats {
          font-size: 12px;
          color: #888;
        }

        .main-recommendation {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 16px;
        }

        .action-display {
          position: relative;
          margin-bottom: 12px;
        }

        .action-text {
          font-size: 24px;
          font-weight: bold;
          display: block;
          margin-bottom: 8px;
        }

        .confidence-bar {
          height: 4px;
          border-radius: 2px;
          transition: width 0.3s ease;
          margin-bottom: 4px;
        }

        .confidence-text {
          font-size: 12px;
          color: #aaa;
        }

        .reasoning {
          font-size: 14px;
          line-height: 1.4;
          color: #ddd;
          margin-top: 12px;
        }

        .alternatives {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .alternatives h4 {
          margin: 0 0 8px 0;
          font-size: 14px;
          color: #aaa;
        }

        .alternative {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 0;
          font-size: 13px;
        }

        .probability {
          color: #888;
          font-size: 12px;
        }

        .multi-agent-section {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .toggle-details {
          background: none;
          border: none;
          color: #4CAF50;
          cursor: pointer;
          font-size: 14px;
          padding: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .toggle-details:hover {
          color: #66BB6A;
        }

        .agent-details {
          margin-top: 12px;
        }

        .agent-card {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
          padding: 8px;
          margin-bottom: 8px;
        }

        .agent-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .agent-role {
          font-weight: bold;
          text-transform: capitalize;
          font-size: 13px;
        }

        .agent-time {
          font-size: 11px;
          color: #888;
        }

        .agent-confidence {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .confidence-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .agent-content {
          font-size: 12px;
          color: #ccc;
          max-height: 150px;
          overflow-y: auto;
        }

        .agent-content pre {
          background: rgba(0, 0, 0, 0.3);
          padding: 8px;
          border-radius: 4px;
          font-size: 11px;
          overflow-x: auto;
        }

        .workflow-metadata {
          margin-top: 16px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }

        .workflow-metadata h5 {
          margin: 0 0 8px 0;
          font-size: 13px;
          color: #aaa;
        }

        .workflow-metadata ul {
          margin: 0;
          padding-left: 20px;
          font-size: 12px;
          color: #ccc;
        }

        .workflow-metadata li {
          margin-bottom: 4px;
        }
      `}</style>
    </div>
  );
};
