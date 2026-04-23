import { NavLink, Outlet } from 'react-router-dom';

import { useAuthSession } from '../../processes/auth-session/AuthSessionContext';
import { useBootstrap } from '../../processes/family-bootstrap/useBootstrap';
import { useOfflineMutationState } from '../../shared/lib/offlineMutationQueue';
import { useNetworkStatus } from '../../shared/lib/useNetworkStatus';

const navigation = [
  { to: '/', label: 'Home' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/meals', label: 'Meals' },
  { to: '/shopping', label: 'Shopping' },
  { to: '/family', label: 'Family' },
];

export function AppShell() {
  const { clearSession } = useAuthSession();
  const bootstrapQuery = useBootstrap();
  const { pendingCount, isFlushing } = useOfflineMutationState();
  const { isOnline } = useNetworkStatus();

  const familyName = bootstrapQuery.data?.familyName ?? 'Kinship';
  const membershipRole = bootstrapQuery.data?.membership.role ?? 'Member';

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Family planner</p>
          <h1 className="topbar-title">{familyName}</h1>
          <p className="topbar-meta">{membershipRole}</p>
        </div>
        <button className="icon-button" type="button" aria-label="Sign out" onClick={clearSession}>
          <span aria-hidden="true">x</span>
        </button>
      </header>

      <main className="app-content">
        {!isOnline ? (
          <div className="status-banner status-banner-offline">
            Offline mode: showing cached planner data when available.
          </div>
        ) : null}
        {isOnline && pendingCount > 0 ? (
          <div className="status-banner status-banner-offline">
            {isFlushing
              ? `Syncing ${pendingCount} offline change${pendingCount === 1 ? '' : 's'}...`
              : `${pendingCount} offline change${pendingCount === 1 ? '' : 's'} waiting to sync.`}
          </div>
        ) : null}
        {bootstrapQuery.isLoading ? <div className="status-banner">Loading family data...</div> : null}
        {bootstrapQuery.isError ? (
          <div className="status-banner status-banner-error">
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
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
