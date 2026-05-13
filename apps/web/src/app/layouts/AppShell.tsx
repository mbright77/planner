import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@planner/api-client';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Calendar01Icon,
  Home01Icon,
  Logout02Icon,
  Restaurant01Icon,
  ShoppingCart01Icon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
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
  const icon =
    name === 'home'
      ? Home01Icon
      : name === 'calendar'
        ? Calendar01Icon
        : name === 'meals'
          ? Restaurant01Icon
          : name === 'shopping'
            ? ShoppingCart01Icon
            : name === 'family'
              ? UserGroupIcon
              : Logout02Icon;

  return <HugeiconsIcon icon={icon} aria-hidden="true" color="currentColor" strokeWidth={2} className="size-5 text-current" />;
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
    <div className="grid min-h-screen min-w-0 grid-rows-[auto_1fr_auto]">
      <a
        className="absolute top-4 left-4 z-20 -translate-y-16 rounded-xl border border-border bg-card px-4 py-3 shadow-sm transition-transform focus:translate-y-0"
        href="#main-content"
      >
        {t('skipToContent')}
      </a>
      <header className="sticky top-0 z-10 flex w-full min-w-0 items-center justify-between gap-4 border-b border-border/70 bg-background/95 px-5 py-4 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground"
            aria-hidden="true"
          >
            {familyName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">{familyName}</p>
            <h1 className="truncate text-lg font-semibold text-foreground">{currentPage.title}</h1>
            <p className="truncate text-sm text-muted-foreground">
              {currentPage.eyebrow} · {t(`roles.${membershipRole.toLowerCase()}`, membershipRole)}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          type="button"
          aria-label={t('signOut')}
          className="text-foreground hover:text-foreground"
          onClick={clearSession}
        >
          <AppIcon name="signout" />
        </Button>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-6xl min-w-0 px-4 pb-24 md:px-6 md:pb-6" tabIndex={-1}>
        {!isOnline ? (
          <div className="mt-4 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground" role="status" aria-live="polite">
            {t('status.offlineMode')}
          </div>
        ) : null}
        {isOnline && pendingCount > 0 ? (
          <div className="mt-4 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground" role="status" aria-live="polite">
            {isFlushing
              ? t('status.syncing', { count: pendingCount })
              : t('status.waiting', { count: pendingCount })}
          </div>
        ) : null}
        {hasBlockingFailure ? (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
            {latestFailureMessage ?? t('status.needsAttention', { count: failedCount })}
          </div>
        ) : null}
        {bootstrapQuery.isLoading ? (
          <div className="mt-4 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground" role="status" aria-live="polite">
            {t('status.loadingFamilyData')}
          </div>
        ) : null}
        {bootstrapQuery.isError ? (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
            {t('status.bootstrapError')}
          </div>
        ) : null}
        <Outlet />
      </main>

      <nav
        className="fixed right-0 bottom-0 left-0 z-10 mx-auto grid w-full max-w-6xl grid-cols-5 border-t border-border bg-card/95 dark:bg-background/90 px-2 py-2 backdrop-blur md:static md:mt-4 md:mb-6 md:rounded-2xl md:border md:shadow-sm"
        aria-label={t('nav.primaryAria')}
      >
        {navigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              isActive
                ? 'rounded-xl bg-primary text-primary-foreground'
                : 'rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground'
            }
          >
            <span className="flex flex-col items-center gap-1 px-1 py-2 text-xs font-medium">
              <AppIcon name={item.icon} />
              <span>{t(item.labelKey)}</span>
            </span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
