/**
 * React entry point for CoinPoker Overlay UI.
 * Integrates OverlayWindow and OverlayControls, manages state, and handles IPC.
 */
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { OverlayWindow } from './components/OverlayWindow';
import OverlayControls, { OverlaySettings } from './components/OverlayControls';
import type { Recommendation } from '../shared/types/Recommendation';

// Default overlay settings
const defaultSettings: OverlaySettings = {
  position: 'top-right',
  transparency: 80,
  showAction: true,
  showConfidence: true,
  showRationale: false,
  fontSize: 'medium',
};

const OverlayApp: React.FC = () => {
  // State for current recommendation and overlay settings
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [settings, setSettings] = useState<OverlaySettings>(defaultSettings);

  // Listen for recommendation updates from backend via IPC
  useEffect(() => {
    // @ts-ignore: Electron's window.api is injected at runtime
    window.api?.on('recommendation', (rec: Recommendation) => {
      setRecommendation(rec);
    });

    // Optionally, load persisted settings from backend
    window.api?.invoke?.('getOverlaySettings').then((saved: OverlaySettings) => {
      if (saved) setSettings(saved);
    });

    // Cleanup listener on unmount
    return () => {
      window.api?.removeAllListeners?.('recommendation');
    };
  }, []);

  // Handle settings changes from controls
  const handleSettingsChange = (newSettings: OverlaySettings) => {
    setSettings(newSettings);
    // Propagate to backend for persistence and other windows
    window.api?.send?.('setOverlaySettings', newSettings);
  };

  return (
    <div>
      <OverlayWindow
        recommendation={recommendation}
        settings={settings}
      />
      <OverlayControls
        settings={settings}
        onChange={handleSettingsChange}
      />
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<OverlayApp />);
}