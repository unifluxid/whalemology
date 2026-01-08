import { TradeItem } from '@/lib/stockbit-types';
import { WSRunningTradeItem } from '@/lib/datafeed';

/**
 * Normalizes a raw WebSocket trade item into the standard TradeItem format
 * used throughout the application.
 */
export function normalizeTrade(item: WSRunningTradeItem): TradeItem {
  // Calculate value if not present, assuming lot size 100
  const lotNum = item.volume / 100;
  const priceNum = item.price;
  const value = item.price * item.volume;

  // Format time
  let timeStr = '';
  if (item.time) {
    const date = new Date(Number(item.time.seconds) * 1000);
    timeStr = date.toLocaleTimeString('en-US', { hour12: false });
  }

  // Format change percentage
  const changeStr = item.change
    ? `${item.change.percentage >= 0 ? '+' : ''}${item.change.percentage.toFixed(2)}%`
    : '0%';

  return {
    id: item.tradeNumber || `ws-${Date.now()}-${Math.random()}`,
    time: timeStr,
    action: (item.action?.toLowerCase() as 'buy' | 'sell') || 'buy',
    code: item.stock || '',
    price: String(item.price),
    change: changeStr,
    lot: String(lotNum),
    is_broker_exists: false,
    buyer: '',
    seller: '',
    trade_number: item.tradeNumber || '',
    buyer_type: '',
    seller_type: '',
    market_board: item.marketBoard || 'RG',
    // Enriched fields
    priceNum: priceNum,
    lotNum: lotNum,
    value: value,
    changeNum: item.change?.percentage ?? 0,
    seconds: item.time?.seconds,
  };
}
