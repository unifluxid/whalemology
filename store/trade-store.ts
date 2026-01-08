import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
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

// Increased to 200,000 for deep in-memory history
const MAX_STORED_TRADES = 200_000;

// Custom storage that handles quota errors gracefully
const safeSessionStorage: StateStorage = {
  getItem: (name: string) => {
    try {
      return sessionStorage.getItem(name);
    } catch {
      console.warn('[TradeStore] Failed to read from sessionStorage');
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      sessionStorage.setItem(name, value);
    } catch (error) {
      // Handle QuotaExceededError - clear old data and try again
      if (
        error instanceof DOMException &&
        error.name === 'QuotaExceededError'
      ) {
        console.warn(
          '[TradeStore] Storage quota exceeded, clearing old data...'
        );
        try {
          sessionStorage.removeItem(name);
          // Try to store with reduced data - this will be handled by the persist middleware
        } catch {
          console.warn('[TradeStore] Failed to clear storage');
        }
      }
    }
  },
  removeItem: (name: string) => {
    try {
      sessionStorage.removeItem(name);
    } catch {
      console.warn('[TradeStore] Failed to remove from sessionStorage');
    }
  },
};

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
          filters,
          lastUpdated: Date.now(),
        });
      },

      clearTrades: () => set({ trades: [], filters: null, lastUpdated: 0 }),
    }),
    {
      name: 'whalemology_running_trades',
      storage: createJSONStorage(() => safeSessionStorage),
      // IMPORTANT: Only persist filters to avoid SessionStorage quota (5MB) issues.
      // Trades are kept in memory only (up to MAX_STORED_TRADES).
      partialize: (state) => ({ filters: state.filters }),
    }
  )
);
