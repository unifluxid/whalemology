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
}
