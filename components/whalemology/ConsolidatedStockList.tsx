'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { OrderFlowResult, SymbolOrderFlow } from '@/hooks/use-order-flow';
import { Radar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo, useState } from 'react';

type SignalFilter =
  | 'all'
  | 'markup'
  | 'accumulation'
  | 'distribution'
  | 'markdown';

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
      {/* Top Line: Symbol, Last Price (+percentage), Entry Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">{item.symbol}</span>
          <span
            className={cn(
              'font-mono text-xs font-medium',
              item.priceChange > 0
                ? 'text-green-500'
                : item.priceChange < 0
                  ? 'text-red-500'
                  : 'text-muted-foreground'
            )}
          >
            {item.lastPrice.toLocaleString()} ({item.priceChange > 0 ? '+' : ''}
            {item.priceChange.toFixed(2)}%)
          </span>
        </div>

        {/* Entry Badge - Right aligned */}
        <div className="flex items-center gap-1">
          {item.bestEntryPrice > 0 && item.signal === 'markup' && (
            <Badge
              variant="secondary"
              className="h-5 border-blue-500/30 bg-blue-500/15 px-1.5 text-[10px] font-semibold text-blue-500"
            >
              🚀 BUY @ {item.bestEntryPrice.toLocaleString()}
            </Badge>
          )}
          {item.bestEntryPrice > 0 && item.signal === 'accumulation' && (
            <Badge
              variant="secondary"
              className="h-5 border-emerald-500/30 bg-emerald-500/15 px-1.5 text-[10px] font-semibold text-emerald-500"
            >
              💰 DIP @ {item.bestEntryPrice.toLocaleString()}
            </Badge>
          )}
          {badgeLabel && (
            <Badge
              variant="outline"
              className={cn('h-5 px-1.5 text-[10px] uppercase', badgeColor)}
            >
              {badgeLabel}
            </Badge>
          )}
        </div>
      </div>

      {/* Bottom Line: Tiered Whale Breakdown */}
      <div className="mt-1 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {/* Mega Whale */}
          {item.megaWhaleNetValue !== 0 && (
            <div className="flex items-center gap-0.5">
              <span className="text-[10px]">🐋🐋</span>
              <span
                className={cn(
                  'font-mono text-[10px] font-bold',
                  item.megaWhaleNetValue > 0 ? 'text-green-600' : 'text-red-600'
                )}
              >
                {formatNumber(item.megaWhaleNetValue)}
              </span>
            </div>
          )}
          {/* Whale */}
          {item.whaleNetValue !== 0 && (
            <div className="flex items-center gap-0.5">
              <span className="text-[10px]">🐋</span>
              <span
                className={cn(
                  'font-mono text-[10px] font-bold',
                  item.whaleNetValue > 0 ? 'text-green-600' : 'text-red-600'
                )}
              >
                {formatNumber(item.whaleNetValue)}
              </span>
            </div>
          )}
          {/* Dolphin */}
          {item.dolphinNetValue !== 0 && (
            <div className="flex items-center gap-0.5">
              <span className="text-[10px]">🐬</span>
              <span
                className={cn(
                  'font-mono text-[10px] font-bold',
                  item.dolphinNetValue > 0 ? 'text-green-600' : 'text-red-600'
                )}
              >
                {formatNumber(item.dolphinNetValue)}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Retail */}
          {item.retailNetValue !== 0 && (
            <div className="flex items-center gap-0.5">
              <span
                className={cn(
                  'font-mono text-[10px] font-bold',
                  item.retailNetValue > 0 ? 'text-green-600' : 'text-red-600'
                )}
              >
                {formatNumber(item.retailNetValue)}
              </span>
              <span className="text-[10px]">🦐</span>
            </div>
          )}
          {/* Same-broker warning */}
          {item.sameBrokerCount > 0 && (
            <span
              className="text-[10px] text-yellow-500"
              title={`${item.sameBrokerCount} trades from same broker (${formatNumber(item.sameBrokerValue)})`}
            >
              ⚠️
            </span>
          )}
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

// Tab configuration
const TAB_CONFIG: {
  value: SignalFilter;
  label: string;
  emoji: string;
  color: string;
  activeColor: string;
}[] = [
  {
    value: 'all',
    label: 'All',
    emoji: '',
    color: 'text-muted-foreground',
    activeColor: 'bg-primary text-primary-foreground',
  },
  {
    value: 'markup',
    label: 'Buy Now',
    emoji: '🚀',
    color: 'text-blue-500',
    activeColor: 'bg-blue-500 text-white',
  },
  {
    value: 'accumulation',
    label: 'Buy Dip',
    emoji: '💰',
    color: 'text-emerald-500',
    activeColor: 'bg-emerald-500 text-white',
  },
  {
    value: 'distribution',
    label: 'Dist',
    emoji: '💦',
    color: 'text-red-500',
    activeColor: 'bg-red-500 text-white',
  },
  {
    value: 'markdown',
    label: 'Panic',
    emoji: '🚨',
    color: 'text-orange-500',
    activeColor: 'bg-orange-500 text-white',
  },
];

export function ConsolidatedStockList({
  data,
  className,
}: ConsolidatedStockListProps) {
  const [activeFilter, setActiveFilter] = useState<SignalFilter>('all');

  // Sorted and filtered list
  const filteredList = useMemo(() => {
    let list = [...data.allSymbols];

    // Apply filter
    if (activeFilter !== 'all') {
      if (activeFilter === 'markup') {
        // Buy Now = markup with bestEntryPrice
        list = list.filter(
          (s) => s.signal === 'markup' && s.bestEntryPrice > 0
        );
      } else if (activeFilter === 'accumulation') {
        // Buy Dip = accumulation with bestEntryPrice
        list = list.filter(
          (s) => s.signal === 'accumulation' && s.bestEntryPrice > 0
        );
      } else {
        list = list.filter((s) => s.signal === activeFilter);
      }
    }

    // Sort: Strong signals first, then by pressure
    return list.sort((a, b) => {
      const scoreA = Math.abs(a.signalScore) * 100 + Math.abs(a.pressureScore);
      const scoreB = Math.abs(b.signalScore) * 100 + Math.abs(b.pressureScore);
      return scoreB - scoreA;
    });
  }, [data.allSymbols, activeFilter]);

  // Counts for each tab
  const counts = useMemo(
    () => ({
      all: data.allSymbols.length,
      markup: data.allSymbols.filter(
        (s) => s.signal === 'markup' && s.bestEntryPrice > 0
      ).length,
      accumulation: data.allSymbols.filter(
        (s) => s.signal === 'accumulation' && s.bestEntryPrice > 0
      ).length,
      distribution: data.allSymbols.filter((s) => s.signal === 'distribution')
        .length,
      markdown: data.allSymbols.filter((s) => s.signal === 'markdown').length,
    }),
    [data.allSymbols]
  );

  return (
    <Card
      className={cn(
        'border-border flex h-full flex-col overflow-hidden shadow-lg',
        className
      )}
    >
      <CardHeader className="border-border bg-card/50 shrink-0 border-b px-4 py-3 backdrop-blur">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Radar className="text-primary h-4 w-4" />
              Market Radar
            </CardTitle>
            <Badge variant="secondary" className="text-[10px]">
              {filteredList.length} / {data.allSymbols.length}
            </Badge>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-1">
            {TAB_CONFIG.map((tab) => {
              const count = counts[tab.value];
              const isActive = activeFilter === tab.value;

              // Hide tabs with 0 count (except All)
              if (count === 0 && tab.value !== 'all') return null;

              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveFilter(tab.value)}
                  className={cn(
                    'flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all',
                    isActive
                      ? tab.activeColor
                      : `bg-secondary/50 hover:bg-secondary ${tab.color}`
                  )}
                >
                  {tab.emoji && <span>{tab.emoji}</span>}
                  {tab.label}
                  <span
                    className={cn(
                      'ml-0.5 rounded px-1',
                      isActive ? 'bg-white/20' : 'bg-black/10'
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </CardHeader>

      <CardContent className="bg-card flex-1 overflow-hidden p-0">
        {filteredList.length === 0 ? (
          <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm italic">
            {activeFilter === 'all'
              ? 'Waiting for market data...'
              : `No ${TAB_CONFIG.find((t) => t.value === activeFilter)?.label} signals`}
          </div>
        ) : (
          <ScrollArea className="h-full w-full">
            <div className="flex flex-col gap-2 p-3">
              {filteredList.map((item) => (
                <StockRow key={item.symbol} item={item} />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
