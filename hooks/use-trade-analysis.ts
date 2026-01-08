import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TradeItem } from '@/lib/stockbit-types';
import {
  StockAnomaly,
  aggregateStockAnomalies,
  AggregateStockAnomaliesOptions,
} from '@/lib/trade-analysis';

interface AnalysisFilters {
  minConfidenceScore: number;
  minTotalValue: number;
  showOnlyWhales: boolean;
}

interface UseTradeAnalysisProps {
  trades: TradeItem[] | null;
  filters: AnalysisFilters;
  options?: AggregateStockAnomaliesOptions;
}

interface UseTradeAnalysisResult {
  anomalies: StockAnomaly[];
  isAnalyzing: boolean;
  progress: number; // 0-100
  tradeCount: number;
  lastAnalyzedAt: number; // timestamp of last completed analysis
}

// Minimum trades before switching to async chunked processing
const MIN_TRADES_FOR_ASYNC = 5_000;
// Debounce delay for analysis (ms)
const ANALYSIS_DEBOUNCE_MS = 300;

/**
 * Hook for analyzing trades with progress tracking.
 * Uses interval-based analysis to handle high-frequency data (100+ trades/sec).
 * Analysis runs every 2 seconds using latest data snapshot.
 */
export function useTradeAnalysis({
  trades,
  filters,
  options = {},
}: UseTradeAnalysisProps): UseTradeAnalysisResult {
  const [anomalies, setAnomalies] = useState<StockAnomaly[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState(0);

  // Refs
  const tradesRef = useRef<TradeItem[] | null>(null);
  const filtersRef = useRef(filters);
  const analysisIdRef = useRef(0); // Track current analysis to cancel stale ones
  const cancelRef = useRef(false); // Flag to cancel in-progress analysis
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs updated inside useEffect to avoid updating refs during render
  useEffect(() => {
    tradesRef.current = trades;
    filtersRef.current = filters;
  });

  const { minConfidenceScore, minTotalValue, showOnlyWhales } = filters;

  // Memoize options to prevent issues
  const stableOptions = useMemo(
    () => ({ hideBrokerNames: options.hideBrokerNames ?? false }),
    [options.hideBrokerNames]
  );

  // Core analysis function (doesn't depend on trades directly)
  const executeAnalysis = useCallback(async () => {
    const currentTrades = tradesRef.current;

    if (!currentTrades || currentTrades.length === 0) {
      setAnomalies([]);
      setIsAnalyzing(false);
      setProgress(0);
      return;
    }

    const currentAnalysisId = ++analysisIdRef.current;
    cancelRef.current = false;
    setIsAnalyzing(true);

    const tradeCount = currentTrades.length;

    // For smaller datasets, run synchronously
    if (tradeCount < MIN_TRADES_FOR_ASYNC) {
      setProgress(50);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const allAnomalies = aggregateStockAnomalies(
        currentTrades,
        stableOptions
      );
      const filtered = filterAnomalies(
        allAnomalies,
        minConfidenceScore,
        minTotalValue,
        showOnlyWhales
      );

      if (currentAnalysisId === analysisIdRef.current && !cancelRef.current) {
        setAnomalies(filtered);
        setProgress(100);
        setIsAnalyzing(false);
        setLastAnalyzedAt(Date.now());
      }
      return;
    }

    // For large datasets, process in chunks with yielding
    setProgress(0);

    // Group trades by symbol
    const stocksMap = new Map<string, TradeItem[]>();
    for (const t of currentTrades) {
      let list = stocksMap.get(t.code);
      if (!list) {
        list = [];
        stocksMap.set(t.code, list);
      }
      list.push(t);
    }

    const symbols = Array.from(stocksMap.keys());
    const totalSymbols = symbols.length;
    const results: StockAnomaly[] = [];

    // Process ~50 symbols per batch for smooth progress
    const batchSize = Math.max(10, Math.ceil(totalSymbols / 20));
    let processedSymbols = 0;

    for (let i = 0; i < totalSymbols; i += batchSize) {
      if (cancelRef.current || currentAnalysisId !== analysisIdRef.current) {
        return; // Cancelled
      }

      const batchSymbols = symbols.slice(i, i + batchSize);

      for (const symbol of batchSymbols) {
        const symbolTrades = stocksMap.get(symbol)!;
        const symbolAnomalies = aggregateStockAnomalies(
          symbolTrades,
          stableOptions
        );
        results.push(...symbolAnomalies);
      }

      processedSymbols += batchSymbols.length;
      setProgress(Math.round((processedSymbols / totalSymbols) * 100));

      // Yield to UI thread
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // Final filtering and update
    if (currentAnalysisId === analysisIdRef.current && !cancelRef.current) {
      const filtered = filterAnomalies(
        results,
        minConfidenceScore,
        minTotalValue,
        showOnlyWhales
      );
      filtered.sort((a, b) => b.totalVolume - a.totalVolume);

      setAnomalies(filtered);
      setProgress(100);
      setIsAnalyzing(false);
      setLastAnalyzedAt(Date.now());
    }
  }, [minConfidenceScore, minTotalValue, showOnlyWhales, stableOptions]);

  // Debounced trigger - waits for data to settle before analyzing
  const triggerAnalysis = useCallback(() => {
    // Clear any pending analysis
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Cancel any in-progress analysis
    cancelRef.current = true;

    // Schedule new analysis after debounce
    debounceTimerRef.current = setTimeout(() => {
      executeAnalysis();
    }, ANALYSIS_DEBOUNCE_MS);
  }, [executeAnalysis]);

  // Trigger analysis when trades change (debounced)
  useEffect(() => {
    triggerAnalysis();

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      cancelRef.current = true;
    };
  }, [trades?.length, triggerAnalysis]); // Only re-trigger when trade COUNT changes

  // Re-run immediately when filters change (no debounce)
  useEffect(() => {
    // Schedule analysis on next tick to avoid cascading renders
    const timeoutId = setTimeout(() => {
      executeAnalysis();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [minConfidenceScore, minTotalValue, showOnlyWhales, executeAnalysis]);

  return {
    anomalies,
    isAnalyzing,
    progress,
    tradeCount: trades?.length ?? 0,
    lastAnalyzedAt,
  };
}

// Helper function to filter anomalies
function filterAnomalies(
  anomalies: StockAnomaly[],
  _minConfidenceScore: number, // Kept for API compatibility, but not used since StockAnomaly doesn't have confidenceScore
  minTotalValue: number,
  showOnlyWhales: boolean
): StockAnomaly[] {
  return anomalies.filter((anomaly) => {
    if (anomaly.totalValue < minTotalValue) return false;
    if (showOnlyWhales && anomaly.whaleCount === 0) return false;
    return true;
  });
}
