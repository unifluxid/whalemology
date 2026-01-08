'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useDatafeedSocket from '@/lib/datafeed/useDatafeedSocket';
import useDatafeedMessageEffect from '@/lib/datafeed/useDatafeedMessageEffect';
import {
  useRunningTradeStore,
  RunningTradeKey,
} from '@/store/running-trade-ws-store';
import { WSRunningTradeItem, DatafeedMessageChannel } from '@/lib/datafeed';
import { TradeItem } from '@/lib/stockbit-types';
import { normalizeTrade } from '@/lib/trade-adapter';

// Lot size constant (shares per lot)
const LOT_SIZE = 100;

// Configuration for different running trade instances
export const runningTradeConfig: Record<RunningTradeKey, { limit: number }> = {
  widget: { limit: 80 },
  fastOrder: { limit: 80 },
  company: { limit: 10 },
};

// Sort by time descending
const sortBatchByTime = (a: WSRunningTradeItem, b: WSRunningTradeItem) => {
  const secondsDiff =
    Number(b.time?.seconds ?? 0) - Number(a.time?.seconds ?? 0);
  if (secondsDiff !== 0) return secondsDiff;
  return Number(b.time?.nanos ?? 0) - Number(a.time?.nanos ?? 0);
};

interface UseRunningTradeWSProps {
  rtKey: RunningTradeKey;
  isOpenMarket?: boolean;
}

/**
 * WebSocket-based running trade hook.
 * Receives real-time trade updates via WebSocket and applies client-side filtering.
 */
export function useRunningTradeWS({
  rtKey,
  isOpenMarket = false,
}: UseRunningTradeWSProps) {
  const { isAuthorized } = useDatafeedSocket();

  // Get store state
  const instances = useRunningTradeStore((state) => state.instances);
  const setActive = useRunningTradeStore((state) => state.setActive);
  const play = useRunningTradeStore((state) => state.play);

  const { isPaused, stock, filter } = instances[rtKey];

  const symbols = useMemo(
    () => Array.from(new Set(stock?.selected ?? [])),
    [stock]
  );

  const [data, setData] = useState<TradeItem[]>([]);
  const queue = useRef<WSRunningTradeItem[]>([]);
  const [isLoading, setLoading] = useState(!isAuthorized);

  // Clear all data
  const clearData = useCallback(() => {
    queue.current = [];
    setData([]);
  }, []);

  // Client-side batch filter
  const batchFilter = useCallback(
    (batch: WSRunningTradeItem) => {
      const stringSymbols = symbols.join();

      // Symbol filter - empty array or '*' means show all
      if (symbols.length > 0 && !stringSymbols.includes('*')) {
        if (!symbols.includes(batch.stock)) {
          return false;
        }
      }

      // Action type filter
      if (filter && filter.actionType && batch.action !== filter.actionType) {
        return false;
      }

      // Market board filter
      if (
        filter &&
        filter.marketBoard &&
        batch.marketBoard !== filter.marketBoard
      ) {
        return false;
      }

      // Price range filter
      if (filter && filter.minPrice != null && batch.price < filter.minPrice) {
        return false;
      }
      if (filter && filter.maxPrice != null && batch.price > filter.maxPrice) {
        return false;
      }

      // Change percentage filter
      if (
        filter &&
        filter.minPercentage != null &&
        batch.change &&
        batch.change.percentage < filter.minPercentage
      ) {
        return false;
      }
      if (
        filter &&
        filter.maxPercentage != null &&
        batch.change &&
        batch.change.percentage > filter.maxPercentage
      ) {
        return false;
      }

      // Lot filter
      if (
        filter &&
        filter.minLot != null &&
        batch.volume / LOT_SIZE < filter.minLot
      ) {
        return false;
      }

      // Value filter (price * volume) - WS source: BYPASS
      // We want to ingest ALL data for Analysis (Shrimp Detection), even if visually hidden.
      // Visual filtering will happen in page.tsx
      // const tradeValue = batch.price * batch.volume;
      // if (filter && filter.minValue != null && tradeValue < filter.minValue) {
      //   return false;
      // }
      // if (filter && filter.maxValue != null && tradeValue > filter.maxValue) {
      //   return false;
      // }

      return true;
    },
    [filter, symbols]
  );

  // Handle incoming WebSocket messages
  const handleReceiveMessage = useCallback(
    (message: DatafeedMessageChannel) => {
      if (message.error) {
        console.error('[RunningTradeWS] Message error:', message.error);
        return;
      }

      if (isPaused) return;

      let batchData = message.runningTradeBatch?.batch || [];
      if (!batchData.length) return;

      // Apply client-side filter
      batchData = batchData.filter(batchFilter);

      // Reverse to process oldest first
      const reversedBatch = [...batchData].reverse();

      // Deduplicate using Map
      const uniqueMap: Map<string, WSRunningTradeItem> = new Map();

      reversedBatch.forEach((item) => {
        const itemKey = `${Number(item.time?.seconds ?? 0)}-${item.stock}-${item.tradeNumber}`;
        uniqueMap.set(itemKey, item);
      });

      // Add existing queue items (keep newest)
      queue.current.forEach((item) => {
        const itemKey = `${Number(item.time?.seconds ?? 0)}-${item.stock}-${item.tradeNumber}`;
        if (!uniqueMap.has(itemKey)) {
          uniqueMap.set(itemKey, item);
        }
      });

      // Sort and limit
      const combined = Array.from(uniqueMap.values())
        .sort(sortBatchByTime)
        .slice(0, runningTradeConfig[rtKey].limit);

      queue.current = combined;
    },
    [isPaused, batchFilter, rtKey]
  );

  // Subscribe to running trade batch messages
  useDatafeedMessageEffect('runningTradeBatch', rtKey, handleReceiveMessage);

  // Update UI at 75ms intervals (for smooth rendering)
  useEffect(() => {
    if (isPaused || !isOpenMarket) return undefined;

    const interval = setInterval(() => {
      setData(queue.current.map(normalizeTrade));
      if (queue.current.length > 0) {
        setLoading(false);
      }
    }, 75);

    return () => clearInterval(interval);
  }, [isPaused, isOpenMarket]);

  // Manage active state
  useEffect(() => {
    setActive(rtKey, isOpenMarket);
    return () => setActive(rtKey, false);
  }, [isOpenMarket, rtKey, setActive]);

  // Clear data when filter changes
  // Using ref to track previous filter to avoid cascading setState
  const prevBatchFilterRef = useRef(batchFilter);
  useEffect(() => {
    if (prevBatchFilterRef.current !== batchFilter) {
      prevBatchFilterRef.current = batchFilter;
      queue.current = [];
      // Intentional: reset data when filter changes to avoid stale filtered results
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData([]);
      play(rtKey);
    }
  }, [batchFilter, play, rtKey]);

  return { data, isLoading, clearData };
}
