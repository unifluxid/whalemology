import { useState, useEffect, useCallback, useRef } from 'react';
import { getRunningTrade, RunningTradeFilters } from '@/lib/stockbit-data';
import { RunningTrade } from '@/lib/stockbit-types';

interface UseRunningTradesProps {
  token: string | null;
  filters: RunningTradeFilters;
  pollInterval?: number;
  pausePolling?: boolean;
}

export function useRunningTrades({
  token,
  filters,
  pollInterval = 3000,
  pausePolling = false,
}: UseRunningTradesProps) {
  const [data, setData] = useState<RunningTrade | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Track previous filters to detect changes
  const prevFiltersRef = useRef<string>(JSON.stringify(filters));

  const fetchTrades = useCallback(
    async (
      activeToken: string,
      tradeNumber?: string,
      dateOverride?: string
    ) => {
      // If we provided a date override, clone filters and update date
      // Otherwise use current filters
      const apiFilters = { ...filters };
      if (dateOverride) {
        apiFilters.date = dateOverride;
      }
      return await getRunningTrade('', activeToken, tradeNumber, apiFilters);
    },
    [filters]
  );

  // Initial Fetch & Filter Change Effect
  useEffect(() => {
    if (!token) return;

    const currentFiltersStr = JSON.stringify(filters);
    const isFilterChange = prevFiltersRef.current !== currentFiltersStr;

    // Update ref
    prevFiltersRef.current = currentFiltersStr;

    // Reset data on filter change if needed, but usually we just re-fetch
    if (isFilterChange) {
      setLoading(true);
    }

    const init = async () => {
      try {
        const trades = await fetchTrades(token);
        setData(trades);
      } catch (error) {
        console.error('Failed to load global trades', error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [token, fetchTrades, filters]); // filters dependency handled by fetchTrades / stringify check

  // Polling
  useEffect(() => {
    if (!token || pausePolling) return;

    const interval = setInterval(async () => {
      try {
        const newTradesData = await fetchTrades(token);

        setData((prev) => {
          if (!prev) return newTradesData;

          const currentTrades = prev.data.running_trade;
          const newItemList = newTradesData.data.running_trade;

          const distinctNewItems = newItemList.filter(
            (newItem) =>
              !currentTrades.some(
                (existing) => existing.trade_number === newItem.trade_number
              )
          );

          if (distinctNewItems.length === 0) return prev;

          return {
            ...prev,
            data: {
              ...prev.data,
              running_trade: [...distinctNewItems, ...currentTrades],
            },
          };
        });
      } catch (e) {
        console.error('Polling error', e);
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [token, pollInterval, fetchTrades, pausePolling]);

  // Load More
  const handleLoadMore = async () => {
    if (loadingMore || !data || !token) return;

    const trades = data.data.running_trade;
    if (trades.length === 0) return;

    const lastTrade = trades[trades.length - 1];
    setLoadingMore(true);
    try {
      const olderTrades = await fetchTrades(token, lastTrade.trade_number);

      if (olderTrades.data.running_trade.length > 0) {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            data: {
              ...prev.data,
              running_trade: [
                ...prev.data.running_trade,
                ...olderTrades.data.running_trade,
              ],
            },
          };
        });
      }
    } catch (e) {
      console.error('Failed to load more global trades', e);
    } finally {
      setLoadingMore(false);
    }
  };

  return {
    data,
    loading,
    loadingMore,
    handleLoadMore,
  };
}
