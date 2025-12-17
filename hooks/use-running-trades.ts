import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getRunningTrade, RunningTradeFilters } from '@/lib/stockbit-data';
import { RunningTrade } from '@/lib/stockbit-types';
import { useTradeStore } from '@/store/trade-store';

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
  // Use Zustand Store
  const {
    trades: storedTrades,
    filters: storedFilters,
    setTrades,
    appendTrades,
    clearTrades,
  } = useTradeStore();

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Reconstruct the full RunningTrade object for the UI
  // We assume default values for metadata since we only persist the list
  const data: RunningTrade | null = useMemo(() => {
    // If we have no trades and loading is explicitly creating the first set,
    // we might return null to show loading spinner, or return empty object.
    // But typically UI checks 'if (!data)'.
    // If we have stored trades, we return valid object immediately.
    if (storedTrades.length === 0 && loading) return null;

    return {
      message: 'From Storage',
      data: {
        is_open_market: true, // Default, will update on next poll
        running_trade: storedTrades,
        is_show_bs: true,
        break_time_left_seconds: 0,
        date: new Date().toISOString().split('T')[0],
      },
    };
  }, [storedTrades, loading]);

  // Track previous filters to detect changes
  const prevFiltersRef = useRef<string>(JSON.stringify(filters));

  const fetchTrades = useCallback(
    async (
      activeToken: string,
      tradeNumber?: string,
      dateOverride?: string
    ) => {
      const apiFilters = { ...filters };
      if (dateOverride) {
        apiFilters.date = dateOverride;
      }
      return await getRunningTrade('', activeToken, tradeNumber, apiFilters);
    },
    [filters]
  );

  // Initial Load & Filter Handling
  useEffect(() => {
    if (!token) return;

    const currentFiltersStr = JSON.stringify(filters);
    const isFilterChange = prevFiltersRef.current !== currentFiltersStr;

    // Update ref
    prevFiltersRef.current = currentFiltersStr;

    const init = async () => {
      try {
        // Check if we have valid stored data
        if (
          !isFilterChange &&
          storedTrades.length > 0 &&
          storedFilters &&
          JSON.stringify(storedFilters) === currentFiltersStr
        ) {
          setLoading(false);
          return;
        }

        // If filters changed, clear
        if (isFilterChange) {
          clearTrades();
          setLoading(true);
        }

        const tradesData = await fetchTrades(token);
        if (tradesData && tradesData.data) {
          setTrades(tradesData.data.running_trade, filters);
          // We should also perhaps update the 'is_open_market' etc if we had a place to put it.
          // But since we only store trades... the polling will fix metadata if we used a separate state.
          // For now, metadata is ephemeral or defaulted.
        }
      } catch (error) {
        console.error('Failed to load global trades', error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [
    token,
    fetchTrades,
    filters,
    storedTrades.length,
    storedFilters,
    clearTrades,
    setTrades,
  ]);

  // Polling
  useEffect(() => {
    if (!token || pausePolling) return;

    // Flag to ensure we don't start polling until initial load is settled?
    // Actually polling is independent, it just appends.

    const interval = setInterval(async () => {
      try {
        const newTradesData = await fetchTrades(token);
        // Store handles deduplication and appending
        if (newTradesData && newTradesData.data.running_trade.length > 0) {
          appendTrades(newTradesData.data.running_trade, filters);
        }
      } catch (e) {
        console.error('Polling error', e);
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [token, pollInterval, fetchTrades, pausePolling, appendTrades, filters]);

  // Load More (Historical)
  const handleLoadMore = async () => {
    if (loadingMore || !data || !token) return;

    const currentTrades = data.data.running_trade;
    // Limit check is handled by store implicitly on set, but we can check here too
    if (currentTrades.length >= 10000) {
      // console.warn("Reached limit");
      return;
    }

    if (currentTrades.length === 0) return;

    const lastTrade = currentTrades[currentTrades.length - 1];
    setLoadingMore(true);
    try {
      const olderTrades = await fetchTrades(token, lastTrade.trade_number);

      if (olderTrades.data.running_trade.length > 0) {
        // Manual merge for historical data
        const merged = [...currentTrades, ...olderTrades.data.running_trade];
        setTrades(merged, filters);
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
