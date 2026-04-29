import { describe, it, expect } from 'vitest';
import { computeWeekStartFromDate } from './useMealsWeek';

describe('computeWeekStartFromDate', () => {
  it('returns Monday for a midweek date', () => {
    expect(computeWeekStartFromDate('2026-04-29')).toBe('2026-04-27');
  });

  it('returns same date for Monday', () => {
    expect(computeWeekStartFromDate('2026-05-04')).toBe('2026-05-04');
  });

  it('returns previous Monday for Sunday', () => {
    expect(computeWeekStartFromDate('2026-05-03')).toBe('2026-04-27');
  });
});
