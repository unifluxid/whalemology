import { useState, useCallback, useMemo } from 'react';
import { RunningTradeFilters } from '@/lib/stockbit-data';
import { useConfigStore } from '@/store';

export type TradeSortOption = 'time' | 'lot';
export type TradeSortOrder = 'asc' | 'desc';
export type ActionTypeFilter = 'all' | 'buy' | 'sell';
export type MarketBoardFilter = 'all' | 'regular' | 'cash' | 'negotiation';

export interface UseTradeFiltersProps {
  initialSymbols?: string[];
}

function formatDateWIB(date: Date): string {
  // WIB is UTC+7
  const wibOffset = 7 * 60 * 60 * 1000;
  const utc = date.getTime();
  const wibDate = new Date(utc + wibOffset);
  return wibDate.toISOString().split('T')[0];
}

export function useTradeFilters({
  initialSymbols = [],
}: UseTradeFiltersProps = {}) {
  // Advanced API Filters (Remote)
  const [actionTypeFilter, setActionTypeFilter] =
    useState<ActionTypeFilter>('all');
  const [marketBoard, setMarketBoard] = useState<MarketBoardFilter>('all');
  const [priceRangeFrom, setPriceRangeFrom] = useState(0);
  const [priceRangeTo, setPriceRangeTo] = useState(0);
  const [minimumLot, setMinimumLot] = useState(0);
  const [timeRangeStart, setTimeRangeStart] = useState('');
  const [timeRangeEnd, setTimeRangeEnd] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date()
  );

  // Sorting
  const [sortBy, setSortBy] = useState<TradeSortOption>('time');
  const [sortOrder, setSortOrder] = useState<TradeSortOrder>('desc');

  // Selected Symbols (for multi-select)
  const [selectedSymbols, setSelectedSymbols] =
    useState<string[]>(initialSymbols);

  // Quick Filters (Client-side / Anomaly only)
  const { useWatchlist, setUseWatchlist } = useConfigStore();

  const resetFilters = useCallback(() => {
    setActionTypeFilter('all');
    setMarketBoard('all');
    setPriceRangeFrom(0);
    setPriceRangeTo(0);
    setMinimumLot(0);
    setTimeRangeStart('');
    setTimeRangeEnd('');
    setSelectedDate(new Date());
    setSortBy('time');
    setSortOrder('desc');
    // Note: We might NOT want to reset selectedSymbols here depending on UX,
    // but usually "Reset Filters" implies resetting the data query parameters.
    // Keeping symbols as is for now as it's often a separate context.

    // Reset quick filters
    // Reset quick filters
    // setUseWatchlist(false); // Can decide if we want to reset this pref too, usually no for config
  }, []);

  const handleSortChange = useCallback((newSortBy: TradeSortOption) => {
    setSortBy((prevSortBy) => {
      // If clicking same column, toggle order
      if (newSortBy === prevSortBy) {
        setSortOrder((prevOrder) => (prevOrder === 'desc' ? 'asc' : 'desc'));
        return newSortBy;
      }
      // If different column, default to desc
      setSortOrder('desc');
      return newSortBy;
    });
  }, []);

  const apiFilters = useMemo((): RunningTradeFilters => {
    const actionTypeMap = {
      all: 'RUNNING_TRADE_ACTION_TYPE_ALL',
      buy: 'RUNNING_TRADE_ACTION_TYPE_BUY',
      sell: 'RUNNING_TRADE_ACTION_TYPE_SELL',
    } as const;

    const marketBoardMap = {
      all: 'BOARD_TYPE_ALL',
      regular: 'BOARD_TYPE_REGULAR',
      cash: 'BOARD_TYPE_CASH',
      negotiation: 'BOARD_TYPE_NEGOTIATION',
    } as const;

    const orderByMap = {
      time: 'RUNNING_TRADE_ORDER_BY_TIME',
      lot: 'RUNNING_TRADE_ORDER_BY_LOT',
    } as const;

    return {
      action_type: actionTypeMap[actionTypeFilter],
      minimum_lot: minimumLot > 0 ? minimumLot : undefined,
      market_board: marketBoardMap[marketBoard],
      price_range_from: priceRangeFrom > 0 ? priceRangeFrom : undefined,
      price_range_to: priceRangeTo > 0 ? priceRangeTo : undefined,
      time_range_start: timeRangeStart || undefined,
      time_range_end: timeRangeEnd || undefined,
      date:
        selectedDate instanceof Date
          ? formatDateWIB(selectedDate)
          : formatDateWIB(new Date()),
      order_by: orderByMap[sortBy],
      sort: sortOrder,
      symbols: selectedSymbols.length > 0 ? selectedSymbols : undefined,
    };
  }, [
    actionTypeFilter,
    minimumLot,
    marketBoard,
    priceRangeFrom,
    priceRangeTo,
    timeRangeStart,
    timeRangeEnd,
    selectedDate,
    sortBy,
    sortOrder,
    selectedSymbols,
  ]);

  return {
    // State
    actionTypeFilter,
    setActionTypeFilter,
    marketBoard,
    setMarketBoard,
    priceRangeFrom,
    setPriceRangeFrom,
    priceRangeTo,
    setPriceRangeTo,
    minimumLot,
    setMinimumLot,
    timeRangeStart,
    setTimeRangeStart,
    timeRangeEnd,
    setTimeRangeEnd,
    selectedDate,
    setSelectedDate,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    selectedSymbols,
    setSelectedSymbols,
    useWatchlist,
    setUseWatchlist,

    // Actions
    resetFilters,
    handleSortChange,

    // Computed
    apiFilters,
  };
}
