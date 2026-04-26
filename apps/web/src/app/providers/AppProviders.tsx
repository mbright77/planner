import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

import { AuthSessionProvider } from '../../processes/auth-session/AuthSessionContext';
import { env } from '../../shared/config/env';
import { OfflineMutationProvider } from '../../shared/lib/offlineMutationQueue';

const queryClient = new QueryClient();

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthSessionProvider>
        <OfflineMutationProvider>
          <BrowserRouter basename={env.appBasePath}>{children}</BrowserRouter>
        </OfflineMutationProvider>
      </AuthSessionProvider>
    </QueryClientProvider>
  );
}
