import { TradeItem } from './stockbit-types';

export interface ShrimpDetectionResult {
  shrimpTrades: Set<TradeItem>;
  shrimpCount: number;
}

/**
 * Detects "Shrimp" trades (Retail Activity).
 *
 * Current Definition: Any trade that is NOT a Whale and NOT a Split Order.
 *
 * Future improvements may include:
 * - High Frequency Trading density check (Panic/FOMO detection)
 * - Retail Herd magnitude check
 */
export function detectShrimps(
  trades: TradeItem[],
  whaleTrades: Set<TradeItem>,
  splitTrades: Set<TradeItem>
): ShrimpDetectionResult {
  const shrimpTrades = new Set<TradeItem>();

  for (const t of trades) {
    // If it's not a whale and not a split, it's a shrimp/retail
    if (!whaleTrades.has(t) && !splitTrades.has(t)) {
      shrimpTrades.add(t);
    }
  }

  return {
    shrimpTrades,
    shrimpCount: shrimpTrades.size,
  };
}
