import { useState, useCallback, useRef } from 'react';
import {
  getOpenLowCandidates,
  verifyOpenLow,
  OpenLowCandidate,
} from '@/services/open-low-service';

export interface ScannedResult extends OpenLowCandidate {
  isValid: boolean;
}

export function useOpenLow(token: string | null) {
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<OpenLowCandidate[]>([]);
  const [results, setResults] = useState<ScannedResult[]>([]);
  const [scannedCount, setScannedCount] = useState(0);
  const [status, setStatus] = useState<string>('Idle');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [currentSymbol, setCurrentSymbol] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Scan logic: Fetch -> Filter -> Verify
  const scan = useCallback(async () => {
    if (!token) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setResults([]);
    setCandidates([]); // Clear previous candidates
    setScannedCount(0);
    setCurrentSymbol(null);
    setStatus('Fetching market data...');

    try {
      // 1. Fetch Fresh Candidates (Top Gainers)
      const rawCandidates = await getOpenLowCandidates(token);
      // Don't set state yet, wait for filter

      if (rawCandidates.length === 0) {
        setStatus('No candidates found from API.');
        setLoading(false);
        return;
      }

      // 2. Smart Filter
      const candidatesToScan = rawCandidates.filter((c) => {
        // Must be "Green" (Change >= 0)
        if (c.change < 0) return false;
        // Minimum Transaction Value > 1 Billion IDR
        if (c.value < 1_000_000_000) return false;
        return true;
      });

      // Sort by Value (Desc)
      candidatesToScan.sort((a, b) => b.value - a.value);

      // Update candidates state with ONLY the filtered list
      setCandidates(candidatesToScan);
      setLastUpdated(new Date());

      if (candidatesToScan.length === 0) {
        setStatus('No candidates match Smart Filters (Value > 1B, Green).');
        setLoading(false);
        return;
      }

      setStatus(
        `Scanning ${candidatesToScan.length} high-quality candidates...`
      );

      // 3. Verify Candidates
      for (const candidate of candidatesToScan) {
        if (abortControllerRef.current?.signal.aborted) break;

        setCurrentSymbol(candidate.symbol);
        setStatus(`Checking ${candidate.symbol}...`);

        // Verify using Orderbook API
        const isValid = await verifyOpenLow(candidate.symbol, token);

        if (isValid) {
          const result: ScannedResult = { ...candidate, isValid: true };
          setResults((prev) => [...prev, result]);
        }

        setScannedCount((prev) => prev + 1);
      }

      setStatus(
        abortControllerRef.current?.signal.aborted
          ? 'Scan cancelled'
          : 'Scan complete'
      );
    } catch (error) {
      console.error('Scan failed', error);
      setStatus('Scan failed');
    } finally {
      setCurrentSymbol(null);
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  }, [token]);

  // Remove polling effect entirely

  return {
    scan,
    loading,
    results,
    scannedCount,
    totalCandidates: candidates.length,
    candidates,
    status,
    lastUpdated,
    currentSymbol,
  };
}
