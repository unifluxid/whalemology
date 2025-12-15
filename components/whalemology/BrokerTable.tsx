import { MarketDetector } from '@/lib/stockbit-types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BrokerTableProps {
  data: MarketDetector;
}

export function BrokerTable({ data }: BrokerTableProps) {
  const summary = data.data.broker_summary;
  const buyers = summary.brokers_buy;
  const sellers = summary.brokers_sell;

  const getBrokerTxData = (
    _code: string,
    type: string,
    val: string | undefined
  ) => {
    const isBUMN = type === 'Pemerintah';
    const isForeign = type === 'Asing';

    let color = 'bg-purple-500'; // Domestic/Lokal default
    let textColor = 'text-purple-400';

    if (isBUMN) {
      color = 'bg-emerald-500';
      textColor = 'text-emerald-400';
    } else if (isForeign) {
      color = 'bg-rose-500';
      textColor = 'text-rose-400';
    }

    // Convert value to Billions (B)
    const valueNum = Math.abs(parseFloat(val || '0'));
    const valueStr = (valueNum / 1_000_000_000).toFixed(2) + ' B';

    return { color, textColor, valueStr };
  };

  return (
    <Card className="border-border bg-card text-card-foreground flex h-full flex-col overflow-hidden shadow-lg">
      <CardHeader className="border-border shrink-0 border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
            Broker Flow
          </CardTitle>
        </div>
      </CardHeader>

      <div className="bg-muted/50 flex shrink-0 items-center justify-between px-4 py-2 text-xs font-bold uppercase backdrop-blur">
        <span className="text-emerald-500">Buyer</span>
        <span className="text-rose-500">Seller</span>
      </div>

      <CardContent className="relative flex-1 overflow-hidden p-0">
        {/* Background "Flow" Effect - Decorative only since we don't have true flow data */}
        <div className="pointer-events-none absolute inset-0 opacity-10">
          <svg className="h-full w-full">
            <defs>
              <linearGradient
                id="flowGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#f43f5e" />
              </linearGradient>
            </defs>
            <path
              d="M0,50 C150,50 150,250 300,250"
              stroke="url(#flowGradient)"
              strokeWidth="100"
              fill="none"
              opacity="0.2"
            />
            {/* Just a subtle background hint */}
          </svg>
        </div>

        <ScrollArea className="h-full w-full px-4 py-2">
          <div className="relative z-10 grid grid-cols-2 gap-8">
            {/* BUYERS LIST */}
            <div className="space-y-3">
              {buyers.map((b, i) => {
                const { color, textColor, valueStr } = getBrokerTxData(
                  b.netbs_broker_code,
                  b.type,
                  b.bval
                );
                return (
                  <div
                    key={i}
                    className="group bg-muted/20 hover:bg-muted/40 relative flex items-center overflow-hidden rounded-r-lg p-2 transition-all"
                  >
                    {/* Color Bar */}
                    <div
                      className={`absolute top-0 bottom-0 left-0 w-1.5 ${color}`}
                    />

                    <div className="ml-3 flex w-full items-center justify-between">
                      <span className={`font-bold ${textColor}`}>
                        {b.netbs_broker_code}
                      </span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {valueStr}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* SELLERS LIST - Mirrored */}
            <div className="space-y-3">
              {sellers.map((s, i) => {
                const { color, textColor, valueStr } = getBrokerTxData(
                  s.netbs_broker_code,
                  s.type,
                  s.sval
                );
                return (
                  <div
                    key={i}
                    className="group bg-muted/20 hover:bg-muted/40 relative flex items-center overflow-hidden rounded-l-lg p-2 transition-all"
                  >
                    {/* Color Bar on Right */}
                    <div
                      className={`absolute top-0 right-0 bottom-0 w-1.5 ${color}`}
                    />

                    <div className="mr-3 flex w-full flex-row-reverse items-center justify-between">
                      <span className={`font-bold ${textColor}`}>
                        {s.netbs_broker_code}
                      </span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {valueStr}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </CardContent>

      {/* Legend */}
      <div className="border-border bg-muted/50 shrink-0 border-t p-3 backdrop-blur">
        <div className="text-muted-foreground flex justify-center gap-6 text-[10px] font-medium tracking-wide uppercase">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-purple-500" />
            Domestic
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            BUMN
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-rose-500" />
            Foreign
          </div>
        </div>
      </div>
    </Card>
  );
}
