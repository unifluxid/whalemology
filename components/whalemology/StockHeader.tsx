import { EmittenInfo, MarketDetector } from '@/lib/stockbit-types';
import { Card, CardContent } from '@/components/ui/card';
import Image from 'next/image';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface StockHeaderProps {
  params: Promise<{ ticker: string }>;
  data: EmittenInfo;
  detector?: MarketDetector | null;
}

export function StockHeader({ params, data, detector }: StockHeaderProps) {
  const router = useRouter();
  const { ticker } = use(params);

  const info = data.data;
  const isPositive = info.change.startsWith('+');
  const changeColor = isPositive ? 'text-green-500' : 'text-red-500';

  // Bandar Detector Logic
  const bandarData = detector?.data.bandar_detector;
  const status = bandarData?.avg.accdist || 'Neutral';
  const isAccumulation = status.includes('Acc');
  const isNeutral = status.includes('Neutral');

  let colorClass = 'bg-gray-500';
  if (isAccumulation) colorClass = 'bg-green-500';
  else if (!isNeutral) colorClass = 'bg-red-500'; // Distribution

  const isBig = status.includes('Big');

  const [inputTicker, setInputTicker] = useState(ticker);

  useEffect(() => {
    document.title = `${ticker} | Whalemology`;
  }, [ticker]);

  const handleTickerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputTicker && inputTicker !== ticker) {
      router.push(`/whalemology/${inputTicker.toUpperCase()}`);
    }
  };

  return (
    <Card className="border-border bg-card text-card-foreground shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="w-1/3">
            <div className="flex items-center gap-4">
              <Image
                src={`https://assets.stockbit.com/logos/companies/${info.symbol}.png`}
                alt={info.symbol}
                width={160}
                height={160}
                className="h-12 w-12 rounded-full bg-white p-1"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="flex items-baseline gap-3">
                <div className="">
                  {/* <h1 className="text-3xl font-bold tracking-tight">
                    {info.symbol}
                  </h1> */}
                  <form onSubmit={handleTickerSubmit}>
                    <input
                      type="text"
                      value={inputTicker}
                      onChange={(e) =>
                        setInputTicker(e.target.value.toUpperCase())
                      }
                      className="border-border bg-input text-foreground focus:border-primary w-32 rounded-lg border py-1 text-center text-3xl font-bold tracking-widest focus:outline-none"
                      placeholder="CODE"
                      onBlur={() => setInputTicker(info.symbol)}
                    />
                  </form>

                  <span className="text-muted-foreground text-xs font-medium">
                    {info.name}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Center: Bandar Detector Gauge */}
          {bandarData && (
            <div className="border-border flex w-1/3 flex-col items-center justify-center border-x px-6">
              <div className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
                Bandar Detector
              </div>
              <div
                className={`mb-2 text-xl font-bold ${
                  isAccumulation
                    ? 'text-green-400'
                    : isNeutral
                      ? 'text-muted-foreground'
                      : 'text-red-400'
                }`}
              >
                {status}
              </div>

              <div className="border-border bg-muted/30 relative h-2 w-full max-w-[200px] overflow-hidden rounded-full border">
                <div className="bg-muted-foreground absolute top-0 bottom-0 left-1/2 z-10 w-0.5" />
                <div
                  className={`h-full transition-all duration-500 ${colorClass} ${isBig ? 'opacity-100' : 'opacity-70'}`}
                  style={{
                    width: isNeutral ? '0%' : isBig ? '50%' : '25%',
                    marginLeft: isAccumulation
                      ? '50%'
                      : isNeutral
                        ? '50%'
                        : isBig
                          ? '0%'
                          : '25%',
                  }}
                />
              </div>
            </div>
          )}

          <div className="w-1/3 text-right">
            <div className="flex flex-col">
              <span className="text-4xl font-bold">
                {parseInt(info.price).toLocaleString('id-ID')}
              </span>
              <div
                className={`mb-1 flex items-center justify-end gap-1 ${changeColor}`}
              >
                <span className="text-sm font-bold">{info.change}</span>
                <span className="text-xs">({info.percentage.toFixed(2)}%)</span>
              </div>
            </div>
            <div className="text-muted-foreground text-xs">
              Prev: {parseInt(info.previous).toLocaleString('id-ID')} • Vol:{' '}
              {(parseInt(info.volume || '0') / 1_000_000).toFixed(1)}M
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
