import { useMemo, useState } from 'react';

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

export function MealsPage() {
  const initialWeekStart = formatDateOnly(getWeekStart(new Date()));

  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [mealDate, setMealDate] = useState(initialWeekStart);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [ownerProfileId, setOwnerProfileId] = useState('');
  const [requestTitle, setRequestTitle] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [requesterProfileId, setRequesterProfileId] = useState('');
  const [requestedForDate, setRequestedForDate] = useState(initialWeekStart);

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
  }, [mealsWeekQuery.data]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    await createMealPlanMutation.mutateAsync({
      mealDate,
      title: title.trim(),
      notes: notes.trim() || null,
      ownerProfileId: ownerProfileId || null,
    });

    setTitle('');
    setNotes('');
    setOwnerProfileId('');
  }

  async function handleRequestSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!requestTitle.trim()) {
      return;
    }

    await createMealRequestMutation.mutateAsync({
      requesterProfileId: requesterProfileId || null,
      requestedForDate: requestedForDate || null,
      title: requestTitle.trim(),
      notes: requestNotes.trim() || null,
    });

    setRequestTitle('');
    setRequestNotes('');
    setRequesterProfileId('');
  }

  async function handleQuickAssign(
    mealId: string,
    currentMealDate: string,
    currentTitle: string,
    currentNotes: string | null,
    currentOwnerProfileId: string | null,
  ) {
    const profiles = bootstrapQuery.data?.profiles ?? [];
    if (profiles.length === 0) {
      return;
    }

    const currentIndex = profiles.findIndex((profile) => profile.id === currentOwnerProfileId);
    const nextProfile = profiles[(currentIndex + 1 + profiles.length) % profiles.length];

    await updateMealPlanMutation.mutateAsync({
      mealId,
      request: {
        mealDate: currentMealDate,
        title: currentTitle,
        notes: currentNotes,
        ownerProfileId: nextProfile?.id ?? null,
      },
    });
  }

  async function handleAssignRequest(requestId: string, currentAssigneeProfileId: string | null) {
    const profiles = bootstrapQuery.data?.profiles ?? [];
    if (profiles.length === 0) {
      return;
    }

    const currentIndex = profiles.findIndex((profile) => profile.id === currentAssigneeProfileId);
    const nextProfile = profiles[(currentIndex + 1 + profiles.length) % profiles.length];

    await assignMealRequestMutation.mutateAsync({
      requestId,
      assigneeProfileId: nextProfile?.id ?? null,
    });
  }

  return (
    <section className="page meals-page">
      <p className="eyebrow">Meals</p>
      <h2 className="page-title">Weekly meals</h2>
      <p className="page-copy">
        Plan one dinner per day so the family can see what&apos;s covered and who is owning it.
      </p>

      <section className="meals-header-panel">
        <div>
          <h3 className="meals-range-title">{formatWeekRange(weekStart)}</h3>
          <p className="shopping-meta">One dinner plan per day, visible to the whole family.</p>
        </div>
        <div className="meals-plan-badge">Plan week</div>
      </section>

      <form className="meals-form meals-compose-card" onSubmit={handleSubmit}>
        <label className="field meals-field-wide">
          <span>Week start</span>
          <input value={weekStart} onChange={(event) => setWeekStart(event.target.value)} type="date" />
        </label>

        <label className="field">
          <span>Meal date</span>
          <input value={mealDate} onChange={(event) => setMealDate(event.target.value)} type="date" />
        </label>

        <label className="field meals-field-wide">
          <span>Meal title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Plan dinner" type="text" />
        </label>

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

        <button className="primary-button" type="submit" disabled={createMealPlanMutation.isPending}>
          {createMealPlanMutation.isPending ? 'Saving...' : 'Add meal'}
        </button>
      </form>

      {mealsWeekQuery.isLoading ? <p className="page-copy">Loading weekly meals...</p> : null}
      {mealsWeekQuery.isError ? <p className="form-error">Unable to load weekly meals.</p> : null}

      <div className="meals-grid">
        {weekDays.map((day) => {
          const meal = mealsByDate.get(day.key);
          const owner = bootstrapQuery.data?.profiles.find((profile) => profile.id === meal?.ownerProfileId);
          const className = meal
            ? day.key === weekDays[4]?.key
              ? 'meal-card meal-card-featured'
              : 'meal-card'
            : 'meal-card meal-card-empty';

          return (
            <article key={day.key} className={className}>
              <div className="meal-card-header">
                <div>
                  <p className="eyebrow">{day.label}</p>
                  <h3 className="profile-card-title">{day.dayNumber}</h3>
                </div>
                {owner ? <span className="profile-color-chip">{owner.displayName}</span> : null}
              </div>

                {meal ? (
                  <>
                    <div className="meal-card-body">
                      <strong className="meal-card-title">{meal.title}</strong>
                      {meal.notes ? <p className="meal-card-notes">{meal.notes}</p> : null}
                    </div>

                  <button
                    className="secondary-button meal-card-button"
                    type="button"
                    onClick={() =>
                      handleQuickAssign(meal.id, meal.mealDate, meal.title, meal.notes, meal.ownerProfileId)
                    }
                  >
                    Rotate owner
                  </button>
                </>
              ) : (
                <div className="meal-card-empty-state">
                  <p className="shopping-meta">No meal planned yet.</p>
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
            <h3 className="profile-card-title">Meal requests</h3>
          </div>
          <span className="profile-color-chip">{mealRequestsQuery.data?.length ?? 0} open</span>
        </div>

        <form className="meal-requests-form" onSubmit={handleRequestSubmit}>
          <label className="field meal-requests-field-wide">
            <span>Request title</span>
            <input
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

          <label className="field">
            <span>For date</span>
            <input value={requestedForDate} onChange={(event) => setRequestedForDate(event.target.value)} type="date" />
          </label>

          <label className="field meal-requests-field-wide">
            <span>Notes</span>
            <textarea value={requestNotes} onChange={(event) => setRequestNotes(event.target.value)} rows={2} />
          </label>

          <button className="primary-button" type="submit" disabled={createMealRequestMutation.isPending}>
            {createMealRequestMutation.isPending ? 'Saving...' : 'Add request'}
          </button>
        </form>

        {mealRequestsQuery.isLoading ? <p className="page-copy">Loading meal requests...</p> : null}
        {mealRequestsQuery.isError ? <p className="form-error">Unable to load meal requests.</p> : null}

        <div className="meal-request-list">
          {mealRequestsQuery.data?.map((request) => {
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
                    {request.requestedForDate ? <span className="shopping-meta">For {request.requestedForDate}</span> : null}
                  </div>
                  {request.notes ? <p className="meal-card-notes">{request.notes}</p> : null}
                  {assignee ? <p className="shopping-meta">Assigned to {assignee.displayName}</p> : null}
                </div>

                <div className="meal-request-actions">
                  <button
                    className="secondary-button meal-request-button"
                    type="button"
                    onClick={() => handleAssignRequest(request.id, request.assigneeProfileId)}
                    disabled={assignMealRequestMutation.isPending}
                  >
                    Assign
                  </button>
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
          })}
        </div>
      </section>
    </section>
  );
}
