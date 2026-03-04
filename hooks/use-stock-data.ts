'use client';

import { useState, useEffect } from 'react';
import {
  getMarketCapCache,
  StockMarketData,
} from '@/services/market-cap-service';

/**
 * Hook to load and provide stock market data from TradingView cache.
 * This provides market cap, VWAP, volume, and MACD data for all IDX stocks.
 */
export function useStockData() {
  const [stockDataMap, setStockDataMap] = useState<Map<
    string,
    StockMarketData
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadCache = async () => {
      try {
        setLoading(true);
        const cache = await getMarketCapCache();
        setStockDataMap(cache);
        console.log(
          '[useStockData] Loaded stock data for',
          cache.size,
          'stocks'
        );
      } catch (err) {
        console.error('[useStockData] Failed to load stock data:', err);
        setError(
          err instanceof Error ? err : new Error('Failed to load stock data')
        );
      } finally {
        setLoading(false);
      }
    };

    loadCache();

    // Refresh cache every hour
    const interval = setInterval(loadCache, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { stockDataMap, loading, error };
}
