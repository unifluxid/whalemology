import { TradeItem } from '@/lib/stockbit-types';
import {
  getDynamicThresholds,
  StockThresholdData,
} from '@/lib/analysis-config';
import type { StockMarketData } from '@/services/market-cap-service';

// Tiered Whale Thresholds (in IDR) - Legacy/default values
export const MEGA_WHALE_THRESHOLD = 500_000_000; // 500 juta - Institutional level
export const WHALE_THRESHOLD = 200_000_000; // 200 juta - Semi-institutional
export const DOLPHIN_THRESHOLD = 100_000_000; // 100 juta - Affluent traders / small bandar
// Below 100 juta = Retail

// Keep legacy export for backward compatibility
export const CONSERVATIVE_WHALE_THRESHOLD = WHALE_THRESHOLD;

// Tier types
export type TradeTier = 'mega_whale' | 'whale' | 'dolphin' | 'retail';

/**
 * Determines the tier of a trade based on its value
 */
export function getTradeTier(value: number): TradeTier {
  if (value >= MEGA_WHALE_THRESHOLD) return 'mega_whale';
  if (value >= WHALE_THRESHOLD) return 'whale';
  if (value >= DOLPHIN_THRESHOLD) return 'dolphin';
  return 'retail';
}

/**
 * Checks if a trade is from the same broker (buyer = seller)
 * This could indicate broker crossing / internal matching
 */
export function isSameBrokerTrade(trade: TradeItem): boolean {
  if (!trade.buyer || !trade.seller) return false;

  // Extract broker code (format: "XL [D]" or "AI [A]")
  const buyerCode = trade.buyer.split(' ')[0];
  const sellerCode = trade.seller.split(' ')[0];

  return buyerCode === sellerCode;
}

/**
 * Detects Split Whale Orders using Conservative Logic.
 *
 * Logic:
 * 1. Groups trades by Symbol + Time (Seconds) + Action + Price
 * 2. Checks if Group Total Value >= 200 Million IDR
 * 3. Checks if Group contains at least 2 trades
 *
 * @param trades - List of trades to analyze
 * @returns Set of TradeItems that are part of a split whale order
 */
export interface SplitDetectionResult {
  splitTrades: Set<TradeItem>;
  splitEventCount: number;
  totalSplitValue: number;
  splitIntensityScore: number;
  dynamicSplitThreshold: number;
}

export interface SplitDetectionOptions {
  stockData?: StockThresholdData | null;
}

/**
 * Detects Split Whale Orders using Conservative Logic.
 *
 * Logic:
 * 1. Groups trades by Symbol + Time (Seconds) + Action + Price
 * 2. Checks if Group Total Value >= dynamic threshold (based on market cap + volume)
 * 3. Checks if Group contains at least 2 trades
 *
 * Thresholds are adjusted based on:
 * - Market cap tier
 * - Average daily trading value
 * - Relative volume (higher volume = more sensitive detection)
 *
 * @param trades - List of trades to analyze
 * @param stockDataMap - Optional map of stock data for per-symbol dynamic thresholds
 * @returns Set of TradeItems that are part of a split whale order
 */
export function detectSplitWhales(
  trades: TradeItem[],
  stockDataMap?: Map<string, StockMarketData> | null
): SplitDetectionResult {
  const splitGroups = new Map<string, TradeItem[]>();
  const splitWhaleTrades = new Set<TradeItem>();
  let splitEventCount = 0;
  let totalSplitValue = 0;
  let splitIntensityScore = 0;
  let lastSplitThreshold = 0;

  for (const trade of trades) {
    if (!trade.time || !trade.price) continue;

    // Key: SYMBOL|TIME|ACTION|PRICE
    // Exact second matching is conservative enough for WS data
    const key = `${trade.code}|${trade.time}|${trade.action}|${trade.price}`;

    let group = splitGroups.get(key);
    if (!group) {
      group = [];
      splitGroups.set(key, group);
    }
    group.push(trade);
  }

  // Detect and Mark Split Whales
  for (const group of splitGroups.values()) {
    if (group.length < 2) continue; // Must be at least 2 trades to be a "split"

    // Get symbol from first trade in group
    const symbol = group[0].code;

    // Get dynamic threshold for this symbol
    const stockData = stockDataMap?.get(symbol);
    const thresholdData: StockThresholdData | null = stockData
      ? {
          marketCap: stockData.marketCap,
          avgDailyValue: stockData.avgDailyValue,
          relativeVolume: stockData.relativeVolume,
          vwap: stockData.vwap,
          macd: stockData.macd,
        }
      : null;
    const { splitThreshold } = getDynamicThresholds(thresholdData);
    lastSplitThreshold = splitThreshold;

    let totalGroupValue = 0;
    for (const t of group) {
      const lot = (t.lotNum ?? Number(t.lot)) || 0;
      const price = (t.priceNum ?? Number(t.price)) || 0;
      // If value is pre-calculated, use it, else calc
      const val = t.value ?? lot * 100 * price;
      totalGroupValue += val;
    }

    // If aggregate value exceeds dynamic threshold, mark ALL as split whale
    if (totalGroupValue >= splitThreshold) {
      splitEventCount++;
      totalSplitValue += totalGroupValue;

      // Intensity score (matches logic from trade-analysis.ts)
      // Score = Value * Log(1 + Value/10M)
      const intensityWeight = Math.log(1 + totalGroupValue / 10_000_000);
      splitIntensityScore += totalGroupValue * intensityWeight;

      for (const t of group) {
        splitWhaleTrades.add(t);
      }
    }
  }

  return {
    splitTrades: splitWhaleTrades,
    splitEventCount,
    totalSplitValue,
    splitIntensityScore,
    dynamicSplitThreshold: lastSplitThreshold,
  };
}
