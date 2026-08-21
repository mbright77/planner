import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar03Icon, LinkSquare01Icon } from '@hugeicons/core-free-icons';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  useCalendarSources,
  useDisconnectGoogleCalendar,
  useGoogleCalendars,
  useStartGoogleAuthorization,
  useUpdateCalendarSources,
  useUpdateGoogleCalendarSelection,
} from '../../entities/calendar-source/model/useCalendarSources';

import type { GoogleCalendarSummary, GoogleAuthorizationUrlResponse } from '@planner/api-client';

type CalendarSourcesSectionProps = {
  profileId: string;
};

const sourceOptions = ['Local', 'Google', 'Both'] as const;

type LocationState = {
  googleCalendarResult?: string;
  googleCalendarReason?: string;
};

export function CalendarSourcesSection({ profileId }: CalendarSourcesSectionProps) {
  const { t } = useTranslation('family');
  const location = useLocation();
  const locationState = location.state as LocationState | undefined;

  const calendarSourcesQuery = useCalendarSources();
  const googleCalendarsQuery = useGoogleCalendars();
  const startGoogleAuthMutation = useStartGoogleAuthorization();
  const updateCalendarSourcesMutation = useUpdateCalendarSources();
  const updateGoogleCalendarSelectionMutation = useUpdateGoogleCalendarSelection();
  const disconnectGoogleCalendarMutation = useDisconnectGoogleCalendar();

  const [showCalendarPicker, setShowCalendarPicker] = useState(false);

  const isConfigured = calendarSourcesQuery.data?.isGoogleConfigured ?? false;
  const connection = calendarSourcesQuery.data?.connection;
  const currentSources = calendarSourcesQuery.data?.sources ?? 'Local';
  const isConnected = connection !== null && connection !== undefined && connection.status === 'Connected';
  const isNeedsReauth = connection !== null && connection !== undefined && connection.status === 'NeedsReauth';

  const calendars = googleCalendarsQuery.data?.calendars ?? [];
  const selectedCalendarIds = calendars.filter((c: GoogleCalendarSummary) => c.isSelected).map((c: GoogleCalendarSummary) => c.googleCalendarId);

  const hasSelection = selectedCalendarIds.length > 0;
  const canSelectGoogle = isConnected && hasSelection;

  function handleSourceChange(value: string) {
    updateCalendarSourcesMutation.mutate({ sources: value });
  }

  function handleConnect() {
    startGoogleAuthMutation.mutate(undefined, {
      onSuccess: (response: GoogleAuthorizationUrlResponse) => {
        window.location.assign(response.authorizationUrl);
      },
    });
  }

  function handleReconnect() {
    handleConnect();
  }

  function handleDisconnect() {
    disconnectGoogleCalendarMutation.mutate();
  }

  function handleCalendarToggle(calendarId: string, checked: boolean) {
    const newSelected = checked
      ? [...selectedCalendarIds, calendarId]
      : selectedCalendarIds.filter((id: string) => id !== calendarId);

    updateGoogleCalendarSelectionMutation.mutate({ selectedCalendarIds: newSelected });
  }

  function handleRefreshCalendars() {
    googleCalendarsQuery.refetch();
  }

  if (!isConfigured) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {locationState?.googleCalendarResult === 'connected' ? (
        <Alert variant="default" className="rounded-xl">
          <AlertDescription>{t('calendarSources.connectSuccess')}</AlertDescription>
        </Alert>
      ) : null}
      {locationState?.googleCalendarResult === 'error' ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>
            {locationState.googleCalendarReason
              ? t(`calendarSources.errors.${locationState.googleCalendarReason}`)
              : t('calendarSources.connectError')}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <HugeiconsIcon icon={Calendar03Icon} aria-hidden="true" />
            {t('calendarSources.title')}
          </CardTitle>
          <CardDescription>{t('calendarSources.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`calendar-sources-${profileId}`}>{t('calendarSources.sourceLabel')}</Label>
            <Select
              value={currentSources}
              onValueChange={handleSourceChange}
              disabled={!isConnected && currentSources !== 'Local'}
            >
              <SelectTrigger id={`calendar-sources-${profileId}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {sourceOptions.map((option) => (
                    <SelectItem key={option} value={option} disabled={option !== 'Local' && !canSelectGoogle}>
                      {t(`calendarSources.sourceOptions.${option.toLowerCase()}`)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{t('calendarSources.googleConnection')}</p>
                <p className="text-sm text-muted-foreground">{t('calendarSources.googleConnectionHint')}</p>
              </div>
            </div>

            {calendarSourcesQuery.isLoading ? (
              <Skeleton className="mt-3 h-10 w-full" />
            ) : isConnected ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="default">
                  <HugeiconsIcon icon={LinkSquare01Icon} aria-hidden="true" className="mr-1" />
                  {connection?.googleAccountEmail}
                </Badge>
                {isNeedsReauth ? (
                  <Button variant="outline" size="sm" onClick={handleReconnect} disabled={startGoogleAuthMutation.isPending}>
                    {t('calendarSources.reconnect')}
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnectGoogleCalendarMutation.isPending}>
                  {t('calendarSources.disconnect')}
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="mt-3 w-full"
                onClick={handleConnect}
                disabled={startGoogleAuthMutation.isPending}
              >
                <HugeiconsIcon icon={LinkSquare01Icon} data-icon="inline-start" aria-hidden="true" />
                {t('calendarSources.connect')}
              </Button>
            )}
          </div>

          {isConnected && showCalendarPicker ? (
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <p className="text-sm font-medium">{t('calendarSources.calendarPickerTitle')}</p>
                  <p className="text-sm text-muted-foreground">{t('calendarSources.calendarPickerHint')}</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleRefreshCalendars} disabled={googleCalendarsQuery.isRefetching}>
                  {t('calendarSources.refreshList')}
                </Button>
              </div>

              {googleCalendarsQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : googleCalendarsQuery.isError ? (
                <Alert variant="destructive">
                  <AlertDescription>{t('calendarSources.loadError')}</AlertDescription>
                </Alert>
              ) : calendars.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('calendarSources.noCalendars')}</p>
              ) : (
                <div className="max-h-[300px] overflow-y-auto space-y-2">
                  {calendars.map((calendar: GoogleCalendarSummary) => (
                    <div
                      key={calendar.googleCalendarId}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                    >
                      <div className="flex items-center gap-3">
                        {calendar.colorHex ? (
                          <span
                            className="size-4 shrink-0 rounded-full"
                            style={{ backgroundColor: calendar.colorHex }}
                            aria-hidden="true"
                          />
                        ) : null}
                        <div>
                          <p className="text-sm font-medium">{calendar.displayName}</p>
                          <p className="text-xs text-muted-foreground">
                            {calendar.isPrimary ? t('calendarSources.primary') : calendar.accessRole}
                          </p>
                        </div>
                      </div>
                      <Checkbox
                        id={`calendar-${calendar.googleCalendarId}`}
                        checked={calendar.isSelected}
                        onCheckedChange={(checked) => handleCalendarToggle(calendar.googleCalendarId, checked as boolean)}
                        disabled={updateGoogleCalendarSelectionMutation.isPending}
                      />
                    </div>
                  ))}
                </div>
              )}

              {hasSelection && currentSources === 'Local' ? (
                <Alert variant="default" className="mt-3">
                  <AlertDescription>{t('calendarSources.enableGoogleHint')}</AlertDescription>
                </Alert>
              ) : null}
              {!hasSelection && (currentSources === 'Google' || currentSources === 'Both') ? (
                <Alert variant="destructive" className="mt-3">
                  <AlertDescription>{t('calendarSources.noSelectionWarning')}</AlertDescription>
                </Alert>
              ) : null}
            </div>
          ) : null}

          {isConnected && !showCalendarPicker ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowCalendarPicker(true)}
            >
              {t('calendarSources.showCalendarPicker')}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
