export const ANALYSIS_CONFIG = {
  WHALE_SINGLE_TRADE_THRESHOLD: 100_000_000, // 100 juta
  WHALE_GROUPED_TRADE_THRESHOLD: 50_000_000, // 50 juta
  MIN_SIGNIFICANT_VALUE: 5_000_000, // Min value 5 juta
  SPLIT_ORDER_THRESHOLD: 5, // Min trades per second
  MIN_SPLIT_TOTAL_VALUE: 50_000_000, // 50 juta
  TIME_DECAY_HALF_LIFE: 30, // Minutes
  MIN_TOTAL_SCORE: 1_000_000, // Score threshold

  // Scoring & Confidence Thresholds
  CONFIDENCE_WHALE_HIGH_VALUE: 200_000_000,
  CONFIDENCE_WHALE_MEDIUM_VALUE: 500_000_000, // For confidence scoring when whaleCount >= 1
  CONFIDENCE_SPLIT_HIGH_VALUE: 500_000_000,
  CONFIDENCE_SPLIT_MEDIUM_VALUE: 200_000_000,
  IMBALANCE_THRESHOLD: 0.3,

  // Refined Logic Thresholds
  ABSORPTION_MIN_VALUE: 200_000_000, // Only large sells on green are "Absorption"
  RELATIVE_WHALE_MULTIPLIER: 20, // Trade > 20x Average is a Whale
  MIN_RELATIVE_WHALE_ABSOLUTE_VALUE: 20_000_000, // Sanity floor for relative whales (20 juta)
};
