import { TradeItem } from './stockbit-types';

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
}

// Thresholds & parameters
const WHALE_SINGLE_TRADE_THRESHOLD = 100_000_000; // 100 juta
const WHALE_GROUPED_TRADE_THRESHOLD = 50_000_000; // 50 juta
const MIN_SIGNIFICANT_VALUE = 5_000_000; // Min nilai trade 5 juta untuk dianggap signifikan
const SPLIT_ORDER_THRESHOLD = 5; // Min trade dalam 1 detik, same side+broker+price
const MIN_SPLIT_TOTAL_VALUE = 50_000_000; // 50 juta - minimum total value untuk split order dianggap anomali
const TIME_DECAY_HALF_LIFE = 30; // Menit untuk time-decay (half life)
const MIN_TOTAL_SCORE = 1_000_000; // ~ kira-kira setara total value ~200M+ (kasar)

function parseNumberFromString(input: string): number {
  const cleaned = input.replace(/,/g, '');
  const parsed = parseInt(cleaned, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseTimeToDate(time: string, referenceDate?: Date): Date {
  const [hStr, mStr = '0', sStr = '0'] = time.split(':');
  const hours = Number(hStr) || 0;
  const minutes = Number(mStr) || 0;
  const seconds = Number(sStr) || 0;
  const base = referenceDate ? new Date(referenceDate) : new Date();
  base.setHours(hours, minutes, seconds, 0);
  return base;
}

// Pakai waktu trade terakhir di hari itu sebagai "now" (reference) untuk decay,
// supaya konsisten untuk data harian, tidak tergantung jam eksekusi.
function computeReferenceTime(trades: TradeItem[]): Date {
  let maxSeconds = 0;

  for (const trade of trades) {
    const [hStr, mStr = '0', sStr = '0'] = trade.time.split(':');
    const h = Number(hStr) || 0;
    const m = Number(mStr) || 0;
    const s = Number(sStr) || 0;
    const totalSeconds = h * 3600 + m * 60 + s;
    if (totalSeconds > maxSeconds) {
      maxSeconds = totalSeconds;
    }
  }

  const ref = new Date();
  const refHours = Math.floor(maxSeconds / 3600);
  const refMinutes = Math.floor((maxSeconds % 3600) / 60);
  const refSeconds = maxSeconds % 60;
  ref.setHours(refHours, refMinutes, refSeconds, 0);
  return ref;
}

// Calculate confidence score (1-6 Likert scale)
export function calculateConfidenceScore(anomaly: StockAnomaly): number {
  let score = 0;

  // Factor 1: Whale events presence (0-2 points)
  if (anomaly.whaleCount >= 3) score += 2;
  else if (anomaly.whaleCount >= 1) score += 1;

  // Factor 2: Split order events presence with value weighting (0-2 points)
  // REVISI: Split order sekarang memperhitungkan total value
  if (anomaly.totalSplitValue >= 500_000_000) {
    score += 2; // Split value >= 500M = strong anomaly
  } else if (anomaly.totalSplitValue >= 200_000_000) {
    score += 1.5; // Split value >= 200M = medium-strong
  } else if (
    anomaly.splitOrderCount >= 2 &&
    anomaly.totalSplitValue >= 100_000_000
  ) {
    score += 1; // Multiple splits >= 100M = medium
  } else if (
    anomaly.splitOrderCount >= 1 &&
    anomaly.totalSplitValue >= 50_000_000
  ) {
    score += 0.5; // Single split >= 50M = low signal
  }
  // Split < 50M total = tidak dapat poin (filtered out)

  // Factor 3: Total value threshold (0-2 points)
  if (anomaly.totalValue >= 500_000_000)
    score += 2; // >= 500M
  else if (anomaly.totalValue >= 200_000_000) score += 1; // >= 200M

  // Factor 4: Broker concentration (0-1 point) – lihat dominasi broker terbesar
  if (anomaly.topBrokers.length > 0) {
    const totalEvents = anomaly.topBrokers.reduce((sum, b) => sum + b.count, 0);
    if (totalEvents > 0) {
      const maxShare = anomaly.topBrokers[0].count / totalEvents;
      if (maxShare >= 0.5) {
        score += 1; // Satu broker dominan di anomali
      }
    }
  }

  // Ensure score is between 1-6, dengan baseline 1
  // Note: Max bisa > 6 dengan formula baru, jadi cap di 6
  return Math.min(Math.max(Math.round(score + 1), 1), 6);
}

export function analyzeTrades(trades: TradeItem[]): {
  analyzedTrades: AnalyzedTrade[];
  summary: TradeAnalysisSummary;
} {
  const analyzedTrades: AnalyzedTrade[] = [];

  if (trades.length === 0) {
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

  // Normalisasi numeric dulu
  const enrichedTrades: EnrichedTrade[] = trades.map((trade, index) => {
    const lotNum = parseNumberFromString(trade.lot);
    const priceNum = parseNumberFromString(trade.price);
    const value = priceNum * lotNum * 100; // 1 lot = 100 saham (IDX)

    return {
      ...trade,
      lotNum,
      priceNum,
      value,
      index,
    };
  });

  let totalVolume = 0;
  for (const t of enrichedTrades) {
    totalVolume += t.lotNum;
  }

  // Group by exact timestamp (HH:MM:SS) – daily data only, jadi aman
  const timeGroups = new Map<string, EnrichedTrade[]>();
  for (const trade of enrichedTrades) {
    if (!timeGroups.has(trade.time)) {
      timeGroups.set(trade.time, []);
    }
    timeGroups.get(trade.time)!.push(trade);
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
      const splitKey = `${side}|${brokerRaw}|${trade.priceNum}`;

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

  // 2. Scoring ACCUMULATION vs DISTRIBUTION dengan time-decay
  const referenceTime = computeReferenceTime(trades);

  let accumulationScore = 0;
  let distributionScore = 0;

  for (const trade of enrichedTrades) {
    const isWhale = isWhaleFlags[trade.index];
    const isSplitOrder = isSplitFlags[trade.index];

    const isSignificant =
      (isWhale || isSplitOrder) && trade.value >= MIN_SIGNIFICANT_VALUE;

    if (!isSignificant) {
      continue;
    }

    const tradeDate = parseTimeToDate(trade.time, referenceTime);
    const ageInMinutes =
      (referenceTime.getTime() - tradeDate.getTime()) / 60000;

    // Exponential decay: trade yang lebih dekat ke "akhir hari" bobotnya lebih besar
    const timeWeight = Math.exp(
      (-ageInMinutes * Math.LN2) / TIME_DECAY_HALF_LIFE
    );

    const tradeScore = trade.lotNum * trade.priceNum * timeWeight;

    if (trade.action === 'buy') {
      accumulationScore += tradeScore;
    } else {
      distributionScore += tradeScore;
    }
  }

  // 3. Bangun analyzedTrades dengan pattern per trade
  const analyzed = enrichedTrades.map<AnalyzedTrade>((trade) => {
    const { value, index, ...originalTrade } = trade;

    const isWhale = isWhaleFlags[index];
    const isSplitOrder = isSplitFlags[index];

    let pattern: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL' = 'NEUTRAL';

    const isSignificant =
      (isWhale || isSplitOrder) && value >= MIN_SIGNIFICANT_VALUE;

    if (isSignificant) {
      // Pattern per trade hanya tergantung side, scoring-nya sudah di-aggregate di atas
      if (trade.action === 'buy') {
        pattern = 'ACCUMULATION';
      } else {
        pattern = 'DISTRIBUTION';
      }
    }

    return {
      ...originalTrade,
      analysis: {
        isWhale,
        isSplitOrder,
        sameTimeCount: timeGroups.get(trade.time)?.length ?? 0,
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

  const stocksMap = new Map<string, TradeItem[]>();

  // Group trades by symbol
  trades.forEach((trade) => {
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

    // Calculate averages dan total value
    const lots = stockTrades.map((t) => parseNumberFromString(t.lot));
    const prices = stockTrades.map((t) => parseNumberFromString(t.price));

    const totalLots = lots.reduce((a, b) => a + b, 0);
    const averageLot =
      stockTrades.length > 0 ? totalLots / stockTrades.length : 0;

    // Volume-weighted average price (VWAP)
    const totalPriceVolume = stockTrades.reduce((sum, _t, idx) => {
      return sum + prices[idx] * lots[idx];
    }, 0);
    const averagePrice = totalLots > 0 ? totalPriceVolume / totalLots : 0;

    // Total value (price × volume)
    const totalValue = stockTrades.reduce((sum, trade) => {
      const lotNum = parseNumberFromString(trade.lot);
      const priceNum = parseNumberFromString(trade.price);
      return sum + priceNum * lotNum * 100;
    }, 0);

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
