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
  const glyph =
    name === 'home'
      ? 'home'
      : name === 'calendar'
        ? 'calendar_month'
        : name === 'meals'
          ? 'restaurant'
          : name === 'shopping'
            ? 'checklist'
            : name === 'family'
              ? 'family_restroom'
              : 'logout';

  return (
    <span className="material-symbols-outlined" aria-hidden="true">
      {glyph}
    </span>
  );
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
          <div className="topbar-copy">
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
