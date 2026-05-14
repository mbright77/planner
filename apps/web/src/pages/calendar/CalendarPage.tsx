import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Calendar01Icon,
  Clock01Icon,
  Delete02Icon,
  Edit01Icon,
  RepeatIcon,
} from '@hugeicons/core-free-icons';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useDashboardOverview } from '../../entities/dashboard/model/useDashboardOverview';
import {
  useCalendarWeek,
  useCreateCalendarEvent,
  useDeleteCalendarEvent,
  useUpdateCalendarEvent,
} from '../../entities/event/model/useCalendarWeek';
import { useBootstrap } from '../../processes/family-bootstrap/useBootstrap';
import { addToCalendar } from '../../shared/lib/calendar';

function getProfileColorChipClass(colorKey: string | null | undefined) {
  return colorKey ? `profile-color-chip profile-color-chip-${colorKey}` : 'profile-color-chip';
}

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

function formatMonthLabel(value: string, locale: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(locale, {
    month: 'long',
  });
}

function formatWeekRangeLabel(value: string, locale: string) {
  const start = new Date(`${value}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  return `${start.toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' })} - ${end.toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
}

function formatWeekdayShort(value: string, locale: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(locale, {
    weekday: 'short',
  });
}

function buildWeekDays(weekStart: string, locale: string) {
  const startDate = new Date(`${weekStart}T00:00:00.000Z`);

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(startDate);
    current.setUTCDate(startDate.getUTCDate() + index);

    return {
      key: formatDateOnly(current),
      label: formatWeekdayShort(formatDateOnly(current), locale),
      dayNumber: current.toLocaleDateString(locale, { day: 'numeric', timeZone: 'UTC' }),
    };
  });
}

function formatAgendaHeading(value: string, locale: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function formatEventTime(startAtUtc: string, endAtUtc: string, locale: string) {
  const start = new Date(startAtUtc);
  const end = new Date(endAtUtc);

  return `${start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false })} - ${end.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

function getEventDayKey(calendarEvent: { startAtUtc: string; date?: string | null }) {
  return calendarEvent.date ?? calendarEvent.startAtUtc.slice(0, 10);
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
  const { t, i18n } = useTranslation('calendar');
  const locale = i18n.language;
  const today = new Date();
  const initialStart = getWeekStart(today);
  const initialWeekStart = formatDateOnly(initialStart);
  const initialSelectedDate = formatDateOnly(today);

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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [hasUserNavigatedWeek, setHasUserNavigatedWeek] = useState(false);

  const bootstrapQuery = useBootstrap();
  const dashboardQuery = useDashboardOverview();
  const calendarWeekQuery = useCalendarWeek(weekStart);
  const createCalendarEventMutation = useCreateCalendarEvent(weekStart);
  const updateCalendarEventMutation = useUpdateCalendarEvent(weekStart);
  const deleteCalendarEventMutation = useDeleteCalendarEvent(weekStart);
  const weekDays = useMemo(() => buildWeekDays(weekStart, locale), [weekStart, locale]);
  const calendarEvents = useMemo(() => calendarWeekQuery.data?.events ?? [], [calendarWeekQuery.data?.events]);

  useEffect(() => {
    if (!dashboardQuery.data || hasUserNavigatedWeek) {
      return;
    }

    const dashboardDate = dashboardQuery.data.date;
    const fallbackWeekStart = formatDateOnly(getWeekStart(new Date(`${dashboardDate}T00:00:00`)));
    const canonicalWeekStart = calendarWeekQuery.data?.weekStart ?? fallbackWeekStart;

    setSelectedDate(dashboardDate);
    setWeekStart(canonicalWeekStart);
  }, [calendarWeekQuery.data?.weekStart, dashboardQuery.data, hasUserNavigatedWeek]);

  const eventsByDay = useMemo(() => {
    const groups = new Map<string, typeof calendarEvents>(weekDays.map((day) => [day.key, []]));

    for (const calendarEvent of calendarEvents) {
      const dayKey = getEventDayKey(calendarEvent);
      const existing = groups.get(dayKey) ?? [];
      groups.set(dayKey, [...existing, calendarEvent]);
    }

    return groups;
  }, [calendarEvents, weekDays]);

  const eventCountsByDay = useMemo(() => {
    return new Map(weekDays.map((day) => [day.key, (eventsByDay.get(day.key) ?? []).length]));
  }, [eventsByDay, weekDays]);
  const selectedDayEvents = eventsByDay.get(selectedDate) ?? [];

  function closeDrawer() {
    setIsDrawerOpen(false);
    setFormError('');
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
    setApplyToSeries(true);
    setFormError('');
    setConfirmDeleteEventId(null);
    setIsDrawerOpen(true);
  }

  function seedEditForm(eventId: string) {
    const calendarEvent = calendarEvents.find((item) => item.id === eventId);
    if (!calendarEvent) {
      return;
    }

    const eventDate = getEventDayKey(calendarEvent);
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
    setApplyToSeries(true);
    setFormError('');
    setConfirmDeleteEventId(null);
    setIsDrawerOpen(true);
  }

  function handleSelectDay(day: string) {
    setHasUserNavigatedWeek(true);
    setSelectedDate(day);
    setFormError('');
    setConfirmDeleteEventId(null);
  }

  function handleShiftWeek(direction: -1 | 1) {
    setHasUserNavigatedWeek(true);
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
      setFormError(t('errors.title'));
      return;
    }

    if (Number.isNaN(nextStart.getTime()) || Number.isNaN(nextEnd.getTime())) {
      setFormError(t('errors.time'));
      return;
    }

    if (nextEnd <= nextStart) {
      setFormError(t('errors.endTime'));
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

    closeDrawer();
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
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle className="text-xl capitalize md:text-2xl">{formatMonthLabel(weekStart, locale)}</CardTitle>
              <CardDescription>{formatWeekRangeLabel(weekStart, locale)}</CardDescription>
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
          </div>

          <div className="grid grid-cols-7 gap-2" aria-label={t('weekDaysAria')}>
            {weekDays.map((day) => {
              const isActive = day.key === selectedDate;
              const eventCount = eventCountsByDay.get(day.key) ?? 0;

              return (
                <Button
                  key={day.key}
                  type="button"
                  variant={isActive ? 'default' : 'outline'}
                  className="h-auto flex-col gap-0.5 py-2"
                  onClick={() => handleSelectDay(day.key)}
                >
                  <span className="text-[11px] uppercase opacity-80">{day.label}</span>
                  <span className="text-sm font-semibold">{day.dayNumber}</span>
                  {!isActive && eventCount > 0 ? <span className="text-[10px]">{eventCount}</span> : null}
                </Button>
              );
            })}
          </div>
        </CardHeader>
      </Card>

      {calendarWeekQuery.isLoading ? (
        <div className="grid gap-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ) : null}

      {calendarWeekQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{t('error')}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('selectedDay')}</p>
            <CardTitle className="text-lg">{formatAgendaHeading(selectedDate, locale)}</CardTitle>
            <CardDescription>
              {selectedDayEvents.length === 0
                ? t('noEvents')
                : t('eventsPlanned', { count: selectedDayEvents.length })}
            </CardDescription>
          </div>

          <Button type="button" onClick={() => seedCreateForm(selectedDate)}>
            <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" aria-hidden="true" />
            {t('addHere')}
          </Button>
        </CardHeader>

        <CardContent>
          {selectedDayEvents.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {selectedDayEvents.map((calendarEvent) => {
                const assignedProfile = bootstrapQuery.data?.profiles.find(
                  (profile) => profile.id === calendarEvent.assignedProfileId,
                );

                return (
                  <li key={calendarEvent.id} className="rounded-xl border border-border bg-muted/20 p-3">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-2">
                        <Badge variant="secondary">{t('event')}</Badge>
                        <p className="text-sm font-semibold md:text-base">{calendarEvent.title}</p>
                        <p className="flex items-center gap-1 text-sm text-muted-foreground">
                          <HugeiconsIcon icon={Clock01Icon} aria-hidden="true" />
                          {formatEventTime(calendarEvent.startAtUtc, calendarEvent.endAtUtc, locale)}
                        </p>
                        {calendarEvent.isRecurring ? (
                          <p className="flex items-center gap-1 text-sm text-muted-foreground">
                            <HugeiconsIcon icon={RepeatIcon} aria-hidden="true" />
                            {t('repeatsWeeklyThrough', { date: calendarEvent.repeatUntil })}
                          </p>
                        ) : null}
                        {calendarEvent.notes ? <p className="text-sm text-muted-foreground">{calendarEvent.notes}</p> : null}
                        {assignedProfile ? (
                          <div aria-label={t('assignedTo', { name: assignedProfile.displayName })}>
                            <span className={getProfileColorChipClass(assignedProfile.colorKey)}>{assignedProfile.displayName}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => exportCalendarEvent(calendarEvent)}
                      >
                        <HugeiconsIcon icon={Calendar01Icon} data-icon="inline-start" aria-hidden="true" />
                        {t('addToCalendar')}
                      </Button>
                      <Button variant="outline" type="button" onClick={() => seedEditForm(calendarEvent.id)}>
                        <HugeiconsIcon icon={Edit01Icon} data-icon="inline-start" aria-hidden="true" />
                        {t('edit')}
                      </Button>
                      <Button
                        variant={confirmDeleteEventId === calendarEvent.id ? 'destructive' : 'outline'}
                        type="button"
                        aria-label={
                          confirmDeleteEventId === calendarEvent.id
                            ? t('confirmDeleteEventAria', { title: calendarEvent.title })
                            : t('deleteEventAria', { title: calendarEvent.title })
                        }
                        onClick={() => handleDeleteEvent(calendarEvent.id)}
                        disabled={deleteCalendarEventMutation.isPending}
                      >
                        <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" aria-hidden="true" />
                        {confirmDeleteEventId === calendarEvent.id ? t('confirmDelete') : t('delete')}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">{t('emptyDayHint')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>{editingEventId ? t('editEvent') : t('addEvent')}</DrawerTitle>
            <DrawerDescription>{formatAgendaHeading(selectedDate, locale)}</DrawerDescription>
          </DrawerHeader>

          <form className="px-4 pb-2" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="calendar-title">{t('fields.title')}</Label>
                <Input
                  id="calendar-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={t('fields.titlePlaceholder')}
                  type="text"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="calendar-start-time">{t('fields.startTime')}</Label>
                  <Input
                    id="calendar-start-time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    type="time"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="calendar-end-time">{t('fields.endTime')}</Label>
                  <Input
                    id="calendar-end-time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    type="time"
                  />
                </div>
              </div>

              <Button variant="outline" type="button" onClick={() => setShowMoreOptions((current) => !current)}>
                {showMoreOptions ? t('hideExtraDetails') : t('showExtraDetails')}
              </Button>

              {showMoreOptions ? (
                <>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="calendar-profile">{t('fields.assignedProfile')}</Label>
                    <Select value={assignedProfileId || '__none'} onValueChange={(value) => setAssignedProfileId(value === '__none' ? '' : value)}>
                      <SelectTrigger id="calendar-profile" className="w-full">
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

                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">{t('fields.repeatWeekly')}</p>
                      <p className="text-sm text-muted-foreground">{t('fields.repeatWeeklyHint')}</p>
                    </div>
                    <Switch checked={repeatsWeekly} onCheckedChange={setRepeatsWeekly} />
                  </div>

                  {repeatsWeekly ? (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="calendar-repeat-until">{t('fields.repeatUntil')}</Label>
                      <Input
                        id="calendar-repeat-until"
                        value={repeatUntil}
                        onChange={(event) => setRepeatUntil(event.target.value)}
                        type="date"
                      />
                    </div>
                  ) : null}

                  {editingEventId && repeatsWeekly ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                      <div>
                        <p className="text-sm font-medium">{t('updateFutureRepeats')}</p>
                        <p className="text-sm text-muted-foreground">{t('updateFutureRepeatsDescription')}</p>
                      </div>
                      <Switch checked={applyToSeries} onCheckedChange={setApplyToSeries} />
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="calendar-notes">{t('fields.notes')}</Label>
                    <Textarea
                      id="calendar-notes"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      rows={3}
                    />
                  </div>
                </>
              ) : null}

              {formError ? (
                <Alert variant="destructive">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : null}
            </div>

            <DrawerFooter className="px-0">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button variant="outline" type="button" onClick={closeDrawer}>
                  {t('cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={createCalendarEventMutation.isPending || updateCalendarEventMutation.isPending}
                >
                  {createCalendarEventMutation.isPending || updateCalendarEventMutation.isPending
                    ? t('saving')
                    : editingEventId
                      ? t('saveEvent')
                      : t('addEvent')}
                </Button>
              </div>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    </section>
  );
}
