import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { BrowserRouter } from 'react-router-dom';

import { AuthSessionProvider } from '../../processes/auth-session/AuthSessionContext';
import { env } from '../../shared/config/env';
import i18n from '../../shared/i18n/i18n';
import { OfflineMutationProvider } from '../../shared/lib/offlineMutationQueue';

const queryClient = new QueryClient();

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <AuthSessionProvider>
          <OfflineMutationProvider>
            <BrowserRouter basename={env.appBasePath}>{children}</BrowserRouter>
          </OfflineMutationProvider>
        </AuthSessionProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
}
