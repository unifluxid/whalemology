import { NextRequest } from 'next/server';
import { fetchStockbitProxy } from '@/lib/stockbit-proxy';

export async function GET(request: NextRequest) {
  // Endpoint: order-trade/market-mover
  return fetchStockbitProxy('order-trade/market-mover', request);
}
