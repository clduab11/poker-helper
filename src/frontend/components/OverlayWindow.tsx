import React, { useState, useEffect } from 'react';
import { OverlayConfiguration, OverlayTheme, OverlayPosition } from '../../shared/types/Overlay';
import { Recommendation } from '../../shared/types/Recommendation';
import { OverlaySettings } from './OverlayControls';
import '../../frontend/styles/overlay.css';

/**
 * OverlayWindowProps now accepts OverlaySettings and recommendation.
 * The component maps settings to OverlayConfiguration internally.
 */
export interface OverlayWindowProps {
  settings: OverlaySettings;
  recommendation: Recommendation | null;
}

/**
 * OverlayWindow displays the poker recommendation overlay with action, confidence, and rationale.
 * Accepts OverlaySettings and maps to OverlayConfiguration for internal use.
 */
const actionColors: Record<Recommendation['action'], string> = {
  'fold': '#e53935',     // red
  'call': '#fbc02d',     // yellow
  'raise': '#43a047',    // green
  'all-in': '#8e24aa',   // purple
};

// Utility: map OverlaySettings to OverlayConfiguration
function mapSettingsToConfig(settings: OverlaySettings): OverlayConfiguration {
  // These theme/display values can be customized or made user-configurable as needed
  const fontSizePx =
    settings.fontSize === 'small'
      ? 14
      : settings.fontSize === 'large'
      ? 22
      : 18;

  const theme: OverlayTheme = {
    backgroundColor: 'rgba(30,30,30,0.85)',
    textColor: '#fff',
    accentColor: '#43a047',
    borderRadius: 12,
    boxShadow: '0 4px 32px rgba(0,0,0,0.3)',
    fontSize: fontSizePx,
    opacity: settings.transparency / 100,
  };

  return {
    position: settings.position as OverlayPosition,
    transparency: settings.transparency,
    display: {
      showAction: settings.showAction,
      showConfidence: settings.showConfidence,
      showRationale: settings.showRationale,
      fontSize: fontSizePx,
    },
    theme,
  };
}

export const OverlayWindow: React.FC<OverlayWindowProps> = ({
  settings,
  recommendation,
}: OverlayWindowProps) => {
  const [showRationale, setShowRationale] = useState<boolean>(false);

  // Map settings to config for internal rendering
  const config = mapSettingsToConfig(settings);

  // Compute overlay style based on config
  const overlayStyle: React.CSSProperties = {
    opacity: config.transparency / 100,
    fontSize: config.display.fontSize,
    backgroundColor: config.theme.backgroundColor,
    color: config.theme.textColor,
    borderRadius: config.theme.borderRadius,
    boxShadow: config.theme.boxShadow,
    position: 'fixed',
    zIndex: 9999,
    ...getPositionStyle(config.position),
    transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
    pointerEvents: 'none', // overlay is non-intrusive by default
  };

  function getPositionStyle(position: string): React.CSSProperties {
    switch (position) {
      case 'top-left': return { top: 16, left: 16 };
      case 'top-right': return { top: 16, right: 16 };
      case 'bottom-left': return { bottom: 16, left: 16 };
      case 'bottom-right': return { bottom: 16, right: 16 };
      default: return { top: 16, right: 16 };
    }
  }

  // Accessibility: allow keyboard toggle for rationale
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'r' && config.display.showRationale) {
        setShowRationale((prev: boolean) => !prev);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [config.display.showRationale]);

  if (!recommendation) return null;

  return (
    <div
      className="overlay-window"
      style={overlayStyle}
      aria-live="polite"
      aria-atomic="true"
      role="region"
      tabIndex={-1}
    >
      {config.display.showAction && (
        <div className="overlay-action" aria-label={`Recommended action: ${recommendation.action}`}>
          <span
            className="overlay-action-indicator"
            style={{
              backgroundColor: actionColors[recommendation.action],
              borderRadius: '50%',
              display: 'inline-block',
              width: 16,
              height: 16,
              marginRight: 8,
              verticalAlign: 'middle',
            }}
            aria-hidden="true"
          />
          <span className="overlay-action-text" style={{ fontWeight: 700 }}>
            {recommendation.action.toUpperCase()}
          </span>
        </div>
      )}

      {config.display.showConfidence && (
        <div className="overlay-confidence" aria-label={`Confidence: ${recommendation.confidence}%`}>
          <div className="overlay-confidence-bar-bg">
            <div
              className="overlay-confidence-bar"
              style={{
                width: `${recommendation.confidence}%`,
                backgroundColor: config.theme.accentColor,
                transition: 'width 0.2s',
              }}
            />
          </div>
          <span className="overlay-confidence-value">{recommendation.confidence}%</span>
        </div>
      )}

      {config.display.showRationale && (
        <div className="overlay-rationale-section">
          <button
            className="overlay-rationale-toggle"
            onClick={() => setShowRationale((v: boolean) => !v)}
            aria-expanded={showRationale}
            aria-controls="overlay-rationale"
            tabIndex={0}
            style={{
              background: 'none',
              border: 'none',
              color: config.theme.accentColor,
              cursor: 'pointer',
              fontSize: 'inherit',
              fontWeight: 500,
              marginTop: 8,
              pointerEvents: 'auto', // allow interaction
            }}
          >
            {showRationale ? 'Hide rationale' : 'Show rationale'}
          </button>
          <div
            id="overlay-rationale"
            className={`overlay-rationale${showRationale ? ' open' : ''}`}
            aria-hidden={!showRationale}
            style={{
              maxHeight: showRationale ? 200 : 0,
              overflow: 'hidden',
              transition: 'max-height 0.3s',
              marginTop: 4,
              pointerEvents: 'auto',
            }}
          >
            <span>{recommendation.rationale || 'No rationale provided.'}</span>
          </div>
        </div>
      )}
    </div>
  );
};