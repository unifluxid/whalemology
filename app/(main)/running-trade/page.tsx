'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useConfigStore } from '@/store';
import { TradeFeed } from '@/components/whalemology/TradeFeed';
import { AnomalyCard } from '@/components/whalemology/AnomalyCard';
import { FilterPopover } from '@/components/whalemology/FilterPopover';
import {
  getRunningTrade,
  RunningTradeFilters,
  getWatchlistSymbols,
  searchSymbols,
} from '@/lib/stockbit-data';
import { RunningTrade, WatchlistSymbol } from '@/lib/stockbit-types';
import { aggregateStockAnomalies } from '@/lib/trade-analysis';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useDebouncedCallback } from '@/hooks/use-debounce';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
} from '@/components/ui/multi-select';
import { Calendar as CalendarIcon, TrendingUp, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function GlobalRunningTradePage() {
  const router = useRouter();
  const { token } = useAuthStore();
  const initialLoadRef = useRef(false);

  // -- Local State for Settings (Refactored from Global Store) --
  const { pollInterval, selectedSymbols, setSelectedSymbols } =
    useConfigStore();
  const [minConfidenceScore, setMinConfidenceScore] = useState(1);
  const [minTotalValue, setMinTotalValue] = useState(0);
  const [showOnlyWhales, setShowOnlyWhales] = useState(false);
  const [actionTypeFilter, setActionTypeFilter] = useState<
    'all' | 'buy' | 'sell'
  >('all');
  const [minimumLot, setMinimumLot] = useState(0);
  const [marketBoard, setMarketBoard] = useState<
    'all' | 'regular' | 'cash' | 'negotiation'
  >('all');
  const [priceRangeFrom, setPriceRangeFrom] = useState(0);
  const [priceRangeTo, setPriceRangeTo] = useState(0);
  const [timeRangeStart, setTimeRangeStart] = useState('');
  const [timeRangeEnd, setTimeRangeEnd] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date()
  );
  const [sortBy, setSortBy] = useState<'time' | 'lot'>('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [data, setData] = useState<RunningTrade | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Symbol multi-select state
  const { user } = useAuthStore();
  const [watchlistSymbols, setWatchlistSymbols] = useState<WatchlistSymbol[]>(
    []
  );
  const [searchResults, setSearchResults] = useState<WatchlistSymbol[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');

  const resetFilters = useCallback(() => {
    setMinConfidenceScore(1);
    setMinTotalValue(0);
    setShowOnlyWhales(false);
    setActionTypeFilter('all');
    setMinimumLot(0);
    setMarketBoard('all');
    setPriceRangeFrom(0);
    setPriceRangeTo(0);
    setTimeRangeStart('');
    setTimeRangeEnd('');
    setSelectedDate(new Date());
    setSortBy('time');
    setSortOrder('desc');
  }, []);

  // Build API filters from advanced filter settings
  const buildApiFilters = useCallback((): RunningTradeFilters => {
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
          ? selectedDate.toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
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

  // Fetch trades with filters
  const fetchTrades = useCallback(
    async (activeToken: string, tradeNumber?: string, dateOverride?: Date) => {
      const filters = buildApiFilters();
      if (dateOverride) {
        filters.date = dateOverride.toISOString().split('T')[0];
      }
      return await getRunningTrade('', activeToken, tradeNumber, filters);
    },
    [buildApiFilters]
  );

  // Compute anomalies from ALL trade data (not filtered by advanced filters)
  // Only apply quick filters: confidence, value, whales
  const anomalies = useMemo(() => {
    if (!data) return [];
    const allAnomalies = aggregateStockAnomalies(data.data.running_trade);

    // Apply only anomaly-level quick filters
    return allAnomalies.filter((anomaly) => {
      if (anomaly.confidenceScore < minConfidenceScore) return false;
      if (anomaly.totalValue < minTotalValue) return false;
      if (showOnlyWhales && anomaly.whaleCount === 0) return false;
      return true;
    });
  }, [data, minConfidenceScore, minTotalValue, showOnlyWhales]);

  // Handle advanced filter apply
  const handleFilterApply = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      const trades = await fetchTrades(token);
      setData(trades);
    } catch (error) {
      console.error('Failed to apply filters', error);
    } finally {
      setLoading(false);
    }
  }, [token, fetchTrades]);

  // Handle advanced filter reset
  const handleFilterReset = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      const trades = await fetchTrades(token);
      setData(trades);
    } catch (error) {
      console.error('Failed to reset filters', error);
    } finally {
      setLoading(false);
    }
  }, [token, fetchTrades]);

  // Load watchlist symbols on mount
  useEffect(() => {
    const loadWatchlist = async () => {
      if (!token || !user?.watchlist_id) return;

      try {
        const response = await getWatchlistSymbols(user.watchlist_id, token);
        setWatchlistSymbols(response.data.result);

        // If no symbols are selected yet, pre-load all watchlist symbols
        if (selectedSymbols.length === 0) {
          const symbols = response.data.result.map((s) => s.symbol);
          setSelectedSymbols(symbols);
        }
      } catch (error) {
        console.error('Failed to load watchlist', error);
      }
    };

    loadWatchlist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user]);

  // Refetch trades when selected symbols change
  useEffect(() => {
    handleFilterApply();
  }, [selectedSymbols, handleFilterApply]);

  const debouncedSetSearchKeyword = useDebouncedCallback(setSearchKeyword, 300);

  // Handle symbol search
  useEffect(() => {
    if (!searchKeyword || !token) {
      setSearchResults([]);
      return;
    }

    const search = async () => {
      try {
        const response = await searchSymbols(searchKeyword, token);
        // Convert search results to watchlist symbol format
        const symbols: WatchlistSymbol[] = response.data.company
          .filter((company) => company.type === 'Saham')
          .map((company) => ({
            symbol: company.name,
            symbol2: company.symbol_2,
            symbol3: company.symbol_3,
            country: company.country,
            exchange: company.exchange,
            status: parseInt(company.status),
            id: company.id,
            name: company.desc,
            sequence_no: 0,
            icon_url: company.icon_url,
            last: '',
            change: '',
            percent: '',
            previous: '',
            tradeable: company.is_tradeable,
            type: company.type,
            orderbook: { bid: '', offer: '' },
            prices: [],
            column: [],
            notations: [],
            uma: false,
            corp_action: { active: false, icon: '', text: '' },
            formatted_price: '',
            notation: [],
            volume: '',
            extra_attributes: null,
          }));
        setSearchResults(symbols);
      } catch (error) {
        console.error('Failed to search symbols', error);
      }
    };

    search();
  }, [searchKeyword, token]);

  // Sync session
  useEffect(() => {
    // Prevent double-fetch in React Strict Mode
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;

    const syncSession = async () => {
      if (token) return token;
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.token) {
            // Only update token, preserve existing user data
            const currentUser = useAuthStore.getState().user;
            if (currentUser) {
              // User already exists, just update token
              useAuthStore.getState().setAuth(data.token, currentUser);
            } else {
              // No user data yet, use what we got (minimal)
              useAuthStore.getState().setAuth(data.token, data.user);
            }
            return data.token;
          }
        }
      } catch (e) {
        console.error('Session sync failed', e);
      }
      return null;
    };

    const init = async () => {
      // Ensure date is reset to today on initial load
      const today = new Date();
      setSelectedDate(today);

      const activeToken = await syncSession();
      if (!activeToken) {
        router.push('/login');
        return;
      }

      try {
        setLoading(true);
        const trades = await fetchTrades(activeToken, undefined, today);
        setData(trades);
      } catch (error) {
        console.error('Failed to load global trades', error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [token, router, fetchTrades]);

  // Infinite Scroll Load More
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

  // Polling
  useEffect(() => {
    if (!token) return;

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
  }, [token, pollInterval, fetchTrades]);

  // Handle date change - fetch immediately (outside filter applies immediately)
  const handleDateChange = useCallback(
    async (date: Date | undefined) => {
      // NOTE: We don't guard against date being undefined here to allow clearing,
      // but UI logic suggests date is usually required or defaults to today.
      // If date is undefined, we might just return.
      if (!date || !token) return;

      setSelectedDate(date);

      try {
        setLoading(true);
        // We pass the new date explicitly because state update might be async/batched
        // although we also update state above.
        // Actually fetchTrades uses selectedDate from state closure or arguments.
        // It's safer to rely on the effect or pass it explicitly if we want immediate fetch.
        // Here we rely on the state update being reflected in next render or pass it if fetchTrades accepts override.
        // fetchTrades accepts dateOverride.
        const trades = await fetchTrades(token, undefined, date);
        setData(trades);
      } catch (error) {
        console.error('Failed to fetch trades with new date', error);
      } finally {
        setLoading(false);
      }
    },
    [token, fetchTrades]
  );

  // Handle sort change - toggle order if same column, fetch immediately
  const handleSortChange = useCallback(
    async (newSortBy: 'time' | 'lot') => {
      if (!token) return;

      // If clicking same column, toggle order; if different column, use desc
      let newSortOrder: 'asc' | 'desc' = 'desc';
      if (newSortBy === sortBy) {
        newSortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
      }

      setSortBy(newSortBy);
      setSortOrder(newSortOrder);

      // We need to wait for state to update for buildApiFilters to see new sort
      // OR we can pass overrides. But fetchTrades doesn't accept sort overrides easily without refactor.
      // For now, let's assume valid state in next tick or duplicate logic.
      // To ensure correct params immediately:
      // We can't easily pass sort override to fetchTrades without changing its signature.
      // So we will just fire the effect or call it.
      // Actually, since buildApiFilters depends on state, calling fetchTrades immediately here
      // might use OLD state due to closure.
      // FIX: It's better to use a dedicated useEffect for sort changes OR refactor fetchTrades to accept filters object directly.
      // The current pattern in `handleDateChange` uses an override.
      // Let's refactor fetchTrades slightly? No, let's just cheat and wait or use a hack?
      // Better approach: Update state, and let a useEffect trigger fetch?
      // The original code fetched immediately.
      // To fix closure stale state issue without changing fetchTrades signature too much:
      // We'll update the state, but we can't await state update.
      // We will perform the fetch manually constructing filters with new sort values here.

      try {
        setLoading(true);
        const filters = buildApiFilters();
        // Override sort in filters
        const orderByMap = {
          time: 'RUNNING_TRADE_ORDER_BY_TIME',
          lot: 'RUNNING_TRADE_ORDER_BY_LOT',
        } as const;
        filters.order_by = orderByMap[newSortBy];
        filters.sort = newSortOrder;

        const trades = await getRunningTrade('', token, undefined, filters);
        setData(trades);
      } catch (error) {
        console.error('Failed to fetch trades with new sort', error);
      } finally {
        setLoading(false);
      }
    },
    [token, sortBy, sortOrder, buildApiFilters]
  );

  useEffect(() => {
    document.title = 'Global Running Trade | Whalemology';
  }, []);

  if (loading || !data) {
    return (
      <div className="text-foreground flex min-h-screen items-center justify-center">
        <div className="flex animate-pulse flex-col items-center">
          <div className="border-primary mb-4 h-12 w-12 animate-spin rounded-full border-4 border-t-transparent" />
          Loading Global Market Data...
        </div>
      </div>
    );
  }

  return (
    <div className="text-foreground flex h-full flex-col p-4 font-sans">
      <div className="mx-auto flex h-full w-full flex-col space-y-4">
        {/* Filters Section - Left and Right */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
          {/* Left: Advanced Filters (Trade Feed) - 3 columns */}
          <div className="md:col-span-3">
            <div className="flex items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-[200px] justify-start text-left font-normal',
                      !selectedDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate
                      ? format(selectedDate, 'dd MMM yyyy')
                      : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateChange}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FilterPopover
                actionTypeFilter={actionTypeFilter}
                marketBoard={marketBoard}
                priceRangeFrom={priceRangeFrom}
                priceRangeTo={priceRangeTo}
                minimumLot={minimumLot}
                timeRangeStart={timeRangeStart}
                timeRangeEnd={timeRangeEnd}
                selectedDate={selectedDate}
                setActionTypeFilter={setActionTypeFilter}
                setMarketBoard={setMarketBoard}
                setPriceRangeFrom={setPriceRangeFrom}
                setPriceRangeTo={setPriceRangeTo}
                setMinimumLot={setMinimumLot}
                setTimeRangeStart={setTimeRangeStart}
                setTimeRangeEnd={setTimeRangeEnd}
                setSelectedDate={setSelectedDate}
                resetFilters={resetFilters}
                onApply={handleFilterApply}
                onReset={handleFilterReset}
              />
              {/* Multi select */}
              <MultiSelect
                values={selectedSymbols}
                onValuesChange={setSelectedSymbols}
              >
                <MultiSelectTrigger className="w-[200px]">
                  <MultiSelectValue
                    overflowBehavior="cutoff"
                    placeholder={
                      selectedSymbols.length > 0
                        ? `${selectedSymbols.length} Selected`
                        : 'All Stocks'
                    }
                  />
                </MultiSelectTrigger>
                <MultiSelectContent
                  search={{
                    placeholder: 'Search symbols...',
                    emptyMessage: 'No symbols found.',
                  }}
                  onValueChange={debouncedSetSearchKeyword}
                >
                  {/* Show watchlist symbols ONLY when not searching */}
                  {!searchKeyword &&
                    watchlistSymbols.map((symbol) => (
                      <MultiSelectItem
                        key={symbol.symbol}
                        value={symbol.symbol}
                        badgeLabel={symbol.symbol}
                      >
                        {symbol.symbol}
                      </MultiSelectItem>
                    ))}

                  {/* Show search results when searching */}
                  {searchKeyword &&
                    searchResults.map((symbol) => (
                      <MultiSelectItem
                        key={`search-${symbol.symbol}`}
                        value={symbol.symbol}
                        badgeLabel={symbol.symbol}
                      >
                        {symbol.symbol}
                      </MultiSelectItem>
                    ))}
                </MultiSelectContent>
              </MultiSelect>
            </div>
          </div>

          {/* Right: Quick Filters (Anomaly Cards) - 4 columns */}
          <div className="md:col-span-4">
            <div className="flex flex-wrap items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Select
                      value={String(minConfidenceScore)}
                      onValueChange={(value) =>
                        setMinConfidenceScore(Number(value))
                      }
                    >
                      <SelectTrigger
                        className="w-[190px] gap-2 [&>span]:flex-1 [&>span]:text-left"
                        id="confidence"
                      >
                        <TrendingUp className="h-4 w-4" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 - All</SelectItem>
                        <SelectItem value="2">2 - Weak+</SelectItem>
                        <SelectItem value="3">3 - Moderate+</SelectItem>
                        <SelectItem value="4">4 - Can Follow+</SelectItem>
                        <SelectItem value="5">5 - Strong Follow+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Min Confidence Score</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Select
                      value={String(minTotalValue)}
                      onValueChange={(value) => setMinTotalValue(Number(value))}
                    >
                      <SelectTrigger
                        className="w-[120px] gap-2 [&>span]:flex-1 [&>span]:text-left"
                        id="value"
                      >
                        <DollarSign className="h-4 w-4" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">All</SelectItem>
                        <SelectItem value="100000000">100M+</SelectItem>
                        <SelectItem value="200000000">200M+</SelectItem>
                        <SelectItem value="500000000">500M+</SelectItem>
                        <SelectItem value="1000000000">1B+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Min Total Value</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="whales"
                      checked={showOnlyWhales}
                      onCheckedChange={(checked) =>
                        setShowOnlyWhales(checked === true)
                      }
                    />
                    <Label
                      htmlFor="whales"
                      className="flex cursor-pointer items-center"
                    >
                      🐋
                    </Label>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Show Whales Only</p>
                </TooltipContent>
              </Tooltip>

              <div className="text-muted-foreground ml-auto text-sm">
                <span className="font-semibold">
                  {data?.data.running_trade.length || 0}
                </span>{' '}
                trades •{' '}
                <span className="font-semibold">{anomalies.length}</span>{' '}
                anomalies
              </div>
            </div>
          </div>
        </div>

        {/* Content - Three Column Grid */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-7">
          {/* Left: Trade Feed - 3 columns */}
          <div className="h-full min-h-0 md:col-span-3">
            <div className="sticky top-6 h-[calc(100vh-10rem)]">
              <TradeFeed
                data={data}
                onLoadMore={handleLoadMore}
                loadingMore={loadingMore}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={handleSortChange}
              />
            </div>
          </div>

          {/* Right: Anomaly Cards - 4 columns (2 columns each side by side) */}
          <div className="md:col-span-4">
            <div className="sticky top-6 h-[calc(100vh-10rem)]">
              <AnomalyCard anomalies={anomalies} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
