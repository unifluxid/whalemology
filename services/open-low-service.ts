import { getOrderbook, getMarketMover } from '@/lib/stockbit-data';

export interface OpenLowCandidate {
  symbol: string;
  price: number;
  priceFormatted: string;
  change: number;
  changePercent: number;
  volume: string;
  value: number;
  valueFormatted: string;
}

export async function getOpenLowCandidates(
  token?: string
): Promise<OpenLowCandidate[]> {
  try {
    // Fetch Top Gainers as primary candidates
    // We can also check other lists if needed, but Top Gainers is a good start for potential bullish moves
    // Fetch Top Gainers as primary candidates
    const response = await getMarketMover(token, {
      mover_type: 'MOVER_TYPE_TOP_GAINER',
      filter_stocks: [
        'FILTER_STOCKS_TYPE_MAIN_BOARD',
        'FILTER_STOCKS_TYPE_DEVELOPMENT_BOARD',
      ],
    });

    if (!response?.data?.mover_list) return [];

    return response.data.mover_list.map((item) => ({
      symbol: item.stock_detail.code,
      price: item.price,
      priceFormatted: item.price.toLocaleString('en-US'),
      change: item.change.value,
      changePercent: item.change.percentage,
      volume: item.volume.formatted,
      value: item.value.raw,
      valueFormatted: item.value.formatted,
    }));
  } catch (error) {
    console.error('Error fetching open=low candidates', error);
    return [];
  }
}

export async function verifyOpenLow(
  symbol: string,
  token?: string
): Promise<boolean> {
  try {
    const data = await getOrderbook(symbol, token);
    const orderbook = data.data;

    // Check if Open equals Low
    // Also ensuring volume > 0 to avoid inactive stocks
    return orderbook.open === orderbook.low && orderbook.volume > 0;
  } catch (error) {
    console.error(`Error verifying open=low for ${symbol}`, error);
    return false;
  }
}
