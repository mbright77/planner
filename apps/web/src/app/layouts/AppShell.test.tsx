import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from './AppShell';

const clearSession = vi.fn();

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
  useOfflineMutationState: () => ({ pendingCount: 0, isFlushing: false }),
}));

vi.mock('../../shared/lib/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: false }),
}));

afterEach(() => {
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
});
