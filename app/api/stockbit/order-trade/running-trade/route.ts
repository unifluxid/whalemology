import { NextRequest } from 'next/server';
import { fetchStockbitProxy } from '@/lib/stockbit-proxy';

export async function GET(request: NextRequest) {
  // Default params from running-trade.txt
  const defaults = {
    limit: '80',
    sort: 'desc',
    order_by: 'RUNNING_TRADE_ORDER_BY_TIME',
    action_type: 'RUNNING_TRADE_ACTION_TYPE_ALL',
    market_board: 'BOARD_TYPE_ALL',
  };

  // Endpoint: order-trade/running-trade
  return fetchStockbitProxy('order-trade/running-trade', request, defaults);
}
