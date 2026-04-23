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

function formatWeekday(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
  });
}

function formatDayNumber(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
  });
}

function formatShortWeekday(value: string) {
  return formatWeekday(value).slice(0, 1);
}

function formatTimeRange(startAtUtc: string, endAtUtc: string) {
  const start = new Date(startAtUtc);
  const end = new Date(endAtUtc);

  return `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
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

export function HomePage() {
  const bootstrapQuery = useBootstrap();
  const dashboardQuery = useDashboardOverview();
  const familyName = bootstrapQuery.data?.familyName ?? 'Your family';

  const profilesById = useMemo(() => {
    return new Map((bootstrapQuery.data?.profiles ?? []).map((profile) => [profile.id, profile]));
  }, [bootstrapQuery.data?.profiles]);

  const nextEventId = dashboardQuery.data?.todayEvents.find((event) => !event.isPast)?.id ?? null;

  return (
    <section className="page dashboard-page">
      <div className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <p className="eyebrow">Dashboard</p>
          <h2 className="page-title">{getGreeting()}, team</h2>
          <p className="page-copy">
            {dashboardQuery.data ? formatLongDate(dashboardQuery.data.date) : 'Loading your family overview...'}
          </p>
        </div>
        <div className="dashboard-family-badge">{familyName}</div>
      </div>

      {dashboardQuery.isLoading ? <p className="page-copy">Loading dashboard...</p> : null}
      {dashboardQuery.isError ? <p className="form-error">Unable to load the dashboard overview.</p> : null}

      {dashboardQuery.data ? (
        <>
          <section className="dashboard-week-strip" aria-label="Weekly snapshot">
            {dashboardQuery.data.week.map((day) => {
              const dotCount = Math.min(day.eventCount + (day.hasMeal ? 1 : 0), 3);
              const isToday = day.date === dashboardQuery.data?.date;

              return (
                <article
                  key={day.date}
                  className={isToday ? 'dashboard-week-day dashboard-week-day-active' : 'dashboard-week-day'}
                >
                  <span className="dashboard-week-label">{formatShortWeekday(day.date)}</span>
                  <strong className="dashboard-week-number">{formatDayNumber(day.date)}</strong>
                  <div className="dashboard-week-dots" aria-hidden="true">
                    {Array.from({ length: dotCount }, (_, index) => (
                      <span key={`${day.date}-${index}`} className="dashboard-week-dot" />
                    ))}
                  </div>
                </article>
              );
            })}
          </section>

          <div className="dashboard-layout">
            <section>
              <div className="dashboard-section-header">
                <h3 className="profile-card-title">Today&apos;s plan</h3>
                <span className="dashboard-section-link">Live view</span>
              </div>

              {dashboardQuery.data.todayEvents.length > 0 ? (
                <ol className="dashboard-timeline">
                  {dashboardQuery.data.todayEvents.map((event) => {
                    const assignedProfile = event.assignedProfileId
                      ? profilesById.get(event.assignedProfileId)
                      : null;

                    const className = event.id === nextEventId
                      ? 'dashboard-timeline-item dashboard-timeline-item-active'
                      : event.isPast
                        ? 'dashboard-timeline-item dashboard-timeline-item-past'
                        : 'dashboard-timeline-item';

                    return (
                      <li key={event.id} className={className}>
                        <div className="dashboard-timeline-marker" aria-hidden="true" />
                        <div className="dashboard-timeline-card">
                          <div className="dashboard-timeline-card-header">
                            <div>
                              <strong className="dashboard-timeline-title">{event.title}</strong>
                              <p className="dashboard-timeline-time">{formatTimeRange(event.startAtUtc, event.endAtUtc)}</p>
                            </div>
                            {assignedProfile ? (
                              <span className="profile-color-chip">{assignedProfile.displayName}</span>
                            ) : null}
                          </div>
                          {event.notes ? (
                            <p className="dashboard-timeline-notes dashboard-timeline-note-card">{event.notes}</p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <div className="dashboard-empty-card">
                  <p className="shopping-meta">No events scheduled for today.</p>
                </div>
              )}
            </section>

            <aside className="dashboard-side-grid">
              <section className="dashboard-meal-card">
                <p className="eyebrow">Dinner tonight</p>
                {dashboardQuery.data.tonightMeal ? (
                  <>
                    <div className="dashboard-meal-head">
                      <div>
                        <h3 className="dashboard-meal-title">{dashboardQuery.data.tonightMeal.title}</h3>
                        {dashboardQuery.data.tonightMeal.ownerProfileId ? (
                          <p className="shopping-meta dashboard-meal-owner">
                            {profilesById.get(dashboardQuery.data.tonightMeal.ownerProfileId)?.displayName ?? 'Assigned family member'}
                          </p>
                        ) : (
                          <p className="shopping-meta dashboard-meal-owner">No owner assigned yet</p>
                        )}
                      </div>
                      <span className="dashboard-meal-badge">Meal</span>
                    </div>
                    {dashboardQuery.data.tonightMeal.notes ? (
                      <p className="dashboard-meal-notes">{dashboardQuery.data.tonightMeal.notes}</p>
                    ) : null}
                    <div className="dashboard-meal-action">Change meal</div>
                  </>
                ) : (
                  <div className="dashboard-empty-card dashboard-empty-card-compact">
                    <p className="shopping-meta">Nothing is planned for tonight yet.</p>
                  </div>
                )}
              </section>

              <div className="dashboard-mini-grid">
                <section className="dashboard-mini-card dashboard-mini-card-shopping">
                  <div className="dashboard-mini-icon" aria-hidden="true">List</div>
                  <h3 className="profile-card-title">Groceries</h3>
                  <p className="dashboard-mini-count">{dashboardQuery.data.shopping.openItemsCount} open</p>
                  <p className="shopping-meta">
                    {dashboardQuery.data.shopping.previewLabels.length > 0
                      ? dashboardQuery.data.shopping.previewLabels.join(', ')
                      : 'Your list is clear.'}
                  </p>
                </section>

                <section className="dashboard-mini-card dashboard-mini-card-upcoming">
                  <div className="dashboard-mini-icon" aria-hidden="true">Next</div>
                  <h3 className="profile-card-title">
                    {dashboardQuery.data.upcomingEvent?.title ?? 'All caught up'}
                  </h3>
                  <p className="dashboard-mini-count">
                    {dashboardQuery.data.upcomingEvent
                      ? formatLongDate(dashboardQuery.data.upcomingEvent.startAtUtc.slice(0, 10))
                      : 'No future events yet'}
                  </p>
                  <p className="shopping-meta">
                    {dashboardQuery.data.upcomingEvent
                      ? formatTimeRange(
                          dashboardQuery.data.upcomingEvent.startAtUtc,
                          dashboardQuery.data.upcomingEvent.endAtUtc,
                        )
                      : 'Add something to the calendar.'}
                  </p>
                </section>
              </div>
            </aside>
          </div>
        </>
      ) : null}
    </section>
  );
}
