'use client';

import * as React from 'react';
import {
  Activity,
  LayoutDashboard,
  MonitorSmartphoneIcon,
  TrendingUp,
} from 'lucide-react';

import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { TeamSwitcher } from '@/components/team-switcher';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';

// Whalemology Data
const data = {
  user: {
    name: 'User',
    email: 'user@whalemology.com',
    avatar: '',
  },
  teams: [
    {
      name: 'Whalemology',
      logo: MonitorSmartphoneIcon,
      plan: 'Enterprise',
    },
  ],
  navMain: [
    {
      title: 'Dashboard',
      url: '/whalemology',
      icon: LayoutDashboard,
      isActive: true,
      items: [
        {
          title: 'Overview',
          url: '/whalemology',
        },
      ],
    },
    {
      title: 'Market Data',
      url: '/running-trade',
      icon: Activity,
      isActive: true,
      items: [
        {
          title: 'Running Trade',
          url: '/running-trade',
        },
      ],
    },
    {
      title: 'Strategies',
      url: '/open-low',
      icon: TrendingUp,
      isActive: true,
      items: [
        {
          title: 'Open = Low',
          url: '/open-low',
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
