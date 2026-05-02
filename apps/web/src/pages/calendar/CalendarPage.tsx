import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useDashboardOverview } from '../../entities/dashboard/model/useDashboardOverview';
import { useBootstrap } from '../../processes/family-bootstrap/useBootstrap';
import {
  useCalendarWeek,
  useCreateCalendarEvent,
  useDeleteCalendarEvent,
  useUpdateCalendarEvent,
} from '../../entities/event/model/useCalendarWeek';
import { addToCalendar } from '../../shared/lib/calendar';

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

function formatMonthLabel(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: 'long',
  });
}

function formatWeekRangeLabel(value: string) {
  const start = new Date(`${value}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
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

  return `${start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', hour12: false })} - ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

function getProfileAccentColor(colorKey: string | null | undefined) {
  if (colorKey === 'green') return '#84ac8e';
  if (colorKey === 'blue') return '#5da9e9';
  if (colorKey === 'pink') return '#fd898a';
  if (colorKey === 'yellow') return '#f4d35e';
  return 'var(--primary-container)';
}

function exportCalendarEvent(calendarEvent: { title: string; notes: string | null; startAtUtc: string; endAtUtc: string }) {
  addToCalendar({
    title: calendarEvent.title,
    description: calendarEvent.notes ?? undefined,
    start: new Date(calendarEvent.startAtUtc),
    end: new Date(calendarEvent.endAtUtc),
  });
}

function formatTimeInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(11, 16);
}

function getDefaultRepeatUntil(date: string) {
  const repeatUntilDate = new Date(`${date}T00:00:00.000Z`);
  repeatUntilDate.setUTCDate(repeatUntilDate.getUTCDate() + 20);

  return formatDateOnly(repeatUntilDate);
}

function combineDateAndTime(date: string, time: string) {
  return new Date(`${date}T${time}`);
}

function shiftWeekDate(weekStart: string, selectedDate: string, direction: -1 | 1) {
  const nextWeekStart = new Date(`${weekStart}T00:00:00.000Z`);
  nextWeekStart.setUTCDate(nextWeekStart.getUTCDate() + direction * 7);

  const selectedOffsetDays = Math.round(
    (new Date(`${selectedDate}T00:00:00.000Z`).getTime() - new Date(`${weekStart}T00:00:00.000Z`).getTime()) /
      (24 * 60 * 60 * 1000),
  );

  const nextSelectedDate = new Date(nextWeekStart);
  nextSelectedDate.setUTCDate(nextWeekStart.getUTCDate() + Math.max(0, Math.min(6, selectedOffsetDays)));

  return {
    nextWeekStart: formatDateOnly(nextWeekStart),
    nextSelectedDate: formatDateOnly(nextSelectedDate),
  };
}

export function CalendarPage() {
  const today = new Date();
  const initialStart = getWeekStart(today);
  const initialWeekStart = formatDateOnly(initialStart);
  const initialSelectedDate = formatDateOnly(today);

  const [searchParams, setSearchParams] = useSearchParams();
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedProfileId, setAssignedProfileId] = useState('');
  const [repeatsWeekly, setRepeatsWeekly] = useState(false);
  const [repeatUntil, setRepeatUntil] = useState(getDefaultRepeatUntil(initialSelectedDate));
  const [applyToSeries, setApplyToSeries] = useState(true);
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('19:00');
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [confirmDeleteEventId, setConfirmDeleteEventId] = useState<string | null>(null);

  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const bootstrapQuery = useBootstrap();
  const dashboardQuery = useDashboardOverview();
  const calendarWeekQuery = useCalendarWeek(weekStart);
  const createCalendarEventMutation = useCreateCalendarEvent(weekStart);
  const updateCalendarEventMutation = useUpdateCalendarEvent(weekStart);
  const deleteCalendarEventMutation = useDeleteCalendarEvent(weekStart);
  const weekDays = useMemo(() => buildWeekDays(weekStart), [weekStart]);
  const calendarEvents = calendarWeekQuery.data?.events ?? [];
  const sheet = searchParams.get('sheet');
  const isSheetOpen = sheet === 'create-event' || sheet === 'edit-event';

  useEffect(() => {
    document.body.classList.toggle('body-modal-open', isSheetOpen);

    return () => {
      document.body.classList.remove('body-modal-open');
    };
  }, [isSheetOpen]);

  useEffect(() => {
    if (!dashboardQuery.data) {
      return;
    }

    setSelectedDate((current) => {
      if (current !== initialSelectedDate) {
        return current;
      }

      return dashboardQuery.data.date;
    });

    setWeekStart((current) => {
      if (current !== initialWeekStart) {
        return current;
      }

      // Prefer server-provided weekStart from calendar query if available
      return calendarWeekQuery.data?.weekStart ?? formatDateOnly(getWeekStart(new Date(`${dashboardQuery.data.date}T00:00:00`)));
    });
  }, [dashboardQuery.data, initialSelectedDate, initialWeekStart]);

  useEffect(() => {
    // If the calendar query returns a canonical weekStart, update local state when unchanged
    if (!calendarWeekQuery.data) return;

    setWeekStart((current) => (current === initialWeekStart ? calendarWeekQuery.data!.weekStart : current));
    setSelectedDate((current) => (current === initialSelectedDate ? dashboardQuery.data?.date ?? current : current));
  }, [calendarWeekQuery.data, initialWeekStart, initialSelectedDate, dashboardQuery.data]);

  const eventsByDay = useMemo(() => {
    const groups = new Map<string, typeof calendarEvents>(weekDays.map((day) => [day.key, []]));

    for (const calendarEvent of calendarEvents) {
      const dayKey = (calendarEvent as any).date ?? calendarEvent.startAtUtc.slice(0, 10);
      const existing = groups.get(dayKey) ?? [];
      groups.set(dayKey, [...existing, calendarEvent]);
    }

    return groups;
  }, [calendarEvents, weekDays]);

  const eventCountsByDay = useMemo(() => {
    return new Map(weekDays.map((day) => [day.key, (eventsByDay.get(day.key) ?? []).length]));
  }, [eventsByDay, weekDays]);

  function focusComposeTitle() {
    window.requestAnimationFrame(() => {
      titleInputRef.current?.focus();
    });
  }

  function openSheet(nextSheet: 'create-event' | 'edit-event', nextDate: string, eventId?: string) {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('sheet', nextSheet);
    nextSearchParams.set('date', nextDate);
    if (eventId) {
      nextSearchParams.set('eventId', eventId);
    } else {
      nextSearchParams.delete('eventId');
    }
    setSearchParams(nextSearchParams, { replace: false });
    focusComposeTitle();
  }

  function closeSheet() {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete('sheet');
    nextSearchParams.delete('date');
    nextSearchParams.delete('eventId');
    setSearchParams(nextSearchParams, { replace: false });
    setFormError('');
    setEditingEventId(null);
    setConfirmDeleteEventId(null);
  }

  function seedCreateForm(date: string) {
    setSelectedDate(date);
    setEditingEventId(null);
    setTitle('');
    setNotes('');
    setAssignedProfileId('');
    setRepeatsWeekly(false);
    setRepeatUntil(getDefaultRepeatUntil(date));
    setStartTime('18:00');
    setEndTime('19:00');
    setShowMoreOptions(false);
    setFormError('');
    setConfirmDeleteEventId(null);
    openSheet('create-event', date);
  }

  function seedEditForm(eventId: string) {
    const calendarEvent = calendarEvents.find((item) => item.id === eventId);
    if (!calendarEvent) {
      return;
    }

    const eventDate = (calendarEvent as any).date ?? calendarEvent.startAtUtc.slice(0, 10);
    setSelectedDate(eventDate);
    setEditingEventId(calendarEvent.id);
    setTitle(calendarEvent.title);
    setNotes(calendarEvent.notes ?? '');
    setAssignedProfileId(calendarEvent.assignedProfileId ?? '');
    setRepeatsWeekly(calendarEvent.isRecurring);
    setRepeatUntil(calendarEvent.repeatUntil ?? getDefaultRepeatUntil(eventDate));
    setStartTime(formatTimeInput(new Date(calendarEvent.startAtUtc)));
    setEndTime(formatTimeInput(new Date(calendarEvent.endAtUtc)));
    setShowMoreOptions(Boolean(calendarEvent.notes || calendarEvent.assignedProfileId || calendarEvent.isRecurring));
    setFormError('');
    setConfirmDeleteEventId(null);
    openSheet('edit-event', eventDate, calendarEvent.id);
  }

  function handleSelectDay(day: string) {
    setSelectedDate(day);
    setFormError('');
    setConfirmDeleteEventId(null);
  }

  function handleShiftWeek(direction: -1 | 1) {
    const { nextWeekStart, nextSelectedDate } = shiftWeekDate(weekStart, selectedDate, direction);
    setWeekStart(nextWeekStart);
    setSelectedDate(nextSelectedDate);
    setFormError('');
    setConfirmDeleteEventId(null);
  }

  async function handleDeleteEvent(eventId: string) {
    if (confirmDeleteEventId !== eventId) {
      setConfirmDeleteEventId(eventId);
      return;
    }

    await deleteCalendarEventMutation.mutateAsync(eventId);
    setConfirmDeleteEventId(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextStart = combineDateAndTime(selectedDate, startTime);
    const nextEnd = combineDateAndTime(selectedDate, endTime);

    if (!title.trim()) {
      setFormError('Add a short event title before saving.');
      return;
    }

    if (Number.isNaN(nextStart.getTime()) || Number.isNaN(nextEnd.getTime())) {
      setFormError('Choose a valid start and end time.');
      return;
    }

    if (nextEnd <= nextStart) {
      setFormError('End time needs to be after the start time.');
      return;
    }

    setFormError('');

    if (editingEventId) {
      await updateCalendarEventMutation.mutateAsync({
        eventId: editingEventId,
        request: {
          title: title.trim(),
          notes: notes.trim() || null,
          date: selectedDate,
          startTime,
          endTime,
          assignedProfileId: assignedProfileId || null,
          applyToSeries: repeatsWeekly ? applyToSeries : false,
          repeatUntil: repeatsWeekly ? repeatUntil : null,
        },
      });
    } else {
      await createCalendarEventMutation.mutateAsync({
        title: title.trim(),
        notes: notes.trim() || null,
        date: selectedDate,
        startTime,
        endTime,
        assignedProfileId: assignedProfileId || null,
        repeatsWeekly,
        repeatUntil: repeatsWeekly ? repeatUntil : null,
      });
    }

    closeSheet();
  }

  return (
    <section className="page calendar-page">
      <p className="eyebrow">Calendar</p>
      <h2 className="page-title">Weekly planner</h2>
      <p className="page-copy">
        Pick a day first, then add or edit events in a focused mobile sheet.
      </p>

      <section className="calendar-header-panel">
        <div className="calendar-header-row">
          <div>
            <h3 className="calendar-month-title">{formatMonthLabel(weekStart)}</h3>
            <p className="shopping-meta">{formatWeekRangeLabel(weekStart)}</p>
          </div>
          <div className="calendar-header-actions">
            <button className="secondary-button calendar-small-button" type="button" onClick={() => handleShiftWeek(-1)}>
              Previous
            </button>
            <button className="secondary-button calendar-small-button" type="button" onClick={() => handleShiftWeek(1)}>
              Next
            </button>
          </div>
        </div>

        <div className="calendar-week-strip" aria-label="Week days">
          {weekDays.map((day) => {
            const isActive = day.key === selectedDate;
            const eventCount = eventCountsByDay.get(day.key) ?? 0;

            return (
              <button
                key={day.key}
                className={isActive ? 'calendar-week-pill calendar-week-pill-active' : 'calendar-week-pill'}
                type="button"
                onClick={() => handleSelectDay(day.key)}
              >
                <span className="calendar-week-pill-label">{day.label}</span>
                <span className="calendar-week-pill-number">{day.dayNumber}</span>
                {isActive ? (
                  <span className="calendar-week-pill-dot calendar-week-pill-dot-active" aria-hidden="true" />
                ) : eventCount > 0 ? (
                  <span className="calendar-week-pill-dot" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="calendar-compose-card calendar-action-card">
        <div>
          <p className="eyebrow">Selected day</p>
          <h3 className="profile-card-title">{formatAgendaHeading(selectedDate)}</h3>
          <p className="shopping-meta">Use the add action or any event card to open the editing sheet.</p>
        </div>
        <button className="primary-button" type="button" onClick={() => seedCreateForm(selectedDate)}>
          Add event
        </button>
      </section>

      {calendarWeekQuery.isLoading ? <p className="page-copy">Loading weekly calendar...</p> : null}
      {calendarWeekQuery.isError ? <p className="form-error">Unable to load weekly events.</p> : null}
      <label className="calendar-apply-series-toggle" htmlFor="calendar-apply-series-toggle">
        <span className="calendar-apply-series-copy">
          <strong>Update future repeats</strong>
          <span className="shopping-meta">Apply edits to the rest of this recurring series.</span>
        </span>
        <input checked={applyToSeries} onChange={(event) => setApplyToSeries(event.target.checked)} type="checkbox" />
      </label>

      <div className="calendar-groups">
        {weekDays.map((day) => {
          const events = eventsByDay.get(day.key) ?? [];

          return (
            <article key={day.key} className={day.key === selectedDate ? 'calendar-day-card calendar-day-card-active' : 'calendar-day-card'}>
              <div className="shopping-group-header calendar-day-header">
                <div>
                  <h3 className="profile-card-title">{formatAgendaHeading(day.key)}</h3>
                  <p className="shopping-meta">
                    {events.length === 0 ? 'No events yet for this day.' : `${events.length} event${events.length === 1 ? '' : 's'} planned`}
                  </p>
                </div>
                <button
                  className={day.key === selectedDate ? 'primary-button calendar-small-button' : 'secondary-button calendar-small-button'}
                  type="button"
                  onClick={() => seedCreateForm(day.key)}
                >
                  Add here
                </button>
              </div>

              {events.length > 0 ? (
                <ul className="calendar-event-list">
                  {events.map((calendarEvent) => {
                    const assignedProfile = bootstrapQuery.data?.profiles.find(
                      (profile) => profile.id === calendarEvent.assignedProfileId,
                    );

                    return (
                      <li
                        key={calendarEvent.id}
                        className="calendar-event-item"
                        style={{ borderLeftColor: getProfileAccentColor(assignedProfile?.colorKey) }}
                      >
                        <div className="calendar-event-content">
                          <span className="calendar-event-category">Event</span>
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
                          {assignedProfile ? (
                            <div className="calendar-event-avatar-stack" aria-label={`Assigned to ${assignedProfile.displayName}`}>
                              <span
                                className="calendar-event-avatar-chip"
                                style={{ borderColor: getProfileAccentColor(assignedProfile.colorKey) }}
                                aria-hidden="true"
                              >
                                {assignedProfile.displayName.slice(0, 1).toUpperCase()}
                              </span>
                              <span className="shopping-meta">{assignedProfile.displayName}</span>
                            </div>
                          ) : null}
                        </div>

                        <div className="calendar-event-actions">
                          <button
                            className="secondary-button calendar-small-button"
                            type="button"
                            onClick={() => exportCalendarEvent(calendarEvent)}
                          >
                            Add to calendar
                          </button>
                          <button
                            className="secondary-button calendar-small-button"
                            type="button"
                            onClick={() => seedEditForm(calendarEvent.id)}
                          >
                            Edit
                          </button>
                          <button
                            className={confirmDeleteEventId === calendarEvent.id ? 'destructive-button calendar-small-button' : 'secondary-button calendar-small-button'}
                            type="button"
                            aria-label={confirmDeleteEventId === calendarEvent.id ? `Confirm delete ${calendarEvent.title}` : `Delete ${calendarEvent.title}`}
                            onClick={() => handleDeleteEvent(calendarEvent.id)}
                            disabled={deleteCalendarEventMutation.isPending}
                          >
                            {confirmDeleteEventId === calendarEvent.id ? 'Confirm delete' : 'Delete'}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="calendar-empty-day">
                  <p className="shopping-meta">Keep this day light or use the add action above to plan something now.</p>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <button className="floating-action-button" type="button" aria-label="Add calendar event" onClick={() => seedCreateForm(selectedDate)}>
        Add event
      </button>

      {isSheetOpen ? (
        <>
          <button className="mobile-sheet-backdrop" type="button" aria-label="Close event sheet" onClick={closeSheet} />
          <section className="mobile-sheet" role="dialog" aria-modal="true" aria-labelledby="calendar-sheet-title">
            <div className="mobile-sheet-header">
              <div>
                <p className="eyebrow">{editingEventId ? 'Edit event' : 'Add event'}</p>
                <h3 id="calendar-sheet-title" className="profile-card-title">{formatAgendaHeading(selectedDate)}</h3>
              </div>
              <button className="secondary-button calendar-small-button" type="button" onClick={closeSheet}>
                Close
              </button>
            </div>

            <form className="calendar-form mobile-sheet-content" onSubmit={handleSubmit}>
              <label className="field calendar-field-wide">
                <span>Title</span>
                <input
                  ref={titleInputRef}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Add event title"
                  type="text"
                />
              </label>

              <div className="calendar-time-row calendar-field-wide">
                <label className="field">
                  <span>Start time</span>
                  <input value={startTime} onChange={(event) => setStartTime(event.target.value)} type="time" />
                </label>

                <label className="field">
                  <span>End time</span>
                  <input value={endTime} onChange={(event) => setEndTime(event.target.value)} type="time" />
                </label>
              </div>

              <button
                className="secondary-button calendar-small-button calendar-field-wide"
                type="button"
                onClick={() => setShowMoreOptions((current) => !current)}
              >
                {showMoreOptions ? 'Hide extra details' : 'Show extra details'}
              </button>

              {showMoreOptions ? (
                <>
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
                </>
              ) : null}

              {formError ? <p className="form-error calendar-field-wide">{formError}</p> : null}

              <div className="mobile-sheet-actions calendar-field-wide">
                <button className="secondary-button" type="button" onClick={closeSheet}>
                  Cancel
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={createCalendarEventMutation.isPending || updateCalendarEventMutation.isPending}
                >
                  {createCalendarEventMutation.isPending || updateCalendarEventMutation.isPending
                    ? 'Saving...'
                    : editingEventId
                      ? 'Save event'
                      : 'Add event'}
                </button>
              </div>
            </form>
          </section>
        </>
      ) : null}
    </section>
  );
}
