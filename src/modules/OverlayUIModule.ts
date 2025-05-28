import { OverlayConfiguration, OverlayPosition, DisplaySettings } from '../shared/types/Overlay';

/**
 * OverlayUIModule manages the overlay window UI, state, and communication with the Electron renderer process.
 * Handles dynamic positioning, transparency, element visibility, and performance-optimized updates.
 */
export class OverlayUIModule {
  private config: OverlayConfiguration;
  private recommendation: any; // Replace with actual recommendation type
  private updateCallback: (() => void) | null = null;

  /**
   * Initializes the OverlayUIModule with a configuration.
   * @param config Initial overlay configuration
   */
  constructor(config: OverlayConfiguration) {
    this.config = config;
    this.recommendation = null;
  }

  /**
   * Registers a callback to be invoked when the overlay state updates.
   * @param cb Callback function
   */
  public onUpdate(cb: () => void) {
    this.updateCallback = cb;
  }

  /**
   * Updates the overlay configuration and triggers UI update.
   * @param config New overlay configuration
   */
  public setConfiguration(config: OverlayConfiguration) {
    this.config = config;
    this.triggerUpdate();
    this.sendConfigToRenderer();
  }

  /**
   * Returns the current overlay configuration.
   */
  public getConfiguration(): OverlayConfiguration {
    return this.config;
  }

  /**
   * Updates the displayed recommendation and triggers UI update.
   * @param recommendation Recommendation data
   */
  public setRecommendation(recommendation: any) {
    this.recommendation = recommendation;
    this.triggerUpdate();
    this.sendRecommendationToRenderer();
  }

  /**
   * Returns the current recommendation.
   */
  public getRecommendation(): any {
    return this.recommendation;
  }

  /**
   * Sets the overlay position and triggers UI update.
   * @param position New overlay position
   */
  public setPosition(position: OverlayPosition) {
    this.config.position = position;
    this.triggerUpdate();
    this.sendConfigToRenderer();
  }

  /**
   * Sets the overlay transparency (0-100%) and triggers UI update.
   * @param transparency Transparency value (0-100)
   */
  public setTransparency(transparency: number) {
    this.config.transparency = Math.max(0, Math.min(100, transparency));
    this.triggerUpdate();
    this.sendConfigToRenderer();
  }

  /**
   * Sets which elements are visible in the overlay.
   * @param display Display settings
   */
  public setDisplaySettings(display: DisplaySettings) {
    this.config.display = display;
    this.triggerUpdate();
    this.sendConfigToRenderer();
  }

  /**
   * Triggers the registered update callback for React state sync.
   * Ensures UI updates are batched for <10ms latency.
   */
  private triggerUpdate() {
    if (this.updateCallback) {
      // Use requestAnimationFrame for fast, batched UI updates
      window.requestAnimationFrame(() => {
        this.updateCallback && this.updateCallback();
      });
    }
  }

  /**
   * Sends the current configuration to the Electron renderer process via IPC.
   */
  private sendConfigToRenderer() {
    if ((window as any).electron && (window as any).electron.ipcRenderer) {
      (window as any).electron.ipcRenderer.send('overlay-config', this.config);
    }
  }

  /**
   * Sends the current recommendation to the Electron renderer process via IPC.
   */
  private sendRecommendationToRenderer() {
    if ((window as any).electron && (window as any).electron.ipcRenderer) {
      (window as any).electron.ipcRenderer.send('overlay-recommendation', this.recommendation);
    }
  }
}