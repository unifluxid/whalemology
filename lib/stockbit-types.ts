export interface BrokerActivity {
  data: {
    bandar_detector: BandarDetector;
    broker_summary: BrokerSummary;
    from: string;
    to: string;
    broker_code: string;
    broker_name: string;
  };
}

export interface BandarDetector {
  average: number;
  avg: AccDistStats;
  avg5: AccDistStats;
  broker_accdist: string;
  number_broker_buysell: number;
  top1: AccDistStats;
  top3: AccDistStats;
  top5: AccDistStats;
  top10: AccDistStats;
  total_buyer: number;
  total_seller: number;
  value: number;
  volume: number;
}

export interface AccDistStats {
  accdist: string;
  amount: number;
  percent: number;
  vol: number;
}

export interface BrokerSummary {
  brokers_buy: BrokerTransaction[];
  brokers_sell: BrokerTransaction[];
  symbol: string;
}

export interface BrokerTransaction {
  blot?: string;
  blotv?: string;
  bval?: string;
  bvalv?: string;
  netbs_broker_code: string;
  netbs_buy_avg_price?: string;
  netbs_sell_avg_price?: string;
  netbs_date: string;
  netbs_stock_code: string;
  slot?: string;
  slotv?: string;
  sval?: string;
  svalv?: string;
  type: 'Lokal' | 'Asing';
}

export interface ChartbitPrice {
  data: {
    chartbit: ChartbitCandle[];
    allow_decimal: number;
    last_data: number;
    previous_timestamp: string;
  };
}

export interface ChartbitCandle {
  date: string;
  unixdate: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  foreignbuy: number;
  foreignsell: number;
  frequency: number;
  foreignflow: number;
  soxclose: number;
  dividend: number;
  value: number;
  shareoutstanding: number;
  freq_analyzer: number;
}

export interface EmittenInfo {
  data: {
    aum: string;
    average: string;
    change: string;
    country: string;
    created: string;
    date: string;
    exchange: string;
    followed: number;
    followers: number;
    id: string;
    indexes: string[];
    name: string;
    orderbook: {
      bid: OrderBookItem;
      offer: OrderBookItem;
    };
    percentage: number;
    previous: string;
    price: string;
    sector: string;
    sub_sector: string;
    symbol: string;
    tradeable: number;
    type_company: string;
    updated: string;
    value: string;
    volume: string;
    market_hour: {
      status: string;
      time_left: number;
      formatted_time_left: string;
      suspend_info: string;
    };
    formatted_price: string;
  };
}

export interface OrderBookItem {
  price: string;
  volume: string;
}

export interface MarketDetector {
  data: {
    bandar_detector: BandarDetector;
    broker_summary: BrokerSummary;
    from: string;
    to: string;
  };
}

export interface RunningTrade {
  data: {
    is_open_market: boolean;
    running_trade: TradeItem[];
    is_show_bs: boolean;
    break_time_left_seconds: number;
    date: string;
  };
}

export interface TradeItem {
  id: string;
  time: string;
  action: 'buy' | 'sell';
  code: string;
  price: string;
  change: string;
  lot: string;
  is_broker_exists: boolean;
  buyer: string;
  seller: string;
  trade_number: string;
  buyer_type: string;
  seller_type: string;
  market_board: string;
  // Enriched fields (pre-calculated for performance)
  priceNum?: number;
  lotNum?: number;
  value?: number;
  changeNum?: number;
  seconds?: number; // Cached time in seconds for time decay calculations
}

export interface WatchlistSymbol {
  symbol: string;
  symbol2: string;
  symbol3: string;
  country: string;
  exchange: string;
  status: number;
  id: string;
  name: string;
  sequence_no: number;
  icon_url: string;
  last: string;
  change: string;
  percent: string;
  previous: string;
  tradeable: boolean;
  type: string;
  orderbook: {
    bid: string;
    offer: string;
  };
  prices: string[];
  column: unknown[];
  notations: unknown[];
  uma: boolean;
  corp_action: {
    active: boolean;
    icon: string;
    text: string;
  };
  formatted_price: string;
  notation: unknown[];
  volume: string;
  extra_attributes: unknown;
}

export interface WatchlistResponse {
  message: string;
  data: {
    watchlist_id: number;
    name: string;
    descriptions: string;
    header: string[];
    header_custom: string[];
    result: WatchlistSymbol[];
    total: number;
    type: string;
    is_default: boolean;
    emoji: string;
    pagination: {
      is_last_page: boolean;
    };
    sort_by: string;
    sort_dir: string;
    sort_desc: string;
  };
}

export interface SearchCompany {
  id: string;
  name: string;
  country: string;
  desc: string;
  exchange: string;
  is_following: boolean;
  img: string;
  is_verified: boolean;
  other: string;
  status: string;
  symbol_2: string;
  symbol_3: string;
  total_followers: number;
  is_tradeable: boolean;
  type: string;
  url: string;
  icon_url: string;
}

export interface SearchResponse {
  message: string;
  data: {
    chat: unknown[];
    company: SearchCompany[];
    insider: unknown[];
    people: unknown[];
    sector: unknown[];
    pagination: {
      has_more_companies: boolean;
      has_more_insiders: boolean;
      has_more_users: boolean;
    };
  };
}

export interface MarketMoverResponse {
  message: string;
  data: {
    mover_list: MoverItem[];
    mover_type: string;
    is_show_net_foreign: boolean;
    net_foreign_updated_at: string;
  };
}

export interface MoverItem {
  stock_detail: {
    code: string;
    name: string;
    icon_url: string;
    has_uma: boolean;
    notations: unknown[];
    corpaction: {
      active: boolean;
      icon_url: string;
      text: string;
    };
  };
  price: number;
  change: {
    value: number;
    percentage: number;
  };
  value: {
    raw: number;
    formatted: string;
  };
  volume: {
    raw: number;
    formatted: string;
  };
  frequency: {
    raw: number;
    formatted: string;
  };
  net_foreign_buy: {
    raw: number;
    formatted: string;
  };
  net_foreign_sell: {
    raw: number;
    formatted: string;
  };
}

export interface OrderbookResponse {
  data: {
    average: number;
    bid: OrderbookItem[];
    change: number;
    close: number;
    country: string;
    domestic: string;
    down: string;
    exchange: string;
    fbuy: number;
    fnet: number;
    foreign: string;
    frequency: number;
    fsell: number;
    high: number;
    id: string;
    lastprice: number;
    low: number;
    offer: OrderbookItem[];
    open: number;
    percentage_change: number;
    previous: number;
    status: string;
    symbol: string;
    tradable: boolean;
    unchanged: string;
    up: string;
    val: number;
    volume: number;
  };
}

export interface OrderbookItem {
  price: string;
  que_num: string;
  volume: string;
  change_percentage: string;
}
