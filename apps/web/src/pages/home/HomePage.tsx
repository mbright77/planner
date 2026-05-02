import { useMemo } from 'react';

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

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'Good morning';
  }

  if (hour < 18) {
    return 'Good afternoon';
  }

  return 'Good evening';
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
  const bootstrapQuery = useBootstrap();
  const dashboardQuery = useDashboardOverview();
  const familyName = bootstrapQuery.data?.familyName ?? 'Your family';

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
          <p className="eyebrow">Dashboard</p>
          <h2 className="page-title">{getGreeting()}, team</h2>
          <p className="page-copy">{dashboardQuery.data ? formatLongDate(dashboardQuery.data.date) : 'Loading your family overview...'}</p>
        </div>
        <div className="home-today-family-badge">{familyName}</div>
      </div>

      {dashboardQuery.isLoading ? <p className="page-copy">Loading dashboard...</p> : null}
      {dashboardQuery.isError ? <p className="form-error">Unable to load the dashboard overview.</p> : null}

      {dashboardQuery.data ? (
        <section className="home-today-section" aria-label="Today's calendar events">
          <div className="home-today-section-header">
            <h3 className="home-today-title">
              <span className="material-symbols-outlined home-today-title-icon" aria-hidden="true">
                calendar_month
              </span>
              Today&apos;s Fun
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
                    <div className="home-today-event-time" aria-label={`Starts at ${timeBlock}`}>
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
                          : 'Family'}
                      </p>
                      {event.notes ? <p className="home-today-event-notes">{event.notes}</p> : null}
                    </article>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="home-today-empty-state">
              <p className="shopping-meta">Nothing planned today - enjoy the day!</p>
            </div>
          )}
        </section>
      ) : null}

      {dashboardQuery.data ? (
        <section className="home-bento-grid" aria-label="Meals and shopping snapshot">
          <article className="home-bento-card home-bento-card-meal">
            <div>
              <span className="home-bento-icon" aria-hidden="true">
                <span className="material-symbols-outlined" aria-hidden="true">
                  restaurant
                </span>
              </span>
              <h3 className="home-bento-title">Dinner</h3>
              <p className="home-bento-copy">
                {dashboardQuery.data.tonightMeal
                  ? dashboardQuery.data.tonightMeal.title
                  : 'No dinner plan yet'}
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
                <span className="shopping-meta">Open Meals to plan tonight.</span>
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
              <h3 className="home-bento-title">Groceries</h3>
              <p className="home-bento-copy">
                {dashboardQuery.data.shopping.openItemsCount} item{dashboardQuery.data.shopping.openItemsCount === 1 ? '' : 's'} left
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
                <ul className="home-bento-shopping-list" aria-label="Open shopping items">
                  {dashboardQuery.data.shopping.previewLabels.map((label, index) => (
                    <li key={`${label}-${index}`} className="home-bento-shopping-item">
                      {label}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="shopping-meta home-bento-preview">List is clear right now.</p>
              )}
            </div>
          </article>
        </section>
      ) : null}
    </section>
  );
}
