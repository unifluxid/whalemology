import { MarketDetector } from '@/lib/stockbit-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BandarGaugeProps {
  data: MarketDetector;
}

export function BandarGauge({ data }: BandarGaugeProps) {
  const detector = data.data.bandar_detector;

  // Determine color and label based on avg accumulation status
  const status = detector.avg.accdist;
  const isAccumulation = status.includes('Acc');
  const isNeutral = status.includes('Neutral');

  let colorClass = 'bg-gray-500';
  if (isAccumulation) colorClass = 'bg-green-500';
  else if (!isNeutral) colorClass = 'bg-red-500'; // Distribution

  // Calculate percentage strength for visual bar (arbitrary logic for demo)
  // If "Big", use higher opacity or size
  const isBig = status.includes('Big');

  return (
    <Card className="border-border bg-card text-card-foreground h-full shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
          Bandar Detector
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-4">
          <div
            className={`mb-2 text-2xl font-bold ${
              isAccumulation
                ? 'text-green-400'
                : isNeutral
                  ? 'text-muted-foreground'
                  : 'text-red-400'
            }`}
          >
            {status}
          </div>

          <div className="border-border bg-muted/30 relative mt-2 h-4 w-full overflow-hidden rounded-full border">
            {/* Center Marker */}
            <div className="bg-muted-foreground absolute top-0 bottom-0 left-1/2 z-10 w-0.5" />

            {/* Bar - Grows from center */}
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

          <div className="text-muted-foreground mt-2 flex w-full justify-between px-1 text-xs">
            <span>Big Dist</span>
            <span>Neutral</span>
            <span>Big Acc</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="border-border bg-muted/20 rounded-lg border p-3">
            <div className="text-muted-foreground text-xs">Total Volume</div>
            <div className="font-mono text-sm">
              {detector.volume.toLocaleString()}
            </div>
          </div>
          <div className="border-border bg-muted/20 rounded-lg border p-3">
            <div className="text-muted-foreground text-xs">Total Value</div>
            <div className="font-mono text-sm">
              {(detector.value / 1_000_000_000).toFixed(1)}B
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
