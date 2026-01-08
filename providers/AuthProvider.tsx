'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store';

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider handles Zustand hydration and auth state management.
 * - Waits for store hydration before rendering children
 * - Redirects unauthenticated users to /login
 * - Allows already-logged-in users to bypass login page
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);
  const { token } = useAuthStore();

  // Wait for Zustand persist to rehydrate
  useEffect(() => {
    const checkHydration = () => {
      if (useAuthStore.persist.hasHydrated()) {
        setHydrated(true);
      }
    };

    // Check immediately (might already be hydrated)
    checkHydration();

    // Also listen for finish hydration event
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });

    return () => unsubscribe();
  }, []);

  // Handle auth redirects after hydration
  useEffect(() => {
    if (!hydrated) return;

    // If no token and not already on login page, redirect to login
    if (!token && pathname !== '/login') {
      router.replace('/login');
    }
  }, [hydrated, token, pathname, router]);

  // Show loading while hydrating
  if (!hydrated) {
    return (
      <div className="bg-background text-foreground flex min-h-screen items-center justify-center">
        <div className="flex animate-pulse flex-col items-center">
          <div className="border-primary mb-4 h-12 w-12 animate-spin rounded-full border-4 border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
