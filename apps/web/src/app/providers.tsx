'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { AuthProvider } from '@/features/auth/context/AuthContext';
import { ToastProvider } from '../components/ui/ToastProvider';
import { GuestLoginProvider } from '../components/ui/GuestLoginProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, //1분
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* 모든 페이지에서 인증 상태를 공유할 수 있도록 연결함 */}
      <AuthProvider>
        {/* 모든 페이지에서 공통 토스트를 사용할 수 있도록 연결함 */}
        <GuestLoginProvider>
          <ToastProvider>{children}</ToastProvider>
        </GuestLoginProvider>
      </AuthProvider>

      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
