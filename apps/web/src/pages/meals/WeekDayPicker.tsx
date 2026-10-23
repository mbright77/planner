import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon, Tick02Icon } from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import { buildWeekDays, formatWeekRange } from './weekDays';

type WeekDayPickerProps = {
  weekStart: string;
  selectedDate: string;
  locale: string;
  /** Dates that already have a meal; shown with a tick. */
  mealDates: ReadonlySet<string>;
  /** Number of open requests per date; shown when the day has no meal. */
  requestCounts?: ReadonlyMap<string, number>;
  isDayDisabled?: (date: string) => boolean;
  onSelect: (date: string) => void;
  onShiftWeek: (direction: -1 | 1) => void;
  /** Render the range label and Previous/Next buttons. Defaults to true. */
  showWeekNav?: boolean;
};

export function WeekDayPicker({
  weekStart,
  selectedDate,
  locale,
  mealDates,
  requestCounts,
  isDayDisabled,
  onSelect,
  onShiftWeek,
  showWeekNav = true,
}: WeekDayPickerProps) {
  const { t } = useTranslation('meals');
  const weekDays = useMemo(() => buildWeekDays(weekStart, locale), [weekStart, locale]);

  return (
    <div className="flex flex-col gap-3">
      {showWeekNav ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{formatWeekRange(weekStart, locale)}</p>
          <div className="flex gap-2">
            <Button variant="outline" type="button" onClick={() => onShiftWeek(-1)}>
              <HugeiconsIcon icon={ArrowLeft01Icon} data-icon="inline-start" aria-hidden="true" />
              {t('previous')}
            </Button>
            <Button variant="outline" type="button" onClick={() => onShiftWeek(1)}>
              {t('next')}
              <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-7 gap-2" aria-label={t('planningDaysAria')}>
        {weekDays.map((day) => {
          const isSelected = day.key === selectedDate;
          const hasMeal = mealDates.has(day.key);
          const requestCount = requestCounts?.get(day.key) ?? 0;
          const statusLabel = hasMeal
            ? t('mealSet')
            : requestCount > 0
              ? t('requestsCount', { count: requestCount })
              : t('open');

          return (
            <Button
              key={day.key}
              type="button"
              variant={isSelected ? 'default' : 'outline'}
              className="h-auto flex-col gap-0.5 py-2"
              aria-label={`${day.label} ${day.dayNumber}, ${statusLabel}`}
              disabled={isDayDisabled?.(day.key) ?? false}
              onClick={() => onSelect(day.key)}
            >
              <span className="text-[11px] uppercase opacity-80">{day.label}</span>
              <span className="text-sm font-semibold">{day.dayNumber}</span>
              {hasMeal ? (
                <HugeiconsIcon icon={Tick02Icon} size={14} aria-hidden="true" />
              ) : requestCount > 0 ? (
                <span className="text-[10px] font-medium" aria-hidden="true">
                  {requestCount}
                </span>
              ) : (
                <span className="h-3.5" aria-hidden="true" />
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
