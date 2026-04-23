import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { useAuthSession } from '../../processes/auth-session/AuthSessionContext';
import { useBootstrap } from '../../processes/family-bootstrap/useBootstrap';
import { useOfflineMutationState } from '../../shared/lib/offlineMutationQueue';
import { useNetworkStatus } from '../../shared/lib/useNetworkStatus';

const navigation = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/meals', label: 'Meals', icon: 'meals' },
  { to: '/shopping', label: 'Shopping', icon: 'shopping' },
  { to: '/family', label: 'Family', icon: 'family' },
] as const;

const routeMeta: Record<string, { eyebrow: string; title: string }> = {
  '/': { eyebrow: 'Dashboard', title: 'Home' },
  '/calendar': { eyebrow: 'Weekly planner', title: 'Calendar' },
  '/meals': { eyebrow: 'Weekly meals', title: 'Meals' },
  '/shopping': { eyebrow: 'Shared list', title: 'Shopping' },
  '/family': { eyebrow: 'Profiles and colors', title: 'Family' },
  '/settings/privacy': { eyebrow: 'Account controls', title: 'Privacy' },
};

function AppIcon({ name }: { name: (typeof navigation)[number]['icon'] | 'signout' }) {
  switch (name) {
    case 'home':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case 'calendar':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'meals':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 3v8M9 3v8M6 7h3M15 3v18M18 3c1.7 2.2 1.7 5.8 0 8h-3V3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'shopping':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 7h14l-1.5 8.5a1 1 0 0 1-1 .8H9a1 1 0 0 1-1-.8L6 4H3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="10" cy="20" r="1.4" fill="currentColor" />
          <circle cx="17" cy="20" r="1.4" fill="currentColor" />
        </svg>
      );
    case 'family':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="9" cy="8" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="16.5" cy="9.5" r="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4.5 18a4.5 4.5 0 0 1 9 0M13 18a3.5 3.5 0 0 1 7 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'signout':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 6H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4M14 8l4 4-4 4M18 12H9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

export function AppShell() {
  const location = useLocation();
  const { clearSession } = useAuthSession();
  const bootstrapQuery = useBootstrap();
  const { failedCount, hasBlockingFailure, latestFailureMessage, pendingCount, isFlushing } = useOfflineMutationState();
  const { isOnline } = useNetworkStatus();

  const familyName = bootstrapQuery.data?.familyName ?? 'Kinship';
  const membershipRole = bootstrapQuery.data?.membership.role ?? 'Member';
  const currentPage = routeMeta[location.pathname] ?? { eyebrow: 'Family planner', title: 'Planner' };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-brand">
          <div className="topbar-avatar" aria-hidden="true">
            {familyName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="eyebrow topbar-eyebrow">{familyName}</p>
            <h1 className="topbar-title">{currentPage.title}</h1>
            <p className="topbar-meta">{currentPage.eyebrow} · {membershipRole}</p>
          </div>
        </div>
        <button className="icon-button" type="button" aria-label="Sign out" onClick={clearSession}>
          <AppIcon name="signout" />
        </button>
      </header>

      <main id="main-content" className="app-content" tabIndex={-1}>
        {!isOnline ? (
          <div className="status-banner status-banner-offline" role="status" aria-live="polite">
            Offline mode: showing cached planner data when available.
          </div>
        ) : null}
        {isOnline && pendingCount > 0 ? (
          <div className="status-banner status-banner-offline" role="status" aria-live="polite">
            {isFlushing
              ? `Syncing ${pendingCount} offline change${pendingCount === 1 ? '' : 's'}...`
              : `${pendingCount} offline change${pendingCount === 1 ? '' : 's'} waiting to sync.`}
          </div>
        ) : null}
        {hasBlockingFailure ? (
          <div className="status-banner status-banner-error" role="alert">
            {latestFailureMessage ?? `Offline sync needs attention for ${failedCount} change${failedCount === 1 ? '' : 's'}.`}
          </div>
        ) : null}
        {bootstrapQuery.isLoading ? <div className="status-banner" role="status" aria-live="polite">Loading family data...</div> : null}
        {bootstrapQuery.isError ? (
          <div className="status-banner status-banner-error" role="alert">
            Unable to load bootstrap data. Try signing in again.
          </div>
        ) : null}
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Primary">
        {navigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              isActive ? 'bottom-nav-link bottom-nav-link-active' : 'bottom-nav-link'
            }
          >
            <span className="bottom-nav-icon" aria-hidden="true">
              <AppIcon name={item.icon} />
            </span>
            <span className="bottom-nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
