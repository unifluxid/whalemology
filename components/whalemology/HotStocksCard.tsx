'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SymbolOrderFlow, OrderFlowResult } from '@/hooks/use-order-flow';

interface HotStocksCardProps {
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
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

function formatLot(lot: number): string {
  if (lot >= 1_000_000) {
    return `${(lot / 1_000_000).toFixed(2)}M`;
  }
  if (lot >= 1_000) {
    return `${(lot / 1_000).toFixed(1)}K`;
  }
  return lot.toLocaleString();
}

function SymbolFlowItem({
  item,
  type,
}: {
  item: SymbolOrderFlow;
  type: 'buy' | 'sell';
}) {
  const isBuy = type === 'buy';
  const bgColor = isBuy
    ? 'bg-green-500/10 border-green-500/30 hover:bg-green-500/20'
    : 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20';
  const textColor = isBuy ? 'text-green-500' : 'text-red-500';

  return (
    <div
      className={cn(
        'cursor-pointer rounded-lg border p-3 transition-colors',
        bgColor
      )}
    >
      {/* Header: Symbol & Pressure */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold">{item.symbol}</span>
          {isBuy ? (
            <TrendingUp className={cn('h-4 w-4', textColor)} />
          ) : (
            <TrendingDown className={cn('h-4 w-4', textColor)} />
          )}
        </div>
        {item.signal !== 'neutral' ? (
          <Badge
            variant="outline"
            className={cn(
              'font-mono text-[10px] uppercase',
              item.signal === 'accumulation'
                ? 'border-green-500 bg-green-500/10 text-green-600'
                : item.signal === 'distribution'
                  ? 'border-red-500 bg-red-500/10 text-red-600'
                  : item.signal === 'markup'
                    ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                    : 'border-orange-500 bg-orange-500/10 text-orange-500'
            )}
          >
            {item.signal === 'accumulation'
              ? 'ACCUM'
              : item.signal === 'distribution'
                ? 'DIST'
                : item.signal === 'markup'
                  ? 'HAKA'
                  : 'PANIC'}
          </Badge>
        ) : (
          <Badge variant="outline" className={cn('font-mono', textColor)}>
            {item.pressureScore > 0 ? '+' : ''}
            {item.pressureScore}%
          </Badge>
        )}
      </div>

      {/* Whale vs Shrimp Analysis (Per Symbol) */}
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
        {/* Whale */}
        <div className="bg-background/60 flex items-center gap-1.5 rounded-md p-1.5 shadow-sm">
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
            {item.whaleNetValue > 0 ? '+' : ''}
            {formatNumber(item.whaleNetValue)}
          </span>
        </div>
        {/* Shrimp */}
        <div className="bg-background/60 flex items-center justify-end gap-1.5 rounded-md p-1.5 shadow-sm">
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
            {item.shrimpNetValue > 0 ? '+' : ''}
            {formatNumber(item.shrimpNetValue)}
          </span>
          <span role="img" aria-label="shrimp">
            🦐
          </span>
        </div>
      </div>

      {/* Buy/Sell Bar */}
      <div className="mb-2">
        <div className="bg-background/30 flex h-1.5 overflow-hidden rounded-full">
          <div
            className="bg-green-500 transition-all duration-300"
            style={{ width: `${item.buyPercentage}%` }}
          />
          <div
            className="bg-red-500 transition-all duration-300"
            style={{ width: `${item.sellPercentage}%` }}
          />
        </div>
      </div>

      {/* Basic Stats */}
      <div className="text-muted-foreground flex justify-between text-[10px]">
        <span>Vol: {formatLot(item.totalVolume)}</span>
        <span>Val: {formatNumber(item.totalValue)}</span>
      </div>
    </div>
  );
}

export function HotStocksCard({ data, className }: HotStocksCardProps) {
  return (
    <div className={cn('grid h-full grid-cols-2 gap-4', className)}>
      {/* Hot Buying Column */}
      <Card className="border-border bg-card text-card-foreground flex flex-col overflow-hidden shadow-lg">
        <CardHeader className="border-border shrink-0 border-b bg-green-500/10 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between">
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <Flame className="h-4 w-4 text-green-500" />
              Hot Buying
            </CardTitle>
            <Badge
              variant="outline"
              className="border-green-500 text-xs text-green-500"
            >
              {data.hotBuying.length}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          {data.hotBuying.length === 0 ? (
            <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm italic">
              No strong buying detected
            </div>
          ) : (
            <ScrollArea className="h-full w-full">
              <div className="flex flex-col gap-2 p-2">
                {data.hotBuying.map((item) => (
                  <SymbolFlowItem key={item.symbol} item={item} type="buy" />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Hot Selling Column */}
      <Card className="border-border bg-card text-card-foreground flex flex-col overflow-hidden shadow-lg">
        <CardHeader className="border-border shrink-0 border-b bg-red-500/10 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between">
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <Flame className="h-4 w-4 text-red-500" />
              Hot Selling
            </CardTitle>
            <Badge
              variant="outline"
              className="border-red-500 text-xs text-red-500"
            >
              {data.hotSelling.length}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          {data.hotSelling.length === 0 ? (
            <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm italic">
              No strong selling detected
            </div>
          ) : (
            <ScrollArea className="h-full w-full">
              <div className="flex flex-col gap-2 p-2">
                {data.hotSelling.map((item) => (
                  <SymbolFlowItem key={item.symbol} item={item} type="sell" />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
