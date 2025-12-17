/* eslint-disable @typescript-eslint/no-explicit-any */
import { TradeItem } from './stockbit-types';
// import { useTradeStore } from '@/store/trade-store'; // REMOVED

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
  totalSplitValue: number; // Total value dari semua split order events
  splitIntensityScore: number; // Weighted score berdasarkan value + frequency
}

export interface StockAnomaly {
  symbol: string;
  reasons: string[];
  averagePrice: number;
  averageLot: number;
  totalVolume: number;
  totalValue: number; // Total value in currency (price × volume)
  whaleCount: number;
  splitOrderCount: number;
  totalSplitValue: number; // Total value dari split orders saja
  splitIntensityScore: number; // Weighted split intensity
  topBrokers: Array<{ broker: string; count: number; action: string }>;
  dominantAction: 'ACCUMULATION' | 'DISTRIBUTION';
  lastUpdate: string;
  confidenceScore: number; // 1-6 Likert scale
}

export interface AggregateStockAnomaliesOptions {
  /**
   * Jika true, nama broker akan dimasking (BROKER_1, BROKER_2, ...)
   * supaya tidak melanggar regulasi saat jam market.
   */
  hideBrokerNames?: boolean;
}

// Internal helper type – normalized numeric fields
interface EnrichedTrade extends TradeItem {
  lotNum: number;
  priceNum: number;
  value: number; // priceNum * lotNum * 100
  index: number;
  timeSeconds: number; // Seconds since start of day (0-86399) or similar
  changeNum: number; // Percentage change as number (e.g. 1.5 for +1.5%)
}

// Thresholds & parameters
import { ANALYSIS_CONFIG } from './analysis-config';

const {
  WHALE_SINGLE_TRADE_THRESHOLD,
  WHALE_GROUPED_TRADE_THRESHOLD,
  MIN_SIGNIFICANT_VALUE,
  SPLIT_ORDER_THRESHOLD,
  MIN_SPLIT_TOTAL_VALUE,
  TIME_DECAY_HALF_LIFE,
  MIN_TOTAL_SCORE,
} = ANALYSIS_CONFIG;

export function parseNumberFromString(input: string): number {
  const cleaned = input.replace(/,/g, '');
  const parsed = parseInt(cleaned, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function enrichTrade(trade: TradeItem): TradeItem {
  if (
    trade.priceNum !== undefined &&
    trade.lotNum !== undefined &&
    trade.value !== undefined &&
    (trade as any).changeNum !== undefined
  ) {
    return trade;
  }
  const lotNum = parseNumberFromString(trade.lot);
  const priceNum = parseNumberFromString(trade.price);
  const value = priceNum * lotNum * 100;
  // Parse change string "+1.5%" or "-0.5%" to number
  const changeClean = trade.change.replace('%', '').replace('+', '');
  const changeNum = parseFloat(changeClean) || 0;

  return { ...trade, lotNum, priceNum, value, changeNum } as TradeItem & {
    changeNum: number;
  };
}

// Calculate confidence score (1-6 Likert scale)
export function calculateConfidenceScore(anomaly: StockAnomaly): number {
  let score = 0;

  // Factor 1: Whale Intensity (Combined Count & Value influence) (0-3 points)
  // We avoid double counting simply adding Count + Total Value.
  // Instead, we score based on "Whale Presence Quality".
  if (anomaly.whaleCount >= 3) {
    score += 2;
    // Bonus if they are HUGE whales average
    const avgWhaleValue =
      anomaly.whaleCount > 0 ? anomaly.totalValue / anomaly.whaleCount : 0;
    if (avgWhaleValue > 200_000_000) score += 1; // High quality whales
  } else if (anomaly.whaleCount >= 1) {
    score += 1;
    if (anomaly.totalValue >= 500_000_000) score += 0.5; // Single but huge
  }

  // Factor 2: Split Order Intensity (0-2 points)
  // Split orders indicate intent to hide.
  if (anomaly.totalSplitValue >= 500_000_000) {
    score += 2; // Strong hiding intent + High value
  } else if (anomaly.totalSplitValue >= 200_000_000) {
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

  // Factor 3: Broker Concentration (0-1 point) – High concentration = higher confidence it's a specific actor
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

export function analyzeTrades(trades: TradeItem[]): {
  analyzedTrades: AnalyzedTrade[];
  summary: TradeAnalysisSummary;
} {
  const sourceTrades = trades;
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

  // Phase 1: Enrich, Calculate Total Volume, Group by Time, and Find Max Time in one pass
  let totalVolume = 0;
  let maxSeconds = 0;
  const timeGroups = new Map<string, EnrichedTrade[]>();
  const enrichedTrades: EnrichedTrade[] = new Array(sourceTrades.length);

  for (let i = 0; i < sourceTrades.length; i++) {
    const original = sourceTrades[i];
    // Use helper to ensure enriched (should be fast if already done in store)
    const t = enrichTrade(original);

    // Calculate timeSeconds for optimization
    const parts = t.time.split(':');
    const h = Number(parts[0]) || 0;
    const m = Number(parts[1]) || 0;
    const s = Number(parts[2]) || 0;
    const timeSeconds = h * 3600 + m * 60 + s;

    if (timeSeconds > maxSeconds) {
      maxSeconds = timeSeconds;
    }

    // Cast to EnrichedTrade (we know it has num fields now) and add index
    const enriched: EnrichedTrade = {
      ...t,
      lotNum: t.lotNum!,
      priceNum: t.priceNum!,
      value: t.value!,
      changeNum: (t as any).changeNum ?? 0,
      index: i,
      timeSeconds,
    };

    enrichedTrades[i] = enriched;
    totalVolume += enriched.lotNum;

    // Grouping
    const group = timeGroups.get(enriched.time);
    if (group) {
      group.push(enriched);
    } else {
      timeGroups.set(enriched.time, [enriched]);
    }
  }

  // Flags per trade index
  const isWhaleFlags = new Array<boolean>(enrichedTrades.length).fill(false);
  const isSplitFlags = new Array<boolean>(enrichedTrades.length).fill(false);

  // Event-level counting (supaya 1 event nggak keitung berkali-kali)
  const whaleEventKeys = new Set<string>();
  const splitOrderEventKeys = new Set<string>();

  // Track split order values per event
  const splitOrderValues = new Map<string, number>();

  // 1. Deteksi whale & split order (time + side + broker [+ price])
  for (const [time, groupTrades] of timeGroups.entries()) {
    // Map untuk group whale: side + broker
    const whaleGroupValueMap = new Map<string, number>();
    const whaleGroupTradesMap = new Map<string, EnrichedTrade[]>();

    // Map untuk split order: side + broker + price
    const splitGroupTradesMap = new Map<string, EnrichedTrade[]>();

    for (const trade of groupTrades) {
      const side = trade.action;
      const brokerRaw =
        side === 'buy'
          ? (trade.buyer ?? 'UNKNOWN')
          : (trade.seller ?? 'UNKNOWN');
      const whaleKey = `${side}|${brokerRaw}`;
      // REVISI LOGIC: Hapus price constraint agar bisa detect algo "sweeping" (beli di berbagai harga sekaligus)
      const splitKey = `${side}|${brokerRaw}`;

      // Whale grouping
      const currentWhaleValue = whaleGroupValueMap.get(whaleKey) ?? 0;
      whaleGroupValueMap.set(whaleKey, currentWhaleValue + trade.value);

      const whaleTrades = whaleGroupTradesMap.get(whaleKey) ?? [];
      whaleTrades.push(trade);
      whaleGroupTradesMap.set(whaleKey, whaleTrades);

      // Split order grouping
      const splitTrades = splitGroupTradesMap.get(splitKey) ?? [];
      splitTrades.push(trade);
      splitGroupTradesMap.set(splitKey, splitTrades);
    }

    // 1.a Single-trade whale
    for (const trade of groupTrades) {
      if (trade.value >= WHALE_SINGLE_TRADE_THRESHOLD) {
        isWhaleFlags[trade.index] = true;

        const side = trade.action;
        const brokerRaw =
          side === 'buy'
            ? (trade.buyer ?? 'UNKNOWN')
            : (trade.seller ?? 'UNKNOWN');
        const eventKey = `single|${time}|${side}|${brokerRaw}|${trade.priceNum}|${trade.lotNum}`;
        whaleEventKeys.add(eventKey);
      }
    }

    // 1.b Grouped whale: total value dalam 1 detik per side+broker
    for (const [whaleKey, totalValueInSecond] of whaleGroupValueMap.entries()) {
      const tradesInGroup = whaleGroupTradesMap.get(whaleKey) ?? [];
      if (
        tradesInGroup.length > 1 &&
        totalValueInSecond >= WHALE_GROUPED_TRADE_THRESHOLD
      ) {
        const eventKey = `group|${time}|${whaleKey}`;
        whaleEventKeys.add(eventKey);

        for (const trade of tradesInGroup) {
          isWhaleFlags[trade.index] = true;
        }
      }
    }

    // 1.c Split order: banyak print dalam 1 detik per side+broker+price
    // REVISI: Tambah minimum total value threshold
    for (const [
      splitKey,
      tradesInSplitGroup,
    ] of splitGroupTradesMap.entries()) {
      if (tradesInSplitGroup.length > SPLIT_ORDER_THRESHOLD) {
        // Hitung total value split group ini
        const totalSplitValue = tradesInSplitGroup.reduce(
          (sum, t) => sum + t.value,
          0
        );

        // Hanya consider sebagai anomaly jika total value >= threshold
        if (totalSplitValue >= MIN_SPLIT_TOTAL_VALUE) {
          const eventKey = `split|${time}|${splitKey}`;
          splitOrderEventKeys.add(eventKey);
          splitOrderValues.set(eventKey, totalSplitValue);

          for (const trade of tradesInSplitGroup) {
            isSplitFlags[trade.index] = true;
          }
        }
      }
    }
  }

  const whaleCount = whaleEventKeys.size;
  const splitOrderCount = splitOrderEventKeys.size;

  // Hitung total split value & intensity score
  let totalSplitValue = 0;
  let splitIntensityScore = 0;

  for (const value of splitOrderValues.values()) {
    totalSplitValue += value;

    // Intensity score: value * log(1 + numberOfSplits)
    // Extract numberOfSplits from eventKey if needed, or use simple weighting
    // For now: higher value = higher intensity
    const intensityWeight = Math.log(1 + value / 10_000_000); // Log scale per 10M
    splitIntensityScore += value * intensityWeight;
  }

  // 2. Scoring ACCUMULATION vs DISTRIBUTION with time-decay
  // We don't need Date objects anymore, just relative seconds diff
  // decay = exp( - (diffMinutes * LN2) / halfLife )
  // diffMinutes = (maxSeconds - tradeSeconds) / 60

  let accumulationScore = 0;
  let distributionScore = 0;

  for (let i = 0; i < enrichedTrades.length; i++) {
    const trade = enrichedTrades[i];
    const isWhale = isWhaleFlags[trade.index];
    const isSplitOrder = isSplitFlags[trade.index];

    const isSignificant =
      (isWhale || isSplitOrder) && trade.value >= MIN_SIGNIFICANT_VALUE;

    if (!isSignificant) {
      continue;
    }

    const ageInMinutes = (maxSeconds - trade.timeSeconds) / 60;

    // Exponential decay: trade yang lebih dekat ke "akhir hari" bobotnya lebih besar
    const timeWeight = Math.exp(
      (-ageInMinutes * Math.LN2) / TIME_DECAY_HALF_LIFE
    );

    const tradeScore = trade.lotNum * trade.priceNum * timeWeight;

    if (trade.action === 'buy') {
      accumulationScore += tradeScore;
    } else {
      // Logic Revisi: Passive Accumulation / Absorption check
      // Jika action sell (HAKI) tapi harga naik/hijau (change > 0),
      // kemungkinan itu adalah Absorption (Limit Buy Whales dimakan retail panic sell).
      // Kita split score 50:50 atau 30:70, jangan full distribution.
      // Simplify: Jika change > 0, anggap 50% absorpsi.
      const changeNum = (trade as any).changeNum ?? 0;

      if (changeNum > 0) {
        accumulationScore += tradeScore * 0.5; // Absorbed
        distributionScore += tradeScore * 0.5; // Still selling pressure
      } else {
        distributionScore += tradeScore;
      }
    }
  }

  // 3. Bangun analyzedTrades dengan pattern per trade
  const analyzed = enrichedTrades.map<AnalyzedTrade>((trade) => {
    const { index, ...tradeData } = trade; // Keep value, lotNum, etc.

    const isWhale = isWhaleFlags[index];
    const isSplitOrder = isSplitFlags[index];

    let pattern: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL' = 'NEUTRAL';

    // Use tradeData.value which is now preserved
    const isSignificant =
      (isWhale || isSplitOrder) &&
      (tradeData.value ?? 0) >= MIN_SIGNIFICANT_VALUE;

    if (isSignificant) {
      // Pattern per trade hanya tergantung side, scoring-nya sudah di-aggregate di atas
      if (tradeData.action === 'buy') {
        pattern = 'ACCUMULATION';
      } else {
        pattern = 'DISTRIBUTION';
      }
    }

    return {
      ...tradeData,
      analysis: {
        isWhale,
        isSplitOrder,
        sameTimeCount: timeGroups.get(tradeData.time)?.length ?? 0,
        pattern,
      },
    };
  });

  analyzedTrades.push(...analyzed);

  // 4. Tentukan dominant action pakai imbalance + minimum strength
  const totalScore = accumulationScore + distributionScore;
  let dominantAction: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL' = 'NEUTRAL';

  if (totalScore >= MIN_TOTAL_SCORE) {
    const imbalance =
      totalScore > 0 ? (accumulationScore - distributionScore) / totalScore : 0;

    if (imbalance > 0.3) {
      dominantAction = 'ACCUMULATION';
    } else if (imbalance < -0.3) {
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

// Aggregate anomalies by stock
export function aggregateStockAnomalies(
  trades: TradeItem[],
  options: AggregateStockAnomaliesOptions = {}
): StockAnomaly[] {
  const { hideBrokerNames = false } = options;

  const sourceTrades = trades;
  const stocksMap = new Map<string, TradeItem[]>();

  // Group trades by symbol
  sourceTrades.forEach((trade) => {
    if (!stocksMap.has(trade.code)) {
      stocksMap.set(trade.code, []);
    }
    stocksMap.get(trade.code)!.push(trade);
  });

  const anomalies: StockAnomaly[] = [];

  // Analyze each stock
  stocksMap.forEach((stockTrades, symbol) => {
    const { analyzedTrades, summary } = analyzeTrades(stockTrades);

    // Only include stocks with anomalies
    if (summary.whaleCount === 0 && summary.splitOrderCount === 0) return;
    if (summary.dominantAction === 'NEUTRAL') return;

    // Build reasons
    const reasons: string[] = [];
    if (summary.whaleCount > 0) {
      reasons.push(
        `🐋 <span class="text-foreground font-semibold">${summary.whaleCount}</span> whale trade${summary.whaleCount > 1 ? 's' : ''}`
      );
    }
    if (summary.splitOrderCount > 0) {
      // Tampilkan value split jika signifikan
      const splitValueInM = Math.round(summary.totalSplitValue / 1_000_000);
      reasons.push(
        `🧩 <span class="text-foreground font-semibold">${summary.splitOrderCount}</span> split order${summary.splitOrderCount > 1 ? 's' : ''} (~${splitValueInM}M)`
      );
    }

    // Calculate averages dan total value using enriched data from analyzedTrades
    let totalValue = 0;
    let totalPriceVolume = 0;

    for (const t of analyzedTrades) {
      // These are guaranteed to be present from analyzeTrades
      const lot = t.lotNum ?? 0;
      const price = t.priceNum ?? 0;
      const val = t.value ?? 0;

      totalValue += val;
      totalPriceVolume += price * lot;
    }

    const totalLots = summary.totalVolume;
    const averageLot =
      analyzedTrades.length > 0 ? totalLots / analyzedTrades.length : 0;

    // Volume-weighted average price (VWAP)
    const averagePrice = totalLots > 0 ? totalPriceVolume / totalLots : 0;

    // Top brokers di anomali (whale / split)
    const brokerMap = new Map<string, { count: number; action: string }>();

    analyzedTrades
      .filter((t) => t.analysis.isWhale || t.analysis.isSplitOrder)
      .forEach((trade) => {
        const side = trade.action;
        const rawBroker =
          side === 'buy'
            ? (trade.buyer ?? 'UNKNOWN')
            : (trade.seller ?? 'UNKNOWN');

        if (!brokerMap.has(rawBroker)) {
          brokerMap.set(rawBroker, { count: 0, action: trade.action });
        }
        const broker = brokerMap.get(rawBroker)!;
        broker.count++;
      });

    const brokerEntries = Array.from(brokerMap.entries()).map(
      ([broker, data]) => ({
        broker,
        ...data,
      })
    );

    brokerEntries.sort((a, b) => b.count - a.count);

    const topBrokerEntries = brokerEntries.slice(0, 3);

    const topBrokers = topBrokerEntries.map((entry, index) => {
      // Hide broker name if hideBrokerNames option OR if is_broker_exists is false
      let displayBroker = entry.broker;

      if (hideBrokerNames) {
        displayBroker = `BROKER_${index + 1}`;
      } else {
        // Check if any trade with this broker has is_broker_exists = false
        const hasMissingBroker = analyzedTrades
          .filter((t) => t.analysis.isWhale || t.analysis.isSplitOrder)
          .some((trade) => {
            const side = trade.action;
            const tradeBroker = side === 'buy' ? trade.buyer : trade.seller;
            return tradeBroker === entry.broker && !trade.is_broker_exists;
          });

        if (hasMissingBroker) {
          displayBroker = `BROKER_${index + 1}`;
        }
      }

      return {
        broker: displayBroker,
        count: entry.count,
        action: entry.action,
      };
    });

    // Last update: trade dengan waktu terbesar (karena data harian)
    let lastUpdate = stockTrades[0]?.time ?? new Date().toLocaleTimeString();
    for (const t of stockTrades) {
      if (t.time > lastUpdate) {
        lastUpdate = t.time;
      }
    }

    const anomaly: StockAnomaly = {
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
      topBrokers,
      dominantAction: summary.dominantAction as 'ACCUMULATION' | 'DISTRIBUTION',
      lastUpdate,
      confidenceScore: 0,
    };

    // Hitung confidence score
    anomaly.confidenceScore = calculateConfidenceScore(anomaly);

    anomalies.push(anomaly);
  });

  // Sort by total volume (most active first)
  return anomalies.sort((a, b) => b.totalVolume - a.totalVolume);
}
