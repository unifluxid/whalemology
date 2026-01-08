import { create } from 'zustand';

// Types for running trade store
export type RunningTradeKey = 'widget' | 'fastOrder' | 'company';

export enum StockFilterTypeEnum {
  AllStock = 'AllStock',
  Watchlist = 'Watchlist',
  Custom = 'Custom',
}

export interface RunningTradeStockFilter {
  type: StockFilterTypeEnum;
  selected: string[];
}

export interface RunningTradeCustomFilter {
  actionType?: 'BUY' | 'SELL' | null;
  marketBoard?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  minPercentage?: number | null;
  maxPercentage?: number | null;
  minLot?: number | null;
  minValue?: number | null; // Trade value filter (price * volume) - WS only
  maxValue?: number | null; // Trade value filter (price * volume) - WS only
}

export interface RunningTradeStoreInstance {
  stock: RunningTradeStockFilter;
  isActive: boolean;
  isQueue: boolean;
  isPaused: boolean;
  filter: RunningTradeCustomFilter | null;
  date: Date | null;
}

type RunningTradeStoreState = Record<
  RunningTradeKey,
  RunningTradeStoreInstance
>;

export interface RunningTradeStore {
  instances: RunningTradeStoreState;

  setActive: (key: RunningTradeKey, value: boolean) => void;
  setStock: (key: RunningTradeKey, value: RunningTradeStockFilter) => void;
  setFilter: (
    key: RunningTradeKey,
    value: Partial<RunningTradeCustomFilter>,
    setPartially?: boolean
  ) => void;
  setDate: (key: RunningTradeKey, value: Date | null) => void;
  play: (key: RunningTradeKey) => void;
  pause: (key: RunningTradeKey) => void;
  getSymbols: (key?: RunningTradeKey) => string[];
}

const initialInstance: RunningTradeStoreInstance = {
  stock: { type: StockFilterTypeEnum.AllStock, selected: [] },
  isActive: false,
  isQueue: false,
  isPaused: false,
  filter: null,
  date: null,
};

export const useRunningTradeStore = create<RunningTradeStore>((set, get) => ({
  instances: {
    company: { ...initialInstance },
    widget: {
      ...initialInstance,
      stock: { type: StockFilterTypeEnum.AllStock, selected: ['*'] },
    },
    fastOrder: { ...initialInstance },
  },

  setActive: (key, value) => {
    set((state) => ({
      instances: {
        ...state.instances,
        [key]: {
          ...state.instances[key],
          isActive: value,
        },
      },
    }));
  },

  setStock: (key, value) => {
    set((state) => {
      const newState = {
        instances: {
          ...state.instances,
          [key]: {
            ...state.instances[key],
            stock: value,
          },
        },
      };

      // Reset date if multiple symbols or all stocks
      if (
        value.type === StockFilterTypeEnum.AllStock ||
        value.type === StockFilterTypeEnum.Watchlist ||
        value.selected.length > 1
      ) {
        newState.instances[key].date = null;
      }

      return newState;
    });

    // Auto-play when stock changes
    get().play(key);
  },

  setFilter: (key, value, setPartially = false) => {
    set((state) => ({
      instances: {
        ...state.instances,
        [key]: {
          ...state.instances[key],
          filter: setPartially
            ? { ...state.instances[key].filter, ...value }
            : (value as RunningTradeCustomFilter),
        },
      },
    }));
  },

  setDate: (key, value) => {
    set((state) => ({
      instances: {
        ...state.instances,
        [key]: {
          ...state.instances[key],
          date: value,
        },
      },
    }));
  },

  play: (key) => {
    set((state) => ({
      instances: {
        ...state.instances,
        [key]: {
          ...state.instances[key],
          isPaused: false,
        },
      },
    }));
  },

  pause: (key) => {
    set((state) => ({
      instances: {
        ...state.instances,
        [key]: {
          ...state.instances[key],
          isPaused: true,
        },
      },
    }));
  },

  getSymbols: (key) => {
    const { instances } = get();

    if (key) {
      return instances[key]?.stock?.selected || [];
    }

    let allSymbols: string[] = [];
    Object.values(instances).forEach((instance) => {
      if (!instance.isActive) return;
      const symbols = instance.stock?.selected || [];
      allSymbols = [...allSymbols, ...symbols];
    });

    return Array.from(new Set(allSymbols));
  },
}));
