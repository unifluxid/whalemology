'use client';

import { useOpenLow } from '@/hooks/use-open-low';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Loader2, ExternalLink, Info, AlertCircle } from 'lucide-react';
import { useMemo } from 'react';

export default function OpenLowPage() {
  const { token } = useAuthStore();
  const {
    scan,
    loading,
    results,
    scannedCount,
    totalCandidates,
    candidates,
    status,
    lastUpdated,
    currentSymbol,
  } = useOpenLow(token);

  const progress =
    totalCandidates > 0 ? (scannedCount / totalCandidates) * 100 : 0;

  // Always sort by Value (Desc)
  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => b.value - a.value);
  }, [results]);

  const sortedCandidates = useMemo(() => {
    return [...candidates].sort((a, b) => b.value - a.value);
  }, [candidates]);

  const handleScan = () => {
    scan();
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Open = Low Scanner
          </h1>
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground">
              Find stocks where the opening price is the lowest price of the
              day.
            </p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="text-muted-foreground hover:text-foreground h-4 w-4 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>
                    <strong>Open = Low Strategy</strong>
                    <br />
                    Indicates strong buying pressure from the opening bell. If
                    Open Price equals Low Price, sellers failed to push price
                    down, often signaling a bullish day.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Button onClick={handleScan} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Start Scan
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Candidates Found
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{totalCandidates}</div>
              {lastUpdated && (
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500"></span>
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString()}`
                : 'Initializing...'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scanned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scannedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {results.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="text-muted-foreground truncate text-sm"
              title={status}
            >
              {status}
            </div>
            {currentSymbol && (
              <div className="text-muted-foreground mt-1 animate-pulse text-xs">
                Checking {currentSymbol}...
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {loading && (
        <div className="space-y-2">
          <div className="text-muted-foreground text-sm">
            Progress: {Math.round(progress)}%
          </div>
          <Progress value={progress} className="w-full" />
        </div>
      )}

      <Tabs defaultValue="matches" className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="matches">
              Matches ({results.length})
            </TabsTrigger>
            <TabsTrigger value="queue">
              Candidate Queue ({totalCandidates})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="matches" className="mt-0 flex-1">
          <Card className="flex h-full flex-1 flex-col">
            <CardHeader className="border-b py-2">
              <CardTitle className="text-sm">Verified Matches</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center">
                        <div className="text-muted-foreground flex flex-col items-center justify-center space-y-2">
                          {loading ? (
                            <>
                              <Loader2 className="h-8 w-8 animate-spin" />
                              <p>Scanning market data...</p>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-8 w-8 opacity-50" />
                              <p className="font-medium">No results found</p>
                              <p className="mx-auto max-w-xs text-xs">
                                Try adjusting your filters (min change/volume)
                                or wait for market movements. Click &quot;Start
                                Scan&quot; to check current candidates.
                              </p>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedResults.map((item) => (
                      <TableRow key={item.symbol}>
                        <TableCell className="font-medium">
                          <a
                            href={`https://stockbit.com/symbol/${item.symbol}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-blue-500 hover:underline"
                          >
                            {item.symbol}
                            <ExternalLink className="h-3 w-3 opacity-50" />
                          </a>
                        </TableCell>
                        <TableCell>{item.priceFormatted}</TableCell>
                        <TableCell>
                          <span
                            className={
                              item.change > 0
                                ? 'font-bold text-green-600'
                                : item.change < 0
                                  ? 'font-bold text-red-600'
                                  : 'text-muted-foreground'
                            }
                          >
                            {item.change > 0 ? '+' : ''}
                            {item.change} ({item.changePercent.toFixed(2)}%)
                          </span>
                        </TableCell>
                        <TableCell className="font-mono">
                          {item.volume}
                        </TableCell>
                        <TableCell className="font-mono">
                          {item.valueFormatted}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="bg-green-100 text-green-800 hover:bg-green-100"
                          >
                            OPEN = LOW
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queue" className="mt-0 flex-1">
          <Card className="flex h-full flex-1 flex-col">
            <CardHeader className="border-b py-2">
              <CardTitle className="text-sm">Candidates being Polled</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-muted-foreground h-32 text-center"
                      >
                        No candidates found yet. Waiting for poll...
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedCandidates.map((item) => (
                      <TableRow key={item.symbol}>
                        <TableCell className="font-medium">
                          <a
                            href={`https://stockbit.com/symbol/${item.symbol}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-blue-500 hover:underline"
                          >
                            {item.symbol}
                            <ExternalLink className="h-3 w-3 opacity-50" />
                          </a>
                        </TableCell>
                        <TableCell>{item.priceFormatted}</TableCell>
                        <TableCell>
                          <span
                            className={
                              item.change > 0
                                ? 'font-medium text-green-600'
                                : item.change < 0
                                  ? 'font-medium text-red-600'
                                  : 'text-muted-foreground'
                            }
                          >
                            {item.changePercent.toFixed(2)}%
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.volume}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.valueFormatted}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-muted-foreground text-xs">
                            Pending Scan
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
