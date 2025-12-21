import {
  BrokerActivity,
  ChartbitPrice,
  EmittenInfo,
  MarketDetector,
  RunningTrade,
  WatchlistResponse,
  SearchResponse,
} from './stockbit-types';

import { useAuthStore } from '@/store/auth';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

export async function fetchStockbitData<T>(
  endpoint: string,
  token?: string,
  method: 'GET' | 'POST' = 'GET'
): Promise<T> {
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`/api/stockbit/${endpoint}`, {
    method: method,
    headers: headers,
  });

  if (res.status === 401) {
    // Global 401 Handler
    // 1. Clear local state
    useAuthStore.getState().logout();

    // 2. Clear httpOnly cookie via backend route
    // We use a simple fetch here, ignoring result as we are redirecting anyway
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Failed to clear cookie on 401', e);
    }

    // 3. Redirect to login (Client-side only)
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }

    throw new Error('Unauthorized: Session expired');
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch ${endpoint}: ${res.statusText}`);
  }
  return res.json();
}

export async function getBrokerActivity(
  symbol: string,
  date: string,
  token?: string
): Promise<BrokerActivity> {
  if (USE_MOCK) return MOCK_BROKER_ACTIVITY;
  // Based on broker-activity.txt: https://exodus.stockbit.com/findata-view/marketdetectors/activity/XL/detail
  // But this might be for specific broker. For now, keep as is or assume user doesn't call this directly for dashboard.
  return fetchStockbitData<BrokerActivity>(
    `findata-view/marketdetectors/activity/${symbol}/detail?date=${date}`,
    token
  );
}

export async function getMarketDetector(
  symbol: string,
  startDate: string, // YYYY-MM-DD
  endDate: string, // YYYY-MM-DD
  token?: string
): Promise<MarketDetector> {
  if (USE_MOCK) return MOCK_MARKET_DETECTOR;

  // Based on market-detector.txt: https://exodus.stockbit.com/marketdetectors/BTPS
  return fetchStockbitData<MarketDetector>(
    `marketdetectors/${symbol}?from=${startDate}&to=${endDate}&transaction_type=TRANSACTION_TYPE_NET&market_board=MARKET_BOARD_REGULER&investor_type=INVESTOR_TYPE_ALL&limit=25`,
    token
  );
}

export async function getEmittenInfo(
  symbol: string,
  token?: string
): Promise<EmittenInfo> {
  if (USE_MOCK) return MOCK_EMITTEN_INFO;
  // Based on emitten-info.txt: https://exodus.stockbit.com/emitten/UNIQ/info
  return fetchStockbitData<EmittenInfo>(`emitten/${symbol}/info`, token);
}

export interface RunningTradeFilters {
  symbol?: string;
  symbols?: string[]; // Array of symbols to filter
  trade_number?: string;
  action_type?:
    | 'RUNNING_TRADE_ACTION_TYPE_ALL'
    | 'RUNNING_TRADE_ACTION_TYPE_BUY'
    | 'RUNNING_TRADE_ACTION_TYPE_SELL';
  minimum_lot?: number;
  price_range_from?: number;
  price_range_to?: number;
  time_range_start?: string;
  time_range_end?: string;
  market_board?:
    | 'BOARD_TYPE_ALL'
    | 'BOARD_TYPE_REGULAR'
    | 'BOARD_TYPE_CASH'
    | 'BOARD_TYPE_NEGOTIATION';
  date?: string;
  order_by?: 'RUNNING_TRADE_ORDER_BY_TIME' | 'RUNNING_TRADE_ORDER_BY_LOT';
  sort?: 'asc' | 'desc';
}

export async function getRunningTrade(
  symbol: string,
  token?: string,
  trade_number?: string,
  filters?: RunningTradeFilters
): Promise<RunningTrade> {
  if (USE_MOCK) return MOCK_RUNNING_TRADE;

  // Handle both single symbol and symbols array from filters
  let symbolsParam = '';
  if (filters?.symbols && filters.symbols.length > 0) {
    symbolsParam = filters.symbols.map((s) => `&symbols[]=${s}`).join('');
  } else if (symbol) {
    symbolsParam = `&symbols[]=${symbol}`;
  }

  const tradeNumberParam = trade_number ? `&trade_number=${trade_number}` : '';
  const date = filters?.date || new Date().toISOString().split('T')[0];

  // Build filter params
  const actionType = filters?.action_type || 'RUNNING_TRADE_ACTION_TYPE_ALL';
  const marketBoard = filters?.market_board || 'BOARD_TYPE_ALL';
  const minLot = filters?.minimum_lot
    ? `&minimum_lot=${filters.minimum_lot}`
    : '';
  const priceFrom = filters?.price_range_from
    ? `&price_range_from=${filters.price_range_from}`
    : '';
  const priceTo = filters?.price_range_to
    ? `&price_range_to=${filters.price_range_to}`
    : '';
  const timeStart = filters?.time_range_start
    ? `&time_range.start=${filters.time_range_start}`
    : '';
  const timeEnd = filters?.time_range_end
    ? `&time_range.end=${filters.time_range_end}`
    : '';

  // Based on running-trade.txt
  return fetchStockbitData<RunningTrade>(
    `order-trade/running-trade?limit=80&sort=desc&order_by=RUNNING_TRADE_ORDER_BY_TIME&action_type=${actionType}&market_board=${marketBoard}&date=${date}${symbolsParam}${tradeNumberParam}${minLot}${priceFrom}${priceTo}${timeStart}${timeEnd}`,
    token
  );
}

export async function getChartbitPrice(
  symbol: string,
  token?: string
): Promise<ChartbitPrice> {
  if (USE_MOCK) return MOCK_CHARTBIT_PRICE;
  // Based on chartbit-price.txt: chartbit/SAME/price/daily
  return fetchStockbitData<ChartbitPrice>(
    `chartbit/${symbol}/price/daily?limit=50`,
    token
  );
}

export interface WatchlistOptions {
  page?: number;
  limit?: number;
  sort_by?: 'symbol' | 'last' | 'change' | 'percent' | 'bid' | 'offer';
  sort_dir?: 'asc' | 'desc';
}

export async function getWatchlistSymbols(
  watchlistId: number,
  token?: string,
  options?: WatchlistOptions
): Promise<WatchlistResponse> {
  const page = options?.page || 1;
  const limit = options?.limit || 50;
  const sortBy = options?.sort_by ? `&sort_by=${options.sort_by}` : '';
  const sortDir = options?.sort_dir ? `&sort_dir=${options.sort_dir}` : '';

  // Based on GET watchlist/{watchlist_id}?page=1&limit=50
  return fetchStockbitData<WatchlistResponse>(
    `watchlist/${watchlistId}?page=${page}&limit=${limit}${sortBy}${sortDir}`,
    token
  );
}

export async function searchSymbols(
  keyword: string,
  token?: string
): Promise<SearchResponse> {
  // Based on search.md: GET search?keyword={keyword}&page=0&type=company
  return fetchStockbitData<SearchResponse>(
    `search?keyword=${encodeURIComponent(keyword)}&page=0&type=company`,
    token
  );
}

// Mock Data Definitions
export const MOCK_BROKER_ACTIVITY: BrokerActivity = {
  data: {
    bandar_detector: {
      average: 275.36557,
      avg: {
        accdist: 'Big Acc',
        amount: 254866100000,
        percent: 53.31134,
        vol: 9255554,
      },
      avg5: {
        accdist: 'Big Acc',
        amount: 254683150000,
        percent: 53.273075,
        vol: 9248910,
      },
      broker_accdist: 'Dist',
      number_broker_buysell: 0,
      top1: {
        accdist: 'Big Acc',
        amount: 257825160000,
        percent: 53.9303,
        vol: 9363013,
      },
      top3: {
        accdist: 'Big Acc',
        amount: 233141910000,
        percent: 48.76721,
        vol: 8466632,
      },
      top5: {
        accdist: 'Big Acc',
        amount: 276773240000,
        percent: 57.89374,
        vol: 10051119,
      },
      top10: {
        accdist: 'Big Acc',
        amount: 311731620000,
        percent: 65.20612,
        vol: 11320645,
      },
      total_buyer: 50,
      total_seller: 50,
      value: 478071060000,
      volume: 17361322,
    },
    broker_summary: {
      brokers_buy: [
        {
          blot: '9.953923e+06',
          blotv: '',
          bval: '6.86918747e+10',
          bvalv: '',
          netbs_broker_code: 'XL',
          netbs_buy_avg_price: '68.95361424561088',
          netbs_date: '20251208',
          netbs_stock_code: 'GOTO',
          type: 'Lokal',
        },
        {
          blot: '87051',
          blotv: '',
          bval: '3.1933945e+10',
          bvalv: '',
          netbs_broker_code: 'XL',
          netbs_buy_avg_price: '3669.6651490066224',
          netbs_date: '20251208',
          netbs_stock_code: 'BBRI',
          type: 'Lokal',
        },
      ],
      brokers_sell: [
        {
          netbs_broker_code: 'XL',
          netbs_date: '20251208',
          netbs_sell_avg_price: '439.61006588331185',
          netbs_stock_code: 'DEWA',
          slot: '-590910',
          slotv: '',
          sval: '-2.65022458e+10',
          svalv: '',
          type: 'Lokal',
        },
        {
          netbs_broker_code: 'XL',
          netbs_date: '20251208',
          netbs_sell_avg_price: '246.86895930847328',
          netbs_stock_code: 'BUMI',
          slot: '-1.054194e+06',
          slotv: '',
          sval: '-2.60209818e+10',
          svalv: '',
          type: 'Lokal',
        },
      ],
      symbol: '',
    },
    from: '2025-12-08',
    to: '2025-12-08',
    broker_code: 'XL',
    broker_name: 'Stockbit Sekuritas Digital',
  },
};

export const MOCK_CHARTBIT_PRICE: ChartbitPrice = {
  data: {
    chartbit: [
      {
        date: '2025-12-08',
        unixdate: 1765126800,
        open: 410,
        high: 434,
        low: 400,
        close: 426,
        volume: 58646800,
        foreignbuy: 591555000,
        foreignsell: 1639895800,
        frequency: 3608,
        foreignflow: 9933264408,
        soxclose: 7308405964170,
        dividend: 0,
        value: 24631011400,
        shareoutstanding: 17155882545,
        freq_analyzer: 1248.661535532832,
      },
      {
        date: '2025-12-05',
        unixdate: 1764867600,
        open: 400,
        high: 408,
        low: 394,
        close: 408,
        volume: 5794700,
        foreignbuy: 94211000,
        foreignsell: 164548800,
        frequency: 447,
        foreignflow: 10981605208,
        soxclose: 6999600078360,
        dividend: 0,
        value: 2319549600,
        shareoutstanding: 17155882545,
        freq_analyzer: 64879.63342799981,
      },
    ],
    allow_decimal: 0,
    last_data: 1357837200,
    previous_timestamp: '',
  },
};

export const MOCK_EMITTEN_INFO: EmittenInfo = {
  data: {
    aum: '',
    average: '32865522.00',
    change: '+4.00',
    country: 'ID',
    created: '2021-03-05T14:29:17+07:00',
    date: '08 Dec 2025',
    exchange: 'IDX',
    followed: 1,
    followers: 47233,
    id: '1000003235',
    indexes: ['IDXSMC-COM', 'IDXENERGY', 'ISSI', 'MBX', 'IHSG'],
    name: 'Ulima Nitra Tbk',
    orderbook: {
      bid: {
        price: '448.000000',
        volume: '1120700.000000',
      },
      offer: {
        price: '452.000000',
        volume: '529900.000000',
      },
    },
    percentage: 0.9,
    previous: '446',
    price: '450',
    sector: 'Energi',
    sub_sector: 'Minyak, Gas & Batu Bara',
    symbol: 'UNIQ',
    tradeable: 1,
    type_company: 'Saham',
    updated: '2025-12-08T08:00:16+07:00',
    value: 'NA',
    volume: '34751600',
    market_hour: {
      status: 'close',
      time_left: 24466,
      formatted_time_left: '6 jam 47 menit 46 detik',
      suspend_info: '',
    },
    formatted_price: '450',
  },
};

export const MOCK_MARKET_DETECTOR: MarketDetector = {
  data: {
    bandar_detector: {
      average: 1318.2812,
      avg: {
        accdist: 'Normal Acc',
        amount: 3778554400,
        percent: 14.329002,
        vol: 28662.732,
      },
      avg5: {
        accdist: 'Normal Acc',
        amount: 3308516900,
        percent: 12.54653,
        vol: 25097.2,
      },
      broker_accdist: 'Dist',
      number_broker_buysell: 5,
      top1: {
        accdist: 'Neutral',
        amount: 391397700,
        percent: 1.4842551,
        vol: 2969,
      },
      top3: {
        accdist: 'Normal Acc',
        amount: 3883656700,
        percent: 14.72757,
        vol: 29460,
      },
      top5: {
        accdist: 'Normal Acc',
        amount: 4143489800,
        percent: 15.712908,
        vol: 31431,
      },
      top10: {
        accdist: 'Neutral',
        amount: 1145322800,
        percent: 4.343283,
        vol: 8688,
      },
      total_buyer: 27,
      total_seller: 22,
      value: 26369976000,
      volume: 200033,
    },
    broker_summary: {
      brokers_buy: [
        {
          blot: '73202',
          blotv: '1.00889e+07',
          bval: '9.524187e+09',
          bvalv: '1.3203996e+10',
          netbs_broker_code: 'XL',
          netbs_buy_avg_price: '1308.7646819772224',
          netbs_date: '20251201',
          netbs_stock_code: 'BTPS',
          type: 'Lokal',
        },
        {
          blot: '60306',
          blotv: '6.0495e+06',
          bval: '8.1488395e+09',
          bvalv: '8.1739255e+09',
          netbs_broker_code: 'AI',
          netbs_buy_avg_price: '1351.173733366394',
          netbs_date: '20251201',
          netbs_stock_code: 'BTPS',
          type: 'Asing',
        },
      ],
      brokers_sell: [
        {
          netbs_broker_code: 'BK',
          netbs_date: '20251201',
          netbs_sell_avg_price: '1308.170652625026',
          netbs_stock_code: 'BTPS',
          slot: '-70233',
          slotv: '7.7104e+06',
          sval: '-9.162752e+09',
          svalv: '1.0086519e+10',
          type: 'Asing',
        },
        {
          netbs_broker_code: 'AZ',
          netbs_date: '20251201',
          netbs_sell_avg_price: '1323.2257819122347',
          netbs_stock_code: 'BTPS',
          slot: '-32821',
          slotv: '4.6009e+06',
          sval: '-4.3357795e+09',
          svalv: '6.0880295e+09',
          type: 'Lokal',
        },
      ],
      symbol: 'BTPS',
    },
    from: '2025-12-01',
    to: '2025-12-08',
  },
};

export const MOCK_RUNNING_TRADE: RunningTrade = {
  data: {
    is_open_market: false,
    running_trade: [
      {
        id: '2770106313',
        time: '16:07:02',
        action: 'buy',
        code: 'UNIQ',
        price: '450',
        change: '+0.90%',
        lot: '49',
        is_broker_exists: true,
        buyer: 'AZ [D]',
        seller: 'LG [D]',
        trade_number: '2900982',
        buyer_type: 'BROKER_TYPE_LOCAL',
        seller_type: 'BROKER_TYPE_LOCAL',
        market_board: 'RG',
      },
    ],
    is_show_bs: true,
    break_time_left_seconds: 0,
    date: '2025-12-08',
  },
};
