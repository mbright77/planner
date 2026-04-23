import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from './AppShell';

const clearSession = vi.fn();
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
  useBootstrap: () => ({
    data: {
      familyName: 'Test Family',
      membership: { role: 'Admin' },
    },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('../../shared/lib/offlineMutationQueue', () => ({
  useOfflineMutationState: () => offlineMutationState,
}));

vi.mock('../../shared/lib/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: false }),
}));

afterEach(() => {
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
});
