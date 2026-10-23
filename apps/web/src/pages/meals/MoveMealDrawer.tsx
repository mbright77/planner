import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useMealsWeek } from '../../entities/meal/model/useMealsWeek';
import type { MealPlanResponse } from '../../shared/api/meals';
import { WeekDayPicker } from './WeekDayPicker';
import { formatLongDate, shiftWeekDate } from './weekDays';

type MoveMealDrawerProps = {
  meal: MealPlanResponse;
  /** Monday (YYYY-MM-DD) of the week the meal currently lives in. */
  currentWeekStart: string;
  locale: string;
  open: boolean;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (newDate: string) => void;
};

export function MoveMealDrawer(props: MoveMealDrawerProps) {
  // Remount the body on every open so the picker restarts on "next week, same weekday".
  return (
    <Drawer open={props.open} onOpenChange={props.onOpenChange}>
      <DrawerContent>{props.open ? <MoveMealBody {...props} /> : null}</DrawerContent>
    </Drawer>
  );
}

function MoveMealBody({
  meal,
  currentWeekStart,
  locale,
  isPending,
  onOpenChange,
  onConfirm,
}: MoveMealDrawerProps) {
  const { t } = useTranslation('meals');

  const initial = useMemo(
    () => shiftWeekDate(currentWeekStart, meal.mealDate, 1),
    [currentWeekStart, meal.mealDate],
  );
  const [pickerWeekStart, setPickerWeekStart] = useState(initial.nextWeekStart);
  const [pickerDate, setPickerDate] = useState(initial.nextSelectedDate);

  const pickerWeekQuery = useMealsWeek(pickerWeekStart);
  const mealDates = useMemo(
    () => new Set((pickerWeekQuery.data?.meals ?? []).map((other) => other.mealDate)),
    [pickerWeekQuery.data?.meals],
  );

  // A day is unavailable when it already holds a meal (one meal per day) or is where this meal already is.
  const isOccupied = (date: string) => date === meal.mealDate || mealDates.has(date);

  function handleShiftWeek(direction: -1 | 1) {
    const next = shiftWeekDate(pickerWeekStart, pickerDate, direction);
    setPickerWeekStart(next.nextWeekStart);
    setPickerDate(next.nextSelectedDate);
  }

  const canConfirm = !isPending && !isOccupied(pickerDate);

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>{t('move.title', { title: meal.title })}</DrawerTitle>
        <DrawerDescription>
          {t('move.newDate', { date: formatLongDate(pickerDate, locale) })}
        </DrawerDescription>
      </DrawerHeader>

      <div className="px-4">
        <WeekDayPicker
          weekStart={pickerWeekStart}
          selectedDate={pickerDate}
          locale={locale}
          mealDates={mealDates}
          isDayDisabled={isOccupied}
          onSelect={setPickerDate}
          onShiftWeek={handleShiftWeek}
        />
      </div>

      <DrawerFooter className="flex-row justify-end">
        <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
          {t('move.cancel')}
        </Button>
        <Button type="button" disabled={!canConfirm} onClick={() => onConfirm(pickerDate)}>
          {t('move.ok')}
        </Button>
      </DrawerFooter>
    </>
  );
}
