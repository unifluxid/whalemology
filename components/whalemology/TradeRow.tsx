import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AnalyzedTrade } from '@/lib/trade-analysis';

interface TradeRowProps {
  trade: AnalyzedTrade;
  index: number;
}

export const TradeRow = memo(function TradeRow({ trade }: TradeRowProps) {
  const { isWhale, isSplitOrder, pattern } = trade.analysis;
  const isBuy = trade.action === 'buy';
  const price = parseInt(trade.price.replace(/,/g, ''));
  const lot = parseInt(trade.lot.replace(/,/g, ''));
  const totalValue = price * lot * 100; // 1 lot = 100 shares
  const isNG = trade.market_board === 'NG';

  let rowClass = 'hover:bg-muted/50';
  if (isWhale)
    rowClass = isBuy
      ? 'bg-green-500/10 border-green-500/30'
      : 'bg-red-500/10 border-red-500/30';
  else if (isSplitOrder) rowClass = 'bg-blue-500/5 border-blue-500/20';

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <div
          className={`grid grid-cols-12 items-center gap-2 rounded border border-transparent px-1 py-2 text-xs transition-colors ${rowClass} cursor-help`}
        >
          <div className="text-muted-foreground col-span-2 flex flex-col font-mono">
            <span>{trade.time}</span>
            {isSplitOrder && (
              <span className="text-[9px] text-blue-400">SPLIT</span>
            )}
          </div>

          <div className="col-span-1 text-center font-bold">{trade.code}</div>
          <div className="col-span-3 flex flex-col text-center font-mono">
            <span className={isBuy ? 'text-green-400' : 'text-red-400'}>
              {price.toLocaleString()}
            </span>
            <span className="text-muted-foreground text-[10px]">
              {trade.change}
            </span>
          </div>
          <div
            className={`col-span-1 text-center font-mono text-[10px] ${isBuy ? 'text-green-500' : 'text-red-500'}`}
          >
            {isBuy ? 'Buy' : 'Sell'}
          </div>
          <div
            className={`col-span-2 text-center font-mono ${isNG ? 'text-yellow-500' : ''} ${isWhale ? 'font-bold' : 'text-muted-foreground'} ${!isNG && isWhale ? (isBuy ? 'text-green-500' : 'text-red-500') : ''}`}
          >
            {lot.toLocaleString()}
          </div>
          <div
            className={`col-span-1 text-center font-mono text-[10px] ${isBuy ? 'text-green-500' : 'text-muted-foreground'}`}
          >
            {trade.buyer}
          </div>
          <div
            className={`col-span-1 text-center font-mono text-[10px] ${!isBuy ? 'text-red-500' : 'text-muted-foreground'}`}
          >
            {trade.seller}
          </div>
          <div
            className={`col-span-1 text-center text-[10px] ${isNG ? 'text-yellow-500' : 'text-muted-foreground'}`}
          >
            {trade.market_board}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="left"
        className="border-border bg-muted max-w-xs p-3"
      >
        <div className="space-y-2">
          <div className="border-border border-b pb-2">
            <div className="text-foreground font-bold">{trade.code}</div>
            <div className="text-muted-foreground text-[10px]">
              Trade #{trade.trade_number}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-muted-foreground">Total Value</div>
              <div className="text-foreground font-mono font-semibold">
                {totalValue >= 1_000_000_000
                  ? `Rp ${(totalValue / 1_000_000_000).toFixed(2)}B`
                  : totalValue >= 1_000_000
                    ? `Rp ${(totalValue / 1_000_000).toFixed(1)}M`
                    : totalValue >= 1_000
                      ? `Rp ${(totalValue / 1_000).toFixed(1)}K`
                      : `Rp ${totalValue.toLocaleString()}`}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Pattern</div>
              <div
                className={`font-semibold ${
                  pattern === 'ACCUMULATION'
                    ? 'text-green-500'
                    : pattern === 'DISTRIBUTION'
                      ? 'text-red-500'
                      : 'text-muted-foreground'
                }`}
              >
                {pattern}
              </div>
            </div>
          </div>
          <div className="border-border space-y-1 border-t pt-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Buyer:</span>
              <span className="text-foreground font-mono">{trade.buyer}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Seller:</span>
              <span className="text-foreground font-mono">{trade.seller}</span>
            </div>
          </div>
          {(isWhale || isSplitOrder) && (
            <div className="border-border space-y-1 space-x-2 border-t pt-2">
              {isWhale && (
                <Badge
                  variant="outline"
                  className="border-amber-500 bg-amber-500/10 text-[10px] text-amber-400"
                >
                  🐋 WHALE TRADE
                </Badge>
              )}
              {isSplitOrder && (
                <Badge
                  variant="outline"
                  className="border-blue-500 bg-blue-500/10 text-[10px] text-blue-400"
                >
                  🧩 SPLIT ORDER
                </Badge>
              )}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
});
