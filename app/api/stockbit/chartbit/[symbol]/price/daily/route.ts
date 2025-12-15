import { NextRequest } from 'next/server';
import { fetchStockbitProxy } from '@/lib/stockbit-proxy';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ symbol: string }> }
) {
  const params = await props.params;

  // Default params from chartbit-price.txt
  const defaults = {
    limit: '50',
  };

  // Endpoint: chartbit/{symbol}/price/daily
  return fetchStockbitProxy(
    `chartbit/${params.symbol}/price/daily`,
    request,
    defaults
  );
}
