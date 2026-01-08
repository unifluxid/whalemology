import { TradeItem } from './stockbit-types';
import { ANALYSIS_CONFIG } from './analysis-config';

export interface WhaleDetectionResult {
  whaleTrades: Set<TradeItem>;
  whaleCount: number;
}

/**
 * Detects "Obvious Whales" based on single trade size.
 *
 * Logic 1: Absolute Whale (Value >= WHALE_SINGLE_TRADE_THRESHOLD)
 * Logic 2: Relative Whale (Value >= Avg * Multiplier AND Value >= Min Floor)
 */
export function detectWhales(
  trades: TradeItem[],
  averageTradeValue: number
): WhaleDetectionResult {
  const whaleTrades = new Set<TradeItem>();
  let whaleCount = 0;

  const {
    WHALE_SINGLE_TRADE_THRESHOLD,
    RELATIVE_WHALE_MULTIPLIER,
    MIN_RELATIVE_WHALE_ABSOLUTE_VALUE,
  } = ANALYSIS_CONFIG;

  for (const t of trades) {
    if (!t.value) continue; // Skip if value missing (should be enriched)

    // Logic 1: Absolute Whale
    if (t.value >= WHALE_SINGLE_TRADE_THRESHOLD) {
      if (!whaleTrades.has(t)) {
        whaleTrades.add(t);
        whaleCount++;
      }
    }
    // Logic 2: Relative Whale (Local Whale)
    else if (
      t.value >= MIN_RELATIVE_WHALE_ABSOLUTE_VALUE &&
      t.value >= averageTradeValue * RELATIVE_WHALE_MULTIPLIER
    ) {
      if (!whaleTrades.has(t)) {
        whaleTrades.add(t);
        whaleCount++;
      }
    }
  }

  return { whaleTrades, whaleCount };
}
