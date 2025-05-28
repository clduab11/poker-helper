/**
 * Recommendation represents the poker action suggestion for the overlay UI.
 */
export interface Recommendation {
  action: 'fold' | 'call' | 'raise' | 'all-in';
  confidence: number; // 0-100
  rationale?: string;
}