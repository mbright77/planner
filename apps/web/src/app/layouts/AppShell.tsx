import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@planner/api-client';

import { useAuthSession } from '../../processes/auth-session/AuthSessionContext';
import { useBootstrap } from '../../processes/family-bootstrap/useBootstrap';
import { HttpError } from '../../shared/api/http';
import { useAppLanguage } from '../../shared/i18n/useAppLanguage';
import { useOfflineMutationState } from '../../shared/lib/offlineMutationQueue';
import { useNetworkStatus } from '../../shared/lib/useNetworkStatus';

const navigation = [
  { to: '/', labelKey: 'nav.home', icon: 'home' },
  { to: '/calendar', labelKey: 'nav.calendar', icon: 'calendar' },
  { to: '/meals', labelKey: 'nav.meals', icon: 'meals' },
  { to: '/shopping', labelKey: 'nav.shopping', icon: 'shopping' },
  { to: '/family', labelKey: 'nav.family', icon: 'family' },
] as const;

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
  const { t } = useTranslation('common');
  const location = useLocation();
  const { clearSession } = useAuthSession();
  const bootstrapQuery = useBootstrap();
  useAppLanguage(bootstrapQuery.data);
  const { failedCount, hasBlockingFailure, latestFailureMessage, pendingCount, isFlushing } = useOfflineMutationState();
  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    if (!isOnline || !bootstrapQuery.isError || !bootstrapQuery.error) {
      return;
    }

    const error = bootstrapQuery.error;
    const status = error instanceof ApiError || error instanceof HttpError ? error.status : null;

    if (status === 401 || status === 403) {
      clearSession();
    }
  }, [bootstrapQuery.error, bootstrapQuery.isError, clearSession, isOnline]);

  const routeMeta: Record<string, { eyebrow: string; title: string }> = {
    '/': { eyebrow: t('route.eyebrow.dashboard'), title: t('route.title.home') },
    '/calendar': { eyebrow: t('route.eyebrow.weeklyPlanner'), title: t('route.title.calendar') },
    '/meals': { eyebrow: t('route.eyebrow.weeklyMeals'), title: t('route.title.meals') },
    '/shopping': { eyebrow: t('route.eyebrow.sharedList'), title: t('route.title.shopping') },
    '/family': { eyebrow: t('route.eyebrow.profilesAndColors'), title: t('route.title.family') },
    '/settings/privacy': { eyebrow: t('route.eyebrow.accountControls'), title: t('route.title.privacy') },
  };

  const familyName = bootstrapQuery.data?.familyName ?? t('defaults.familyName');
  const membershipRole = bootstrapQuery.data?.membership.role ?? 'Member';
  const currentPage = routeMeta[location.pathname] ?? {
    eyebrow: t('route.eyebrow.familyPlanner'),
    title: t('route.title.planner'),
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t('skipToContent')}
      </a>
      <header className="topbar">
        <div className="topbar-brand">
          <div className="topbar-avatar" aria-hidden="true">
            {familyName.slice(0, 1).toUpperCase()}
          </div>
          <div className="topbar-copy">
            <p className="eyebrow topbar-eyebrow">{familyName}</p>
            <h1 className="topbar-title">{currentPage.title}</h1>
            <p className="topbar-meta">{currentPage.eyebrow} · {t(`roles.${membershipRole.toLowerCase()}`, membershipRole)}</p>
          </div>
        </div>
        <button className="icon-button" type="button" aria-label={t('signOut')} onClick={clearSession}>
          <AppIcon name="signout" />
        </button>
      </header>

      <main id="main-content" className="app-content" tabIndex={-1}>
        {!isOnline ? (
          <div className="status-banner status-banner-offline" role="status" aria-live="polite">
            {t('status.offlineMode')}
          </div>
        ) : null}
        {isOnline && pendingCount > 0 ? (
          <div className="status-banner status-banner-offline" role="status" aria-live="polite">
            {isFlushing
              ? t('status.syncing', { count: pendingCount })
              : t('status.waiting', { count: pendingCount })}
          </div>
        ) : null}
        {hasBlockingFailure ? (
          <div className="status-banner status-banner-error" role="alert">
            {latestFailureMessage ?? t('status.needsAttention', { count: failedCount })}
          </div>
        ) : null}
        {bootstrapQuery.isLoading ? <div className="status-banner" role="status" aria-live="polite">{t('status.loadingFamilyData')}</div> : null}
        {bootstrapQuery.isError ? (
          <div className="status-banner status-banner-error" role="alert">
            {t('status.bootstrapError')}
          </div>
        ) : null}
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label={t('nav.primaryAria')}>
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
            <span className="bottom-nav-label">{t(item.labelKey)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
