import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

import { AuthSessionProvider } from '../../processes/auth-session/AuthSessionContext';

const queryClient = new QueryClient();

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthSessionProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </AuthSessionProvider>
    </QueryClientProvider>
  );
}
