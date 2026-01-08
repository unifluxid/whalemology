import { NextRequest } from 'next/server';
import { fetchStockbitProxy } from '@/lib/stockbit-proxy';

/**
 * API endpoint to get WebSocket trading key from Stockbit.
 * This is required to authenticate WebSocket connections.
 *
 * Stockbit's auth flow:
 * 1. Call this API to get a WS key
 * 2. Send the key via WebSocket as a protobuf WebsocketRequest message
 * 3. Server responds with auth confirmation
 *
 * Response format: { message: "Success get websocket key", data: { key: "xxx" } }
 */
export async function GET(request: NextRequest) {
  // The actual Stockbit endpoint for WS key
  return fetchStockbitProxy('auth/websocket/key', request, {});
}
