import { useState, useEffect, useCallback, useMemo } from 'react';
import { getRunningTrade, RunningTradeFilters } from '@/lib/stockbit-data';
import { RunningTrade } from '@/lib/stockbit-types';
import { useTradeStore } from '@/store/trade-store';

interface UseRunningTradesProps {
  token: string | null;
  filters: RunningTradeFilters;
}

export function useRunningTrades({ token, filters }: UseRunningTradesProps) {
  // Use Zustand Store
  const {
    trades: storedTrades,
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
    // Always return null (loading) during fetch to ignore stored data on refresh
    if (loading) return null;

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

    const init = async () => {
      try {
        // Always clear old data to start fresh (ignore stored on refresh)
        clearTrades();
        setLoading(true);

        const tradesData = await fetchTrades(token);
        if (tradesData && tradesData.data) {
          setTrades(tradesData.data.running_trade, filters);
        }
      } catch (error) {
        console.error('Failed to load global trades', error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [token, fetchTrades, filters, clearTrades, setTrades]);

  // Refetch trades (used when resuming from pause)
  const refetch = useCallback(async () => {
    if (!token) return;
    try {
      const tradesData = await fetchTrades(token);
      if (tradesData && tradesData.data) {
        setTrades(tradesData.data.running_trade, filters);
      }
    } catch (error) {
      console.error('Failed to refetch trades', error);
    }
  }, [token, fetchTrades, filters, setTrades]);

  // Load More (Historical)
  const handleLoadMore = async () => {
    if (loadingMore || !data || !token) return;

    const currentTrades = data.data.running_trade;
    // Limit check is handled by store implicitly on set, but we can check here too
    if (currentTrades.length >= 500_000) {
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
    refetch,
    appendTrades,
  };
}
