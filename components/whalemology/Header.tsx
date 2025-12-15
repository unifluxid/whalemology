'use client';

import { usePathname } from 'next/navigation';
import { Slash, Activity, Moon, Sun } from 'lucide-react';
import { useEffect } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useConfigStore } from '@/store';

export function Header() {
  const pathname = usePathname();
  const { pollInterval, setPollInterval, theme, setTheme } = useConfigStore();

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Simple logic to determine title based on path
  const getPageTitle = (path: string) => {
    if (path === '/whalemology' || path.startsWith('/whalemology'))
      return 'Dashboard';
    if (path === '/running-trade') return 'Running Trade';
    return 'Whalemology';
  };

  const title = getPageTitle(pathname);

  return (
    <header className="bg-background/50 sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b backdrop-blur-sm transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex flex-1 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink
                href="/whalemology"
                className="text-muted-foreground hover:text-foreground"
              >
                Whalemology
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block">
              <Slash />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage className="text-foreground font-medium">
                {title}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex items-center gap-4 px-4">
        {/* Interval Selector */}
        <div className="flex items-center gap-2">
          <Select
            value={pollInterval.toString()}
            onValueChange={(val) => setPollInterval(parseInt(val))}
          >
            <SelectTrigger className="h-8 w-[130px] text-xs [&>span]:flex-1 [&>span]:text-left">
              <Activity className="h-4 w-4" />
              <SelectValue placeholder="Interval" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1000">1s (Fast)</SelectItem>
              <SelectItem value="3000">3s (Normal)</SelectItem>
              <SelectItem value="5000">5s (Slow)</SelectItem>
              <SelectItem value="10000">10s (Relax)</SelectItem>
              <SelectItem value="60000">1m (Manual)</SelectItem>
              <SelectItem value="300000">5m (Lazy)</SelectItem>
              <SelectItem value="600000">10m (Dev)</SelectItem>
              <SelectItem value="999999999">Stop</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Theme Toggle */}
        <div className="flex items-center gap-2">
          <Sun className="text-muted-foreground h-4 w-4" />
          <Switch
            checked={theme === 'dark'}
            onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
          />
          <Moon className="text-muted-foreground h-4 w-4" />
        </div>
      </div>
    </header>
  );
}
