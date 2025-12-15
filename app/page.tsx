import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  Activity,
  Target,
  BarChart3,
  Zap,
  Shield,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import StarField from '@/components/reactbits/StarField';
import SplitText from '@/components/reactbits/SplitText';

export const metadata = {
  title: 'Whalemology - Market Intelligence Platform',
  description:
    'Advanced bandarmology and market intelligence for Indonesian stock market',
};

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <StarField
        starColor="#ffffff"
        backgroundColor="#000000"
        speed={0.05}
        count={2000}
      />
      <div className="relative z-10">
        {/* Hero Section */}
        <section className="container mx-auto px-4 pt-20 pb-16 md:pt-32 md:pb-24">
          <div className="flex flex-col items-center space-y-8 text-center">
            <Badge variant="secondary" className="px-4 py-1 text-sm">
              <Sparkles className="mr-2 h-3 w-3" />
              Market Intelligence Platform
            </Badge>

            <div className="relative mb-8 text-center">
              <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl">
                <SplitText
                  text="Master The Market with"
                  className="justify-center"
                  delay={0}
                />
                <SplitText
                  text="Whalemology"
                  className="text-primary mt-2 justify-center"
                  delay={0.5}
                />
              </h1>
            </div>

            <p className="text-muted-foreground max-w-2xl text-lg md:text-xl">
              Advanced bandarmology analysis and real-time market intelligence
              for the Indonesian stock market. Make informed decisions with
              data-driven insights.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Button asChild size="lg" className="px-8 text-lg">
                <Link href="/whalemology">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="px-8 text-lg"
              >
                <Link href="/dashboard">View Dashboard</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              Powerful Features
            </h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
              Everything you need to analyze market movements and track bandar
              activity
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="hover:border-primary/50 border-2 transition-colors">
              <CardHeader>
                <TrendingUp className="text-primary mb-2 h-10 w-10" />
                <CardTitle>Real-Time Analysis</CardTitle>
                <CardDescription>
                  Live market data and instant bandar activity detection
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Track price movements, volume spikes, and unusual trading
                  patterns as they happen.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:border-primary/50 border-2 transition-colors">
              <CardHeader>
                <Activity className="text-primary mb-2 h-10 w-10" />
                <CardTitle>Broker Activity</CardTitle>
                <CardDescription>
                  Comprehensive broker tracking and analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Monitor top broker transactions, net buy/sell, and identify
                  accumulation patterns.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:border-primary/50 border-2 transition-colors">
              <CardHeader>
                <Target className="text-primary mb-2 h-10 w-10" />
                <CardTitle>Smart Alerts</CardTitle>
                <CardDescription>
                  Customizable notifications for market events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Get notified when stocks match your criteria and trading
                  opportunities arise.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:border-primary/50 border-2 transition-colors">
              <CardHeader>
                <BarChart3 className="text-primary mb-2 h-10 w-10" />
                <CardTitle>Technical Indicators</CardTitle>
                <CardDescription>
                  Advanced charting and technical analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Comprehensive technical indicators and pattern recognition
                  tools.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:border-primary/50 border-2 transition-colors">
              <CardHeader>
                <Zap className="text-primary mb-2 h-10 w-10" />
                <CardTitle>Fast Performance</CardTitle>
                <CardDescription>
                  Lightning-fast data processing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Optimized for speed with real-time updates and minimal
                  latency.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:border-primary/50 border-2 transition-colors">
              <CardHeader>
                <Shield className="text-primary mb-2 h-10 w-10" />
                <CardTitle>Secure & Reliable</CardTitle>
                <CardDescription>Enterprise-grade security</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Your data is protected with industry-standard security
                  measures.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto mb-16 px-4 py-16">
          <Card className="bg-primary/5 border-2">
            <CardContent className="p-12 text-center">
              <h2 className="mb-4 text-3xl font-bold md:text-4xl">
                Ready to start trading smarter?
              </h2>
              <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-lg">
                Join traders who are using Whalemology to gain an edge in the
                market
              </p>
              <Button asChild size="lg" className="px-8 text-lg">
                <Link href="/whalemology">
                  Launch Platform
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Footer */}
        <footer className="bg-muted/30 border-t">
          <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
              <div className="text-center md:text-left">
                <p className="mb-1 text-sm font-semibold">Whalemology</p>
                <p className="text-muted-foreground text-xs">
                  Market Intelligence Platform © {new Date().getFullYear()}
                </p>
              </div>
              <div className="text-muted-foreground flex gap-6 text-sm">
                <Link
                  href="/whalemology"
                  className="hover:text-foreground transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/running-trade"
                  className="hover:text-foreground transition-colors"
                >
                  Running Trade
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
