'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuthStore } from '@/store';
import { TradeFeed } from '@/components/whalemology/TradeFeed';
import { ConsolidatedStockList } from '@/components/whalemology/ConsolidatedStockList';
import { FilterPopover } from '@/components/whalemology/FilterPopover';
import { getWatchlistSymbols } from '@/lib/stockbit-data';
import { featureFlags } from '@/lib/feature-flags';
import { WatchlistSymbol } from '@/lib/stockbit-types';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// Duplicate Select imports removed
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  useMockScenarios,
  SCENARIO_OPTIONS,
  type ScenarioType,
} from '@/hooks/use-mock-scenarios';
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
} from '@/components/ui/multi-select';
import { Calendar as CalendarIcon, Star, Play, Pause } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// Hooks
import { useTradeFilters } from '@/hooks/use-trade-filters';
import { useSymbolSearch } from '@/hooks/use-symbol-search';
import { useRunningTrades } from '@/hooks/use-running-trades';
import { useRunningTradeWS } from '@/hooks/use-running-trade-ws';
import { useOrderFlowThrottled } from '@/hooks/use-order-flow';
import useDatafeedSocket from '@/lib/datafeed/useDatafeedSocket';
import {
  useRunningTradeStore,
  StockFilterTypeEnum,
} from '@/store/running-trade-ws-store';

export default function GlobalRunningTradePage() {
  const { token, user } = useAuthStore();

  // 1. Filter Hook
  const {
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
    sortOrder,
    selectedSymbols,
    setSelectedSymbols,

    // Actions
    resetFilters,
    handleSortChange,
    // Computed
    apiFilters,
    useWatchlist,
    setUseWatchlist,
  } = useTradeFilters();

  // 2. Search Hook
  const { searchKeyword, setSearchKeyword, searchResults } =
    useSymbolSearch(token);

  // 3. Trade Data Hook (REST - used as fallback and initial data)
  const {
    data: restData,
    loading,
    loadingMore,
    handleLoadMore,
    refetch,
    appendTrades,
  } = useRunningTrades({
    token,
    filters: apiFilters,
  });

  // 4. WebSocket connection status
  const { isAuthorized } = useDatafeedSocket();

  // 5. Running trade store for pause/play
  const isPaused = useRunningTradeStore(
    (state) => state.instances.widget.isPaused
  );
  const pauseWS = useRunningTradeStore((state) => state.pause);
  const playWS = useRunningTradeStore((state) => state.play);
  const setStock = useRunningTradeStore((state) => state.setStock);

  // Determine if market is open based on REST data
  const isOpenMarket = useMemo(() => {
    return restData?.data?.is_open_market ?? false;
  }, [restData]);

  // 6. WebSocket Trade Data Hook
  const { data: wsData } = useRunningTradeWS({
    rtKey: 'widget',
    isOpenMarket: isOpenMarket && isAuthorized,
  });

  // 5. Data Unification (Rest + WS)
  // restData comes from useRunningTrades which reads from the store.
  // The store is updated by WS data via appendTrades in useEffect below.
  // So restData is the single source of truth for the UI.
  const liveData = restData;

  // 6. Simulation Mode Logic
  const [scenario, setScenario] = useState<ScenarioType>('live');
  const mockData = useMockScenarios(scenario);

  const rawData = useMemo(() => {
    return scenario === 'live' ? liveData : mockData;
  }, [scenario, liveData, mockData]);

  // Handle load more only for live mode
  const handleActiveLoadMore =
    scenario === 'live' ? handleLoadMore : async () => {};
  const isActiveLoadingMore = scenario === 'live' ? loadingMore : false;

  // Sync symbols to WS store when selectedSymbols change
  useEffect(() => {
    setStock('widget', {
      type:
        selectedSymbols.length > 0
          ? StockFilterTypeEnum.Custom
          : StockFilterTypeEnum.AllStock,
      selected: selectedSymbols.length > 0 ? selectedSymbols : ['*'],
    });
  }, [selectedSymbols, setStock]);

  // Get setFilter from WS store
  const setWsFilter = useRunningTradeStore((state) => state.setFilter);

  // Sync REST API filters to WS store for client-side filtering
  // This ensures WS data is filtered the same way as REST data
  useEffect(() => {
    const wsFilter = {
      actionType:
        actionTypeFilter === 'buy'
          ? 'BUY'
          : actionTypeFilter === 'sell'
            ? 'SELL'
            : null,
      marketBoard:
        marketBoard === 'all'
          ? null
          : marketBoard === 'regular'
            ? 'RG'
            : marketBoard === 'cash'
              ? 'TN'
              : marketBoard === 'negotiation'
                ? 'NG'
                : null,
      minPrice: priceRangeFrom > 0 ? priceRangeFrom : null,
      maxPrice: priceRangeTo > 0 ? priceRangeTo : null,
      minLot: minimumLot > 0 ? minimumLot : null,
    } as const;

    setWsFilter('widget', wsFilter);
  }, [
    actionTypeFilter,
    marketBoard,
    priceRangeFrom,
    priceRangeTo,
    minimumLot,
    setWsFilter,
  ]);

  // Use WebSocket when available and market is open
  const useWebSocket =
    isOpenMarket && isAuthorized && !isPaused && wsData.length > 0;

  // Final data: always use restData (unified store)
  // Final data: always use restData (unified store)
  // const data = restData; // Removed

  // 7. Merge WebSocket trades into unified store
  useEffect(() => {
    if (!useWebSocket || wsData.length === 0) return;

    // WS data is already normalized to TradeItem format by the hook
    appendTrades(wsData, apiFilters);
  }, [wsData, useWebSocket, appendTrades, apiFilters]);

  // Auto-pause when user scrolls (like Stockbit)
  const handleUserScroll = useCallback(() => {
    if (!isPaused && isOpenMarket) {
      pauseWS('widget');
    }
  }, [isPaused, isOpenMarket, pauseWS]);

  // Pause/Play handlers
  const handlePausePlay = useCallback(async () => {
    if (isPaused) {
      // Fetch fresh data before resuming to fill the gap
      await refetch();
      playWS('widget');
    } else {
      pauseWS('widget');
    }
  }, [isPaused, playWS, pauseWS, refetch]);

  // Load watchlist symbols on mount (keep this logic here as it interacts with auth & selected symbols)
  // We could extract another hook `useWatchlist` but this is acceptable for now.
  const [watchlistSymbols, setWatchlistSymbols] = useState<WatchlistSymbol[]>(
    []
  );

  // NOTE: I need to import useState for this local state
  // Let's add useState to imports

  // Logic from original file to load watchlist
  useEffect(() => {
    const loadWatchlist = async () => {
      // User requested: "when not true. should not fetch watchlist on innitial"
      if (!useWatchlist) return;

      if (!token || !user?.watchlist_id) return;

      try {
        const response = await getWatchlistSymbols(user.watchlist_id, token);
        setWatchlistSymbols(response.data.result);

        // If no symbols are selected yet, pre-load all watchlist symbols
        if (selectedSymbols.length === 0) {
          const symbols = response.data.result.map(
            (s: WatchlistSymbol) => s.symbol
          );
          setSelectedSymbols(symbols);
        }
      } catch (error) {
        console.error('Failed to load watchlist', error);
      }
    };

    loadWatchlist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user, useWatchlist]); // Added useWatchlist dependency

  // Handle Watchlist Toggle Loop
  useEffect(() => {
    if (useWatchlist) {
      if (watchlistSymbols.length > 0) {
        const symbols = watchlistSymbols.map((s) => s.symbol);
        setSelectedSymbols(symbols);
        setPendingSelectedSymbols(symbols); // Sync pending state too
      }
    }
  }, [useWatchlist, watchlistSymbols, setSelectedSymbols]);

  const handleWatchlistToggle = (checked: boolean) => {
    setUseWatchlist(checked);
    if (!checked) {
      setSelectedSymbols([]);
      setPendingSelectedSymbols([]);
    }
  };

  // Deferred Selection Logic
  const [pendingSelectedSymbols, setPendingSelectedSymbols] =
    useState<string[]>(selectedSymbols);
  const [isMultiSelectOpen, setIsMultiSelectOpen] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);

  // Sync pending with real when opening, AND when real changes externally (e.g. from watchlist toggle or initial load)
  useEffect(() => {
    if (!isMultiSelectOpen) {
      setPendingSelectedSymbols(selectedSymbols);
    }
  }, [selectedSymbols, isMultiSelectOpen]);

  const handleValuesChange = (newValues: string[]) => {
    setPendingSelectedSymbols(newValues);
    // If closed, apply immediately (e.g. removing via "x" button)
    if (!isMultiSelectOpen) {
      setSelectedSymbols(newValues);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setIsMultiSelectOpen(isOpen);
    if (!isOpen) {
      // Closing: Apply changes
      setSelectedSymbols(pendingSelectedSymbols);
    }
  };

  // Combine options: always include selected items even if searching
  // logic: if Not Searching -> Watchlist + (Selected items not in Watchlist)
  // if Searching -> Search Results + (Selected items not in Results)
  // BUT user said "all selected symbols should show on multiselect options", implying they want to see them to uncheck them.
  // MultiSelect component handles "checking/unchecking" via value.
  // We just need to ensure the ITEM is rendered.

  const visibleOptions = useMemo(() => {
    const baseOptions = searchKeyword ? searchResults : watchlistSymbols;
    const baseSymbols = new Set(baseOptions.map((s) => s.symbol));

    // Items that are selected but not in the base list
    // We need to reconstruct their details. Since we only store symbol string,
    // we might need to find them in watchlist or just make a dummy object.
    // Ideally we find them in watchlist to get correct distinct name if possible.
    const missingSelected = pendingSelectedSymbols.filter(
      (s) => !baseSymbols.has(s)
    );

    const extraItems = missingSelected.map((symbol) => {
      // Try to find in watchlist first
      const found = watchlistSymbols.find((w) => w.symbol === symbol);
      if (found) return found;
      // Fallback dummy
      return {
        symbol,
        name: symbol, // We might not have name if it came from a previous search
        // Minimal required props for MultiSelectItem key/value
      } as WatchlistSymbol;
    });

    return [...baseOptions, ...extraItems];
  }, [searchKeyword, searchResults, watchlistSymbols, pendingSelectedSymbols]);

  // Note: Auth redirects are now handled by AuthProvider
  // Session sync is no longer needed here

  // Calculate order flow statistics per symbol (throttled to 500ms)
  const orderFlowStats = useOrderFlowThrottled({
    trades: rawData?.data.running_trade ?? null,
    interval: 500, // Analyze every 500ms instead of every change
    // Always enabled - Market Radar should analyze even when WS is paused
  });

  // Title effect
  useEffect(() => {
    document.title = 'Global Running Trade | Whalemology';
  }, []);

  if (loading || !rawData) {
    // Only block if we are in live mode and authenticating/fetching
    // If mock mode, activeData should be ready instantly (unless we want to fake load)
    if (scenario === 'live' && (loading || !rawData)) {
      return (
        <div className="text-foreground flex min-h-screen items-center justify-center">
          <div className="flex animate-pulse flex-col items-center">
            <div className="border-primary mb-4 h-12 w-12 animate-spin rounded-full border-4 border-t-transparent" />
            Loading Global Market Data...
          </div>
        </div>
      );
    }
    // If scenario is mock and activeData is somehow null
    if (scenario !== 'live' && !rawData) return null;
  }

  // The render part is mostly identical, just using values from hooks
  return (
    <div className="text-foreground flex h-full flex-col p-4 font-sans">
      <div className="mx-auto flex h-full w-full flex-col space-y-4">
        {/* Filters Section */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
          <div className="md:col-span-3">
            <div className="flex items-center gap-3">
              {/* Simulation Selector */}
              <Select
                value={scenario}
                onValueChange={(val) => setScenario(val as ScenarioType)}
              >
                <SelectTrigger className="bg-background w-[280px]">
                  <SelectValue placeholder="Select Mode" />
                </SelectTrigger>
                <SelectContent>
                  {SCENARIO_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Popover open={isDateOpen} onOpenChange={setIsDateOpen}>
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
                    onSelect={(date) => {
                      if (date) {
                        setSelectedDate(date);
                        setIsDateOpen(false);
                      }
                    }}
                    initialFocus
                    required
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
                setActionTypeFilter={setActionTypeFilter}
                setMarketBoard={setMarketBoard}
                setPriceRangeFrom={setPriceRangeFrom}
                setPriceRangeTo={setPriceRangeTo}
                setMinimumLot={setMinimumLot}
                setTimeRangeStart={setTimeRangeStart}
                setTimeRangeEnd={setTimeRangeEnd}
                resetFilters={resetFilters}
                onApply={() => {
                  /* No-op: Hook handles refetch automatically on change */
                }}
                onReset={resetFilters}
              />
              <MultiSelect
                values={pendingSelectedSymbols}
                onValuesChange={handleValuesChange}
                onOpenChange={handleOpenChange}
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
                  onValueChange={setSearchKeyword}
                >
                  {visibleOptions.map((symbol) => (
                    <MultiSelectItem
                      key={symbol.symbol}
                      value={symbol.symbol}
                      badgeLabel={symbol.symbol}
                    >
                      {symbol.symbol}
                    </MultiSelectItem>
                  ))}
                </MultiSelectContent>
              </MultiSelect>

              {featureFlags.watchlist && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="watchlist"
                        checked={useWatchlist}
                        onCheckedChange={(checked) =>
                          handleWatchlistToggle(checked === true)
                        }
                      />
                      <Label
                        htmlFor="watchlist"
                        className="flex cursor-pointer items-center"
                      >
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      </Label>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Use Watchlist</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          <div className="md:col-span-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-muted-foreground ml-auto flex items-center gap-3 text-sm">
                {/* Pause/Play Badge */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant={isPaused ? 'secondary' : 'default'}
                      className={cn(
                        'cursor-pointer gap-1',
                        !isPaused && 'bg-green-600 hover:bg-green-700'
                      )}
                      onClick={handlePausePlay}
                    >
                      {isPaused ? (
                        <Play className="h-3 w-3" />
                      ) : (
                        <Pause className="h-3 w-3" />
                      )}
                      {isPaused ? 'Paused' : 'Live'}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {isPaused
                        ? 'Click to resume updates'
                        : 'Click to pause updates'}
                    </p>
                  </TooltipContent>
                </Tooltip>
                <span className="font-semibold">
                  {rawData?.data.running_trade.length || 0}
                </span>{' '}
                trades
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-7">
          <div className="h-full min-h-0 md:col-span-3">
            <div className="sticky top-6 h-[calc(100vh-10rem)]">
              {rawData && (
                <TradeFeed
                  data={rawData}
                  onLoadMore={handleActiveLoadMore}
                  loadingMore={isActiveLoadingMore}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSortChange={handleSortChange}
                  onUserScroll={handleUserScroll}
                />
              )}
            </div>
          </div>

          <div className="md:col-span-4">
            <div className="sticky top-6 h-[calc(100vh-10rem)] pr-1 pb-4">
              <ConsolidatedStockList data={orderFlowStats} className="h-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
