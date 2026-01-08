import { TradeItem } from './stockbit-types';
import { ANALYSIS_CONFIG } from './analysis-config';
import { detectSplitWhales } from './split-detection';
import { detectWhales } from './whale-detection';

// ----------------------------------------------------------------------
// Interfaces
// ----------------------------------------------------------------------

export interface AnalyzedTrade extends TradeItem {
  analysis: {
    isWhale: boolean;
    isSplitOrder: boolean;
    sameTimeCount: number;
    pattern: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL';
  };
}

export interface TradeAnalysisSummary {
  accumulationScore: number;
  distributionScore: number;
  dominantAction: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL';
  whaleCount: number;
  splitOrderCount: number;
  totalVolume: number;
  totalSplitValue: number;
  splitIntensityScore: number;
}

// Structured reason item (no HTML in data layer)
export interface AnomalyReason {
  type: 'whale' | 'split';
  count: number;
  value?: number; // For split orders
}

export interface StockAnomaly {
  symbol: string;
  reasons: AnomalyReason[];
  averagePrice: number;
  averageLot: number;
  totalVolume: number;
  totalValue: number;
  whaleCount: number;
  splitOrderCount: number;
  totalSplitValue: number;
  splitIntensityScore: number;
  topBrokers: Array<{ broker: string; count: number; action: string }>;
  dominantAction: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL';
  lastUpdate: string;
}

export interface AggregateStockAnomaliesOptions {
  hideBrokerNames?: boolean;
}

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

function parseNumberFromString(input: string): number {
  if (!input) return 0;
  // Faster replacement than regex if format is simple, but regex is safe enough
  const cleaned = input.replace(/,/g, '');
  const parsed = parseInt(cleaned, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function enrichTrade(trade: TradeItem): TradeItem {
  // If already enriched, return as is
  if (
    trade.priceNum !== undefined &&
    trade.lotNum !== undefined &&
    trade.value !== undefined &&
    trade.changeNum !== undefined
  ) {
    return trade;
  }

  const lotNum = parseNumberFromString(trade.lot);
  const priceNum = parseNumberFromString(trade.price);
  const value = priceNum * lotNum * 100; // Indonesian stocks usually 1 lot = 100 shares

  // Parse change string "+1.5%" or "-0.5%" to number
  let changeNum = 0;
  if (trade.change) {
    const changeClean = trade.change.replace('%', '').replace('+', '');
    changeNum = parseFloat(changeClean) || 0;
  }

  // Cache parsed time as seconds for time decay calculations
  let seconds = 0;
  if (trade.time) {
    const [h, m, s] = trade.time.split(':').map(Number);
    seconds = h * 3600 + m * 60 + s;
  }

  return { ...trade, lotNum, priceNum, value, changeNum, seconds };
}

/**
 * Classifies a single trade pattern based on action and price change context.
 * This ensures alignment between individual trade tags and overall summary scores.
 */
function classifyTradePattern(
  action: 'buy' | 'sell'
): 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL' {
  if (action === 'buy') {
    return 'ACCUMULATION';
  } else {
    // Action is 'sell'
    // Logic: If HAKI (Sell) occurs while price is UP (change > 0), it *might* be absorption.
    // However, purely labeling it "ACCUMULATION" can be confusing.
    // We will keep the summary scoring nuanced, but for the badge/tag,
    // if it's a Sell, we label it DISTRIBUTION to reflect the literal action,
    // unless we introduce a specific "ABSORPTION" tag later.
    // For now, to keep it simple and consistent with previous UI:
    return 'DISTRIBUTION';
  }
}

// ----------------------------------------------------------------------
// Main Logic
// ----------------------------------------------------------------------

export function analyzeTrades(trades: TradeItem[]): {
  analyzedTrades: AnalyzedTrade[];
  summary: TradeAnalysisSummary;
} {
  const sourceTrades = trades;
  // Pre-allocate to avoid repeated resizing if possible (though JS engines handle this well)
  const analyzedTrades: AnalyzedTrade[] = [];

  if (!sourceTrades || sourceTrades.length === 0) {
    return {
      analyzedTrades,
      summary: {
        accumulationScore: 0,
        distributionScore: 0,
        dominantAction: 'NEUTRAL',
        whaleCount: 0,
        splitOrderCount: 0,
        totalVolume: 0,
        totalSplitValue: 0,
        splitIntensityScore: 0,
      },
    };
  }

  const {
    MIN_SIGNIFICANT_VALUE,
    TIME_DECAY_HALF_LIFE,
    MIN_TOTAL_SCORE,
    IMBALANCE_THRESHOLD,
    ABSORPTION_MIN_VALUE,
  } = ANALYSIS_CONFIG;

  // 1. Single Pass: Enrich, Time Grouping, Total Volume
  // --------------------------------------------------
  let totalVolume = 0;
  let maxSeconds = 0; // For time decay reference

  // Using a flat Map with time string as key is standard.
  // To avoid re-creating arrays constantly, we can just push indices or store refs.
  // Storing trade objects is fine.
  const timeInfoMap = new Map<string, TradeItem[]>();

  // Use a strictly typed array for enriched items internally to avoid casting later
  const enrichedList: TradeItem[] = [];

  for (let i = 0; i < sourceTrades.length; i++) {
    const t = enrichTrade(sourceTrades[i]);
    enrichedList.push(t);
    totalVolume += t.lotNum!;

    // Use cached seconds from enrichTrade
    if (t.seconds! > maxSeconds) maxSeconds = t.seconds!;

    // Grouping for detection
    let group = timeInfoMap.get(t.time);
    if (!group) {
      group = [];
      timeInfoMap.set(t.time, group);
    }
    group.push(t);
  }

  // --- NEW: Calculate Average Trade Value for Relative Detection ---
  // Avoid division by zero
  const averageTradeValue =
    enrichedList.length > 0
      ? enrichedList.reduce((sum, t) => sum + t.value!, 0) / enrichedList.length
      : 0;

  // --- Detect if broker data is available (market closed) or not (market open) ---
  // When market is open, buyer/seller are empty due to regulation
  // When market is closed, broker data becomes available
  // const hasBrokerData = enrichedList.some(
  //   (t) => (t.buyer && t.buyer !== '') || (t.seller && t.seller !== '')
  // );

  // 2. Detection (Whale & Split)
  // ----------------------------
  // We will store detection results in Sets/Maps keyed by trade ID or Index to allow O(1) lookup.
  // Since we don't have unique stable IDs for all trades guaranteed, we'll use object reference (Set<TradeItem>)
  // 2. Detection (Whale & Split & Shrimp)
  // -------------------------------------

  // A. Detect Split Whales (Aggregated)
  const {
    splitTrades,
    splitEventCount: splitOrderCount,
    totalSplitValue,
    splitIntensityScore,
  } = detectSplitWhales(enrichedList);

  // B. Detect Single Whales (Obvious)
  const { whaleTrades, whaleCount } = detectWhales(
    enrichedList,
    averageTradeValue
  );

  // C. Detect Shrimps (The Rest)
  // implicit, but we can verify consistency if needed
  // const { shrimpTrades } = detectShrimps(enrichedList, whaleTrades, splitTrades);

  // 3. Scoring & Final Analysis Construction
  // ----------------------------------------
  let accumulationScore = 0;
  let distributionScore = 0;

  for (const t of enrichedList) {
    const isWhale = whaleTrades.has(t);
    const isSplit = splitTrades.has(t);
    // Optional: Explicit consistency check
    // const isShrimp = shrimpTrades.has(t);

    const isSignificant =
      (isWhale || isSplit) && t.value! >= MIN_SIGNIFICANT_VALUE;

    // Calculate time decay using cached seconds
    const ageMinutes = (maxSeconds - t.seconds!) / 60;
    const timeWeight = Math.exp(
      (-ageMinutes * Math.LN2) / TIME_DECAY_HALF_LIFE
    );

    // Score accumulation/distribution
    if (isSignificant) {
      const baseScore = t.value! * timeWeight;

      if (t.action === 'buy') {
        accumulationScore += baseScore;
      } else {
        // Sell logic with absorption
        if (t.changeNum! > 0) {
          // Passive accumulation / Absorption logic
          // Only count as accumulation if the trade is large enough to be a "wall" being hit
          if (t.value! >= ABSORPTION_MIN_VALUE) {
            accumulationScore += baseScore * 0.5;
            distributionScore += baseScore * 0.5;
          } else {
            // Retail profit taking / small sells on rise = Distribution (selling pressure)
            distributionScore += baseScore;
          }
        } else {
          distributionScore += baseScore;
        }
      }
    }

    // Classify pattern for UI
    let pattern: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL' = 'NEUTRAL';
    if (isSignificant) {
      pattern = classifyTradePattern(t.action);
    }

    analyzedTrades.push({
      ...t,
      analysis: {
        isWhale,
        isSplitOrder: isSplit,
        sameTimeCount: timeInfoMap.get(t.time)?.length ?? 0,
        pattern,
      },
    });
  }

  // 4. Dominant Action Summary
  // --------------------------
  const totalScore = accumulationScore + distributionScore;
  let dominantAction: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL' = 'NEUTRAL';

  if (totalScore >= MIN_TOTAL_SCORE) {
    const imbalance =
      totalScore > 0 ? (accumulationScore - distributionScore) / totalScore : 0;

    if (imbalance > IMBALANCE_THRESHOLD) {
      dominantAction = 'ACCUMULATION';
    } else if (imbalance < -IMBALANCE_THRESHOLD) {
      dominantAction = 'DISTRIBUTION';
    }
  }

  return {
    analyzedTrades,
    summary: {
      accumulationScore,
      distributionScore,
      dominantAction,
      whaleCount,
      splitOrderCount,
      totalVolume,
      totalSplitValue,
      splitIntensityScore,
    },
  };
}

export function aggregateStockAnomalies(
  trades: TradeItem[],
  options: AggregateStockAnomaliesOptions = {}
): StockAnomaly[] {
  const { hideBrokerNames = false } = options;

  // Group by symbol first
  const stocksMap = new Map<string, TradeItem[]>();
  for (const t of trades) {
    let list = stocksMap.get(t.code);
    if (!list) {
      list = [];
      stocksMap.set(t.code, list);
    }
    list.push(t);
  }

  const anomalies: StockAnomaly[] = [];

  for (const [symbol, stockTrades] of stocksMap.entries()) {
    const { analyzedTrades, summary } = analyzeTrades(stockTrades);

    // Filter out stocks that won't be displayed:
    // 1. NEUTRAL dominant action (AnomalyCard only shows ACCUMULATION/DISTRIBUTION)
    // 2. No whale or split activity
    if (summary.dominantAction === 'NEUTRAL') {
      continue;
    }
    if (summary.whaleCount === 0 && summary.splitOrderCount === 0) {
      continue;
    }

    // --- Build Anomaly Object ---

    // 1. Structured Reasons (no HTML in data layer)
    const reasons: AnomalyReason[] = [];
    if (summary.whaleCount > 0) {
      reasons.push({
        type: 'whale',
        count: summary.whaleCount,
      });
    }
    if (summary.splitOrderCount > 0) {
      reasons.push({
        type: 'split',
        count: summary.splitOrderCount,
        value: summary.totalSplitValue,
      });
    }

    // 2. Stats
    // Assuming analyzedTrades are already enriched
    let totalValue = 0;
    let totalPriceVolume = 0;

    for (const t of analyzedTrades) {
      totalValue += t.value!;
      totalPriceVolume += t.priceNum! * t.lotNum!;
    }

    // Safety check for division by zero
    const count = analyzedTrades.length;
    const totalLots = summary.totalVolume;

    const averageLot = count > 0 ? totalLots / count : 0;
    const averagePrice = totalLots > 0 ? totalPriceVolume / totalLots : 0;

    // 3. Top Brokers (only when broker data is available)
    let finalBrokers: Array<{ broker: string; count: number; action: string }> =
      [];

    // Check if broker data is available (market closed)
    const hasBrokerData = stockTrades.some(
      (t) => (t.buyer && t.buyer !== '') || (t.seller && t.seller !== '')
    );

    if (hasBrokerData) {
      const brokerStats = new Map<string, { count: number; action: string }>();

      // Only analyze brokers from significant events (Whale or Split)
      const significantTrades = analyzedTrades.filter(
        (t) => t.analysis.isWhale || t.analysis.isSplitOrder
      );

      for (const t of significantTrades) {
        const side = t.action;
        const tBroker = side === 'buy' ? t.buyer : t.seller;
        if (!tBroker) continue; // Skip empty broker

        let entry = brokerStats.get(tBroker);
        if (!entry) {
          entry = { count: 0, action: t.action };
          brokerStats.set(tBroker, entry);
        }
        entry.count++;
      }

      const sortedBrokers = Array.from(brokerStats.entries())
        .map(([broker, data]) => ({ broker, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      // Apply strict privacy masking
      finalBrokers = sortedBrokers.map((entry, idx) => {
        let displayName = entry.broker;

        // Mask if forced by option OR if broker is marked as hidden
        let shouldMask = hideBrokerNames;

        if (!shouldMask) {
          const significantTrades = analyzedTrades.filter(
            (t) => t.analysis.isWhale || t.analysis.isSplitOrder
          );
          const hasHiddenBroker = significantTrades.some((t) => {
            const tBroker = t.action === 'buy' ? t.buyer : t.seller;
            return tBroker === entry.broker && !t.is_broker_exists;
          });
          if (hasHiddenBroker) shouldMask = true;
        }

        if (shouldMask) {
          displayName = `BROKER_${idx + 1}`;
        }

        return { ...entry, broker: displayName };
      });
    }

    // 4. Last Update
    // Efficient max finding
    let lastUpdate = '';
    if (stockTrades.length > 0) {
      // Assuming sorted by time? Usually yes, but safer to loop
      // Or just take the maxSeconds logic if we kept it?
      // simple loop:
      for (const t of stockTrades) {
        if (t.time > lastUpdate) lastUpdate = t.time;
      }
    } else {
      lastUpdate = new Date().toLocaleTimeString();
    }

    const anomalyObj: StockAnomaly = {
      symbol,
      reasons,
      averagePrice,
      averageLot,
      totalVolume: summary.totalVolume,
      totalValue,
      whaleCount: summary.whaleCount,
      splitOrderCount: summary.splitOrderCount,
      totalSplitValue: summary.totalSplitValue,
      splitIntensityScore: summary.splitIntensityScore,
      topBrokers: finalBrokers,
      dominantAction: summary.dominantAction,
      lastUpdate,
    };

    anomalies.push(anomalyObj);
  }

  // Sort: Highest volume first
  return anomalies.sort((a, b) => b.totalVolume - a.totalVolume);
}
