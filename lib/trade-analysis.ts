import { TradeItem } from './stockbit-types';
import { ANALYSIS_CONFIG } from './analysis-config';

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

export interface StockAnomaly {
  symbol: string;
  reasons: string[];
  averagePrice: number;
  averageLot: number;
  totalVolume: number;
  totalValue: number;
  whaleCount: number;
  splitOrderCount: number;
  totalSplitValue: number;
  splitIntensityScore: number;
  topBrokers: Array<{ broker: string; count: number; action: string }>;
  dominantAction: 'ACCUMULATION' | 'DISTRIBUTION';
  lastUpdate: string;
  confidenceScore: number;
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
  // Optimized: check length before regex
  let changeNum = 0;
  if (trade.change) {
    const changeClean = trade.change.replace('%', '').replace('+', '');
    changeNum = parseFloat(changeClean) || 0;
  }

  return { ...trade, lotNum, priceNum, value, changeNum };
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

/**
 * Calculates a confidence score (1-6) based on anomaly severity.
 */
export function calculateConfidenceScore(anomaly: StockAnomaly): number {
  let score = 0;
  const {
    CONFIDENCE_WHALE_HIGH_VALUE,
    CONFIDENCE_SPLIT_HIGH_VALUE,
    CONFIDENCE_SPLIT_MEDIUM_VALUE,
  } = ANALYSIS_CONFIG;

  // Factor 1: Whale Intensity
  if (anomaly.whaleCount >= 3) {
    score += 2;
    const avgWhaleValue =
      anomaly.whaleCount > 0 ? anomaly.totalValue / anomaly.whaleCount : 0;
    if (avgWhaleValue > CONFIDENCE_WHALE_HIGH_VALUE) score += 1;
  } else if (anomaly.whaleCount >= 1) {
    score += 1;
    if (anomaly.totalValue >= 500_000_000) score += 0.5;
  }

  // Factor 2: Split Order Intensity
  if (anomaly.totalSplitValue >= CONFIDENCE_SPLIT_HIGH_VALUE) {
    score += 2;
  } else if (anomaly.totalSplitValue >= CONFIDENCE_SPLIT_MEDIUM_VALUE) {
    score += 1.5;
  } else if (
    anomaly.splitOrderCount >= 2 &&
    anomaly.totalSplitValue >= 100_000_000
  ) {
    score += 1;
  } else if (
    anomaly.splitOrderCount >= 1 &&
    anomaly.totalSplitValue >= 50_000_000
  ) {
    score += 0.5;
  }

  // Factor 3: Broker Concentration
  if (anomaly.topBrokers.length > 0) {
    const totalEvents = anomaly.topBrokers.reduce((sum, b) => sum + b.count, 0);
    if (totalEvents > 0) {
      const maxShare = anomaly.topBrokers[0].count / totalEvents;
      if (maxShare >= 0.5) {
        score += 1; // Dominant broker
      }
    }
  }

  return Math.min(Math.max(Math.round(score + 1), 1), 6);
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
    WHALE_SINGLE_TRADE_THRESHOLD,
    WHALE_GROUPED_TRADE_THRESHOLD,
    MIN_SIGNIFICANT_VALUE,
    SPLIT_ORDER_THRESHOLD,
    MIN_SPLIT_TOTAL_VALUE,
    TIME_DECAY_HALF_LIFE,
    MIN_TOTAL_SCORE,
    IMBALANCE_THRESHOLD,
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

    // Time decay calculation prep
    const [h, m, s] = t.time.split(':').map(Number);
    const secs = h * 3600 + m * 60 + s;
    if (secs > maxSeconds) maxSeconds = secs;

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

  const {
    RELATIVE_WHALE_MULTIPLIER,
    MIN_RELATIVE_WHALE_ABSOLUTE_VALUE,
    ABSORPTION_MIN_VALUE,
  } = ANALYSIS_CONFIG;

  // 2. Detection (Whale & Split)
  // ----------------------------
  // We will store detection results in Sets/Maps keyed by trade ID or Index to allow O(1) lookup.
  // Since we don't have unique stable IDs for all trades guaranteed, we'll use object reference (Set<TradeItem>)
  const whaleTrades = new Set<TradeItem>();
  const splitTrades = new Set<TradeItem>();

  let whaleCount = 0; // Number of unique "whale events" (single or group)
  let splitOrderCount = 0; // Number of unique "split events"
  let totalSplitValue = 0;
  let splitIntensityScore = 0;

  // Iterate over time groups
  for (const groupTrades of timeInfoMap.values()) {
    // Sub-grouping for detection logic
    // We need to group by:
    // - Whale: Side + Broker
    // - Split: Side + Broker (and conceptually Price, though we allow sweeping)

    // Key: "Side|Broker", Value: List of trades
    const subGroups = new Map<string, TradeItem[]>();

    // 1.a Detect Single Whales immediately & build subgroups
    for (const t of groupTrades) {
      // Logic 1: Absolute Whale
      if (t.value! >= WHALE_SINGLE_TRADE_THRESHOLD) {
        if (!whaleTrades.has(t)) {
          whaleTrades.add(t);
          whaleCount++; // A single trade is 1 event
        }
      }
      // Logic 2: Relative Whale (Local Whale)
      else if (
        t.value! >= MIN_RELATIVE_WHALE_ABSOLUTE_VALUE &&
        t.value! >= averageTradeValue * RELATIVE_WHALE_MULTIPLIER
      ) {
        if (!whaleTrades.has(t)) {
          whaleTrades.add(t);
          whaleCount++;
        }
      }

      const side = t.action;
      const broker =
        side === 'buy' ? t.buyer || 'UNKNOWN' : t.seller || 'UNKNOWN';
      const key = `${side}|${broker}`;

      let subList = subGroups.get(key);
      if (!subList) {
        subList = [];
        subGroups.set(key, subList);
      }
      subList.push(t);
    }

    // 1.b Detect Grouped Whales & Split Orders from subgroups
    for (const trades of subGroups.values()) {
      const count = trades.length;
      if (count <= 0) continue;

      const totalValue = trades.reduce((sum, t) => sum + t.value!, 0);

      // --- Grouped Whale Check ---
      // Check if not already counted as single whales?
      // Actually, if a group forms a whale event, all trades inside are whale trades.
      // If sum > threshold and count > 1
      if (count > 1 && totalValue >= WHALE_GROUPED_TRADE_THRESHOLD) {
        // This is a grouped whale event
        whaleCount++;
        for (const t of trades) {
          whaleTrades.add(t);
        }
      }

      // --- Split Order Check ---
      // Logic: High frequency (count > threshold) AND significant value
      if (count > SPLIT_ORDER_THRESHOLD) {
        if (totalValue >= MIN_SPLIT_TOTAL_VALUE) {
          splitOrderCount++;
          totalSplitValue += totalValue;

          // Intensity score
          const intensityWeight = Math.log(1 + totalValue / 10_000_000);
          splitIntensityScore += totalValue * intensityWeight;

          for (const t of trades) {
            splitTrades.add(t);
          }
        }
      }
    }
  }

  // 3. Scoring & Final Analysis Construction
  // ----------------------------------------
  let accumulationScore = 0;
  let distributionScore = 0;

  for (const t of enrichedList) {
    const isWhale = whaleTrades.has(t);
    const isSplit = splitTrades.has(t);

    const isSignificant =
      (isWhale || isSplit) && t.value! >= MIN_SIGNIFICANT_VALUE;

    // Calculate time decay
    // Re-calculate seconds here or store it on enriched?
    // Optimization: Calculate once.
    const [h, m, s] = t.time.split(':').map(Number);
    const tSecs = h * 3600 + m * 60 + s;
    const ageMinutes = (maxSeconds - tSecs) / 60;
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

    // Filter out uninteresting stocks
    if (
      summary.whaleCount === 0 &&
      summary.splitOrderCount === 0 &&
      summary.dominantAction === 'NEUTRAL'
    ) {
      continue;
    }

    // --- Build Anomaly Object ---

    // 1. Reasons HTML
    const reasons: string[] = [];
    if (summary.whaleCount > 0) {
      reasons.push(
        `🐋 <span class="text-foreground font-semibold">${summary.whaleCount}</span> whale trade${summary.whaleCount > 1 ? 's' : ''}`
      );
    }
    if (summary.splitOrderCount > 0) {
      let formattedValue = '';
      if (summary.totalSplitValue >= 1_000_000_000) {
        formattedValue = `${(summary.totalSplitValue / 1_000_000_000).toFixed(1)}B`;
      } else if (summary.totalSplitValue >= 1_000_000) {
        formattedValue = `${(summary.totalSplitValue / 1_000_000).toFixed(0)}M`;
      } else {
        formattedValue = `${(summary.totalSplitValue / 1_000).toFixed(0)}K`;
      }

      reasons.push(
        `🧩 <span class="text-foreground font-semibold">${summary.splitOrderCount}</span> split order${summary.splitOrderCount > 1 ? 's' : ''} (~${formattedValue})`
      );
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

    // 3. Top Brokers
    const brokerStats = new Map<string, { count: number; action: string }>();

    // Only analyze brokers from significant events (Whale or Split)
    const significantTrades = analyzedTrades.filter(
      (t) => t.analysis.isWhale || t.analysis.isSplitOrder
    );

    for (const t of significantTrades) {
      const side = t.action;
      const tBroker = side === 'buy' ? t.buyer : t.seller;
      const brokerName = tBroker || 'UNKNOWN';

      let entry = brokerStats.get(brokerName);
      if (!entry) {
        entry = { count: 0, action: t.action };
        brokerStats.set(brokerName, entry);
      }
      entry.count++;
    }

    const sortedBrokers = Array.from(brokerStats.entries())
      .map(([broker, data]) => ({ broker, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // Apply strict privacy masking
    const finalBrokers = sortedBrokers.map((entry, idx) => {
      let displayName = entry.broker;

      // Mask if forced by option OR if checks fail
      let shouldMask = hideBrokerNames;

      if (!shouldMask) {
        // Check if any significant trade with this broker has is_broker_exists = false
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
      dominantAction: summary.dominantAction as 'ACCUMULATION' | 'DISTRIBUTION',
      lastUpdate,
      confidenceScore: 0,
    };

    anomalyObj.confidenceScore = calculateConfidenceScore(anomalyObj);
    anomalies.push(anomalyObj);
  }

  // Sort: Highest volume first
  return anomalies.sort((a, b) => b.totalVolume - a.totalVolume);
}
