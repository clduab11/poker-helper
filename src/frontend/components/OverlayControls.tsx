import React, { useState } from "react";

/**
 * OverlayControlsProps defines the props for the OverlayControls component.
 * - settings: Current overlay settings.
 * - onChange: Callback when settings are updated.
 */
export interface OverlaySettings {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  transparency: number; // 0-100
  showAction: boolean;
  showConfidence: boolean;
  showRationale: boolean;
  fontSize: "small" | "medium" | "large";
}

interface OverlayControlsProps {
  settings: OverlaySettings;
  onChange: (settings: OverlaySettings) => void;
}

/**
 * OverlayControls provides UI for customizing overlay appearance and behavior.
 * - Position selector (4 corners)
 * - Transparency slider (0-100%)
 * - Visibility toggles for action, confidence, rationale
 * - Font size adjustment (small, medium, large)
 */
const OverlayControls: React.FC<OverlayControlsProps> = ({ settings, onChange }) => {
  const [localSettings, setLocalSettings] = useState<OverlaySettings>(settings);

  // Handle changes and propagate up
  const handleChange = (key: keyof OverlaySettings, value: any) => {
    const updated = { ...localSettings, [key]: value };
    setLocalSettings(updated);
    onChange(updated);
  };

  return (
    <div className="overlay-controls-panel">
      <h3>Overlay Settings</h3>
      <div className="overlay-controls-group">
        <label>Position:</label>
        <select
          value={localSettings.position}
          onChange={e => handleChange("position", e.target.value)}
        >
          <option value="top-left">Top Left</option>
          <option value="top-right">Top Right</option>
          <option value="bottom-left">Bottom Left</option>
          <option value="bottom-right">Bottom Right</option>
        </select>
      </div>
      <div className="overlay-controls-group">
        <label>Transparency: {localSettings.transparency}%</label>
        <input
          type="range"
          min={0}
          max={100}
          value={localSettings.transparency}
          onChange={e => handleChange("transparency", Number(e.target.value))}
        />
      </div>
      <div className="overlay-controls-group">
        <label>
          <input
            type="checkbox"
            checked={localSettings.showAction}
            onChange={e => handleChange("showAction", e.target.checked)}
          />
          Show Action
        </label>
        <label>
          <input
            type="checkbox"
            checked={localSettings.showConfidence}
            onChange={e => handleChange("showConfidence", e.target.checked)}
          />
          Show Confidence
        </label>
        <label>
          <input
            type="checkbox"
            checked={localSettings.showRationale}
            onChange={e => handleChange("showRationale", e.target.checked)}
          />
          Show Rationale
        </label>
      </div>
      <div className="overlay-controls-group">
        <label>Font Size:</label>
        <select
          value={localSettings.fontSize}
          onChange={e => handleChange("fontSize", e.target.value)}
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </div>
    </div>
  );
};

export default OverlayControls;