// =============================================================================
// MARKET CAP TIERS (for dynamic threshold calculation)
// =============================================================================

export interface MarketCapTier {
  name: string;
  minCap: number; // Minimum market cap for this tier
  whaleThreshold: number; // Absolute whale threshold
  whalePct: number; // Percentage of market cap for whale detection
  splitThreshold: number; // Minimum split order total value
  significantPct: number; // Min significant trade as % of market cap
}

// Volume-based threshold percentages
export const VOLUME_THRESHOLDS = {
  // Percentage of Average Daily Value (ADV) to qualify as whale
  WHALE_ADV_PCT: 0.02, // 2% of daily trading value = whale
  SPLIT_ADV_PCT: 0.01, // 1% of daily trading value = significant split
  SIGNIFICANT_ADV_PCT: 0.005, // 0.5% of daily trading value = significant

  // Relative volume multipliers (when stock trades above normal volume)
  // If relative_volume > threshold, make detection MORE sensitive
  HIGH_VOLUME_THRESHOLD: 2.0, // 2x normal volume
  EXTREME_VOLUME_THRESHOLD: 3.0, // 3x normal volume
  HIGH_VOLUME_SENSITIVITY: 0.7, // Reduce threshold by 30% when high volume
  EXTREME_VOLUME_SENSITIVITY: 0.5, // Reduce threshold by 50% when extreme volume
};

// VWAP-based scoring
export const VWAP_THRESHOLDS = {
  // Price deviation from VWAP to flag as aggressive
  AGGRESSIVE_DEVIATION_PCT: 0.01, // 1% above/below VWAP = aggressive
  VERY_AGGRESSIVE_DEVIATION_PCT: 0.02, // 2% above/below VWAP = very aggressive
};

// Tier definitions based on Indonesian market structure
export const MARKET_CAP_TIERS: MarketCapTier[] = [
  {
    name: 'MEGA', // Blue chips: BBCA, BBRI, TLKM, etc.
    minCap: 100_000_000_000_000, // 100T+
    whaleThreshold: 1_000_000_000, // 1B IDR
    whalePct: 0.00001, // 0.001% of market cap
    splitThreshold: 500_000_000, // 500M
    significantPct: 0.000001, // 0.0001%
  },
  {
    name: 'LARGE', // Large caps: ASII, UNVR, etc.
    minCap: 20_000_000_000_000, // 20T+
    whaleThreshold: 500_000_000, // 500M IDR
    whalePct: 0.000025, // 0.0025% of market cap
    splitThreshold: 200_000_000, // 200M
    significantPct: 0.000005, // 0.0005%
  },
  {
    name: 'MID', // Mid caps
    minCap: 5_000_000_000_000, // 5T+
    whaleThreshold: 200_000_000, // 200M IDR
    whalePct: 0.00004, // 0.004% of market cap
    splitThreshold: 100_000_000, // 100M
    significantPct: 0.00001, // 0.001%
  },
  {
    name: 'SMALL', // Small caps
    minCap: 1_000_000_000_000, // 1T+
    whaleThreshold: 100_000_000, // 100M IDR
    whalePct: 0.0001, // 0.01% of market cap
    splitThreshold: 50_000_000, // 50M
    significantPct: 0.00005, // 0.005%
  },
  {
    name: 'MICRO', // Micro caps / third liner
    minCap: 100_000_000_000, // 100B+
    whaleThreshold: 50_000_000, // 50M IDR
    whalePct: 0.0005, // 0.05% of market cap
    splitThreshold: 25_000_000, // 25M
    significantPct: 0.0001, // 0.01%
  },
  {
    name: 'NANO', // Very small / penny stocks
    minCap: 0, // Below 100B
    whaleThreshold: 20_000_000, // 20M IDR (absolute floor)
    whalePct: 0.001, // 0.1% of market cap
    splitThreshold: 10_000_000, // 10M
    significantPct: 0.0005, // 0.05%
  },
];

/**
 * Gets the appropriate tier for a given market cap
 */
export function getMarketCapTier(marketCap: number): MarketCapTier {
  for (const tier of MARKET_CAP_TIERS) {
    if (marketCap >= tier.minCap) {
      return tier;
    }
  }
  // Fallback to lowest tier
  return MARKET_CAP_TIERS[MARKET_CAP_TIERS.length - 1];
}

/**
 * Stock data for dynamic threshold calculation
 */
export interface StockThresholdData {
  marketCap?: number | null;
  avgDailyValue?: number | null; // Today's traded value (volume * close)
  relativeVolume?: number | null; // Relative to 10-day avg (e.g., 2.0 = 200%)
  vwap?: number | null; // Volume-weighted average price
  macd?: number | null; // MACD for momentum context
}

/**
 * Dynamic threshold result with additional context
 */
export interface DynamicThresholdResult {
  whaleThreshold: number;
  splitThreshold: number;
  minSignificantValue: number;
  tierName: string;
  // Additional context
  volumeMultiplier: number; // 1.0 = normal, <1 = more sensitive due to high volume
  isHighVolume: boolean;
  vwap: number | null;
  macd: number | null;
}

/**
 * Calculates dynamic thresholds based on market cap AND trading volume
 *
 * Logic:
 * 1. Start with market-cap-based tier thresholds
 * 2. If avgDailyValue available, use % of ADV as alternative threshold
 * 3. Take the HIGHER of market cap % OR ADV %
 * 4. If relative volume is high (>2x), reduce thresholds to be MORE sensitive
 */
export function getDynamicThresholds(
  data: StockThresholdData | number | null
): DynamicThresholdResult {
  // Handle legacy call with just marketCap number
  const stockData: StockThresholdData =
    typeof data === 'number' ? { marketCap: data } : data || {};

  const { marketCap, avgDailyValue, relativeVolume, vwap, macd } = stockData;

  // Fallback to default SMALL tier if no market cap data
  if (!marketCap || marketCap <= 0) {
    const defaultTier = MARKET_CAP_TIERS.find((t) => t.name === 'SMALL')!;
    return {
      whaleThreshold: defaultTier.whaleThreshold,
      splitThreshold: defaultTier.splitThreshold,
      minSignificantValue: ANALYSIS_CONFIG.MIN_SIGNIFICANT_VALUE,
      tierName: 'UNKNOWN',
      volumeMultiplier: 1,
      isHighVolume: false,
      vwap: vwap ?? null,
      macd: macd ?? null,
    };
  }

  const tier = getMarketCapTier(marketCap);

  // === Calculate market cap based thresholds ===
  const marketCapWhaleThreshold = Math.max(
    marketCap * tier.whalePct,
    tier.whaleThreshold
  );

  const marketCapSplitThreshold = Math.max(
    marketCap * tier.significantPct * 10,
    tier.splitThreshold
  );

  const marketCapSignificant = Math.max(
    marketCap * tier.significantPct,
    ANALYSIS_CONFIG.MIN_SIGNIFICANT_VALUE
  );

  // === Calculate ADV-based thresholds (if available) ===
  let whaleThreshold = marketCapWhaleThreshold;
  let splitThreshold = marketCapSplitThreshold;
  let minSignificantValue = marketCapSignificant;

  if (avgDailyValue && avgDailyValue > 0) {
    const advWhaleThreshold = avgDailyValue * VOLUME_THRESHOLDS.WHALE_ADV_PCT;
    const advSplitThreshold = avgDailyValue * VOLUME_THRESHOLDS.SPLIT_ADV_PCT;
    const advSignificant =
      avgDailyValue * VOLUME_THRESHOLDS.SIGNIFICANT_ADV_PCT;

    // Use the HIGHER of market cap % OR ADV %
    // This ensures we don't miss whales in high-volume stocks
    whaleThreshold = Math.max(
      marketCapWhaleThreshold,
      advWhaleThreshold,
      tier.whaleThreshold // Absolute floor
    );

    splitThreshold = Math.max(
      marketCapSplitThreshold,
      advSplitThreshold,
      tier.splitThreshold
    );

    minSignificantValue = Math.max(
      marketCapSignificant,
      advSignificant,
      ANALYSIS_CONFIG.MIN_SIGNIFICANT_VALUE
    );
  }

  // === Apply relative volume sensitivity ===
  let volumeMultiplier = 1;
  let isHighVolume = false;

  if (relativeVolume && relativeVolume > 1) {
    if (relativeVolume >= VOLUME_THRESHOLDS.EXTREME_VOLUME_THRESHOLD) {
      // Extreme volume (3x+): Be 50% more sensitive
      volumeMultiplier = VOLUME_THRESHOLDS.EXTREME_VOLUME_SENSITIVITY;
      isHighVolume = true;
    } else if (relativeVolume >= VOLUME_THRESHOLDS.HIGH_VOLUME_THRESHOLD) {
      // High volume (2x+): Be 30% more sensitive
      volumeMultiplier = VOLUME_THRESHOLDS.HIGH_VOLUME_SENSITIVITY;
      isHighVolume = true;
    }

    // Apply multiplier (lower threshold = more sensitive)
    whaleThreshold *= volumeMultiplier;
    splitThreshold *= volumeMultiplier;
    minSignificantValue *= volumeMultiplier;

    // But never go below absolute minimums
    whaleThreshold = Math.max(
      whaleThreshold,
      ANALYSIS_CONFIG.MIN_RELATIVE_WHALE_ABSOLUTE_VALUE
    );
    splitThreshold = Math.max(
      splitThreshold,
      ANALYSIS_CONFIG.MIN_SIGNIFICANT_VALUE * 2
    );
    minSignificantValue = Math.max(
      minSignificantValue,
      ANALYSIS_CONFIG.MIN_SIGNIFICANT_VALUE
    );
  }

  return {
    whaleThreshold,
    splitThreshold,
    minSignificantValue,
    tierName: tier.name,
    volumeMultiplier,
    isHighVolume,
    vwap: vwap ?? null,
    macd: macd ?? null,
  };
}

// =============================================================================
// BASE CONFIG (fallback/default values)
// =============================================================================

export const ANALYSIS_CONFIG = {
  // Legacy absolute thresholds (used as fallback when no market cap data)
  WHALE_SINGLE_TRADE_THRESHOLD: 100_000_000, // 100 juta (default for SMALL cap)
  WHALE_GROUPED_TRADE_THRESHOLD: 50_000_000, // 50 juta
  MIN_SIGNIFICANT_VALUE: 5_000_000, // Min value 5 juta (absolute floor)
  SPLIT_ORDER_THRESHOLD: 5, // Min trades per second
  MIN_SPLIT_TOTAL_VALUE: 50_000_000, // 50 juta
  TIME_DECAY_HALF_LIFE: 30, // Minutes
  MIN_TOTAL_SCORE: 1_000_000, // Score threshold

  // Scoring & Confidence Thresholds (relative to dynamic thresholds)
  CONFIDENCE_WHALE_HIGH_MULTIPLIER: 2, // 2x whale threshold = high confidence
  CONFIDENCE_WHALE_MEDIUM_MULTIPLIER: 1, // 1x whale threshold = medium confidence
  CONFIDENCE_SPLIT_HIGH_MULTIPLIER: 2.5, // 2.5x split threshold = high confidence
  CONFIDENCE_SPLIT_MEDIUM_MULTIPLIER: 1, // 1x split threshold = medium confidence

  // Legacy absolute values (for backward compatibility)
  CONFIDENCE_WHALE_HIGH_VALUE: 200_000_000,
  CONFIDENCE_WHALE_MEDIUM_VALUE: 500_000_000,
  CONFIDENCE_SPLIT_HIGH_VALUE: 500_000_000,
  CONFIDENCE_SPLIT_MEDIUM_VALUE: 200_000_000,

  IMBALANCE_THRESHOLD: 0.3,

  // Refined Logic Thresholds
  ABSORPTION_MIN_VALUE: 200_000_000, // Only large sells on green are "Absorption"
  RELATIVE_WHALE_MULTIPLIER: 20, // Trade > 20x Average is a Whale
  MIN_RELATIVE_WHALE_ABSOLUTE_VALUE: 20_000_000, // Sanity floor for relative whales (20 juta)
};
