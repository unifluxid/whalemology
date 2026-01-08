'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HotStocksCard } from '@/components/whalemology/HotStocksCard';
import { WhaleComparisonCard } from '@/components/whalemology/AnomalyCard';
import { OrderFlowResult } from '@/hooks/use-order-flow';
import { Activity, Waves } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UnifiedRightPanelProps {
  data: OrderFlowResult;
  className?: string;
}

export function UnifiedRightPanel({ data, className }: UnifiedRightPanelProps) {
  return (
    <Card className={cn('flex h-full flex-col overflow-hidden', className)}>
      <Tabs defaultValue="market_action" className="flex h-full flex-col">
        <CardHeader className="border-border shrink-0 border-b px-4 py-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Market Analysis
            </CardTitle>
            <TabsList className="grid w-[200px] grid-cols-2">
              <TabsTrigger value="market_action" className="text-xs">
                <Activity className="mr-1 h-3 w-3" />
                Action
              </TabsTrigger>
              <TabsTrigger value="whale_analysis" className="text-xs">
                <Waves className="mr-1 h-3 w-3" />
                Whales
              </TabsTrigger>
            </TabsList>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          <TabsContent value="market_action" className="m-0 h-full border-0">
            {/* Pass className to ensure it fills height and removes internal card borders if needed */}
            <HotStocksCard
              data={data}
              className="h-full rounded-none border-0 shadow-none"
            />
          </TabsContent>

          <TabsContent value="whale_analysis" className="m-0 h-full border-0">
            <WhaleComparisonCard
              data={data}
              className="h-full rounded-none border-0 shadow-none"
            />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
