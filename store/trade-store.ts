import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { TradeItem } from '@/lib/stockbit-types';
import { RunningTradeFilters } from '@/lib/stockbit-data';
import { enrichTrade } from '@/lib/trade-analysis';

interface TradeState {
  trades: TradeItem[];
  filters: RunningTradeFilters | null; // Store filters to validate cache
  lastUpdated: number;

  // Actions
  setTrades: (trades: TradeItem[], filters: RunningTradeFilters) => void;
  appendTrades: (newTrades: TradeItem[], filters: RunningTradeFilters) => void;
  clearTrades: () => void;
}

const MAX_STORED_TRADES = 10000;

export const useTradeStore = create<TradeState>()(
  persist(
    (set, get) => ({
      trades: [],
      filters: null,
      lastUpdated: 0,

      setTrades: (trades, filters) => {
        // Enrich trades before storing
        const enriched = trades.map(enrichTrade);
        // Enforce limit on set
        const limitedTrades = enriched.slice(0, MAX_STORED_TRADES);

        set({
          trades: limitedTrades,
          filters,
          lastUpdated: Date.now(),
        });
      },

      appendTrades: (newTrades, filters) => {
        const currentTrades = get().trades;
        const enrichedNew = newTrades.map(enrichTrade);

        // Optimistic Deduplication using Set (O(N) creation, O(1) lookup)
        const existingIds = new Set(currentTrades.map((t) => t.trade_number));

        const distinctNewItems = enrichedNew.filter(
          (newItem) => !existingIds.has(newItem.trade_number)
        );

        if (distinctNewItems.length === 0) return;

        const combinedTrades = [...distinctNewItems, ...currentTrades];
        const trimmedTrades =
          combinedTrades.length > MAX_STORED_TRADES
            ? combinedTrades.slice(0, MAX_STORED_TRADES)
            : combinedTrades;

        set({
          trades: trimmedTrades,
          filters, // Update filters just in case? Usually filters shouldn't change here
          lastUpdated: Date.now(),
        });
      },

      clearTrades: () => set({ trades: [], filters: null, lastUpdated: 0 }),
    }),
    {
      name: 'whalemology_running_trades',
      storage: createJSONStorage(() => sessionStorage),
      // Optional: partialize to assume what we save? We save everything defined in state
    }
  )
);
