import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useDashboardOverview } from '../../entities/dashboard/model/useDashboardOverview';
import { useBootstrap } from '../../processes/family-bootstrap/useBootstrap';

function formatLongDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateBadge(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  }).toUpperCase();
}

function formatTimeBlock(value: string) {
  return new Date(value).toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getGreetingKey() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'greeting.morning';
  }

  if (hour < 18) {
    return 'greeting.afternoon';
  }

  return 'greeting.evening';
}

function getProfileAccentColor(colorKey: string | null | undefined) {
  if (colorKey === 'green') {
    return '#84ac8e';
  }

  if (colorKey === 'blue') {
    return '#5da9e9';
  }

  if (colorKey === 'pink') {
    return '#fd898a';
  }

  if (colorKey === 'yellow') {
    return '#f4d35e';
  }

  return 'var(--primary-container)';
}

function getProfileColorChipClass(colorKey: string | null | undefined) {
  return colorKey ? `profile-color-chip profile-color-chip-${colorKey}` : 'profile-color-chip';
}

export function HomePage() {
  const { t } = useTranslation('home');
  const bootstrapQuery = useBootstrap();
  const dashboardQuery = useDashboardOverview();
  const familyName = bootstrapQuery.data?.familyName ?? t('fallback.familyName');

  const profilesById = useMemo(() => {
    return new Map((bootstrapQuery.data?.profiles ?? []).map((profile) => [profile.id, profile]));
  }, [bootstrapQuery.data?.profiles]);

  const todayEvents = useMemo(() => {
    return [...(dashboardQuery.data?.todayEvents ?? [])].sort((left, right) => {
      return left.startAtUtc.localeCompare(right.startAtUtc);
    });
  }, [dashboardQuery.data?.todayEvents]);

  const tonightMealOwner = useMemo(() => {
    const ownerId = dashboardQuery.data?.tonightMeal?.ownerProfileId;
    if (!ownerId) {
      return null;
    }

    return profilesById.get(ownerId) ?? null;
  }, [dashboardQuery.data?.tonightMeal?.ownerProfileId, profilesById]);

  return (
    <section className="page dashboard-page">
      <div className="home-today-header">
        <div className="home-today-header-copy">
          <p className="eyebrow">{t('eyebrow')}</p>
          <h2 className="page-title">{t(getGreetingKey(), { team: t('team') })}</h2>
          <p className="page-copy">{dashboardQuery.data ? formatLongDate(dashboardQuery.data.date) : t('loadingOverview')}</p>
        </div>
        <div className="home-today-family-badge">{familyName}</div>
      </div>

      {dashboardQuery.isLoading ? <p className="page-copy">{t('loading')}</p> : null}
      {dashboardQuery.isError ? <p className="form-error">{t('error')}</p> : null}

      {dashboardQuery.data ? (
        <section className="home-today-section" aria-label={t('todayEventsAria')}>
          <div className="home-today-section-header">
            <h3 className="home-today-title">
              <span className="material-symbols-outlined home-today-title-icon" aria-hidden="true">
                calendar_month
              </span>
              {t('todayTitle')}
            </h3>
            <span className="home-today-date-badge">{formatDateBadge(dashboardQuery.data.date)}</span>
          </div>

          {todayEvents.length > 0 ? (
            <ol className="home-today-events">
              {todayEvents.map((event) => {
                const assignedProfile = event.assignedProfileId ? profilesById.get(event.assignedProfileId) : null;
                const timeBlock = formatTimeBlock(event.startAtUtc);

                return (
                  <li key={event.id} className="home-today-event-row">
                    <div className="home-today-event-time" aria-label={t('startsAt', { time: timeBlock })}>
                      <span className="home-today-event-time-clock">{timeBlock}</span>
                    </div>

                    <article
                      className="home-today-event-card"
                      style={{ borderLeftColor: getProfileAccentColor(assignedProfile?.colorKey) }}
                    >
                      <strong className="home-today-event-title">{event.title}</strong>
                      <p className="home-today-event-subtitle">
                        {assignedProfile
                          ? assignedProfile.displayName
                          : t('assignedFallback')}
                      </p>
                      {event.notes ? <p className="home-today-event-notes">{event.notes}</p> : null}
                    </article>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="home-today-empty-state">
              <p className="shopping-meta">{t('emptyToday')}</p>
            </div>
          )}
        </section>
      ) : null}

      {dashboardQuery.data ? (
        <section className="home-bento-grid" aria-label={t('snapshotAria')}>
          <article className="home-bento-card home-bento-card-meal">
            <div>
              <span className="home-bento-icon" aria-hidden="true">
                <span className="material-symbols-outlined" aria-hidden="true">
                  restaurant
                </span>
              </span>
              <h3 className="home-bento-title">{t('dinner')}</h3>
              <p className="home-bento-copy">
                {dashboardQuery.data.tonightMeal
                  ? dashboardQuery.data.tonightMeal.title
                  : t('noDinner')}
              </p>
              {dashboardQuery.data.tonightMeal?.notes ? (
                <p className="shopping-meta home-bento-note">{dashboardQuery.data.tonightMeal.notes}</p>
              ) : null}
            </div>

            {dashboardQuery.data.tonightMeal ? (
              <div className="home-bento-foot">
                {tonightMealOwner ? <span className={getProfileColorChipClass(tonightMealOwner.colorKey)}>{tonightMealOwner.displayName}</span> : null}
              </div>
            ) : (
              <div className="home-bento-foot">
                <span className="shopping-meta">{t('openMealsCta')}</span>
              </div>
            )}
          </article>

          <article className="home-bento-card home-bento-card-shopping">
            <div>
              <span className="home-bento-icon" aria-hidden="true">
                <span className="material-symbols-outlined" aria-hidden="true">
                  checklist
                </span>
              </span>
              <h3 className="home-bento-title">{t('groceries')}</h3>
              <p className="home-bento-copy">
                {t('itemsLeft', { count: dashboardQuery.data.shopping.openItemsCount })}
              </p>
            </div>

            <div className="home-bento-foot">
              <div className="home-bento-progress" aria-hidden="true">
                <span
                  className="home-bento-progress-value"
                  style={{
                    width: `${Math.max(8, Math.min(100, (dashboardQuery.data.shopping.openItemsCount / Math.max(dashboardQuery.data.shopping.openItemsCount + 8, 1)) * 100))}%`,
                  }}
                />
              </div>
              {dashboardQuery.data.shopping.previewLabels.length > 0 ? (
                <ul className="home-bento-shopping-list" aria-label={t('openShoppingItemsAria')}>
                  {dashboardQuery.data.shopping.previewLabels.map((label, index) => (
                    <li key={`${label}-${index}`} className="home-bento-shopping-item">
                      {label}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="shopping-meta home-bento-preview">{t('emptyList')}</p>
              )}
            </div>
          </article>
        </section>
      ) : null}
    </section>
  );
}
