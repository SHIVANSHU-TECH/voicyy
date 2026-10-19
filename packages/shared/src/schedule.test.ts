import { describe, expect, it } from 'vitest';
import { getLocalClock, isWithinSchedule } from './schedule.js';

describe('schedule helpers', () => {
  it('parses local clock in Asia/Kolkata', () => {
    // 2026-06-01 12:30 UTC = 18:00 IST
    const clock = getLocalClock(new Date('2026-06-01T12:30:00.000Z'), 'Asia/Kolkata');
    expect(clock.minutesSinceMidnight).toBe(18 * 60);
    expect(clock.dayOfWeek).toBe(1); // Monday
  });

  it('treats empty window as always open', () => {
    expect(
      isWithinSchedule(
        { timezone: 'UTC', windowStartLocal: '', windowEndLocal: '', daysOfWeek: [] },
        new Date('2026-06-01T03:00:00.000Z'),
      ),
    ).toBe(true);
  });

  it('respects a same-day window', () => {
    const schedule = {
      timezone: 'UTC',
      windowStartLocal: '09:00',
      windowEndLocal: '17:00',
      daysOfWeek: [] as number[],
    };
    expect(isWithinSchedule(schedule, new Date('2026-06-01T10:00:00.000Z'))).toBe(true);
    expect(isWithinSchedule(schedule, new Date('2026-06-01T08:59:00.000Z'))).toBe(false);
    expect(isWithinSchedule(schedule, new Date('2026-06-01T17:00:00.000Z'))).toBe(false);
  });

  it('filters by daysOfWeek', () => {
    // Monday 2026-06-01
    const schedule = {
      timezone: 'UTC',
      windowStartLocal: '',
      windowEndLocal: '',
      daysOfWeek: [0, 6], // Sun/Sat only
    };
    expect(isWithinSchedule(schedule, new Date('2026-06-01T12:00:00.000Z'))).toBe(false);
  });
});
