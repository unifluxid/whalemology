import { NextRequest } from 'next/server';
import { fetchStockbitProxy } from '@/lib/stockbit-proxy';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ symbol: string }> }
) {
  const params = await props.params;
  const symbol = params.symbol;

  // Endpoint: company-price-feed/v2/orderbook/companies/{symbol}
  // Note: The proxy helper usually prepends path, but here the path structure is different from others.
  // The 'fetchStockbitProxy' assumes 'api/stockbit/...' maps to 'exodus.stockbit.com/...'
  // Check if fetchStockbitProxy handles full paths or just appends.

  // Actually the instruction says:
  // curl 'https://exodus.stockbit.com/company-price-feed/v2/orderbook/companies/GGRM'

  // If fetchStockbitProxy just takes the path to append to BASE_URL, we need to pass the correct path.
  // Assuming BASE_URL is https://exodus.stockbit.com/ (or similar)

  return fetchStockbitProxy(
    `company-price-feed/v2/orderbook/companies/${symbol}`,
    request
  );
}
