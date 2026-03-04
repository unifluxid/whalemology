'use client';

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

// Tier configuration with colors and descriptions
const TIER_CONFIG: Record<
  string,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    description: string;
    examples: string;
  }
> = {
  MEGA: {
    label: 'MEGA',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/50',
    description: 'Blue chip stocks with market cap > 100 Trillion IDR',
    examples: 'e.g., BBCA, BBRI, TLKM',
  },
  LARGE: {
    label: 'LARGE',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/50',
    description: 'Large cap stocks with market cap 20-100 Trillion IDR',
    examples: 'e.g., ASII, UNVR, BMRI',
  },
  MID: {
    label: 'MID',
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/50',
    description: 'Mid cap stocks with market cap 5-20 Trillion IDR',
    examples: 'e.g., MAPI, ACES, ERAA',
  },
  SMALL: {
    label: 'SMALL',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/50',
    description: 'Small cap stocks with market cap 1-5 Trillion IDR',
    examples: 'Second liner stocks',
  },
  MICRO: {
    label: 'MICRO',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/50',
    description: 'Micro cap stocks with market cap 100B-1T IDR',
    examples: 'Third liner stocks',
  },
  NANO: {
    label: 'NANO',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/50',
    description: 'Nano cap / penny stocks with market cap < 100B IDR',
    examples: 'Very small / speculative stocks',
  },
  UNKNOWN: {
    label: '?',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    borderColor: 'border-muted',
    description: 'Market cap data not available',
    examples: 'Using default thresholds',
  },
};

interface TierBadgeProps {
  tier?: string;
  className?: string;
  showTooltip?: boolean;
}

export function TierBadge({
  tier,
  className,
  showTooltip = true,
}: TierBadgeProps) {
  const config = TIER_CONFIG[tier || 'UNKNOWN'] || TIER_CONFIG.UNKNOWN;

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        'font-mono text-[9px] font-bold',
        config.color,
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      {config.label}
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <div className="font-semibold">{config.label} Cap</div>
          <div className="text-muted-foreground text-xs">
            {config.description}
          </div>
          <div className="text-muted-foreground text-[10px] italic">
            {config.examples}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface VolumeFireProps {
  relativeVolume?: number;
  isHighVolume?: boolean;
  className?: string;
  showTooltip?: boolean;
}

export function VolumeFire({
  relativeVolume,
  isHighVolume,
  className,
  showTooltip = true,
}: VolumeFireProps) {
  // Only show if high volume or relativeVolume > 1.5
  const shouldShow = isHighVolume || (relativeVolume && relativeVolume >= 1.5);
  if (!shouldShow) return null;

  const intensity =
    relativeVolume && relativeVolume >= 3
      ? 'extreme'
      : relativeVolume && relativeVolume >= 2
        ? 'high'
        : 'elevated';

  const config = {
    extreme: {
      color: 'text-red-500',
      bgColor: 'bg-red-500/20',
      flames: 3,
      label: 'EXTREME',
      description: 'Trading at 3x+ normal volume. Major activity detected!',
    },
    high: {
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/20',
      flames: 2,
      label: 'HIGH',
      description:
        'Trading at 2x+ normal volume. Significant interest detected.',
    },
    elevated: {
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/20',
      flames: 1,
      label: 'ELEVATED',
      description: 'Trading above normal volume. Watch for developments.',
    },
  }[intensity];

  const fireIcon = (
    <div
      className={cn(
        'flex items-center gap-0.5 rounded px-1 py-0.5',
        config.bgColor,
        className
      )}
    >
      {Array.from({ length: config.flames }).map((_, i) => (
        <Flame key={i} className={cn('h-3 w-3', config.color)} />
      ))}
      <span className={cn('text-[9px] font-bold', config.color)}>
        {relativeVolume ? `${relativeVolume.toFixed(1)}x` : config.label}
      </span>
    </div>
  );

  if (!showTooltip) return fireIcon;

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{fireIcon}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-semibold">
            <Flame className={cn('h-4 w-4', config.color)} />
            {config.label} Volume
          </div>
          <div className="text-muted-foreground text-xs">
            {config.description}
          </div>
          {relativeVolume && (
            <div className="text-muted-foreground text-[10px]">
              Current:{' '}
              <span className="font-mono">{relativeVolume.toFixed(2)}x</span> vs
              10-day average
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface ThresholdInfoProps {
  threshold?: number;
  tierName?: string;
  className?: string;
}

export function ThresholdInfo({
  threshold,
  tierName,
  className,
}: ThresholdInfoProps) {
  if (!threshold) return null;

  const formatThreshold = (val: number) => {
    if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}B`;
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(0)}M`;
    return `${(val / 1_000).toFixed(0)}K`;
  };

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'text-muted-foreground cursor-help text-[9px] underline decoration-dotted',
            className
          )}
        >
          ≥{formatThreshold(threshold)}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <div className="font-semibold">Dynamic Whale Threshold</div>
          <div className="text-muted-foreground text-xs">
            Trades ≥{' '}
            <span className="font-mono">{formatThreshold(threshold)}</span> IDR
            are classified as whales for this{' '}
            <span className="font-semibold">{tierName || 'UNKNOWN'}</span> cap
            stock.
          </div>
          <div className="text-muted-foreground text-[10px] italic">
            Threshold is based on market cap, daily volume, and current trading
            activity.
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface VwapIndicatorProps {
  tradePrice: number;
  vwap?: number | null;
  action: 'buy' | 'sell';
  className?: string;
}

export function VwapIndicator({
  tradePrice,
  vwap,
  action,
  className,
}: VwapIndicatorProps) {
  if (!vwap || vwap <= 0) return null;

  const deviation = ((tradePrice - vwap) / vwap) * 100;
  const isAboveVwap = deviation > 0;
  const isBuy = action === 'buy';

  // Determine significance
  const isAggressive =
    (isBuy && isAboveVwap) || // Buy above VWAP = aggressive buy
    (!isBuy && !isAboveVwap); // Sell below VWAP = aggressive sell

  const isVeryAggressive = Math.abs(deviation) >= 2;

  const config = isAggressive
    ? {
        color: isBuy ? 'text-green-500' : 'text-red-500',
        bgColor: isBuy ? 'bg-green-500/20' : 'bg-red-500/20',
        icon: isAboveVwap ? '▲' : '▼',
        label: isVeryAggressive ? 'Very Aggressive' : 'Aggressive',
        description: isBuy
          ? 'Buyer willing to pay above average price - shows urgency'
          : 'Seller dumping below average price - shows urgency',
      }
    : {
        color: 'text-muted-foreground',
        bgColor: 'bg-muted/50',
        icon: isAboveVwap ? '▲' : '▼',
        label: 'Passive',
        description: isBuy
          ? 'Buyer getting good price below VWAP'
          : 'Seller getting good price above VWAP',
      };

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center gap-0.5 rounded px-1 text-[9px] font-bold',
            config.bgColor,
            config.color,
            className
          )}
        >
          {config.icon}
          {Math.abs(deviation).toFixed(1)}%
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <div className="font-semibold">
            {config.label} {isBuy ? 'Buy' : 'Sell'}
          </div>
          <div className="text-muted-foreground text-xs">
            {config.description}
          </div>
          <div className="text-muted-foreground grid grid-cols-2 gap-2 text-[10px]">
            <div>
              Trade Price:{' '}
              <span className="font-mono">{tradePrice.toLocaleString()}</span>
            </div>
            <div>
              VWAP: <span className="font-mono">{vwap.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface MomentumAlignmentProps {
  dominantAction: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL';
  macd?: number | null;
  className?: string;
}

export function MomentumAlignment({
  dominantAction,
  macd,
  className,
}: MomentumAlignmentProps) {
  if (macd === null || macd === undefined || dominantAction === 'NEUTRAL')
    return null;

  const isBullish = macd > 0;
  const isAccumulation = dominantAction === 'ACCUMULATION';

  // Check if whale action aligns with momentum
  const isAligned =
    (isAccumulation && isBullish) || (!isAccumulation && !isBullish);

  const config = isAligned
    ? {
        icon: '✓',
        color: 'text-green-500',
        bgColor: 'bg-green-500/20',
        label: 'Aligned',
        description: isAccumulation
          ? 'Whale accumulation aligns with bullish momentum (MACD > 0)'
          : 'Whale distribution aligns with bearish momentum (MACD < 0)',
      }
    : {
        icon: '⚠',
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500/20',
        label: 'Divergent',
        description: isAccumulation
          ? 'Whale accumulation against bearish momentum - watch closely'
          : 'Whale distribution against bullish momentum - potential trap',
      };

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center gap-0.5 rounded px-1 text-[9px] font-bold',
            config.bgColor,
            config.color,
            className
          )}
        >
          {config.icon} MACD
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <div className="font-semibold">Momentum {config.label}</div>
          <div className="text-muted-foreground text-xs">
            {config.description}
          </div>
          <div className="text-muted-foreground text-[10px]">
            MACD: <span className="font-mono">{macd.toFixed(2)}</span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
