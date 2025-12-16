import { NextRequest } from 'next/server';
import { fetchStockbitProxy } from '@/lib/stockbit-proxy';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ watchlist_id: string }> }
) {
  const { watchlist_id } = await params;
  // Endpoint: watchlist/{watchlist_id}?page=1&limit=50
  const endpoint = `watchlist/${watchlist_id}`;

  // Default params
  const defaults = {
    page: '1',
    limit: '50',
  };

  return fetchStockbitProxy(endpoint, request, defaults);
}
