import { TradeItem } from './stockbit-types';
import {
  ANALYSIS_CONFIG,
  getDynamicThresholds,
  StockThresholdData,
} from './analysis-config';

export interface WhaleDetectionResult {
  whaleTrades: Set<TradeItem>;
  whaleCount: number;
  tierName: string;
  dynamicThreshold: number;
  isHighVolume: boolean;
}

export interface WhaleDetectionOptions {
  stockData?: StockThresholdData | null;
}

/**
 * Detects "Obvious Whales" based on single trade size.
 *
 * Logic 1: Absolute Whale (Value >= dynamic threshold based on market cap + volume)
 * Logic 2: Relative Whale (Value >= Avg * Multiplier AND Value >= Min Floor)
 *
 * Thresholds are adjusted based on:
 * - Market cap tier
 * - Average daily trading value
 * - Relative volume (higher volume = more sensitive detection)
 *
 * @param trades - List of trades to analyze
 * @param averageTradeValue - Average trade value for relative detection
 * @param options - Optional config including full stock data for dynamic thresholds
 */
export function detectWhales(
  trades: TradeItem[],
  averageTradeValue: number,
  options: WhaleDetectionOptions = {}
): WhaleDetectionResult {
  const whaleTrades = new Set<TradeItem>();
  let whaleCount = 0;

  // Get dynamic thresholds based on full stock data
  const { whaleThreshold, tierName, isHighVolume } = getDynamicThresholds(
    options.stockData ?? null
  );

  const { RELATIVE_WHALE_MULTIPLIER, MIN_RELATIVE_WHALE_ABSOLUTE_VALUE } =
    ANALYSIS_CONFIG;

  for (const t of trades) {
    if (!t.value) continue; // Skip if value missing (should be enriched)

    // Logic 1: Absolute Whale (using dynamic threshold)
    if (t.value >= whaleThreshold) {
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

  return {
    whaleTrades,
    whaleCount,
    tierName,
    dynamicThreshold: whaleThreshold,
    isHighVolume,
  };
}
