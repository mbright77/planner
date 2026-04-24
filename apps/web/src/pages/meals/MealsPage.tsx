import { useEffect, useMemo, useRef, useState } from 'react';

import { useBootstrap } from '../../processes/family-bootstrap/useBootstrap';
import {
  useAcceptMealRequest,
  useAssignMealRequest,
  useCreateMealPlan,
  useCreateMealRequest,
  useMealRequests,
  useMealsWeek,
  useUpdateMealPlan,
} from '../../entities/meal/model/useMealsWeek';

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

function buildWeekDays(weekStart: string) {
  const startDate = new Date(`${weekStart}T00:00:00.000Z`);

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(startDate);
    current.setUTCDate(startDate.getUTCDate() + index);

    return {
      key: formatDateOnly(current),
      label: current.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' }),
      dayNumber: current.toLocaleDateString(undefined, { day: 'numeric', timeZone: 'UTC' }),
    };
  });
}

function formatWeekRange(weekStart: string) {
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
}

function formatLongDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
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

export function MealsPage() {
  const today = new Date();
  const initialWeekStart = formatDateOnly(getWeekStart(today));
  const initialSelectedDate = formatDateOnly(today);

  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [ownerProfileId, setOwnerProfileId] = useState('');
  const [requestTitle, setRequestTitle] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [requesterProfileId, setRequesterProfileId] = useState('');
  const [showMealOptions, setShowMealOptions] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [mealFormError, setMealFormError] = useState('');
  const [requestFormError, setRequestFormError] = useState('');
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [editingMealTitle, setEditingMealTitle] = useState('');
  const [editingMealNotes, setEditingMealNotes] = useState('');
  const [editingMealOwnerProfileId, setEditingMealOwnerProfileId] = useState('');
  const [mealEditError, setMealEditError] = useState('');
  const [assigningRequestId, setAssigningRequestId] = useState<string | null>(null);
  const [assigningRequestProfileId, setAssigningRequestProfileId] = useState('');

  const mealTitleRef = useRef<HTMLInputElement | null>(null);
  const requestTitleRef = useRef<HTMLInputElement | null>(null);

  const bootstrapQuery = useBootstrap();
  const mealsWeekQuery = useMealsWeek(weekStart);
  const mealRequestsQuery = useMealRequests(weekStart);
  const createMealPlanMutation = useCreateMealPlan(weekStart);
  const createMealRequestMutation = useCreateMealRequest(weekStart);
  const assignMealRequestMutation = useAssignMealRequest(weekStart);
  const acceptMealRequestMutation = useAcceptMealRequest(weekStart);
  const updateMealPlanMutation = useUpdateMealPlan(weekStart);

  const weekDays = useMemo(() => buildWeekDays(weekStart), [weekStart]);
  const mealsByDate = useMemo(() => {
    return new Map((mealsWeekQuery.data?.meals ?? []).map((meal) => [meal.mealDate, meal]));
  }, [mealsWeekQuery.data?.meals]);
  const requestsByDate = useMemo(() => {
    const grouped = new Map<string, typeof mealRequestsQuery.data>();

    for (const request of mealRequestsQuery.data ?? []) {
      const key = request.requestedForDate ?? 'unscheduled';
      const existing = grouped.get(key) ?? [];
      grouped.set(key, [...existing, request]);
    }

    return grouped;
  }, [mealRequestsQuery.data]);

  const selectedMeal = mealsByDate.get(selectedDate);
  const selectedRequests = requestsByDate.get(selectedDate) ?? [];

  useEffect(() => {
    if (selectedMeal) {
      setEditingMealId(selectedMeal.id);
      setEditingMealTitle(selectedMeal.title);
      setEditingMealNotes(selectedMeal.notes ?? '');
      setEditingMealOwnerProfileId(selectedMeal.ownerProfileId ?? '');
      setMealEditError('');
      return;
    }

    setEditingMealId(null);
    setEditingMealTitle('');
    setEditingMealNotes('');
    setEditingMealOwnerProfileId('');
    setMealEditError('');
  }, [selectedMeal]);

  function focusMealTitle() {
    window.requestAnimationFrame(() => {
      mealTitleRef.current?.focus();
    });
  }

  function focusRequestTitle() {
    window.requestAnimationFrame(() => {
      requestTitleRef.current?.focus();
    });
  }

  function handleSelectDay(day: string) {
    setSelectedDate(day);
    setMealFormError('');
    setRequestFormError('');
    focusMealTitle();
  }

  function handleShiftWeek(direction: -1 | 1) {
    const { nextWeekStart, nextSelectedDate } = shiftWeekDate(weekStart, selectedDate, direction);
    setWeekStart(nextWeekStart);
    setSelectedDate(nextSelectedDate);
    setMealFormError('');
    setRequestFormError('');
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      setMealFormError('Add a dinner title before saving.');
      return;
    }

    setMealFormError('');

    await createMealPlanMutation.mutateAsync({
      mealDate: selectedDate,
      title: title.trim(),
      notes: notes.trim() || null,
      ownerProfileId: ownerProfileId || null,
    });

    setTitle('');
    setNotes('');
    setOwnerProfileId('');
    setShowMealOptions(false);
  }

  async function handleRequestSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!requestTitle.trim()) {
      setRequestFormError('Add a short request before sending it.');
      return;
    }

    setRequestFormError('');

    await createMealRequestMutation.mutateAsync({
      requesterProfileId: requesterProfileId || null,
      requestedForDate: selectedDate,
      title: requestTitle.trim(),
      notes: requestNotes.trim() || null,
    });

    setRequestTitle('');
    setRequestNotes('');
    setRequesterProfileId('');
    setShowRequestForm(false);
  }

  async function handleSaveMealEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingMealId) {
      return;
    }

    if (!editingMealTitle.trim()) {
      setMealEditError('Add a dinner title before saving changes.');
      return;
    }

    setMealEditError('');

    await updateMealPlanMutation.mutateAsync({
      mealId: editingMealId,
      request: {
        mealDate: selectedDate,
        title: editingMealTitle.trim(),
        notes: editingMealNotes.trim() || null,
        ownerProfileId: editingMealOwnerProfileId || null,
      },
    });
  }

  async function handleAssignRequest(requestId: string) {
    await assignMealRequestMutation.mutateAsync({
      requestId,
      assigneeProfileId: assigningRequestProfileId || null,
    });

    setAssigningRequestId(null);
    setAssigningRequestProfileId('');
  }

  function handleStartMealEdit(day: string) {
    const meal = mealsByDate.get(day);
    if (!meal) {
      return;
    }

    setSelectedDate(day);
    setEditingMealId(meal.id);
    setEditingMealTitle(meal.title);
    setEditingMealNotes(meal.notes ?? '');
    setEditingMealOwnerProfileId(meal.ownerProfileId ?? '');
    setMealEditError('');
    focusMealTitle();
  }

  function handleStartRequestAssignment(requestId: string, currentAssigneeProfileId: string | null) {
    setAssigningRequestId(requestId);
    setAssigningRequestProfileId(currentAssigneeProfileId ?? '');
  }

  return (
    <section className="page meals-page">
      <p className="eyebrow">Meals</p>
      <h2 className="page-title">Weekly meals</h2>
      <p className="page-copy">
        Pick a day first, then plan dinner or capture a request while that day is in view.
      </p>

      <section className="meals-header-panel">
        <div>
          <h3 className="meals-range-title">{formatWeekRange(weekStart)}</h3>
          <p className="shopping-meta">One dinner plan per day, visible to the whole family.</p>
        </div>
        <div className="meals-header-actions">
          <button className="secondary-button calendar-small-button" type="button" onClick={() => handleShiftWeek(-1)}>
            Previous
          </button>
          <button className="secondary-button calendar-small-button" type="button" onClick={() => handleShiftWeek(1)}>
            Next
          </button>
        </div>
      </section>

      <div className="meals-week-strip" aria-label="Meal planning days">
        {weekDays.map((day) => {
          const isSelected = day.key === selectedDate;
          const meal = mealsByDate.get(day.key);
          const requests = requestsByDate.get(day.key) ?? [];

          return (
            <button
              key={day.key}
              className={isSelected ? 'calendar-week-pill calendar-week-pill-active' : 'calendar-week-pill'}
              type="button"
              onClick={() => handleSelectDay(day.key)}
            >
              <span className="calendar-week-pill-label">{day.label}</span>
              <span className="calendar-week-pill-number">{day.dayNumber}</span>
              <span className="meal-day-summary">
                {meal ? 'Meal set' : requests.length > 0 ? `${requests.length} request${requests.length === 1 ? '' : 's'}` : 'Open'}
              </span>
            </button>
          );
        })}
      </div>

      {selectedMeal ? (
        <form className="meals-form meals-compose-card meals-edit-card" onSubmit={handleSaveMealEdit}>
          <div className="meals-compose-header meals-field-wide">
            <div>
              <p className="eyebrow">Edit dinner</p>
              <h3 className="profile-card-title">{formatLongDate(selectedDate)}</h3>
            </div>
            <button
              className="secondary-button calendar-small-button"
              type="button"
              onClick={() => setShowMealOptions((current) => !current)}
            >
              {showMealOptions ? 'Fewer fields' : 'More options'}
            </button>
          </div>

          <label className="field meals-field-wide">
            <span>Meal title</span>
            <input
              ref={mealTitleRef}
              value={editingMealTitle}
              onChange={(event) => setEditingMealTitle(event.target.value)}
              type="text"
            />
          </label>

          {showMealOptions ? (
            <>
              <label className="field">
                <span>Owner</span>
                <select value={editingMealOwnerProfileId} onChange={(event) => setEditingMealOwnerProfileId(event.target.value)}>
                  <option value="">Unassigned</option>
                  {bootstrapQuery.data?.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.displayName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field meals-field-wide">
                <span>Notes</span>
                <textarea value={editingMealNotes} onChange={(event) => setEditingMealNotes(event.target.value)} rows={3} />
              </label>
            </>
          ) : null}

          {mealEditError ? <p className="form-error meals-field-wide">{mealEditError}</p> : null}

          <button className="primary-button" type="submit" disabled={updateMealPlanMutation.isPending || !editingMealId}>
            {updateMealPlanMutation.isPending ? 'Saving...' : `Save changes for ${formatLongDate(selectedDate)}`}
          </button>
        </form>
      ) : (
        <form className="meals-form meals-compose-card" onSubmit={handleSubmit}>
          <div className="meals-compose-header meals-field-wide">
            <div>
              <p className="eyebrow">Plan dinner</p>
              <h3 className="profile-card-title">{formatLongDate(selectedDate)}</h3>
            </div>
            <button
              className="secondary-button calendar-small-button"
              type="button"
              onClick={() => setShowMealOptions((current) => !current)}
            >
              {showMealOptions ? 'Fewer fields' : 'More options'}
            </button>
          </div>

          <label className="field meals-field-wide">
            <span>Meal title</span>
            <input
              ref={mealTitleRef}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Plan dinner"
              type="text"
            />
          </label>

          {showMealOptions ? (
            <>
              <label className="field">
                <span>Owner</span>
                <select value={ownerProfileId} onChange={(event) => setOwnerProfileId(event.target.value)}>
                  <option value="">Unassigned</option>
                  {bootstrapQuery.data?.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.displayName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field meals-field-wide">
                <span>Notes</span>
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
              </label>
            </>
          ) : null}

          {mealFormError ? <p className="form-error meals-field-wide">{mealFormError}</p> : null}

          <button className="primary-button" type="submit" disabled={createMealPlanMutation.isPending}>
            {createMealPlanMutation.isPending ? 'Saving...' : `Save dinner for ${formatLongDate(selectedDate)}`}
          </button>
        </form>
      )}

      {mealsWeekQuery.isLoading ? <p className="page-copy">Loading weekly meals...</p> : null}
      {mealsWeekQuery.isError ? <p className="form-error">Unable to load weekly meals.</p> : null}

      <div className="meals-grid">
        {weekDays.map((day) => {
          const meal = mealsByDate.get(day.key);
          const owner = bootstrapQuery.data?.profiles.find((profile) => profile.id === meal?.ownerProfileId);
          const requests = requestsByDate.get(day.key) ?? [];
          const className = meal
            ? day.key === weekDays[4]?.key
              ? 'meal-card meal-card-featured'
              : 'meal-card'
            : 'meal-card meal-card-empty';

          return (
            <article key={day.key} className={day.key === selectedDate ? `${className} meal-card-active` : className}>
              <div className="meal-card-header">
                <div>
                  <p className="eyebrow">{day.label}</p>
                  <h3 className="profile-card-title">{day.dayNumber}</h3>
                </div>
                <div className="meal-card-chip-stack">
                  {owner ? <span className="profile-color-chip">{owner.displayName}</span> : null}
                  {requests.length > 0 ? <span className="profile-color-chip">{requests.length} request{requests.length === 1 ? '' : 's'}</span> : null}
                </div>
              </div>

              {meal ? (
                <>
                  <div className="meal-card-body">
                    <strong className="meal-card-title">{meal.title}</strong>
                    {meal.notes ? <p className="meal-card-notes">{meal.notes}</p> : null}
                  </div>

                  <div className="meal-card-actions">
                    <button
                      className="secondary-button meal-card-button"
                      type="button"
                      onClick={() => handleStartMealEdit(day.key)}
                    >
                      Edit day
                    </button>
                  </div>
                </>
              ) : (
                <div className="meal-card-empty-state">
                  <p className="shopping-meta">No meal planned yet.</p>
                  <div className="meal-card-actions">
                    <button className="secondary-button meal-card-button" type="button" onClick={() => handleSelectDay(day.key)}>
                      Plan this day
                    </button>
                    <button
                      className="secondary-button meal-card-button"
                      type="button"
                      onClick={() => {
                        handleSelectDay(day.key);
                        setShowRequestForm(true);
                        focusRequestTitle();
                      }}
                    >
                      Request meal
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <section className="meal-requests-section">
        <div className="shopping-group-header meal-requests-header">
          <div>
            <p className="eyebrow">Requests</p>
            <h3 className="profile-card-title">Meal requests for {formatLongDate(selectedDate)}</h3>
          </div>
          <div className="meal-requests-header-actions">
            <span className="profile-color-chip">{selectedRequests.length} open</span>
            <button
              className="secondary-button calendar-small-button"
              type="button"
              onClick={() => {
                setShowRequestForm((current) => !current);
                if (!showRequestForm) {
                  focusRequestTitle();
                }
              }}
            >
              {showRequestForm ? 'Hide request form' : 'Request meal'}
            </button>
          </div>
        </div>

        {showRequestForm ? (
          <form className="meal-requests-form" onSubmit={handleRequestSubmit}>
            <label className="field meal-requests-field-wide">
              <span>Request title</span>
              <input
                ref={requestTitleRef}
                value={requestTitle}
                onChange={(event) => setRequestTitle(event.target.value)}
                placeholder="Request a meal idea"
                type="text"
              />
            </label>

            <label className="field">
              <span>Requested by</span>
              <select value={requesterProfileId} onChange={(event) => setRequesterProfileId(event.target.value)}>
                <option value="">No profile</option>
                {bootstrapQuery.data?.profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.displayName}
                  </option>
                ))}
              </select>
            </label>

            <label className="field meal-requests-field-wide">
              <span>Notes</span>
              <textarea value={requestNotes} onChange={(event) => setRequestNotes(event.target.value)} rows={2} />
            </label>

            {requestFormError ? <p className="form-error meal-requests-field-wide">{requestFormError}</p> : null}

            <button className="primary-button" type="submit" disabled={createMealRequestMutation.isPending}>
              {createMealRequestMutation.isPending ? 'Saving...' : `Add request for ${formatLongDate(selectedDate)}`}
            </button>
          </form>
        ) : null}

        {mealRequestsQuery.isLoading ? <p className="page-copy">Loading meal requests...</p> : null}
        {mealRequestsQuery.isError ? <p className="form-error">Unable to load meal requests.</p> : null}

        <div className="meal-request-list">
          {selectedRequests.length > 0 ? (
            selectedRequests.map((request) => {
              const requester = bootstrapQuery.data?.profiles.find((profile) => profile.id === request.requesterProfileId);
              const assignee = bootstrapQuery.data?.profiles.find((profile) => profile.id === request.assigneeProfileId);

              return (
                <article key={request.id} className="meal-request-card">
                  <div className="meal-request-avatar" aria-hidden="true">
                    {requester ? requester.displayName.slice(0, 1).toUpperCase() : 'R'}
                  </div>

                  <div className="meal-request-copy">
                    <div className="meal-request-tags">
                      <strong className="meal-request-title">{request.title}</strong>
                      {requester ? <span className="profile-color-chip">{requester.displayName}</span> : null}
                    </div>
                    {request.notes ? <p className="meal-card-notes">{request.notes}</p> : null}
                    {assignee ? <p className="shopping-meta">Assigned to {assignee.displayName}</p> : null}
                  </div>

                  <div className="meal-request-actions">
                    {assigningRequestId === request.id ? (
                      <>
                        <label className="field meal-request-assign-field">
                          <span>Assign person</span>
                          <select value={assigningRequestProfileId} onChange={(event) => setAssigningRequestProfileId(event.target.value)}>
                            <option value="">Unassigned</option>
                            {bootstrapQuery.data?.profiles.map((profile) => (
                              <option key={profile.id} value={profile.id}>
                                {profile.displayName}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          className="secondary-button meal-request-button"
                          type="button"
                          onClick={() => handleAssignRequest(request.id)}
                          disabled={assignMealRequestMutation.isPending}
                        >
                          Save assignment
                        </button>
                      </>
                    ) : (
                      <button
                        className="secondary-button meal-request-button"
                        type="button"
                        onClick={() => handleStartRequestAssignment(request.id, request.assigneeProfileId)}
                        disabled={assignMealRequestMutation.isPending}
                      >
                        Assign person
                      </button>
                    )}
                    <button
                      className="primary-button meal-request-button"
                      type="button"
                      onClick={() => acceptMealRequestMutation.mutate(request.id)}
                      disabled={acceptMealRequestMutation.isPending}
                    >
                      Accept
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="dashboard-empty-card dashboard-empty-card-compact">
              <p className="shopping-meta">No requests are waiting for this day.</p>
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
