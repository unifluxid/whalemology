'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { StockAnomaly } from '@/lib/trade-analysis';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnomalyCardProps {
  anomalies: StockAnomaly[];
}

// Determine confidence label and color
function getConfidenceLabel(score: number) {
  if (score >= 5) return { label: 'Strong Follow', color: 'text-green-600' };
  if (score >= 4) return { label: 'Can Follow', color: 'text-green-500' };
  if (score >= 3) return { label: 'Moderate', color: 'text-yellow-500' };
  if (score >= 2) return { label: 'Weak', color: 'text-orange-500' };
  return { label: 'Very Weak', color: 'text-red-500' };
}

function AnomalyItem({ anomaly, idx }: { anomaly: StockAnomaly; idx: number }) {
  const isAccumulation = anomaly.dominantAction === 'ACCUMULATION';
  const actionColor = isAccumulation ? 'text-green-500' : 'text-red-500';
  const bgColor = isAccumulation
    ? 'bg-green-500/10 border-green-500/30'
    : 'bg-red-500/10 border-red-500/30';

  const confidenceScore = anomaly.confidenceScore;
  const confidencePercentage = ((confidenceScore - 1) / 5) * 100; // Convert 1-6 to 0-100%
  const confidence = getConfidenceLabel(confidenceScore);

  return (
    <div
      key={`${anomaly.symbol}-${idx}`}
      className={`rounded-lg border p-3 ${bgColor}`}
    >
      {/* Header: Symbol & Action */}
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold">{anomaly.symbol}</span>
          {isAccumulation ? (
            <TrendingUp className={`h-4 w-4 ${actionColor}`} />
          ) : (
            <TrendingDown className={`h-4 w-4 ${actionColor}`} />
          )}
          <Badge
            variant="outline"
            className={`text-[10px] ${actionColor} border-current`}
          >
            {anomaly.dominantAction}
          </Badge>
        </div>
        <span className="text-foreground text-[10px] font-semibold">
          {anomaly.lastUpdate}
        </span>
      </div>

      {/* Reasons */}
      <div className="mb-2"></div>

      {/* Stats Grid */}
      <div className="mb-2 grid grid-cols-2 gap-2 text-xs">
        {anomaly.reasons.map((reason, i) => (
          <div
            key={i}
            className={cn(
              anomaly.reasons.length === 1 ? 'col-span-2' : 'col-span-1'
            )}
          >
            <div
              className="text-muted-foreground flex items-center gap-1 text-xs"
              dangerouslySetInnerHTML={{
                __html: reason,
              }}
            ></div>
          </div>
        ))}
        <div>
          <span className="text-muted-foreground">Avg Price:</span>
          <span className="ml-1 font-mono font-semibold">
            {Math.round(anomaly.averagePrice).toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Avg Lot:</span>
          <span className="ml-1 font-mono font-semibold">
            {Math.round(anomaly.averageLot).toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Total Vol:</span>
          <span className="ml-1 font-mono font-semibold">
            {anomaly.totalVolume.toLocaleString()} lot
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Total Value:</span>
          <span className="ml-1 font-mono font-semibold">
            {anomaly.totalValue >= 1_000_000_000
              ? `Rp ${(anomaly.totalValue / 1_000_000_000).toFixed(2)}B`
              : anomaly.totalValue >= 1_000_000
                ? `Rp ${(anomaly.totalValue / 1_000_000).toFixed(1)}M`
                : anomaly.totalValue >= 1_000
                  ? `Rp ${(anomaly.totalValue / 1_000).toFixed(1)}K`
                  : `Rp ${anomaly.totalValue.toLocaleString()}`}
          </span>
        </div>
      </div>

      {/* Confidence Score Progress Bar */}
      <div className="mb-2 border-t border-current/20 pt-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-muted-foreground text-[10px] font-medium uppercase">
            Confidence Score
          </span>
          <span className={`text-[10px] font-bold ${confidence.color}`}>
            {confidenceScore}/6 - {confidence.label}
          </span>
        </div>
        <Progress
          value={confidencePercentage}
          className="h-2"
          indicatorClassName={cn(
            confidenceScore >= 5
              ? 'bg-green-600'
              : confidenceScore >= 4
                ? 'bg-green-500'
                : confidenceScore >= 3
                  ? 'bg-yellow-500'
                  : confidenceScore >= 2
                    ? 'bg-orange-500'
                    : 'bg-red-500'
          )}
        />
      </div>

      {/* Top Brokers */}
      {anomaly.topBrokers.length > 0 && (
        <div className="border-t border-current/20 pt-2">
          <div className="text-muted-foreground mb-1 text-[10px] font-medium uppercase">
            Top Brokers
          </div>
          <div className="flex flex-wrap gap-1">
            {anomaly.topBrokers.map((broker, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="border border-current/30 text-[10px]"
              >
                <span className="font-bold">{broker.broker}</span>
                <span className="mx-1">•</span>
                <span>{broker.count}x</span>
                <span className="ml-1 opacity-70">
                  ({broker.action === 'buy' ? 'B' : 'S'})
                </span>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AnomalyCard({ anomalies }: AnomalyCardProps) {
  const { accumulationAnomalies, distributionAnomalies } = useMemo(() => {
    const accumulation = anomalies
      .filter((a) => a.dominantAction === 'ACCUMULATION')
      .sort((a, b) => b.totalValue - a.totalValue) // Sort by highest Total Value
      .slice(0, 10);
    const distribution = anomalies
      .filter((a) => a.dominantAction === 'DISTRIBUTION')
      .sort((a, b) => b.totalValue - a.totalValue) // Sort by highest Total Value
      .slice(0, 10);
    return {
      accumulationAnomalies: accumulation,
      distributionAnomalies: distribution,
    };
  }, [anomalies]);

  if (
    accumulationAnomalies.length === 0 &&
    distributionAnomalies.length === 0
  ) {
    return (
      <Card className="border-border bg-card text-card-foreground flex h-full flex-col overflow-hidden shadow-lg">
        <CardHeader className="border-border shrink-0 border-b px-4 py-3">
          <CardTitle className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
            Market Anomalies
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center p-8">
          <div className="text-muted-foreground text-center">
            <AlertTriangle className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p className="text-sm">No anomalies detected</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid h-full grid-cols-2 gap-4">
      {/* Accumulation Card */}
      <Card className="border-border bg-card text-card-foreground flex flex-col overflow-hidden shadow-lg">
        <CardHeader className="border-border shrink-0 border-b bg-green-500/10 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between">
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Accumulation
            </CardTitle>
            <Badge
              variant="outline"
              className="border-green-500 text-xs text-green-500"
            >
              {accumulationAnomalies.length}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          {accumulationAnomalies.length === 0 ? (
            <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm italic">
              No accumulation detected
            </div>
          ) : (
            <ScrollArea className="h-full w-full">
              <div className="flex flex-col gap-2 p-2">
                {accumulationAnomalies.map((anomaly, idx) => (
                  <AnomalyItem
                    key={`acc-${anomaly.symbol}-${idx}`}
                    anomaly={anomaly}
                    idx={idx}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Distribution Card */}
      <Card className="border-border bg-card text-card-foreground flex flex-col overflow-hidden shadow-lg">
        <CardHeader className="border-border shrink-0 border-b bg-red-500/10 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between">
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Distribution
            </CardTitle>
            <Badge
              variant="outline"
              className="border-red-500 text-xs text-red-500"
            >
              {distributionAnomalies.length}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          {distributionAnomalies.length === 0 ? (
            <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm italic">
              No distribution detected
            </div>
          ) : (
            <ScrollArea className="h-full w-full">
              <div className="flex flex-col gap-2 p-2">
                {distributionAnomalies.map((anomaly, idx) => (
                  <AnomalyItem
                    key={`dist-${anomaly.symbol}-${idx}`}
                    anomaly={anomaly}
                    idx={idx}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
