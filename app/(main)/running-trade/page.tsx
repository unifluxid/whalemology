'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useConfigStore } from '@/store';
import { TradeFeed } from '@/components/whalemology/TradeFeed';
import { AnomalyCard } from '@/components/whalemology/AnomalyCard';
import { FilterPopover } from '@/components/whalemology/FilterPopover';
import { getWatchlistSymbols } from '@/lib/stockbit-data';
import { WatchlistSymbol } from '@/lib/stockbit-types';
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

// Hooks
import { useTradeFilters } from '@/hooks/use-trade-filters';
import { useSymbolSearch } from '@/hooks/use-symbol-search';
import { useRunningTrades } from '@/hooks/use-running-trades';

export default function GlobalRunningTradePage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const initialLoadRef = useRef(false);

  // Config from store
  const { pollInterval } = useConfigStore();

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
    minConfidenceScore,
    setMinConfidenceScore,
    minTotalValue,
    setMinTotalValue,
    showOnlyWhales,
    setShowOnlyWhales,
    // Actions
    resetFilters,
    handleSortChange,
    // Computed
    apiFilters,
  } = useTradeFilters();

  // 2. Search Hook
  const { searchKeyword, setSearchKeyword, searchResults } =
    useSymbolSearch(token);

  // 3. Trade Data Hook
  const { data, loading, loadingMore, handleLoadMore } = useRunningTrades({
    token,
    filters: apiFilters,
    pollInterval,
  });

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
  }, [token, user]); // Removed selectedSymbols dependency to avoid loop, checked inside

  // Sync session (Keep existing logic)
  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;

    const syncSession = async () => {
      if (token) return token;
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.token) {
            const currentUser = useAuthStore.getState().user;
            if (currentUser) {
              useAuthStore.getState().setAuth(data.token, currentUser);
            } else {
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
      const activeToken = await syncSession();
      if (!activeToken) {
        router.push('/login');
      }
    };

    init();
  }, [token, router]);

  // Compute anomalies (Client-side filtering)
  const anomalies = useMemo(() => {
    if (!data) return [];
    const allAnomalies = aggregateStockAnomalies(data.data.running_trade);

    return allAnomalies.filter((anomaly) => {
      if (anomaly.confidenceScore < minConfidenceScore) return false;
      if (anomaly.totalValue < minTotalValue) return false;
      if (showOnlyWhales && anomaly.whaleCount === 0) return false;
      return true;
    });
  }, [data, minConfidenceScore, minTotalValue, showOnlyWhales]);

  // Title effect
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

  // The render part is mostly identical, just using values from hooks
  return (
    <div className="text-foreground flex h-full flex-col p-4 font-sans">
      <div className="mx-auto flex h-full w-full flex-col space-y-4">
        {/* Filters Section */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
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
                    onSelect={setSelectedDate}
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
                onApply={() => {
                  /* No-op: Hook handles refetch automatically on change */
                }}
                onReset={resetFilters}
              />
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
                  onValueChange={setSearchKeyword}
                >
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

        {/* Content */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-7">
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
