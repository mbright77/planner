import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Delete02Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useDashboardOverview } from '../../entities/dashboard/model/useDashboardOverview';
import {
  useAcceptMealRequest,
  useAssignMealRequest,
  useCreateMealPlan,
  useCreateMealRequest,
  useDeleteMealRequest,
  useDeleteMealPlan,
  useMealRequests,
  useMealsWeek,
  useUpdateMealPlan,
} from '../../entities/meal/model/useMealsWeek';
import { useBootstrap } from '../../processes/family-bootstrap/useBootstrap';

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

function buildWeekDays(weekStart: string, locale: string) {
  const startDate = new Date(`${weekStart}T00:00:00.000Z`);

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(startDate);
    current.setUTCDate(startDate.getUTCDate() + index);

    return {
      key: formatDateOnly(current),
      label: current.toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' }),
      dayNumber: current.toLocaleDateString(locale, { day: 'numeric', timeZone: 'UTC' }),
    };
  });
}

function formatWeekRange(weekStart: string, locale: string) {
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  return `${start.toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' })} - ${end.toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
}

function formatLongDate(value: string, locale: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(locale, {
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

function getProfileColorChipClass(colorKey: string | null | undefined) {
  return colorKey ? `profile-color-chip profile-color-chip-${colorKey}` : 'profile-color-chip';
}

export function MealsPage() {
  const { t, i18n } = useTranslation('meals');
  const locale = i18n.language;
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
  const [confirmDeleteMealId, setConfirmDeleteMealId] = useState<string | null>(null);
  const [hasUserNavigatedWeek, setHasUserNavigatedWeek] = useState(false);

  const bootstrapQuery = useBootstrap();
  const dashboardQuery = useDashboardOverview();
  const mealsWeekQuery = useMealsWeek(weekStart);
  const mealRequestsQuery = useMealRequests(weekStart);
  const createMealPlanMutation = useCreateMealPlan(weekStart);
  const createMealRequestMutation = useCreateMealRequest(weekStart);
  const assignMealRequestMutation = useAssignMealRequest(weekStart);
  const acceptMealRequestMutation = useAcceptMealRequest(weekStart);
  const deleteMealRequestMutation = useDeleteMealRequest(weekStart);
  const updateMealPlanMutation = useUpdateMealPlan(weekStart);
  const deleteMealPlanMutation = useDeleteMealPlan(weekStart);

  const weekDays = useMemo(() => buildWeekDays(weekStart, locale), [weekStart, locale]);
  const canPlanMeals = bootstrapQuery.data?.membership.canPlanMeals ?? true;
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
  const selectedMealOwner = bootstrapQuery.data?.profiles.find((profile) => profile.id === selectedMeal?.ownerProfileId);
  const currentUserProfileId = bootstrapQuery.data?.profiles.find((profile) =>
    profile.linkedUserId === bootstrapQuery.data?.membership.userId,
  )?.id;

  useEffect(() => {
    if (!dashboardQuery.data || hasUserNavigatedWeek) {
      return;
    }

    const dashboardDate = dashboardQuery.data.date;
    const fallbackWeekStart = formatDateOnly(getWeekStart(new Date(`${dashboardDate}T00:00:00`)));
    const canonicalWeekStart = mealsWeekQuery.data?.weekStart ?? fallbackWeekStart;

    setSelectedDate(dashboardDate);
    setWeekStart(canonicalWeekStart);
  }, [dashboardQuery.data, mealsWeekQuery.data?.weekStart, hasUserNavigatedWeek]);

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

  function handleSelectDay(day: string) {
    setHasUserNavigatedWeek(true);
    setSelectedDate(day);
    setMealFormError('');
    setRequestFormError('');
    setConfirmDeleteMealId(null);
  }

  function handleShiftWeek(direction: -1 | 1) {
    setHasUserNavigatedWeek(true);
    const { nextWeekStart, nextSelectedDate } = shiftWeekDate(weekStart, selectedDate, direction);
    setWeekStart(nextWeekStart);
    setSelectedDate(nextSelectedDate);
    setMealFormError('');
    setRequestFormError('');
    setConfirmDeleteMealId(null);
  }

  async function handleDeleteMeal(mealId: string) {
    if (confirmDeleteMealId !== mealId) {
      setConfirmDeleteMealId(mealId);
      return;
    }

    await deleteMealPlanMutation.mutateAsync(mealId);
    setConfirmDeleteMealId(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      setMealFormError(t('errors.addDinnerTitle'));
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
      setRequestFormError(t('errors.addRequestTitle'));
      return;
    }

    setRequestFormError('');

    await createMealRequestMutation.mutateAsync({
      requestedForDate: selectedDate,
      title: requestTitle.trim(),
      notes: requestNotes.trim() || null,
    });

    setRequestTitle('');
    setRequestNotes('');
    setShowRequestForm(false);
  }

  async function handleSaveMealEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingMealId) {
      return;
    }

    if (!editingMealTitle.trim()) {
      setMealEditError(t('errors.addDinnerTitleChanges'));
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

  async function handleDeleteRequest(requestId: string) {
    await deleteMealRequestMutation.mutateAsync(requestId);
  }

  function handleStartRequestAssignment(requestId: string, currentAssigneeProfileId: string | null) {
    setAssigningRequestId(requestId);
    setAssigningRequestProfileId(currentAssigneeProfileId ?? '');
  }

  return (
    <section className="flex flex-col gap-4 py-4 md:gap-6">
      <Card>
        <CardHeader>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('eyebrow')}</p>
          <CardTitle className="text-2xl md:text-3xl">{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex-row items-end justify-between gap-3">
          <div>
            <CardTitle className="text-xl md:text-2xl">{formatWeekRange(weekStart, locale)}</CardTitle>
            <CardDescription>{t('weekMeta')}</CardDescription>
            {!canPlanMeals ? <CardDescription>{t('readOnlyNote')}</CardDescription> : null}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" type="button" onClick={() => handleShiftWeek(-1)}>
              <HugeiconsIcon icon={ArrowLeft01Icon} data-icon="inline-start" aria-hidden="true" />
              {t('previous')}
            </Button>
            <Button variant="outline" type="button" onClick={() => handleShiftWeek(1)}>
              {t('next')}
              <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" aria-hidden="true" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-7 gap-2" aria-label={t('planningDaysAria')}>
            {weekDays.map((day) => {
              const isSelected = day.key === selectedDate;
              const meal = mealsByDate.get(day.key);
              const requests = requestsByDate.get(day.key) ?? [];
              const statusLabel = meal
                ? t('mealSet')
                : requests.length > 0
                  ? t('requestsCount', { count: requests.length })
                  : t('open');

              return (
                <Button
                  key={day.key}
                  type="button"
                  variant={isSelected ? 'default' : 'outline'}
                  className="h-auto flex-col gap-0.5 py-2"
                  aria-label={`${day.label} ${day.dayNumber}, ${statusLabel}`}
                  onClick={() => handleSelectDay(day.key)}
                >
                  <span className="text-[11px] uppercase opacity-80">{day.label}</span>
                  <span className="text-sm font-semibold">{day.dayNumber}</span>
                  {meal ? (
                    <HugeiconsIcon icon={Tick02Icon} size={14} aria-hidden="true" />
                  ) : requests.length > 0 ? (
                    <span className="text-[10px] font-medium" aria-hidden="true">
                      {requests.length}
                    </span>
                  ) : (
                    <span className="h-3.5" aria-hidden="true" />
                  )}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {mealsWeekQuery.isLoading ? (
        <div className="grid gap-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ) : null}
      {mealsWeekQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{t('error')}</AlertDescription>
        </Alert>
      ) : null}

      {!canPlanMeals ? (
        <Card>
          <CardHeader>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {selectedMeal ? t('mealSet') : t('open')}
            </p>
            <CardTitle className="text-lg">{formatLongDate(selectedDate, locale)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedMeal ? (
              <>
                <p className="text-base font-semibold">{selectedMeal.title}</p>
                {selectedMeal.notes ? <p className="text-sm text-muted-foreground">{selectedMeal.notes}</p> : null}
                {selectedMealOwner ? (
                  <span className={getProfileColorChipClass(selectedMealOwner.colorKey)}>{selectedMealOwner.displayName}</span>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t('noMealPlanned')}</p>
            )}
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setShowRequestForm(true);
              }}
            >
              {t('requestMeal')}
            </Button>
          </CardContent>
        </Card>
      ) : selectedMeal ? (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('editDinner')}</p>
              <CardTitle className="text-lg">{formatLongDate(selectedDate, locale)}</CardTitle>
            </div>
            <Button variant="outline" type="button" onClick={() => setShowMealOptions((current) => !current)}>
              {showMealOptions ? t('fewerFields') : t('moreOptions')}
            </Button>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSaveMealEdit}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="meal-edit-title">{t('fields.mealTitle')}</Label>
                <Input
                  id="meal-edit-title"
                  value={editingMealTitle}
                  onChange={(event) => setEditingMealTitle(event.target.value)}
                  type="text"
                />
              </div>

              {showMealOptions ? (
                <>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="meal-edit-owner">{t('fields.owner')}</Label>
                    <Select
                      value={editingMealOwnerProfileId || '__none'}
                      onValueChange={(value) => setEditingMealOwnerProfileId(value === '__none' ? '' : value)}
                    >
                      <SelectTrigger id="meal-edit-owner" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="__none">{t('unassigned')}</SelectItem>
                          {bootstrapQuery.data?.profiles.map((profile) => (
                            <SelectItem key={profile.id} value={profile.id}>
                              {profile.displayName}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="meal-edit-notes">{t('fields.notes')}</Label>
                    <Textarea
                      id="meal-edit-notes"
                      value={editingMealNotes}
                      onChange={(event) => setEditingMealNotes(event.target.value)}
                      rows={3}
                    />
                  </div>
                </>
              ) : null}

              {mealEditError ? (
                <Alert variant="destructive">
                  <AlertDescription>{mealEditError}</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={updateMealPlanMutation.isPending || !editingMealId}>
                  {updateMealPlanMutation.isPending
                    ? t('saving')
                    : t('saveChangesForDate')}
                </Button>
                <Button
                  variant={confirmDeleteMealId === selectedMeal.id ? 'destructive' : 'outline'}
                  type="button"
                  onClick={() => handleDeleteMeal(selectedMeal.id)}
                  aria-label={
                    confirmDeleteMealId === selectedMeal.id
                      ? t('confirmDeleteMealAria', { title: selectedMeal.title })
                      : t('deleteMealAria', { title: selectedMeal.title })
                  }
                  disabled={deleteMealPlanMutation.isPending}
                >
                  <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" aria-hidden="true" />
                  {confirmDeleteMealId === selectedMeal.id ? t('confirmDelete') : t('delete')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('planDinner')}</p>
              <CardTitle className="text-lg">{formatLongDate(selectedDate, locale)}</CardTitle>
            </div>
            <Button variant="outline" type="button" onClick={() => setShowMealOptions((current) => !current)}>
              {showMealOptions ? t('fewerFields') : t('moreOptions')}
            </Button>
          </CardHeader>

          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="meal-title">{t('fields.mealTitle')}</Label>
                <Input
                  id="meal-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={t('fields.mealTitlePlaceholder')}
                  type="text"
                />
              </div>

              {showMealOptions ? (
                <>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="meal-owner">{t('fields.owner')}</Label>
                    <Select
                      value={ownerProfileId || '__none'}
                      onValueChange={(value) => setOwnerProfileId(value === '__none' ? '' : value)}
                    >
                      <SelectTrigger id="meal-owner" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="__none">{t('unassigned')}</SelectItem>
                          {bootstrapQuery.data?.profiles.map((profile) => (
                            <SelectItem key={profile.id} value={profile.id}>
                              {profile.displayName}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="meal-notes">{t('fields.notes')}</Label>
                    <Textarea id="meal-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
                  </div>
                </>
              ) : null}

              {mealFormError ? (
                <Alert variant="destructive">
                  <AlertDescription>{mealFormError}</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={createMealPlanMutation.isPending}>
                  {createMealPlanMutation.isPending
                    ? t('saving')
                    : t('saveDinnerForDate')}
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setShowRequestForm(true);
                  }}
                >
                  {t('requestMeal')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('requests')}</p>
            <CardTitle className="text-lg">{t('mealRequestsForDate', { date: formatLongDate(selectedDate, locale) })}</CardTitle>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{t('openCount', { count: selectedRequests.length })}</Badge>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setShowRequestForm((current) => !current);
              }}
            >
              {showRequestForm ? t('hideRequestForm') : t('requestMeal')}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {showRequestForm ? (
            <form className="space-y-4" onSubmit={handleRequestSubmit}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="request-title">{t('fields.requestTitle')}</Label>
                <Input
                  id="request-title"
                  value={requestTitle}
                  onChange={(event) => setRequestTitle(event.target.value)}
                  placeholder={t('fields.requestTitlePlaceholder')}
                  type="text"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="request-notes">{t('fields.notes')}</Label>
                <Textarea id="request-notes" value={requestNotes} onChange={(event) => setRequestNotes(event.target.value)} rows={2} />
              </div>

              {requestFormError ? (
                <Alert variant="destructive">
                  <AlertDescription>{requestFormError}</AlertDescription>
                </Alert>
              ) : null}

              <Button type="submit" disabled={createMealRequestMutation.isPending}>
                {createMealRequestMutation.isPending
                  ? t('saving')
                  : t('addRequestForDate', { date: formatLongDate(selectedDate, locale) })}
              </Button>
            </form>
          ) : null}

          {mealRequestsQuery.isLoading ? <Skeleton className="h-24 rounded-2xl" /> : null}
          {mealRequestsQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{t('errorRequests')}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-3">
            {selectedRequests.length > 0 ? (
              selectedRequests.map((request) => {
                const requester = bootstrapQuery.data?.profiles.find((profile) => profile.id === request.requesterProfileId);
                const assignee = bootstrapQuery.data?.profiles.find((profile) => profile.id === request.assigneeProfileId);

                return (
                  <article key={request.id} className="rounded-xl border border-border bg-muted/20 p-3">
                    <div className="mb-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold md:text-base">{request.title}</p>
                        {requester ? <span className={getProfileColorChipClass(requester.colorKey)}>{requester.displayName}</span> : null}
                      </div>
                      {request.notes ? <p className="text-sm text-muted-foreground">{request.notes}</p> : null}
                      {assignee ? <p className="text-sm text-muted-foreground">{t('assignedTo', { name: assignee.displayName })}</p> : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {assigningRequestId === request.id ? (
                        <>
                          <div className="min-w-[12rem] flex-1">
                            <Select
                              value={assigningRequestProfileId || '__none'}
                              onValueChange={(value) => setAssigningRequestProfileId(value === '__none' ? '' : value)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder={t('unassigned')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectItem value="__none">{t('unassigned')}</SelectItem>
                                  {bootstrapQuery.data?.profiles.map((profile) => (
                                    <SelectItem key={profile.id} value={profile.id}>
                                      {profile.displayName}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            variant="outline"
                            type="button"
                            onClick={() => handleAssignRequest(request.id)}
                            disabled={assignMealRequestMutation.isPending}
                          >
                            {t('saveAssignment')}
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          type="button"
                          onClick={() => handleStartRequestAssignment(request.id, request.assigneeProfileId)}
                          disabled={assignMealRequestMutation.isPending}
                        >
                          {t('assignPerson')}
                        </Button>
                      )}

                      {canPlanMeals ? (
                        <Button
                          type="button"
                          onClick={() => acceptMealRequestMutation.mutate(request.id)}
                          disabled={acceptMealRequestMutation.isPending}
                        >
                          <HugeiconsIcon icon={Tick02Icon} data-icon="inline-start" aria-hidden="true" />
                          {t('accept')}
                        </Button>
                      ) : null}

                      {canPlanMeals || request.requesterProfileId === currentUserProfileId ? (
                        <Button
                          variant="destructive"
                          type="button"
                          onClick={() => void handleDeleteRequest(request.id)}
                          disabled={deleteMealRequestMutation.isPending}
                        >
                          <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" aria-hidden="true" />
                          {t('deleteRequest')}
                        </Button>
                      ) : null}
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">{t('noRequestsWaiting')}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
