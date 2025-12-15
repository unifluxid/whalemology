import { NextRequest } from 'next/server';
import { fetchStockbitProxy } from '@/lib/stockbit-proxy';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ symbol: string }> }
) {
  const params = await props.params;
  // Endpoint: emitten/{symbol}/info
  return fetchStockbitProxy(`emitten/${params.symbol}/info`, request);
}
