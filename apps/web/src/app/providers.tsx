'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';

/**
 * Global providers wrapper.
 * Manages React Query client with optimal settings for real-time space data.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // ISS position updates every 5s — stale immediately
            staleTime: 0,
            // But keep in cache for 30s to avoid flashes during refetch
            gcTime: 30_000,
            // Retry failed requests with exponential back-off (max 3 attempts)
            retry: 3,
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
            // Refetch on window focus for real-time data
            refetchOnWindowFocus: true,
            // Don't refetch on reconnect by default (let individual queries decide)
            refetchOnReconnect: 'always',
          },
          mutations: {
            // Don't retry mutations automatically
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env['NODE_ENV'] === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
}
