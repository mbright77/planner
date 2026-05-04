import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@planner/api-client';

import { AppShell } from './AppShell';

const clearSession = vi.fn();
const networkState = { isOnline: false };
const bootstrapState: {
  data:
    | {
      familyName: string;
      membership: { role: string; userId: string };
      memberships: Array<{ role: string; userId: string; profileId: string; canPlanMeals: boolean }>;
      profiles: Array<{
        id: string;
        displayName: string;
        colorKey: string;
        isActive: boolean;
        hasLogin: boolean;
        linkedUserId: string;
        preferredLanguage: string;
      }>;
    }
    | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
} = {
  data: {
    familyName: 'Test Family',
    membership: { role: 'Admin', userId: 'user-1' },
    memberships: [{ role: 'Admin', userId: 'user-1', profileId: 'profile-1', canPlanMeals: true }],
    profiles: [
      {
        id: 'profile-1',
        displayName: 'Test User',
        colorKey: 'blue',
        isActive: true,
        hasLogin: true,
        linkedUserId: 'user-1',
        preferredLanguage: 'en',
      },
    ],
  },
  isLoading: false,
  isError: false,
  error: null as Error | null,
};
const offlineMutationState = {
  pendingCount: 0,
  failedCount: 0,
  isFlushing: false,
  hasBlockingFailure: false,
  latestFailureMessage: null as string | null,
};

vi.mock('../../processes/auth-session/AuthSessionContext', () => ({
  useAuthSession: () => ({ clearSession }),
}));

vi.mock('../../processes/family-bootstrap/useBootstrap', () => ({
  useBootstrap: () => bootstrapState,
}));

vi.mock('../../shared/lib/offlineMutationQueue', () => ({
  useOfflineMutationState: () => offlineMutationState,
}));

vi.mock('../../shared/lib/useNetworkStatus', () => ({
  useNetworkStatus: () => networkState,
}));

afterEach(() => {
  clearSession.mockReset();
  networkState.isOnline = false;
  bootstrapState.data = {
    familyName: 'Test Family',
    membership: { role: 'Admin', userId: 'user-1' },
    memberships: [{ role: 'Admin', userId: 'user-1', profileId: 'profile-1', canPlanMeals: true }],
    profiles: [
      {
        id: 'profile-1',
        displayName: 'Test User',
        colorKey: 'blue',
        isActive: true,
        hasLogin: true,
        linkedUserId: 'user-1',
        preferredLanguage: 'en',
      },
    ],
  };
  bootstrapState.isLoading = false;
  bootstrapState.isError = false;
  bootstrapState.error = null;
  offlineMutationState.pendingCount = 0;
  offlineMutationState.failedCount = 0;
  offlineMutationState.isFlushing = false;
  offlineMutationState.hasBlockingFailure = false;
  offlineMutationState.latestFailureMessage = null;
  cleanup();
});

describe('AppShell', () => {
  it('renders a skip link and main landmark', () => {
    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('announces offline state with a polite status region', () => {
    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Offline mode: showing cached planner data when available.');
  });

  it('shows an alert when offline sync needs manual attention', () => {
    offlineMutationState.failedCount = 1;
    offlineMutationState.hasBlockingFailure = true;
    offlineMutationState.latestFailureMessage = 'An offline change conflicted with newer planner data and needs review.';

    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'An offline change conflicted with newer planner data and needs review.',
    );
  });

  it('clears session when bootstrap returns unauthorized while online', async () => {
    networkState.isOnline = true;
    bootstrapState.data = undefined;
    bootstrapState.isError = true;
    bootstrapState.error = new ApiError(401, 'Unauthorized');

    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    );

    await waitFor(() => expect(clearSession).toHaveBeenCalledTimes(1));
  });
});
