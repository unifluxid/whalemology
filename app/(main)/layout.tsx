'use client';

import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Header } from '@/components/whalemology/Header';
import { DatafeedProvider } from '@/lib/datafeed';
import { AuthProvider } from '@/providers';
import { useAuthStore } from '@/store';
import '../../styles/globals.css';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { token, user } = useAuthStore();

  return (
    <AuthProvider>
      <DatafeedProvider token={token} userId={user?.id} enabled={!!token}>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <Header />
            <div className="flex h-[calc(100vh-4rem)] flex-1 flex-col gap-4">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </DatafeedProvider>
    </AuthProvider>
  );
}
