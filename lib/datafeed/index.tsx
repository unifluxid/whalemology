'use client';

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import {
  encodeAuthRequest,
  encodePingRequest,
  encodeChannelRequest,
} from './protobuf-encoder';
import { decodeWebSocketMessage } from './protobuf-decoder';

// Types for WebSocket messages
export interface WSRunningTradeItem {
  stock: string;
  price: number;
  volume: number;
  action: 'BUY' | 'SELL';
  marketBoard: string;
  tradeNumber: string;
  time?: { seconds: number; nanos: number };
  change?: { value: number; percentage: number };
}

export interface DatafeedMessageChannel {
  runningTradeBatch?: { batch: WSRunningTradeItem[] };
  ping?: { message: string };
  error?: { code: number; message: string };
}

export type DatafeedAction = (message: DatafeedMessageChannel) => void;

type ActionMap = Map<string, DatafeedAction>;
type ChannelActions = Record<keyof DatafeedMessageChannel, ActionMap>;

export interface DatafeedContextValue {
  isAuthorized: boolean;
  isConnected: boolean;
  error: Error | null;
  setAction: (
    channel: keyof DatafeedMessageChannel,
    key: string,
    action: DatafeedAction
  ) => void;
  removeAction: (channel: keyof DatafeedMessageChannel, key: string) => void;
}

export const DatafeedContext = createContext<DatafeedContextValue>({
  isAuthorized: false,
  isConnected: false,
  error: null,
  setAction: () => {},
  removeAction: () => {},
});

const WEBSOCKET_URL =
  process.env.NEXT_PUBLIC_DATAFEED_SOCKET ||
  'wss://wss-trading.stockbit.com/ws';
const RECONNECT_DELAY_BASE = 1000;
const MAX_RECONNECT_DELAY = 30000;
const MAX_RECONNECT_ATTEMPTS = 10;
const HEARTBEAT_DURATION = 10000; // 10 seconds

interface DatafeedProviderProps {
  children: ReactNode;
  token?: string | null;
  userId?: number;
  enabled?: boolean;
  symbols?: string[]; // Symbols to subscribe to - if empty or ['*'], subscribes to all
}

export function DatafeedProvider({
  children,
  token,
  userId = 0,
  enabled = true,
  symbols: symbolsProp = [],
}: DatafeedProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Memoize symbols array to prevent infinite reconnection loops
  // Only changes when the content actually changes
  const symbolsKey = symbolsProp.join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- symbolsKey is derived from symbolsProp
  const symbols = useMemo(() => symbolsProp, [symbolsKey]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const pongTimeout = useRef<NodeJS.Timeout | null>(null);
  const connectRef = useRef<() => void>(() => {});
  const actionsRef = useRef<ChannelActions>({
    runningTradeBatch: new Map(),
    ping: new Map(),
    error: new Map(),
  });

  // Set action handler for a channel
  const setAction = useCallback(
    (
      channel: keyof DatafeedMessageChannel,
      key: string,
      action: DatafeedAction
    ) => {
      if (!actionsRef.current[channel]) {
        actionsRef.current[channel] = new Map();
      }
      actionsRef.current[channel].set(key, action);
    },
    []
  );

  // Remove action handler
  const removeAction = useCallback(
    (channel: keyof DatafeedMessageChannel, key: string) => {
      actionsRef.current[channel]?.delete(key);
    },
    []
  );

  // Dispatch message to all registered handlers
  const dispatchMessage = useCallback((message: DatafeedMessageChannel) => {
    Object.entries(message).forEach(([channel, data]) => {
      if (data && actionsRef.current[channel as keyof DatafeedMessageChannel]) {
        actionsRef.current[channel as keyof DatafeedMessageChannel].forEach(
          (action) => {
            try {
              action(message);
            } catch (e) {
              console.error(`Error in datafeed action for ${channel}:`, e);
            }
          }
        );
      }
    });
  }, []);

  // Get WebSocket trading key from API
  const getWebSocketKey = useCallback(async (): Promise<string | null> => {
    if (!token) return null;

    try {
      const response = await fetch('/api/stockbit/ws/trading-key', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error('[Datafeed] Failed to get WS key:', response.status);
        return null;
      }

      const data = await response.json();
      // Response: { message: "Success get websocket key", data: { key: "xxx" } }
      return data.data?.key || null;
    } catch (e) {
      console.error('[Datafeed] Error getting WS key:', e);
      return null;
    }
  }, [token]);

  // Send ping heartbeat
  const sendPing = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const buffer = encodePingRequest();
    wsRef.current.send(buffer);
    console.log('[Datafeed] Sent ping');

    // Set pong timeout
    pongTimeout.current = setTimeout(() => {
      console.warn('[Datafeed] Pong timeout, reconnecting...');
      wsRef.current?.close();
    }, HEARTBEAT_DURATION / 3);
  }, []);

  // Handle heartbeat response
  const handlePong = useCallback(() => {
    clearTimeout(pongTimeout.current!);
    console.log('[Datafeed] Received pong');
  }, []);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    if (!enabled || !token) return;

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      // Step 1: Get WS key from API
      console.log('[Datafeed] Getting WebSocket key...');
      const wsKey = await getWebSocketKey();

      if (!wsKey) {
        console.error('[Datafeed] Failed to get WS key, cannot connect');
        setError(new Error('Failed to get WebSocket key'));
        return;
      }
      console.log('[Datafeed] Got WebSocket key');

      // Step 2: Connect to WebSocket
      console.log('[Datafeed] Connecting to WebSocket:', WEBSOCKET_URL);
      const ws = new WebSocket(WEBSOCKET_URL);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        console.log('[Datafeed] WebSocket connected');
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;

        // Step 3: Send auth message with WS key (not token)
        const authBuffer = encodeAuthRequest(wsKey, userId);
        ws.send(authBuffer);
        console.log('[Datafeed] Sent auth request with WS key');

        // Assume authorized after sending
        setIsAuthorized(true);

        // Step 4: Start heartbeat
        setAction('ping', 'heartbeat', handlePong);
        heartbeatInterval.current = setInterval(() => {
          sendPing();
        }, HEARTBEAT_DURATION);

        // Step 5: Subscribe to running trade channel
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            // Based on captured Stockbit hex: 12 03 2a 01 2a
            // They send '*' only in field 5 (liveprice), NOT in field 6 (runningTradeBatch)
            // When subscribing to all symbols, just send '*' in field 5
            const useAllSymbols = symbols.length === 0;
            const channelBuffer = encodeChannelRequest(wsKey, userId, {
              liveprice: useAllSymbols ? ['*'] : symbols, // Field 5
              runningTradeBatch: useAllSymbols ? [] : symbols, // Field 6 - empty when using * in field 5
            });
            ws.send(channelBuffer);
            console.log(
              '[Datafeed] Subscribed to:',
              useAllSymbols ? 'ALL (*)' : symbols.join(', ')
            );
          }
        }, 500);
      };

      ws.onmessage = (event) => {
        try {
          // Handle binary data (protobuf)
          if (event.data instanceof ArrayBuffer) {
            const decoded = decodeWebSocketMessage(event.data);

            if (decoded) {
              // Check for ping/pong response
              // Format: { "2": [{ "1": ["pong"] }] }
              const rawFields = decoded.rawFields as Record<number, unknown[]>;
              if (rawFields && rawFields[2]) {
                const field2 = rawFields[2];
                if (Array.isArray(field2)) {
                  for (const item of field2) {
                    if (typeof item === 'object' && item !== null) {
                      const nested = item as Record<number, unknown[]>;
                      if (
                        nested[1] &&
                        Array.isArray(nested[1]) &&
                        nested[1].includes('pong')
                      ) {
                        handlePong();
                        return;
                      }
                    }
                  }
                }
              }

              // Check for running trade batch
              if (
                decoded.runningTradeBatch &&
                decoded.runningTradeBatch.batch.length > 0
              ) {
                const mappedTrades = decoded.runningTradeBatch.batch.map(
                  (trade) => ({
                    stock: trade.stock || '',
                    price: trade.price || 0,
                    volume: trade.volume || 0,
                    action: (trade.action || 'BUY') as 'BUY' | 'SELL', // Default to BUY if not set
                    marketBoard: trade.marketBoard || 'RG',
                    tradeNumber: trade.tradeNumber || '',
                    time: trade.time,
                    change: trade.change,
                  })
                );

                console.log(
                  '[Datafeed] Dispatching trades:',
                  mappedTrades.length,
                  'trades'
                );
                dispatchMessage({
                  runningTradeBatch: {
                    batch: mappedTrades,
                  },
                });
              }
            }
            return;
          }

          // Handle string data (JSON fallback)
          if (typeof event.data === 'string') {
            const data = JSON.parse(event.data);
            console.log('[Datafeed] Received JSON:', data);
            dispatchMessage(data);
          }
        } catch (e) {
          console.error('[Datafeed] Failed to parse message:', e);
        }
      };

      ws.onerror = (event) => {
        console.error('[Datafeed] WebSocket error:', event);
        setError(new Error('WebSocket connection error'));
      };

      ws.onclose = (event) => {
        console.log('[Datafeed] WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        setIsAuthorized(false);

        // Clear heartbeat
        clearInterval(heartbeatInterval.current!);
        clearTimeout(pongTimeout.current!);

        // Attempt reconnection with exponential backoff
        if (enabled && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(
            RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttempts.current),
            MAX_RECONNECT_DELAY
          );
          reconnectAttempts.current++;

          console.log(
            `[Datafeed] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`
          );

          reconnectTimeout.current = setTimeout(() => {
            connectRef.current();
          }, delay);
        }
      };

      wsRef.current = ws;
    } catch (e) {
      console.error('[Datafeed] Failed to create WebSocket:', e);
      setError(e instanceof Error ? e : new Error('Failed to connect'));
    }
  }, [
    enabled,
    token,
    userId,
    symbols,
    getWebSocketKey,
    dispatchMessage,
    handlePong,
    sendPing,
    setAction,
  ]);

  // Keep connectRef in sync with connect
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Connect on mount or when token changes
  useEffect(() => {
    // Intentional: connect establishes WebSocket connection on mount/token change
    void connect();

    return () => {
      clearTimeout(reconnectTimeout.current!);
      clearInterval(heartbeatInterval.current!);
      clearTimeout(pongTimeout.current!);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const value: DatafeedContextValue = {
    isAuthorized,
    isConnected,
    error,
    setAction,
    removeAction,
  };

  return (
    <DatafeedContext.Provider value={value}>
      {children}
    </DatafeedContext.Provider>
  );
}
