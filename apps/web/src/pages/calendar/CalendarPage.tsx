import { useMemo, useState } from 'react';

import { useBootstrap } from '../../processes/family-bootstrap/useBootstrap';
import {
  useCalendarWeek,
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
} from '../../entities/event/model/useCalendarWeek';

function getWeekStart(date: Date) {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;

  utcDate.setUTCDate(utcDate.getUTCDate() + diff);

  return utcDate;
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatDateTimeLocal(value: Date) {
  const iso = new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString();
  return iso.slice(0, 16);
}

function formatMonthLabel(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: 'long',
  });
}

function formatWeekdayShort(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
  });
}

function buildWeekDays(weekStart: string) {
  const startDate = new Date(`${weekStart}T00:00:00.000Z`);

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(startDate);
    current.setUTCDate(startDate.getUTCDate() + index);

    return {
      key: formatDateOnly(current),
      label: formatWeekdayShort(formatDateOnly(current)),
      dayNumber: current.toLocaleDateString(undefined, { day: 'numeric', timeZone: 'UTC' }),
    };
  });
}

function formatAgendaHeading(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function formatEventTime(startAtUtc: string, endAtUtc: string) {
  const start = new Date(startAtUtc);
  const end = new Date(endAtUtc);

  return `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

export function CalendarPage() {
  const initialStart = getWeekStart(new Date());
  const [weekStart, setWeekStart] = useState(formatDateOnly(initialStart));
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedProfileId, setAssignedProfileId] = useState('');
  const [repeatsWeekly, setRepeatsWeekly] = useState(false);
  const [repeatUntil, setRepeatUntil] = useState(formatDateOnly(new Date(initialStart.getTime() + 20 * 24 * 60 * 60 * 1000)));
  const [applyToSeries, setApplyToSeries] = useState(true);
  const [startAtLocal, setStartAtLocal] = useState(formatDateTimeLocal(new Date()));
  const [endAtLocal, setEndAtLocal] = useState(formatDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000)));

  const bootstrapQuery = useBootstrap();
  const calendarWeekQuery = useCalendarWeek(weekStart);
  const createCalendarEventMutation = useCreateCalendarEvent(weekStart);
  const updateCalendarEventMutation = useUpdateCalendarEvent(weekStart);
  const weekDays = useMemo(() => buildWeekDays(weekStart), [weekStart]);

  const groupedEvents = useMemo(() => {
    const events = calendarWeekQuery.data?.events ?? [];
    const groups = new Map<string, typeof events>();

    for (const event of events) {
      const dayKey = event.startAtUtc.slice(0, 10);
      const existing = groups.get(dayKey) ?? [];
      groups.set(dayKey, [...existing, event]);
    }

    return [...groups.entries()];
  }, [calendarWeekQuery.data]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    await createCalendarEventMutation.mutateAsync({
      title: title.trim(),
      notes: notes.trim() || null,
      startAtUtc: new Date(startAtLocal).toISOString(),
      endAtUtc: new Date(endAtLocal).toISOString(),
      assignedProfileId: assignedProfileId || null,
      repeatsWeekly,
      repeatUntil: repeatsWeekly ? repeatUntil : null,
    });

    setTitle('');
    setNotes('');
    setAssignedProfileId('');
    setRepeatsWeekly(false);
  }

  async function handleBumpHour(
    eventId: string,
    currentTitle: string,
    currentNotes: string | null,
    currentAssignedProfileId: string | null,
    currentRepeatUntil: string | null,
    currentIsRecurring: boolean,
    startAtUtc: string,
    endAtUtc: string,
  ) {
    const nextStart = new Date(new Date(startAtUtc).getTime() + 60 * 60 * 1000).toISOString();
    const nextEnd = new Date(new Date(endAtUtc).getTime() + 60 * 60 * 1000).toISOString();

    await updateCalendarEventMutation.mutateAsync({
      eventId,
        request: {
          title: currentTitle,
          notes: currentNotes,
          startAtUtc: nextStart,
          endAtUtc: nextEnd,
          assignedProfileId: currentAssignedProfileId,
          applyToSeries: currentIsRecurring ? applyToSeries : false,
          repeatUntil: currentIsRecurring ? currentRepeatUntil : null,
        },
      });
  }

  return (
    <section className="page calendar-page">
      <p className="eyebrow">Calendar</p>
      <h2 className="page-title">Weekly planner</h2>
      <p className="page-copy">
        Build out the shared family week and add events against the active planning window.
      </p>

      <section className="calendar-header-panel">
        <div className="calendar-header-row">
          <h3 className="calendar-month-title">{formatMonthLabel(weekStart)}</h3>
          <span className="calendar-today-badge">Today</span>
        </div>

        <div className="calendar-week-strip" aria-label="Week days">
          {weekDays.map((day) => {
            const isActive = day.key === weekStart;

            return (
              <button
                key={day.key}
                className={isActive ? 'calendar-week-pill calendar-week-pill-active' : 'calendar-week-pill'}
                type="button"
                onClick={() => setWeekStart(day.key)}
              >
                <span className="calendar-week-pill-label">{day.label}</span>
                <span className="calendar-week-pill-number">{day.dayNumber}</span>
              </button>
            );
          })}
        </div>
      </section>

      <form className="calendar-form calendar-compose-card" onSubmit={handleCreate}>
        <label className="field calendar-field-wide">
          <span>Week start</span>
          <input value={weekStart} onChange={(event) => setWeekStart(event.target.value)} type="date" />
        </label>

        <label className="field calendar-field-wide">
          <span>Title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add event title" type="text" />
        </label>

        <label className="field">
          <span>Start</span>
          <input value={startAtLocal} onChange={(event) => setStartAtLocal(event.target.value)} type="datetime-local" />
        </label>

        <label className="field">
          <span>End</span>
          <input value={endAtLocal} onChange={(event) => setEndAtLocal(event.target.value)} type="datetime-local" />
        </label>

        <label className="field">
          <span>Assigned profile</span>
          <select value={assignedProfileId} onChange={(event) => setAssignedProfileId(event.target.value)}>
            <option value="">Unassigned</option>
            {bootstrapQuery.data?.profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.displayName}
              </option>
            ))}
          </select>
        </label>

        <label className="field checkbox-field">
          <span>Repeat weekly</span>
          <input
            checked={repeatsWeekly}
            onChange={(event) => setRepeatsWeekly(event.target.checked)}
            type="checkbox"
          />
        </label>

        {repeatsWeekly ? (
          <label className="field">
            <span>Repeat until</span>
            <input value={repeatUntil} onChange={(event) => setRepeatUntil(event.target.value)} type="date" />
          </label>
        ) : null}

        <label className="field calendar-field-wide">
          <span>Notes</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
        </label>

        <button className="primary-button" type="submit" disabled={createCalendarEventMutation.isPending}>
          {createCalendarEventMutation.isPending ? 'Saving...' : 'Add event'}
        </button>
      </form>

      {calendarWeekQuery.isLoading ? <p className="page-copy">Loading weekly calendar...</p> : null}
      {calendarWeekQuery.isError ? <p className="form-error">Unable to load weekly events.</p> : null}
      <label className="field checkbox-field calendar-apply-series-toggle">
        <span>Update all future repeats when bumping recurring events</span>
        <input checked={applyToSeries} onChange={(event) => setApplyToSeries(event.target.checked)} type="checkbox" />
      </label>

      <div className="calendar-groups">
        {groupedEvents.map(([day, events]) => (
          <article key={day} className="calendar-day-card">
            <div className="shopping-group-header calendar-day-header">
              <h3 className="profile-card-title">{formatAgendaHeading(day)}</h3>
              <span className="profile-color-chip">{events?.length ?? 0} events</span>
            </div>

            <ul className="calendar-event-list">
              {events?.map((calendarEvent) => {
                const assignedProfile = bootstrapQuery.data?.profiles.find(
                  (profile) => profile.id === calendarEvent.assignedProfileId,
                );

                return (
                  <li key={calendarEvent.id} className="calendar-event-item">
                    <div className="calendar-event-avatar" aria-hidden="true">
                      {assignedProfile ? assignedProfile.displayName.slice(0, 1).toUpperCase() : 'A'}
                    </div>

                    <div className="calendar-event-content">
                      <strong className="calendar-event-title">{calendarEvent.title}</strong>
                      <p className="calendar-event-time">
                        {formatEventTime(calendarEvent.startAtUtc, calendarEvent.endAtUtc)}
                      </p>
                      {calendarEvent.isRecurring ? (
                        <p className="calendar-event-recurrence">
                          Repeats weekly through {calendarEvent.repeatUntil}
                        </p>
                      ) : null}
                      {calendarEvent.notes ? <p className="calendar-event-notes">{calendarEvent.notes}</p> : null}
                    </div>

                    <div className="calendar-event-actions">
                      {assignedProfile ? <span className="shopping-meta">{assignedProfile.displayName}</span> : null}
                      <button
                        className="secondary-button calendar-small-button"
                        type="button"
                        onClick={() =>
                          handleBumpHour(
                            calendarEvent.id,
                            calendarEvent.title,
                            calendarEvent.notes,
                            calendarEvent.assignedProfileId,
                            calendarEvent.repeatUntil,
                            calendarEvent.isRecurring,
                            calendarEvent.startAtUtc,
                            calendarEvent.endAtUtc,
                          )
                        }
                      >
                        +1h
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
