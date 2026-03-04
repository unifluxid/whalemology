/**
 * Market Cap Service
 *
 * Fetches and caches market cap data from TradingView scanner API.
 * Used for dynamic threshold calculations in whale detection.
 */

export interface StockMarketData {
  symbol: string;
  name: string;
  marketCap: number;
  close: number;
  change: number;
  volume: number;
  sector: string;
  // Enhanced fields for smarter whale detection
  relativeVolume: number; // Relative volume vs 10-day avg (e.g., 2.0 = 200%)
  vwap: number; // Volume-weighted average price
  macd: number; // MACD value for momentum context
  avgDailyValue: number; // Calculated: volume * close (today's value)
}

interface TradingViewScanResponse {
  totalCount: number;
  data: Array<{
    s: string; // e.g., "IDX:TRIN"
    d: [
      string, // 0: name (symbol)
      string, // 1: description
      number, // 2: market_cap_basic
      number, // 3: close
      number, // 4: minmov
      number, // 5: change
      number, // 6: volume
      string, // 7: sector
      number, // 8: relative_volume_10d_calc
      number, // 9: VWAP
      number, // 10: MACD.macd
    ];
  }>;
}

// In-memory cache
let marketCapCache: Map<string, StockMarketData> = new Map();
let lastFetchTime: number = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache

/**
 * Fetches all Indonesian stock data from TradingView scanner
 */
async function fetchMarketCaps(): Promise<Map<string, StockMarketData>> {
  const response = await fetch(
    'https://scanner.tradingview.com/indonesia/scan',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: 'https://www.tradingview.com',
        Referer: 'https://www.tradingview.com/',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        symbols: {
          tickers: [],
          query: {
            types: ['stock'],
          },
        },
        columns: [
          'name',
          'description',
          'market_cap_basic',
          'close',
          'minmov',
          'change',
          'volume',
          'sector',
          'relative_volume_10d_calc',
          'VWAP',
          'MACD.macd',
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`TradingView API error: ${response.status}`);
  }

  const data: TradingViewScanResponse = await response.json();
  const result = new Map<string, StockMarketData>();

  for (const item of data.data) {
    const [
      name,
      description,
      marketCap,
      close,
      ,
      change,
      volume,
      sector,
      relativeVolume,
      vwap,
      macd,
    ] = item.d;
    const symbol = name.toUpperCase();

    // Calculate average daily value (today's traded value)
    const avgDailyValue = (volume || 0) * (close || 0);

    result.set(symbol, {
      symbol,
      name: description,
      marketCap: marketCap || 0,
      close: close || 0,
      change: change || 0,
      volume: volume || 0,
      sector: sector || '',
      relativeVolume: relativeVolume || 1, // Default to 1x if not available
      vwap: vwap || close || 0, // Fallback to close price
      macd: macd || 0,
      avgDailyValue,
    });
  }

  return result;
}

/**
 * Gets market cap cache, fetching if stale or empty
 */
export async function getMarketCapCache(): Promise<
  Map<string, StockMarketData>
> {
  const now = Date.now();

  if (marketCapCache.size === 0 || now - lastFetchTime > CACHE_TTL_MS) {
    try {
      console.log(
        '[MarketCapService] Fetching market cap data from TradingView...'
      );
      marketCapCache = await fetchMarketCaps();
      lastFetchTime = now;
      console.log(`[MarketCapService] Cached ${marketCapCache.size} stocks`);
    } catch (error) {
      console.error('[MarketCapService] Failed to fetch market caps:', error);
      // Return existing cache if fetch fails
      if (marketCapCache.size === 0) {
        throw error;
      }
    }
  }

  return marketCapCache;
}

/**
 * Gets market cap for a specific symbol
 */
export async function getMarketCap(symbol: string): Promise<number | null> {
  const cache = await getMarketCapCache();
  const data = cache.get(symbol.toUpperCase());
  return data?.marketCap ?? null;
}

/**
 * Gets full stock data for a specific symbol
 */
export async function getStockData(
  symbol: string
): Promise<StockMarketData | null> {
  const cache = await getMarketCapCache();
  return cache.get(symbol.toUpperCase()) ?? null;
}

/**
 * Forces a refresh of the market cap cache
 */
export async function refreshMarketCapCache(): Promise<void> {
  console.log('[MarketCapService] Force refreshing market cap cache...');
  marketCapCache = await fetchMarketCaps();
  lastFetchTime = Date.now();
  console.log(`[MarketCapService] Refreshed ${marketCapCache.size} stocks`);
}

/**
 * Pre-warms the cache (call on app startup)
 */
export async function initMarketCapCache(): Promise<void> {
  try {
    await getMarketCapCache();
  } catch (error) {
    console.warn('[MarketCapService] Failed to initialize cache:', error);
  }
}

/**
 * Gets cache stats for debugging
 */
export function getCacheStats(): {
  size: number;
  lastFetch: Date | null;
  age: number;
} {
  return {
    size: marketCapCache.size,
    lastFetch: lastFetchTime ? new Date(lastFetchTime) : null,
    age: lastFetchTime ? Math.floor((Date.now() - lastFetchTime) / 1000) : -1,
  };
}
