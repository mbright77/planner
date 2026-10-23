import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WeekDayPicker } from './WeekDayPicker';
import { shiftWeekDate } from './weekDays';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => (options?.count ? `${key}:${options.count}` : key),
  }),
}));

afterEach(cleanup);

function renderPicker(overrides: Partial<React.ComponentProps<typeof WeekDayPicker>> = {}) {
  const props = {
    weekStart: '2026-10-19',
    selectedDate: '2026-10-21',
    locale: 'en',
    mealDates: new Set(['2026-10-20']),
    onSelect: vi.fn(),
    onShiftWeek: vi.fn(),
    ...overrides,
  };
  render(<WeekDayPicker {...props} />);
  return props;
}

describe('WeekDayPicker', () => {
  it('renders seven days and marks days that have a meal', () => {
    renderPicker();

    expect(screen.getAllByRole('button').filter((button) => button.getAttribute('aria-label')?.includes(','))).toHaveLength(7);
    expect(screen.getByRole('button', { name: /Tue 20, mealSet/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Wed 21, open/ })).toBeTruthy();
  });

  it('does not select disabled days', () => {
    const props = renderPicker({ isDayDisabled: (date) => date === '2026-10-20' });

    fireEvent.click(screen.getByRole('button', { name: /Tue 20/ }));
    expect(props.onSelect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Thu 22/ }));
    expect(props.onSelect).toHaveBeenCalledWith('2026-10-22');
  });

  it('calls onShiftWeek from Previous and Next, and hides them when showWeekNav is false', () => {
    const props = renderPicker();

    fireEvent.click(screen.getByRole('button', { name: 'next' }));
    fireEvent.click(screen.getByRole('button', { name: 'previous' }));
    expect(props.onShiftWeek).toHaveBeenNthCalledWith(1, 1);
    expect(props.onShiftWeek).toHaveBeenNthCalledWith(2, -1);

    cleanup();
    renderPicker({ showWeekNav: false });
    expect(screen.queryByRole('button', { name: 'next' })).toBeNull();
  });
});

describe('shiftWeekDate', () => {
  it('moves a week forward keeping the same weekday', () => {
    expect(shiftWeekDate('2026-10-19', '2026-10-22', 1)).toEqual({
      nextWeekStart: '2026-10-26',
      nextSelectedDate: '2026-10-29',
    });
  });
});
