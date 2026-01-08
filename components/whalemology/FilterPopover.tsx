'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Filter, X } from 'lucide-react';

const lotOptions = [100, 200, 500, 1000, 5000];

interface FilterPopoverProps {
  // Current values
  actionTypeFilter: 'all' | 'buy' | 'sell';
  marketBoard: 'all' | 'regular' | 'cash' | 'negotiation';
  priceRangeFrom: number;
  priceRangeTo: number;
  minimumLot: number;
  timeRangeStart: string;
  timeRangeEnd: string;

  // Setters
  setActionTypeFilter: (type: 'all' | 'buy' | 'sell') => void;
  setMarketBoard: (board: 'all' | 'regular' | 'cash' | 'negotiation') => void;
  setPriceRangeFrom: (price: number) => void;
  setPriceRangeTo: (price: number) => void;
  setMinimumLot: (lot: number) => void;
  setTimeRangeStart: (time: string) => void;
  setTimeRangeEnd: (time: string) => void;

  resetFilters: () => void;

  onApply: () => void;
  onReset?: () => void; // Optional callback after internal reset
}

export function FilterPopover({
  actionTypeFilter,
  marketBoard,
  priceRangeFrom,
  priceRangeTo,
  minimumLot,
  timeRangeStart,
  timeRangeEnd,

  setActionTypeFilter,
  setMarketBoard,
  setPriceRangeFrom,
  setPriceRangeTo,
  setMinimumLot,
  setTimeRangeStart,
  setTimeRangeEnd,

  resetFilters,
  onApply,
  onReset,
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false);

  // Local state for temporary values before Apply
  const [tempActionType, setTempActionType] = useState(actionTypeFilter);
  const [tempMarketBoard, setTempMarketBoard] = useState(marketBoard);
  const [tempPriceFrom, setTempPriceFrom] = useState(priceRangeFrom);
  const [tempPriceTo, setTempPriceTo] = useState(priceRangeTo);
  const [tempMinLot, setTempMinLot] = useState(minimumLot);
  const [tempTimeStart, setTempTimeStart] = useState(timeRangeStart);
  const [tempTimeEnd, setTempTimeEnd] = useState(timeRangeEnd);

  // Sync temp values when opening popover
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setTempActionType(actionTypeFilter);
      setTempMarketBoard(marketBoard);
      setTempPriceFrom(priceRangeFrom);
      setTempPriceTo(priceRangeTo);
      setTempMinLot(minimumLot);
      setTempTimeStart(timeRangeStart);
      setTempTimeEnd(timeRangeEnd);
    }
    setOpen(isOpen);
  };

  const handleApply = () => {
    // Apply all temporary values to parent state
    setActionTypeFilter(tempActionType);
    setMarketBoard(tempMarketBoard);
    setPriceRangeFrom(tempPriceFrom);
    setPriceRangeTo(tempPriceTo);
    setMinimumLot(tempMinLot);
    setTimeRangeStart(tempTimeStart);
    setTimeRangeEnd(tempTimeEnd);

    setOpen(false);
    onApply();
  };

  const handleReset = () => {
    resetFilters();
    // Reset temp values matching defaults
    setTempActionType('all');
    setTempMarketBoard('all');
    setTempPriceFrom(0);
    setTempPriceTo(0);
    setTempMinLot(0);
    setTempTimeStart('');
    setTempTimeEnd('');

    if (onReset) onReset();
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="default" className="gap-2">
          <Filter className="h-4 w-4" />
          Filters
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-4" align="start">
        <div className="space-y-3">
          {/* Action Type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Action Type</Label>
            <div className="flex gap-1.5">
              {(['all', 'buy', 'sell'] as const).map((action) => (
                <Button
                  key={action}
                  variant={tempActionType === action ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTempActionType(action)}
                  className="h-7 flex-1 text-xs"
                >
                  {action === 'all' ? 'All' : action === 'buy' ? 'Buy' : 'Sell'}
                </Button>
              ))}
            </div>
          </div>

          {/* Market Type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Market Type</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  { value: 'all', label: 'All' },
                  { value: 'regular', label: 'Regular' },
                  { value: 'cash', label: 'Tunai' },
                  { value: 'negotiation', label: 'Nego' },
                ] as const
              ).map((board) => (
                <Button
                  key={board.value}
                  variant={
                    tempMarketBoard === board.value ? 'default' : 'outline'
                  }
                  size="sm"
                  onClick={() => setTempMarketBoard(board.value)}
                  className="h-7 text-xs"
                >
                  {board.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Price Range (Rp)</Label>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                value={tempPriceFrom || ''}
                onChange={(e) => setTempPriceFrom(Number(e.target.value))}
                placeholder="From"
                className="h-8 flex-1 text-xs"
              />
              <span className="text-muted-foreground text-xs">→</span>
              <Input
                type="number"
                value={tempPriceTo || ''}
                onChange={(e) => setTempPriceTo(Number(e.target.value))}
                placeholder="To"
                className="h-8 flex-1 text-xs"
              />
            </div>
          </div>

          {/* Minimum Lot */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Minimum Lot</Label>
            <div className="space-y-1.5">
              <Input
                type="number"
                value={tempMinLot || ''}
                onChange={(e) => setTempMinLot(Number(e.target.value) || 0)}
                placeholder="e.g., 1000"
                className="h-8 text-xs"
              />
              <div className="grid grid-cols-5 gap-1.5">
                {lotOptions.map((lot) => (
                  <Button
                    key={lot}
                    variant={tempMinLot === lot ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTempMinLot(lot)}
                    className="h-7 text-xs"
                  >
                    {lot >= 1000 ? `${lot / 1000}k` : lot}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Time Range */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Time Range</Label>
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Input
                  type="time"
                  step="1"
                  value={tempTimeStart}
                  onChange={(e) => setTempTimeStart(e.target.value)}
                  className="h-8 pr-7 text-xs [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                />
                {tempTimeStart && (
                  <button
                    onClick={() => setTempTimeStart('')}
                    className="text-foreground absolute top-1/2 right-1.5 -translate-y-1/2 hover:opacity-70"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <span className="text-muted-foreground text-xs">→</span>
              <div className="relative flex-1">
                <Input
                  type="time"
                  step="1"
                  value={tempTimeEnd}
                  onChange={(e) => setTempTimeEnd(e.target.value)}
                  className="h-8 pr-7 text-xs [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                />
                {tempTimeEnd && (
                  <button
                    onClick={() => setTempTimeEnd('')}
                    className="text-foreground absolute top-1/2 right-1.5 -translate-y-1/2 hover:opacity-70"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 flex-1"
              onClick={handleReset}
            >
              Reset
            </Button>
            <Button
              size="sm"
              className="h-8 flex-1 bg-green-600 hover:bg-green-700"
              onClick={handleApply}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
