'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { TradeItem } from '@/lib/stockbit-types';

import {
  detectSplitWhales,
  getTradeTier,
  isSameBrokerTrade,
  MEGA_WHALE_THRESHOLD,
  WHALE_THRESHOLD,
  DOLPHIN_THRESHOLD,
} from '@/lib/split-detection';

// Stats per tier
export interface TierStats {
  buyVolume: number;
  sellVolume: number;
  buyValue: number;
  sellValue: number;
  buyCount: number;
  sellCount: number;
  netValue: number;
}

export interface SizeBucketStats {
  buyVolume: number;
  sellVolume: number;
  buyValue: number;
  sellValue: number;
  buyCount: number;
  sellCount: number;
  netValue: number;
}

export interface SymbolOrderFlow {
  symbol: string;
  // Volume stats
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
  buyPercentage: number;
  sellPercentage: number;

  // Value stats (price * volume)
  buyValue: number;
  sellValue: number;
  totalValue: number;

  // Delta (buy - sell)
  volumeDelta: number; // in lots
  valueDelta: number; // in rupiah

  // Trade count
  buyCount: number;
  sellCount: number;
  totalCount: number;

  // TIERED stats (per symbol) - NEW!
  megaWhaleNetValue: number; // 🐋🐋 >= 500M
  whaleNetValue: number; // 🐋 >= 200M
  dolphinNetValue: number; // 🐬 >= 100M
  retailNetValue: number; // 🦐 < 100M

  // Combined whale (Mega + Whale) for backwards compatibility
  combinedWhaleNetValue: number;

  // Same-broker trades count (potential crossing)
  sameBrokerCount: number;
  sameBrokerValue: number;

  // Legacy buckets (keeping for backward compat)
  shrimpNetValue: number;
  whaleVolume: number;
  shrimpVolume: number;

  // Pressure indicators
  pressure: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  pressureScore: number; // -100 to +100

  // Latest price info
  lastPrice: number;
  priceChange: number;

  // Signal Indicators
  signal: 'accumulation' | 'distribution' | 'markup' | 'markdown' | 'neutral';
  signalScore: number;

  // Entry Strategy
  whaleVWAP: number;
  bestEntryPrice: number;
}

export interface OrderFlowResult {
  // Per-symbol data
  hotBuying: SymbolOrderFlow[]; // Top stocks with buying pressure
  hotSelling: SymbolOrderFlow[]; // Top stocks with selling pressure
  allSymbols: SymbolOrderFlow[]; // All symbols sorted by absolute pressure

  // Global Lists
  topWhaleAccum: SymbolOrderFlow[]; // Top stocks bought by whales
  topWhaleDump: SymbolOrderFlow[]; // Top stocks sold by whales
  topShrimpAccum: SymbolOrderFlow[]; // Top stocks bought by shrimp
  topShrimpDump: SymbolOrderFlow[]; // Top stocks sold by shrimp

  // Aggregate stats
  totalBuyVolume: number;
  totalSellVolume: number;
  totalBuyValue: number;
  totalSellValue: number;
  overallPressure: number;

  // Global Buckets
  whaleStats: SizeBucketStats;
  shrimpStats: SizeBucketStats;
}

/**
 * Calculate order flow statistics per symbol from trade data.
 */
export function calculatePerSymbolOrderFlow(
  trades: TradeItem[]
): OrderFlowResult {
  const symbolMap = new Map<string, TradeItem[]>();

  // Global Accumulators
  const globalWhale: SizeBucketStats = {
    buyVolume: 0,
    sellVolume: 0,
    buyValue: 0,
    sellValue: 0,
    buyCount: 0,
    sellCount: 0,
    netValue: 0,
  };
  const globalShrimp: SizeBucketStats = {
    buyVolume: 0,
    sellVolume: 0,
    buyValue: 0,
    sellValue: 0,
    buyCount: 0,
    sellCount: 0,
    netValue: 0,
  };

  // --- SPLIT ORDER DETECTION (Conservative) ---
  const { splitTrades } = detectSplitWhales(trades);

  let totalBuyVolume = 0;
  let totalSellVolume = 0;
  let totalBuyValue = 0;
  let totalSellValue = 0;

  for (const trade of trades) {
    const symbol = trade.code;
    if (!symbolMap.has(symbol)) {
      symbolMap.set(symbol, []);
    }
    symbolMap.get(symbol)!.push(trade);
  }

  const symbolStats: SymbolOrderFlow[] = [];

  for (const [symbol, symbolTrades] of symbolMap) {
    let buyVolume = 0;
    let sellVolume = 0;
    let buyValue = 0;
    let sellValue = 0;
    let buyCount = 0;
    let sellCount = 0;
    let lastPrice = 0;
    let priceChange = 0;

    // TIERED tracking
    let megaWhaleNetValue = 0;
    let whaleNetValue = 0;
    let dolphinNetValue = 0;
    let retailNetValue = 0;

    // Legacy tracking (for backward compat)
    let shrimpNetValue = 0;
    let whaleVolume = 0;
    let shrimpVolume = 0;
    let whaleBuyValue = 0;
    let whaleBuyVolume = 0;

    // Same-broker detection
    let sameBrokerCount = 0;
    let sameBrokerValue = 0;

    for (const trade of symbolTrades) {
      const lot = (trade.lotNum ?? Number(trade.lot)) || 0;
      const price = (trade.priceNum ?? Number(trade.price)) || 0;
      const value = trade.value ?? lot * 100 * price;
      const isBuy = trade.action === 'buy';

      // Get latest price and change
      if (lastPrice === 0) {
        lastPrice = price;
        priceChange = trade.changeNum ?? 0;
      }

      if (isBuy) {
        buyVolume += lot;
        buyValue += value;
        buyCount++;
      } else {
        sellVolume += lot;
        sellValue += value;
        sellCount++;
      }

      // Same-broker detection
      if (isSameBrokerTrade(trade)) {
        sameBrokerCount++;
        sameBrokerValue += value;
      }

      // TIERED Bucketing
      const tier = getTradeTier(value);
      const isSplitWhale = splitTrades.has(trade);
      const signedValue = isBuy ? value : -value;

      // Apply to appropriate tier
      if (
        tier === 'mega_whale' ||
        (isSplitWhale && value >= MEGA_WHALE_THRESHOLD)
      ) {
        megaWhaleNetValue += signedValue;
        whaleVolume += lot;
        if (isBuy) {
          globalWhale.buyValue += value;
          globalWhale.buyVolume += lot;
          globalWhale.buyCount++;
          whaleBuyValue += value;
          whaleBuyVolume += lot;
        } else {
          globalWhale.sellValue += value;
          globalWhale.sellVolume += lot;
          globalWhale.sellCount++;
        }
      } else if (
        tier === 'whale' ||
        (isSplitWhale && value >= WHALE_THRESHOLD)
      ) {
        whaleNetValue += signedValue;
        whaleVolume += lot;
        if (isBuy) {
          globalWhale.buyValue += value;
          globalWhale.buyVolume += lot;
          globalWhale.buyCount++;
          whaleBuyValue += value;
          whaleBuyVolume += lot;
        } else {
          globalWhale.sellValue += value;
          globalWhale.sellVolume += lot;
          globalWhale.sellCount++;
        }
      } else if (
        tier === 'dolphin' ||
        (isSplitWhale && value >= DOLPHIN_THRESHOLD)
      ) {
        dolphinNetValue += signedValue;
      } else {
        // Retail tier
        retailNetValue += signedValue;
        shrimpNetValue += signedValue; // Legacy compat
        shrimpVolume += lot;
        if (isBuy) {
          globalShrimp.buyValue += value;
          globalShrimp.buyVolume += lot;
          globalShrimp.buyCount++;
        } else {
          globalShrimp.sellValue += value;
          globalShrimp.sellVolume += lot;
          globalShrimp.sellCount++;
        }
      }
    }

    const symbolTotalVolume = buyVolume + sellVolume;
    const symbolTotalValue = buyValue + sellValue;

    // Skip symbols with no volume
    if (symbolTotalVolume === 0) continue;

    const buyPercentage = (buyVolume / symbolTotalVolume) * 100;
    const sellPercentage = (sellVolume / symbolTotalVolume) * 100;
    const volumeDelta = buyVolume - sellVolume;
    const valueDelta = buyValue - sellValue;

    // Calculate pressure score
    const volumeScore = (volumeDelta / symbolTotalVolume) * 100;
    const valueScore =
      symbolTotalValue > 0 ? (valueDelta / symbolTotalValue) * 100 : 0;
    const pressureScore = Math.round((volumeScore + valueScore) / 2);

    // Determine pressure level
    let pressure: SymbolOrderFlow['pressure'];
    if (pressureScore >= 30) pressure = 'strong_buy';
    else if (pressureScore >= 10) pressure = 'buy';
    else if (pressureScore <= -30) pressure = 'strong_sell';
    else if (pressureScore <= -10) pressure = 'sell';
    else pressure = 'neutral';

    // Combined whale for signal detection (Mega + Whale)
    const combinedWhaleNetValue = megaWhaleNetValue + whaleNetValue;

    // Determine Signal based on Combined Whale vs Retail Net Value
    let signal: SymbolOrderFlow['signal'] = 'neutral';
    let signalScore = 0;

    // Strong Signal Threshold (e.g. 50M IDR divergence)
    const SIGNAL_THRESHOLD = 50_000_000;

    // 1. Accumulation: Whale Buy, Retail Sell (Smart money collecting)
    if (
      combinedWhaleNetValue > SIGNAL_THRESHOLD &&
      retailNetValue < -SIGNAL_THRESHOLD
    ) {
      signal = 'accumulation';
      signalScore = 2; // Strongest Bullish
    }
    // 2. Markup: Whale Buy, Retail Following (Strong trend)
    else if (
      combinedWhaleNetValue > SIGNAL_THRESHOLD &&
      retailNetValue > SIGNAL_THRESHOLD
    ) {
      signal = 'markup';
      signalScore = 1; // Bullish continuation
    }
    // 3. Distribution: Whale Sell, Retail Buy (Smart money dumping)
    else if (
      combinedWhaleNetValue < -SIGNAL_THRESHOLD &&
      retailNetValue > SIGNAL_THRESHOLD
    ) {
      signal = 'distribution';
      signalScore = -2; // Strongest Bearish
    }
    // 4. Markdown/Panic: Whale Sell, Retail Sell (Crash)
    else if (
      combinedWhaleNetValue < -SIGNAL_THRESHOLD &&
      retailNetValue < -SIGNAL_THRESHOLD
    ) {
      signal = 'markdown';
      signalScore = -1; // Bearish continuation
    }
    // 5. Special Case: Bottom Fishing (Price Drop but Whale Buying)
    else if (priceChange < 0 && combinedWhaleNetValue > SIGNAL_THRESHOLD) {
      signal = 'accumulation';
      signalScore = 2;
    }

    // Calculate Whale VWAP and Best Entry
    let whaleVWAP = 0;
    let bestEntryPrice = 0;

    if (whaleBuyVolume > 0) {
      // VWAP = Total Value / Total Volume / 100 (shares per lot)
      whaleVWAP = Math.round(whaleBuyValue / (whaleBuyVolume * 100));

      // Strategy:
      // Markup (Strong Uptrend) -> Entry at VWAP
      // Accumulation (Collecting) -> Entry slightly below VWAP (bargain hunting)
      if (signal === 'markup') {
        bestEntryPrice = whaleVWAP;
      } else if (signal === 'accumulation') {
        // 1-2 ticks below VWAP (approx 1%)
        bestEntryPrice = Math.round(whaleVWAP * 0.99);
      } else {
        // Default to VWAP if neutral but whale buying exists
        bestEntryPrice = whaleVWAP;
      }
    }

    symbolStats.push({
      symbol,
      buyVolume,
      sellVolume,
      totalVolume: symbolTotalVolume,
      buyPercentage,
      sellPercentage,
      buyValue,
      sellValue,
      totalValue: symbolTotalValue,
      volumeDelta,
      valueDelta,
      buyCount,
      sellCount,
      totalCount: buyCount + sellCount,
      // TIERED stats
      megaWhaleNetValue,
      whaleNetValue,
      dolphinNetValue,
      retailNetValue,
      combinedWhaleNetValue,
      // Same-broker
      sameBrokerCount,
      sameBrokerValue,
      // Legacy
      shrimpNetValue,
      whaleVolume,
      shrimpVolume,
      pressure,
      pressureScore,
      lastPrice,
      priceChange,
      signal,
      signalScore,
      whaleVWAP,
      bestEntryPrice,
    });

    totalBuyVolume += buyVolume;
    totalSellVolume += sellVolume;
    totalBuyValue += buyValue;
    totalSellValue += sellValue;
  }

  // Calculate global nets
  globalWhale.netValue = globalWhale.buyValue - globalWhale.sellValue;
  globalShrimp.netValue = globalShrimp.buyValue - globalShrimp.sellValue;

  // Sort and split into hot buying and hot selling
  const hotBuying = symbolStats
    .filter((s) => s.pressureScore > 0)
    .sort((a, b) => b.pressureScore - a.pressureScore)
    .slice(0, 15);

  const hotSelling = symbolStats
    .filter((s) => s.pressureScore < 0)
    .sort((a, b) => a.pressureScore - b.pressureScore)
    .slice(0, 15);

  const allSymbols = [...symbolStats].sort(
    (a, b) => Math.abs(b.pressureScore) - Math.abs(a.pressureScore)
  );

  // Top Lists
  const topWhaleAccum = symbolStats
    .filter((s) => s.whaleNetValue > 0)
    .sort((a, b) => b.whaleNetValue - a.whaleNetValue)
    .slice(0, 10);
  const topWhaleDump = symbolStats
    .filter((s) => s.whaleNetValue < 0)
    .sort((a, b) => a.whaleNetValue - b.whaleNetValue)
    .slice(0, 10); // Most negative first (ascending)
  const topShrimpAccum = symbolStats
    .filter((s) => s.shrimpNetValue > 0)
    .sort((a, b) => b.shrimpNetValue - a.shrimpNetValue)
    .slice(0, 10);
  const topShrimpDump = symbolStats
    .filter((s) => s.shrimpNetValue < 0)
    .sort((a, b) => a.shrimpNetValue - b.shrimpNetValue)
    .slice(0, 10);

  const overallTotal = totalBuyVolume + totalSellVolume;
  const overallPressure =
    overallTotal > 0
      ? Math.round(((totalBuyVolume - totalSellVolume) / overallTotal) * 100)
      : 0;

  return {
    hotBuying,
    hotSelling,
    allSymbols,
    topWhaleAccum,
    topWhaleDump,
    topShrimpAccum,
    topShrimpDump,
    totalBuyVolume,
    totalSellVolume,
    totalBuyValue,
    totalSellValue,
    overallPressure,
    whaleStats: globalWhale,
    shrimpStats: globalShrimp,
  };
}

interface UseOrderFlowProps {
  trades: TradeItem[] | null;
}

/**
 * Hook for calculating real-time per-symbol order flow statistics.
 * UNTHROTTLED - recalculates on every trades change.
 * Use useOrderFlowThrottled for better performance with large datasets.
 */
export function useOrderFlow({ trades }: UseOrderFlowProps): OrderFlowResult {
  return useMemo(() => {
    if (!trades || trades.length === 0) {
      return {
        hotBuying: [],
        hotSelling: [],
        allSymbols: [],
        topWhaleAccum: [],
        topWhaleDump: [],
        topShrimpAccum: [],
        topShrimpDump: [],
        totalBuyVolume: 0,
        totalSellVolume: 0,
        totalBuyValue: 0,
        totalSellValue: 0,
        overallPressure: 0,
        whaleStats: {
          buyVolume: 0,
          sellVolume: 0,
          buyValue: 0,
          sellValue: 0,
          buyCount: 0,
          sellCount: 0,
          netValue: 0,
        },
        shrimpStats: {
          buyVolume: 0,
          sellVolume: 0,
          buyValue: 0,
          sellValue: 0,
          buyCount: 0,
          sellCount: 0,
          netValue: 0,
        },
      };
    }

    return calculatePerSymbolOrderFlow(trades);
  }, [trades]);
}

// Default throttle interval (ms)
const DEFAULT_THROTTLE_INTERVAL = 500;

// Empty result for initial state
const EMPTY_RESULT: OrderFlowResult = {
  hotBuying: [],
  hotSelling: [],
  allSymbols: [],
  topWhaleAccum: [],
  topWhaleDump: [],
  topShrimpAccum: [],
  topShrimpDump: [],
  totalBuyVolume: 0,
  totalSellVolume: 0,
  totalBuyValue: 0,
  totalSellValue: 0,
  overallPressure: 0,
  whaleStats: {
    buyVolume: 0,
    sellVolume: 0,
    buyValue: 0,
    sellValue: 0,
    buyCount: 0,
    sellCount: 0,
    netValue: 0,
  },
  shrimpStats: {
    buyVolume: 0,
    sellVolume: 0,
    buyValue: 0,
    sellValue: 0,
    buyCount: 0,
    sellCount: 0,
    netValue: 0,
  },
};

interface UseOrderFlowThrottledProps {
  trades: TradeItem[] | null;
  /** Throttle interval in ms (default: 500ms) */
  interval?: number;
  /** Whether analysis is enabled (default: true) */
  enabled?: boolean;
}

interface UseOrderFlowThrottledResult extends OrderFlowResult {
  /** Whether analysis is currently running */
  isAnalyzing: boolean;
  /** Timestamp of last completed analysis */
  lastAnalyzedAt: number;
  /** Number of trades analyzed */
  tradeCount: number;
}

/**
 * THROTTLED version of useOrderFlow.
 * Runs analysis on a fixed interval (default 500ms) instead of on every change.
 * Reduces CPU usage by ~90% for large datasets with real-time updates.
 *
 * @example
 * const orderFlow = useOrderFlowThrottled({
 *   trades: rawData?.data.running_trade ?? null,
 *   interval: 500,  // Analyze every 500ms
 *   enabled: true   // Turn off when paused
 * });
 */
export function useOrderFlowThrottled({
  trades,
  interval = DEFAULT_THROTTLE_INTERVAL,
  enabled = true,
}: UseOrderFlowThrottledProps): UseOrderFlowThrottledResult {
  const [result, setResult] = useState<OrderFlowResult>(EMPTY_RESULT);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState(0);

  // Use ref to always have latest trades without triggering effect
  const tradesRef = useRef<TradeItem[] | null>(trades);
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep ref updated
  useEffect(() => {
    tradesRef.current = trades;
  }, [trades]);

  // Run analysis on interval
  useEffect(() => {
    // Clear existing interval
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    if (!enabled) {
      return;
    }

    // Immediate first analysis
    const runAnalysis = () => {
      const currentTrades = tradesRef.current;

      if (!currentTrades || currentTrades.length === 0) {
        setResult(EMPTY_RESULT);
        setIsAnalyzing(false);
        return;
      }

      setIsAnalyzing(true);

      // Use requestAnimationFrame to yield to UI thread
      requestAnimationFrame(() => {
        const analysisResult = calculatePerSymbolOrderFlow(currentTrades);
        setResult(analysisResult);
        setIsAnalyzing(false);
        setLastAnalyzedAt(Date.now());
      });
    };

    // Run immediately on mount/enable
    runAnalysis();

    // Set up interval
    intervalIdRef.current = setInterval(runAnalysis, interval);

    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, [enabled, interval]);

  return {
    ...result,
    isAnalyzing,
    lastAnalyzedAt,
    tradeCount: trades?.length ?? 0,
  };
}
