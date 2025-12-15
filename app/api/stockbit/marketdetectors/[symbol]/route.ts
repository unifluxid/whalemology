import { NextRequest } from 'next/server';
import { fetchStockbitProxy } from '@/lib/stockbit-proxy';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ symbol: string }> }
) {
  const params = await props.params;

  // Default params from market-detector.txt
  const defaults = {
    transaction_type: 'TRANSACTION_TYPE_NET',
    market_board: 'MARKET_BOARD_REGULER',
    investor_type: 'INVESTOR_TYPE_ALL',
    limit: '25',
  };

  // Endpoint: marketdetectors/{symbol}
  return fetchStockbitProxy(
    `marketdetectors/${params.symbol}`,
    request,
    defaults
  );
}
