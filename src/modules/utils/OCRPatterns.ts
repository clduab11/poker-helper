// OCRPatterns.ts
// Utility regex and helpers for parsing OCR output in CoinPoker UI

/** Card pattern: e.g., "Ah", "10c", "Kd" (case-insensitive, with OCR error tolerance) */
export const CARD_PATTERN = /\b(10|[2-9]|[AJQK])\s*([hdcs])\b/gi;

/** Card pattern with OCR error correction (e.g., '0' for 'O', 'l' for '1', etc.) */
export const CARD_PATTERN_CORRECTION = /\b(10|[2-9]|[AJQK]|[a-zA-Z0-9])\s*([hdcsHDCS0Oo])\b/g;

/** Number pattern for pot/chip amounts (accepts commas, periods, OCR errors) */
export const NUMBER_PATTERN = /\b\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?\b/g;

/** Action detection patterns (case-insensitive, tolerant to OCR errors) */
export const ACTION_PATTERNS = {
  fold: /\bf[o0]ld\b/i,
  call: /\bc[a4]ll\b/i,
  raise: /\brai[s5]e\b/i,
  allin: /\ball[-\s]?in\b/i,
  check: /\bch[e3]ck\b/i,
  bet: /\bb[e3]t\b/i
};

/**
 * Attempts to correct common OCR errors in card strings.
 * E.g., '0'->'O', 'l'->'1', 'S'->'5', etc.
 */
export function correctOCRErrors(text: string): string {
  return text
    .replace(/0/g, 'O')
    .replace(/1/g, 'I')
    .replace(/5/g, 'S')
    .replace(/l/g, '1')
    .replace(/O/g, '0')
    .replace(/S/g, '5');
}

/**
 * Parses a string for a valid poker card, correcting common OCR errors.
 * Returns {rank, suit} or null if not matched.
 */
export function parseCard(text: string): { rank: string; suit: string } | null {
  const cleaned = correctOCRErrors(text).replace(/\s+/g, '');
  const match = cleaned.match(/^(10|[2-9]|[AJQK])([hdcs])$/i);
  if (!match) return null;
  return { rank: match[1].toUpperCase(), suit: match[2].toLowerCase() };
}

/**
 * Parses a string for a number (pot/chip), tolerant to OCR errors.
 */
export function parseNumber(text: string): number | null {
  const cleaned = text.replace(/[^\d.,]/g, '').replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}