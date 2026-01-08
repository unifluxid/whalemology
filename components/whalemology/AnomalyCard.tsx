'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { OrderFlowResult, SymbolOrderFlow } from '@/hooks/use-order-flow';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WhaleComparisonCardProps {
  data: OrderFlowResult;
  className?: string;
}

function formatValue(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(0)}M`;
  }
  return `${(value / 1_000).toFixed(0)}K`;
}

function StockItem({
  item,
  netValue,
}: {
  item: SymbolOrderFlow;
  netValue: number;
}) {
  const isBuy = netValue > 0;
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <div className="flex items-center gap-2">
        <span className="font-bold">{item.symbol}</span>
        {isBuy ? (
          <TrendingUp className="h-3 w-3 text-green-500" />
        ) : (
          <TrendingDown className="h-3 w-3 text-red-500" />
        )}
      </div>
      <span
        className={cn(
          'font-mono font-medium',
          isBuy ? 'text-green-500' : 'text-red-500'
        )}
      >
        {formatValue(Math.abs(netValue))}
      </span>
    </div>
  );
}

export function WhaleComparisonCard({
  data,
  className,
}: WhaleComparisonCardProps) {
  const { whaleStats, shrimpStats } = data;

  const whaleNet = whaleStats.buyValue - whaleStats.sellValue;
  const shrimpNet = shrimpStats.buyValue - shrimpStats.sellValue;

  return (
    <div className={cn('grid h-full grid-cols-2 gap-4', className)}>
      {/* 🐋 WHALES COLUMN */}
      <Card className="border-border bg-card text-card-foreground flex flex-col overflow-hidden shadow-lg">
        <CardHeader className="border-border shrink-0 border-b bg-blue-500/10 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between">
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <span role="img" aria-label="whale">
                🐋
              </span>
              Whales (≥200M)
            </CardTitle>
            <Badge
              variant="outline"
              className={cn(
                'font-mono',
                whaleNet > 0
                  ? 'border-green-500 text-green-500'
                  : 'border-red-500 text-red-500'
              )}
            >
              {whaleNet > 0 ? '+' : ''}
              {formatValue(whaleNet)}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full w-full p-2">
            {/* Top Buy */}
            {data.topWhaleAccum.length > 0 && (
              <div className="mb-4">
                <div className="text-muted-foreground mb-1 text-[10px] uppercase">
                  Accumulating
                </div>
                <div className="space-y-1 rounded-lg border bg-green-500/5 p-2">
                  {data.topWhaleAccum.slice(0, 5).map((item) => (
                    <StockItem
                      key={item.symbol}
                      item={item}
                      netValue={item.whaleNetValue}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Top Sell */}
            {data.topWhaleDump.length > 0 && (
              <div>
                <div className="text-muted-foreground mb-1 text-[10px] uppercase">
                  Dumping
                </div>
                <div className="space-y-1 rounded-lg border bg-red-500/5 p-2">
                  {data.topWhaleDump.slice(0, 5).map((item) => (
                    <StockItem
                      key={item.symbol}
                      item={item}
                      netValue={item.whaleNetValue}
                    />
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 🦐 SHRIMP COLUMN */}
      <Card className="border-border bg-card text-card-foreground flex flex-col overflow-hidden shadow-lg">
        <CardHeader className="border-border shrink-0 border-b bg-orange-500/10 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between">
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <span role="img" aria-label="shrimp">
                🦐
              </span>
              Shrimp (≤20M)
            </CardTitle>
            <Badge
              variant="outline"
              className={cn(
                'font-mono',
                shrimpNet > 0
                  ? 'border-green-500 text-green-500'
                  : 'border-red-500 text-red-500'
              )}
            >
              {shrimpNet > 0 ? '+' : ''}
              {formatValue(shrimpNet)}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full w-full p-2">
            {/* Top Buy */}
            {data.topShrimpAccum.length > 0 && (
              <div className="mb-4">
                <div className="text-muted-foreground mb-1 text-[10px] uppercase">
                  Buying
                </div>
                <div className="space-y-1 rounded-lg border bg-green-500/5 p-2">
                  {data.topShrimpAccum.slice(0, 5).map((item) => (
                    <StockItem
                      key={item.symbol}
                      item={item}
                      netValue={item.shrimpNetValue}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Top Sell */}
            {data.topShrimpDump.length > 0 && (
              <div>
                <div className="text-muted-foreground mb-1 text-[10px] uppercase">
                  Panic Selling
                </div>
                <div className="space-y-1 rounded-lg border bg-red-500/5 p-2">
                  {data.topShrimpDump.slice(0, 5).map((item) => (
                    <StockItem
                      key={item.symbol}
                      item={item}
                      netValue={item.shrimpNetValue}
                    />
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
