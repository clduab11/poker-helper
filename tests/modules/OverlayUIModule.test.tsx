/**
 * OverlayUIModule tests:
 * - Configuration validation
 * - Position calculations
 * - Recommendation display update
 * - UI update performance (<10ms)
 * - Configuration change propagation
 */
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { OverlayWindow } from "../../src/frontend/components/OverlayWindow";
import OverlayControls, { OverlaySettings } from "../../src/frontend/components/OverlayControls";
import type { Recommendation } from "../../src/shared/types/Recommendation";

// Mock settings and recommendation
const baseSettings: OverlaySettings = {
  position: "top-right",
  transparency: 80,
  showAction: true,
  showConfidence: true,
  showRationale: true,
  fontSize: "medium",
};

const mockRecommendation: Recommendation = {
  action: "raise",
  confidence: 87,
  rationale: "Opponent range is weak; raising maximizes EV.",
};

describe("OverlayUIModule", () => {
  it("validates configuration structure and values", () => {
    expect(baseSettings).toMatchObject({
      position: expect.any(String),
      transparency: expect.any(Number),
      showAction: expect.any(Boolean),
      showConfidence: expect.any(Boolean),
      showRationale: expect.any(Boolean),
      fontSize: expect.any(String),
    });
    expect(["top-left", "top-right", "bottom-left", "bottom-right"]).toContain(baseSettings.position);
    expect(baseSettings.transparency).toBeGreaterThanOrEqual(0);
    expect(baseSettings.transparency).toBeLessThanOrEqual(100);
    expect(["small", "medium", "large"]).toContain(baseSettings.fontSize);
  });

  it("calculates correct overlay position style for each corner", () => {
    const positions: OverlaySettings["position"][] = [
      "top-left", "top-right", "bottom-left", "bottom-right"
    ];
    positions.forEach(pos => {
      render(
        <OverlayWindow
          settings={{ ...baseSettings, position: pos }}
          recommendation={mockRecommendation}
        />
      );
      const overlay = screen.getByRole("region");
      const style = window.getComputedStyle(overlay);
      if (pos.includes("top")) expect(style.top).not.toBe("");
      if (pos.includes("bottom")) expect(style.bottom).not.toBe("");
      if (pos.includes("left")) expect(style.left).not.toBe("");
      if (pos.includes("right")) expect(style.right).not.toBe("");
    });
  });

  it("updates display when recommendation changes", () => {
    const { rerender } = render(
      <OverlayWindow settings={baseSettings} recommendation={null} />
    );
    expect(screen.queryByText(/RAISE/)).toBeNull();

    rerender(
      <OverlayWindow settings={baseSettings} recommendation={mockRecommendation} />
    );
    expect(screen.getByText(/RAISE/)).toBeInTheDocument();
    expect(screen.getByText(/87%/)).toBeInTheDocument();
    expect(screen.getByText(/Opponent range is weak/)).toBeInTheDocument();
  });

  it("UI updates complete in under 10ms", () => {
    const start = performance.now();
    render(
      <OverlayWindow settings={baseSettings} recommendation={mockRecommendation} />
    );
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(10);
  });

  it("propagates configuration changes from controls", () => {
    const handleChange = jest.fn();
    render(
      <OverlayControls settings={baseSettings} onChange={handleChange} />
    );
    // Simulate user changing font size
    fireEvent.change(screen.getByDisplayValue("medium"), { target: { value: "large" } });
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ fontSize: "large" }));
    // Simulate toggling showAction
    fireEvent.click(screen.getByLabelText(/Show Action/i));
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ showAction: false }));
  });
});