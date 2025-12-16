import { NextRequest } from 'next/server';
import { fetchStockbitProxy } from '@/lib/stockbit-proxy';

export async function GET(request: NextRequest) {
  // Endpoint: search
  // Query params: keyword, page, type
  return fetchStockbitProxy('search', request);
}
