import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar01Icon, Restaurant01Icon, ShoppingCart01Icon } from '@hugeicons/core-free-icons';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardOverview } from '../../entities/dashboard/model/useDashboardOverview';
import { useBootstrap } from '../../processes/family-bootstrap/useBootstrap';

function formatLongDate(value: string, locale: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatTimeBlock(value: string, locale: string) {
  return new Date(value).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getGreetingKey() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'greeting.morning';
  }

  if (hour < 18) {
    return 'greeting.afternoon';
  }

  return 'greeting.evening';
}

function getProfileColorChipClass(colorKey: string | null | undefined) {
  return colorKey ? `profile-color-chip profile-color-chip-${colorKey}` : 'profile-color-chip';
}

function getProfileAccentColor(colorKey: string | null | undefined) {
  switch (colorKey) {
    case 'green':
      return '#84ac8e';
    case 'blue':
      return '#5da9e9';
    case 'pink':
      return '#fd898a';
    case 'yellow':
      return '#f4d35e';
    default:
      return 'var(--border)';
  }
}

export function HomePage() {
  const { t, i18n } = useTranslation('home');
  const locale = i18n.language;
  const bootstrapQuery = useBootstrap();
  const dashboardQuery = useDashboardOverview();

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
    <section className="flex flex-col gap-4 py-4 md:gap-6" aria-label={t('eyebrow')}>
      <Card>
        <CardHeader className="gap-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('eyebrow')}</p>
          <h2 className="font-heading text-2xl font-medium md:text-3xl">{t(getGreetingKey(), { team: t('team') })}</h2>
          <CardDescription>
            {dashboardQuery.data ? formatLongDate(dashboardQuery.data.date, locale) : t('loadingOverview')}
          </CardDescription>
        </CardHeader>
      </Card>

      {dashboardQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2" aria-hidden="true">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      ) : null}

      {dashboardQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{t('error')}</AlertDescription>
        </Alert>
      ) : null}

      {dashboardQuery.data ? (
        <Card aria-label={t('todayEventsAria')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HugeiconsIcon icon={Calendar01Icon} aria-hidden="true" />
              {t('todayTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayEvents.length > 0 ? (
              <ol className="flex flex-col gap-3">
                {todayEvents.map((event) => {
                  const assignedProfile = event.assignedProfileId ? profilesById.get(event.assignedProfileId) : null;
                  const timeBlock = formatTimeBlock(event.startAtUtc, locale);
                  const accentColor = getProfileAccentColor(assignedProfile?.colorKey);

                  return (
                    <li
                      key={event.id}
                      className="grid gap-2 rounded-xl border border-border bg-muted/20 p-3 md:grid-cols-[5rem_1fr] md:items-start"
                      style={{ borderLeftWidth: '6px', borderLeftColor: accentColor }}
                    >
                      <div className="text-sm font-medium text-muted-foreground" aria-label={t('startsAt', { time: timeBlock })}>
                        {timeBlock}
                      </div>
                      <article className="flex min-w-0 flex-col gap-2">
                        <strong className="text-sm font-semibold text-foreground md:text-base">{event.title}</strong>
                        {assignedProfile ? (
                          <div>
                            <span className={getProfileColorChipClass(assignedProfile.colorKey)}>{assignedProfile.displayName}</span>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">{t('assignedFallback')}</p>
                        )}
                        {event.notes ? <p className="text-sm text-muted-foreground">{event.notes}</p> : null}
                      </article>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">{t('emptyToday')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {dashboardQuery.data ? (
        <section className="grid gap-4 md:grid-cols-2" aria-label={t('snapshotAria')}>
          <Card className="bg-secondary/35">
            <CardHeader className="gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <HugeiconsIcon icon={Restaurant01Icon} aria-hidden="true" />
                {t('dinner')}
              </CardTitle>
              <CardDescription>
                {dashboardQuery.data.tonightMeal ? dashboardQuery.data.tonightMeal.title : t('noDinner')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {dashboardQuery.data.tonightMeal?.notes ? (
                <p className="text-sm text-muted-foreground">{dashboardQuery.data.tonightMeal.notes}</p>
              ) : null}
              {dashboardQuery.data.tonightMeal ? (
                tonightMealOwner ? (
                  <div>
                    <span className={getProfileColorChipClass(tonightMealOwner.colorKey)}>{tonightMealOwner.displayName}</span>
                  </div>
                ) : null
              ) : (
                <p className="text-sm text-muted-foreground">{t('openMealsCta')}</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-muted/40">
            <CardHeader className="gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <HugeiconsIcon icon={ShoppingCart01Icon} aria-hidden="true" />
                {t('groceries')}
              </CardTitle>
              <CardDescription>{t('itemsLeft', { count: dashboardQuery.data.shopping.openItemsCount })}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{
                    width: `${Math.max(8, Math.min(100, (dashboardQuery.data.shopping.openItemsCount / Math.max(dashboardQuery.data.shopping.openItemsCount + 8, 1)) * 100))}%`,
                  }}
                />
              </div>
              <Separator />
              {dashboardQuery.data.shopping.previewLabels.length > 0 ? (
                <ul className="flex flex-wrap gap-2" aria-label={t('openShoppingItemsAria')}>
                  {dashboardQuery.data.shopping.previewLabels.map((label, index) => (
                    <li key={`${label}-${index}`}>
                      <Badge variant="secondary">{label}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t('emptyList')}</p>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </section>
  );
}
