import { RunningTrade } from '@/lib/stockbit-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { analyzeTrades } from '@/lib/trade-analysis';
import { Badge } from '@/components/ui/badge';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useMemo, useRef } from 'react';
import { TradeRow } from './TradeRow';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface TradeFeedProps {
  data: RunningTrade;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  sortBy: 'time' | 'lot';
  sortOrder: 'asc' | 'desc';
  onSortChange: (sortBy: 'time' | 'lot') => void;
}

export function TradeFeed({
  data,
  onLoadMore,
  loadingMore,
  sortBy,
  sortOrder,
  onSortChange,
}: TradeFeedProps) {
  const { analyzedTrades, summary } = useMemo(
    () => analyzeTrades(data.data.running_trade),
    [data.data.running_trade]
  );

  const parentRef = useRef<HTMLDivElement>(null);

  // Create virtualizer instance
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: analyzedTrades.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 45, // estimated row height
    overscan: 5, // number of items to render outside of the visible area
  });

  // Handle infinite scroll via scroll event
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollHeight, scrollTop, clientHeight } = e.currentTarget;
    // Trigger when within 200px of bottom
    if (
      scrollHeight - scrollTop - clientHeight < 200 &&
      onLoadMore &&
      !loadingMore
    ) {
      onLoadMore();
    }
  };

  return (
    <Card className="border-border bg-card text-card-foreground flex h-full flex-col overflow-hidden shadow-lg">
      <CardHeader className="border-border bg-muted/50 border-b px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
            Live Trade Feed
          </CardTitle>
          {summary.dominantAction !== 'NEUTRAL' && (
            <Badge
              variant="outline"
              className={`${
                summary.dominantAction === 'ACCUMULATION'
                  ? 'border-green-500 bg-green-500/10 text-green-400'
                  : 'border-red-500 bg-red-500/10 text-red-400'
              }`}
            >
              {summary.dominantAction} DETECTED
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <TooltipProvider>
          <div className="flex h-full flex-col">
            {/* Sticky Header */}
            <div className="bg-muted/80 sticky top-0 z-10 grid shrink-0 grid-cols-12 items-center gap-2 border-b px-2 py-2 text-xs font-semibold backdrop-blur">
              <button
                onClick={() => onSortChange('time')}
                className="hover:text-foreground col-span-2 flex cursor-pointer items-center gap-1"
              >
                Time
                {sortBy === 'time' ? (
                  sortOrder === 'desc' ? (
                    <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowUp className="h-3 w-3" />
                  )
                ) : (
                  <ArrowUpDown className="h-3 w-3 opacity-50" />
                )}
              </button>
              <div className="col-span-1">Code</div>
              <div className="col-span-3 text-center">Price</div>
              <div className="col-span-1 text-center">Act</div>
              <button
                onClick={() => onSortChange('lot')}
                className="hover:text-foreground col-span-2 flex cursor-pointer items-center justify-center gap-1"
              >
                Lot
                {sortBy === 'lot' ? (
                  sortOrder === 'desc' ? (
                    <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowUp className="h-3 w-3" />
                  )
                ) : (
                  <ArrowUpDown className="h-3 w-3 opacity-50" />
                )}
              </button>
              <div className="col-span-1 text-center">Buyer</div>
              <div className="col-span-1 text-center">Seller</div>
              <div className="col-span-1 text-center">Market</div>
            </div>

            {/* List Container */}
            <div
              ref={parentRef}
              className="min-h-0 flex-1 overflow-auto"
              onScroll={handleScroll}
            >
              {analyzedTrades.length === 0 ? (
                <div className="text-muted-foreground py-10 text-center italic">
                  Waiting for trades...
                </div>
              ) : (
                <div
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {virtualizer.getVirtualItems().map((virtualItem) => (
                    <div
                      key={virtualItem.key}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                      className="px-2"
                    >
                      <TradeRow
                        trade={analyzedTrades[virtualItem.index]}
                        index={virtualItem.index}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Optional: Loading indicator at bottom of list if needed overlay? 
                But virtual list makes it tricky. Usually handled in list footer or separate indicator. */}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
