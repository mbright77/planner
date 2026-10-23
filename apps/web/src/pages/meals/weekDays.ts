export function getWeekStart(date: Date) {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;

  utcDate.setUTCDate(utcDate.getUTCDate() + diff);

  return utcDate;
}

export function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function buildWeekDays(weekStart: string, locale: string) {
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

export function formatWeekRange(weekStart: string, locale: string) {
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  return `${start.toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' })} - ${end.toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
}

export function formatLongDate(value: string, locale: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export function shiftWeekDate(weekStart: string, selectedDate: string, direction: -1 | 1) {
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
