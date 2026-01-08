import { useMemo } from 'react';
import { TradeItem, RunningTrade } from '@/lib/stockbit-types';

export type ScenarioType =
  | 'live'
  | 'bullish_continuation'
  | 'markup_distribution'
  | 'panic_selling'
  | 'fake_down';

export const SCENARIO_OPTIONS: { value: ScenarioType; label: string }[] = [
  { value: 'live', label: '🔴 Live Market' },
  {
    value: 'bullish_continuation',
    label: '🚀 Bullish Continuation (HAKA Bersama)',
  },
  { value: 'markup_distribution', label: '🎣 Markup Distribution (Pancingan)' },
  { value: 'panic_selling', label: '📉 Panic Selling (Bandar Nampung)' },
  { value: 'fake_down', label: '👻 Fake Down (Shake Out)' },
];

function generateTrades(
  symbol: string,
  priceStart: number,
  count: number,
  pattern: 'accum' | 'distrib' | 'panic_retail' | 'retail_fomo' | 'neutral',
  isWhale: boolean
): TradeItem[] {
  const trades: TradeItem[] = [];
  let currentPrice = priceStart;

  // Configuration based on pattern
  let buyProb = 0.5;
  if (pattern === 'accum') buyProb = 0.9;
  if (pattern === 'distrib') buyProb = 0.1;
  if (pattern === 'panic_retail') buyProb = 0.05;
  if (pattern === 'retail_fomo') buyProb = 0.95;

  for (let i = 0; i < count; i++) {
    const isBuy = Math.random() < buyProb;

    // Lot size logic
    let lot = 0;
    if (isWhale) {
      lot = 5000 + Math.floor(Math.random() * 20000); // 5k - 25k lots (Big value)
    } else {
      lot = 1 + Math.floor(Math.random() * 30); // 1 - 30 lots (Ensure < 20M value)
    }

    // Price movement simulation (simplistic)
    if (isBuy) currentPrice += 25;
    else currentPrice -= 25;
    if (currentPrice < 50) currentPrice = 50;

    trades.push({
      // Required fields
      id: `mock-${symbol}-${i}-${isWhale ? 'w' : 's'}`,
      is_broker_exists: false,
      buyer: '',
      seller: '',
      buyer_type: '',
      seller_type: '',
      market_board: 'RG',

      code: symbol,
      trade_number: `mock-${symbol}-${i}-${isWhale ? 'w' : 's'}`,
      price: currentPrice.toString(),
      priceNum: currentPrice,
      change: (currentPrice - priceStart).toString(),
      changeNum: currentPrice - priceStart,
      lot: lot.toString(),
      lotNum: lot,
      value: lot * 100 * currentPrice,
      action: isBuy ? 'buy' : 'sell',
      time: '10:00:00',
    });
  }
  return trades;
}

export function useMockScenarios(scenario: ScenarioType): RunningTrade | null {
  const mockData = useMemo(() => {
    if (scenario === 'live') return null;

    let trades: TradeItem[] = [];

    // SCENARIO 1: Bullish Continuation (HAKA Bersama)
    // BBRI: Whale Buy, Retail Buy (Strong Uptrend)
    if (scenario === 'bullish_continuation') {
      trades = [
        ...generateTrades('BBRI', 5200, 50, 'accum', true), // Whale Accum
        ...generateTrades('BBRI', 5200, 200, 'retail_fomo', false), // Retail Follow
        // Noise stocks
        ...generateTrades('GOTO', 80, 20, 'neutral', true),
      ];
    }

    // SCENARIO 2: Markup Distribution
    // GOTO: Price Up/Stable, but Whale Selling huge, Retail Buying huge
    if (scenario === 'markup_distribution') {
      trades = [
        ...generateTrades('GOTO', 100, 50, 'distrib', true), // Whale Dumping
        ...generateTrades('GOTO', 100, 300, 'retail_fomo', false), // Retail absorbing
        // Decoy stock
        ...generateTrades('TLKM', 3000, 20, 'neutral', true),
      ];
    }

    // SCENARIO 3: Panic Selling (Bottom Fishing)
    // UNVR: Price crash, Retail Panic Sell, Whale Buying silently
    if (scenario === 'panic_selling') {
      trades = [
        ...generateTrades('UNVR', 4000, 40, 'accum', true), // Whale Absorbing (Buying)
        ...generateTrades('UNVR', 4000, 400, 'panic_retail', false), // Retail Panic Selling
      ];
    }

    // SCENARIO 4: Fake Down (Shake Out)
    // ARTO: Price down, but low volume/neutral flow
    if (scenario === 'fake_down') {
      trades = [
        ...generateTrades('ARTO', 2500, 10, 'distrib', true), // Whale small sell
        ...generateTrades('ARTO', 2500, 50, 'neutral', false), // Retail confused
      ];
    }

    return {
      message: 'Mock Data',
      data: {
        running_trade: trades,
        is_open_market: true,
        is_show_bs: true,
        break_time_left_seconds: 0,
        date: new Date().toISOString(),
      },
    } as RunningTrade;
  }, [scenario]);

  return mockData;
}
