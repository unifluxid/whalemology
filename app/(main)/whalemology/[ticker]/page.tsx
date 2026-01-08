'use client';

import { useEffect, useState, use } from 'react';
import { useAuthStore } from '@/store';
import { StockHeader } from '@/components/whalemology/StockHeader';
import { BrokerTable } from '@/components/whalemology/BrokerTable';
import { TradeFeed } from '@/components/whalemology/TradeFeed';

import {
  getEmittenInfo,
  getMarketDetector,
  getRunningTrade,
} from '@/lib/stockbit-data';
import {
  EmittenInfo,
  MarketDetector,
  RunningTrade,
} from '@/lib/stockbit-types';

// Setup types for state
type DashboardData = {
  emittenInfo: EmittenInfo | null;
  marketDetector: MarketDetector | null; // using market detector for bandar gauge & broker
  runningTrade: RunningTrade | null;
};

interface PageProps {
  params: Promise<{ ticker: string }>;
}

export default function WhalemologyDashboard({ params }: PageProps) {
  const { ticker } = use(params);
  const { token } = useAuthStore();

  const [data, setData] = useState<DashboardData>({
    emittenInfo: null,
    marketDetector: null,
    runningTrade: null,
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortBy, setSortBy] = useState<'time' | 'lot'>('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSortChange = (newSortBy: 'time' | 'lot') => {
    if (sortBy === newSortBy) {
      // Toggle order if clicking the same column
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new sort column with default desc order
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  const handleLoadMore = async () => {
    if (loadingMore || !data.runningTrade || !token) return;

    const trades = data.runningTrade.data.running_trade;
    if (trades.length === 0) return;

    const lastTrade = trades[trades.length - 1];
    setLoadingMore(true);
    try {
      // Fetch older trades using the last trade number as cursor
      const olderTrades = await getRunningTrade(
        ticker,
        token,
        lastTrade.trade_number
      );

      if (olderTrades.data.running_trade.length > 0) {
        setData((prev) => {
          if (!prev.runningTrade) return prev;
          return {
            ...prev,
            runningTrade: {
              ...prev.runningTrade,
              data: {
                ...prev.runningTrade.data,
                running_trade: [
                  ...prev.runningTrade.data.running_trade,
                  ...olderTrades.data.running_trade,
                ],
              },
            },
          };
        });
      }
    } catch (e) {
      console.error('Failed to load more trades', e);
    } finally {
      setLoadingMore(false);
    }
  };

  // Fetch data when token is available
  // AuthProvider guarantees token is hydrated before this component renders
  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [info, detector, trades] = await Promise.all([
          getEmittenInfo(ticker, token),
          getMarketDetector(ticker, '2025-12-01', '2025-12-08', token),
          getRunningTrade(ticker, token),
        ]);

        setData({
          emittenInfo: info,
          marketDetector: detector,
          runningTrade: trades,
        });
      } catch (error) {
        console.error('Failed to load dashboard data', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [ticker, token]);

  if (
    loading ||
    !data.emittenInfo ||
    !data.marketDetector ||
    !data.runningTrade
  ) {
    return (
      <div className="bg-background text-foreground flex min-h-screen items-center justify-center">
        <div className="flex animate-pulse flex-col items-center">
          <div className="border-primary mb-4 h-12 w-12 animate-spin rounded-full border-4 border-t-transparent" />
          <div className="text-center">
            <p className="mb-2">Loading Whalemology Data for {ticker}...</p>
            <p className="text-muted-foreground text-xs">
              Please wait while we fetch the latest market data
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-foreground flex h-full flex-col overflow-hidden p-2 font-sans">
      <div className="mx-auto flex h-full w-full flex-col space-y-6">
        {/* Stock Info */}
        <div className="flex-none">
          <StockHeader
            data={data.emittenInfo}
            detector={data.marketDetector}
            params={params}
          />
        </div>

        {/* Main Grid */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-2">
          {/* Left Col: Broker Summary - Full Height Card */}
          <div className="h-full min-h-0 md:col-span-1">
            <BrokerTable data={data.marketDetector} />
          </div>

          {/* Right Col: Running Trade - Full Height Card */}
          <div className="h-full min-h-0 md:col-span-1">
            <TradeFeed
              data={data.runningTrade}
              onLoadMore={handleLoadMore}
              loadingMore={loadingMore}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
