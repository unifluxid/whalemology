'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { OrderFlowResult, SymbolOrderFlow } from '@/hooks/use-order-flow';
import { Radar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface ConsolidatedStockListProps {
  data: OrderFlowResult;
  className?: string;
}

function formatNumber(num: number): string {
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  }
  return `${sign}${(abs / 1_000).toFixed(1)}K`; // Fallback
}

function StockRow({ item }: { item: SymbolOrderFlow }) {
  const isBuy = item.pressureScore > 0;

  // Choose signal badge color/label
  let badgeColor = 'border-slate-500 text-slate-500';
  let badgeLabel = '';

  if (item.signal === 'accumulation') {
    badgeColor = 'border-green-500 bg-green-500/10 text-green-600';
    badgeLabel = '💰 ACCUM';
  } else if (item.signal === 'distribution') {
    badgeColor = 'border-red-500 bg-red-500/10 text-red-600';
    badgeLabel = '💦 DIST';
  } else if (item.signal === 'markup') {
    badgeColor = 'border-blue-500 bg-blue-500/10 text-blue-500';
    badgeLabel = '🚀 HAKA';
  } else if (item.signal === 'markdown') {
    badgeColor = 'border-orange-500 bg-orange-500/10 text-orange-500';
    badgeLabel = '🚨 PANIC';
  }

  return (
    <div className="hover:bg-accent/50 flex flex-col gap-1 rounded-lg border p-2 transition-colors">
      {/* Top Line: Symbol, Price Change, Signal */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">{item.symbol}</span>
          <span
            className={cn(
              'text-xs font-medium',
              item.priceChange > 0
                ? 'text-green-500'
                : item.priceChange < 0
                  ? 'text-red-500'
                  : 'text-muted-foreground'
            )}
          >
            {item.priceChange > 0 ? '+' : ''}
            {item.priceChange.toFixed(2)}%
          </span>

          {/* Best Entry Price Badge - Actionable Labels */}
          {item.bestEntryPrice > 0 && item.signal === 'markup' && (
            <Badge
              variant="secondary"
              className="h-5 border-blue-500/30 bg-blue-500/15 px-1.5 text-[10px] font-semibold text-blue-500"
            >
              🚀 BUY NOW @ {item.bestEntryPrice.toLocaleString()}
            </Badge>
          )}
          {item.bestEntryPrice > 0 && item.signal === 'accumulation' && (
            <Badge
              variant="secondary"
              className="h-5 border-emerald-500/30 bg-emerald-500/15 px-1.5 text-[10px] font-semibold text-emerald-500"
            >
              💰 BUY DIP @ {item.bestEntryPrice.toLocaleString()}
            </Badge>
          )}
        </div>

        {badgeLabel && (
          <Badge
            variant="outline"
            className={cn('h-5 px-1.5 text-[10px] uppercase', badgeColor)}
          >
            {badgeLabel}
          </Badge>
        )}
      </div>

      {/* Bottom Line: Whale vs Shrimp Values */}
      <div className="mt-1 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1">
          <span role="img" aria-label="whale">
            🐋
          </span>
          <span
            className={cn(
              'font-mono font-bold',
              item.whaleNetValue > 0
                ? 'text-green-600'
                : item.whaleNetValue < 0
                  ? 'text-red-600'
                  : 'text-muted-foreground'
            )}
          >
            {formatNumber(item.whaleNetValue)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span
            className={cn(
              'font-mono font-bold',
              item.shrimpNetValue > 0
                ? 'text-green-600'
                : item.shrimpNetValue < 0
                  ? 'text-red-600'
                  : 'text-muted-foreground'
            )}
          >
            {formatNumber(item.shrimpNetValue)}
          </span>
          <span role="img" aria-label="shrimp">
            🦐
          </span>
        </div>
      </div>

      {/* Pressure Bar (Visual Guide) */}
      <div className="bg-secondary mt-1 h-1 w-full overflow-hidden rounded-full">
        <div
          className={cn(
            'h-full transition-all duration-500',
            isBuy ? 'bg-green-500' : 'bg-red-500'
          )}
          style={{ width: `${Math.abs(item.pressureScore)}%` }}
        />
      </div>
    </div>
  );
}

export function ConsolidatedStockList({
  data,
  className,
}: ConsolidatedStockListProps) {
  // Sort logic:
  // 1. Items with Strong Signals first (Accum/Dist/Haka/Panic) - ordered by Signal Score magnitude
  // 2. Then items by absolute pressure score
  const sortedList = useMemo(() => {
    return [...data.allSymbols].sort((a, b) => {
      const scoreA = Math.abs(a.signalScore) * 100 + Math.abs(a.pressureScore);
      const scoreB = Math.abs(b.signalScore) * 100 + Math.abs(b.pressureScore);
      return scoreB - scoreA;
    });
  }, [data.allSymbols]);

  return (
    <Card
      className={cn(
        'border-border flex h-full flex-col overflow-hidden shadow-lg',
        className
      )}
    >
      <CardHeader className="border-border bg-card/50 shrink-0 border-b px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Radar className="text-primary h-4 w-4" />
            Market Radar
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Buy Now count */}
            {sortedList.filter(
              (s) => s.signal === 'markup' && s.bestEntryPrice > 0
            ).length > 0 && (
              <Badge className="border-blue-500/30 bg-blue-500/15 text-[10px] text-blue-500">
                🚀 Buy Now{' '}
                {
                  sortedList.filter(
                    (s) => s.signal === 'markup' && s.bestEntryPrice > 0
                  ).length
                }
              </Badge>
            )}
            {/* Buy Dip count */}
            {sortedList.filter(
              (s) => s.signal === 'accumulation' && s.bestEntryPrice > 0
            ).length > 0 && (
              <Badge className="border-emerald-500/30 bg-emerald-500/15 text-[10px] text-emerald-500">
                💰 Buy Dip{' '}
                {
                  sortedList.filter(
                    (s) => s.signal === 'accumulation' && s.bestEntryPrice > 0
                  ).length
                }
              </Badge>
            )}
            {/* Distribution count */}
            {sortedList.filter((s) => s.signal === 'distribution').length >
              0 && (
              <Badge className="border-red-500/30 bg-red-500/15 text-[10px] text-red-500">
                � Dist{' '}
                {sortedList.filter((s) => s.signal === 'distribution').length}
              </Badge>
            )}
            {/* Panic count */}
            {sortedList.filter((s) => s.signal === 'markdown').length > 0 && (
              <Badge className="border-orange-500/30 bg-orange-500/15 text-[10px] text-orange-500">
                🚨 Panic{' '}
                {sortedList.filter((s) => s.signal === 'markdown').length}
              </Badge>
            )}
            {/* Total */}
            <Badge variant="secondary" className="text-[10px]">
              {sortedList.length} Total
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="bg-card flex-1 overflow-hidden p-0">
        {sortedList.length === 0 ? (
          <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm italic">
            Waiting for market data...
          </div>
        ) : (
          <ScrollArea className="h-full w-full">
            <div className="flex flex-col gap-2 p-3">
              {sortedList.map((item) => (
                <StockRow key={item.symbol} item={item} />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
