/**
 * OverlayPosition defines the possible positions for the overlay window.
 */
export enum OverlayPosition {
  TopLeft = 'top-left',
  TopRight = 'top-right',
  BottomLeft = 'bottom-left',
  BottomRight = 'bottom-right',
}

/**
 * OverlayTheme defines customizable styling options for the overlay.
 */
export interface OverlayTheme {
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  fontSize: number; // in px
  borderRadius: number; // in px
  boxShadow: string;
  opacity: number; // 0-1
}

/**
 * DisplaySettings controls which elements are visible in the overlay.
 */
export interface DisplaySettings {
  showAction: boolean;
  showConfidence: boolean;
  showRationale: boolean;
  fontSize: number; // in px
}

/**
 * OverlayConfiguration aggregates all overlay settings.
 */
export interface OverlayConfiguration {
  position: OverlayPosition;
  transparency: number; // 0-100
  theme: OverlayTheme;
  display: DisplaySettings;
}