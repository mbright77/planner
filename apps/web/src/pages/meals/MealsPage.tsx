import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import { MoveMealDrawer } from './MoveMealDrawer';
import { WeekDayPicker } from './WeekDayPicker';
import { formatDateOnly, formatLongDate, formatWeekRange, getWeekStart, shiftWeekDate } from './weekDays';

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
  const [recipeUrl, setRecipeUrl] = useState('');
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
  const [editingMealRecipeUrl, setEditingMealRecipeUrl] = useState('');
  const [editingMealOwnerProfileId, setEditingMealOwnerProfileId] = useState('');
  const [mealEditError, setMealEditError] = useState('');
  const [assigningRequestId, setAssigningRequestId] = useState<string | null>(null);
  const [assigningRequestProfileId, setAssigningRequestProfileId] = useState('');
  const [confirmDeleteMealId, setConfirmDeleteMealId] = useState<string | null>(null);
  const [showMoveDrawer, setShowMoveDrawer] = useState(false);
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

  const canPlanMeals = bootstrapQuery.data?.membership.canPlanMeals ?? true;
  const mealsByDate = useMemo(() => {
    return new Map((mealsWeekQuery.data?.meals ?? []).map((meal) => [meal.mealDate, meal]));
  }, [mealsWeekQuery.data?.meals]);
  const mealDates = useMemo(() => new Set(mealsByDate.keys()), [mealsByDate]);
  const requestsByDate = useMemo(() => {
    const grouped = new Map<string, typeof mealRequestsQuery.data>();

    for (const request of mealRequestsQuery.data ?? []) {
      const key = request.requestedForDate ?? 'unscheduled';
      const existing = grouped.get(key) ?? [];
      grouped.set(key, [...existing, request]);
    }

    return grouped;
  }, [mealRequestsQuery.data]);

  const requestCounts = useMemo(() => {
    return new Map([...requestsByDate].map(([date, requests]) => [date, requests?.length ?? 0]));
  }, [requestsByDate]);

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
      setEditingMealRecipeUrl(selectedMeal.recipeUrl ?? '');
      setEditingMealOwnerProfileId(selectedMeal.ownerProfileId ?? '');
      setMealEditError('');
      return;
    }

    setEditingMealId(null);
    setEditingMealTitle('');
    setEditingMealNotes('');
    setEditingMealRecipeUrl('');
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
      recipeUrl: recipeUrl.trim() || null,
      ownerProfileId: ownerProfileId || null,
    });

    setTitle('');
    setNotes('');
    setRecipeUrl('');
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
        recipeUrl: editingMealRecipeUrl.trim() || null,
        ownerProfileId: editingMealOwnerProfileId || null,
      },
    });
  }

  async function handleMoveMeal(newDate: string) {
    if (!selectedMeal) {
      return;
    }

    try {
      await updateMealPlanMutation.mutateAsync({
        mealId: selectedMeal.id,
        request: {
          mealDate: newDate,
          title: selectedMeal.title,
          notes: selectedMeal.notes,
          recipeUrl: selectedMeal.recipeUrl,
          ownerProfileId: selectedMeal.ownerProfileId,
        },
      });
      setShowMoveDrawer(false);
      toast.success(t('move.success'));
    } catch (error) {
      const isConflict = (error as { status?: number }).status === 409;
      toast.error(t('move.failed'), isConflict ? { description: t('move.conflict') } : undefined);
    }
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
          <WeekDayPicker
            weekStart={weekStart}
            selectedDate={selectedDate}
            locale={locale}
            mealDates={mealDates}
            requestCounts={requestCounts}
            onSelect={handleSelectDay}
            onShiftWeek={handleShiftWeek}
            showWeekNav={false}
          />
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
                {selectedMeal.recipeUrl ? (
                  <div>
                    <a
                      href={selectedMeal.recipeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {t('fields.recipeLink')}
                    </a>
                  </div>
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

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="meal-edit-recipe-url">{t('fields.recipeUrl')}</Label>
                    <Input
                      id="meal-edit-recipe-url"
                      value={editingMealRecipeUrl}
                      onChange={(event) => setEditingMealRecipeUrl(event.target.value)}
                      placeholder={t('fields.recipeUrlPlaceholder')}
                      type="url"
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
                <Button variant="outline" type="button" onClick={() => setShowMoveDrawer(true)}>
                  {t('moveMeal')}
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

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="meal-recipe-url">{t('fields.recipeUrl')}</Label>
                    <Input
                      id="meal-recipe-url"
                      value={recipeUrl}
                      onChange={(event) => setRecipeUrl(event.target.value)}
                      placeholder={t('fields.recipeUrlPlaceholder')}
                      type="url"
                    />
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

      {selectedMeal ? (
        <MoveMealDrawer
          meal={selectedMeal}
          currentWeekStart={weekStart}
          locale={locale}
          open={showMoveDrawer}
          isPending={updateMealPlanMutation.isPending}
          onOpenChange={setShowMoveDrawer}
          onConfirm={(newDate) => void handleMoveMeal(newDate)}
        />
      ) : null}
    </section>
  );
}
