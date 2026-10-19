import type { CampaignSchedule } from './domain.js';

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export interface LocalClock {
  dayOfWeek: number;
  minutesSinceMidnight: number;
}

/** Resolve local day-of-week and minutes-since-midnight in a given IANA timezone. */
export function getLocalClock(now: Date, timeZone: string): LocalClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');

  return {
    dayOfWeek: WEEKDAY_TO_INDEX[weekday] ?? 0,
    minutesSinceMidnight: hour * 60 + minute,
  };
}

function parseHm(value: string | undefined | ''): number | null {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/**
 * True when `now` falls inside the campaign calling window.
 * Empty start/end → always open (day filter still applies when daysOfWeek is set).
 */
export function isWithinSchedule(
  schedule: CampaignSchedule,
  now: Date = new Date(),
): boolean {
  const clock = getLocalClock(now, schedule.timezone || 'Asia/Kolkata');

  if (schedule.daysOfWeek.length > 0 && !schedule.daysOfWeek.includes(clock.dayOfWeek)) {
    return false;
  }

  const start = parseHm(schedule.windowStartLocal);
  const end = parseHm(schedule.windowEndLocal);
  if (start === null || end === null) return true;

  if (start === end) return true;

  if (start < end) {
    return clock.minutesSinceMidnight >= start && clock.minutesSinceMidnight < end;
  }

  // Window wraps midnight (e.g. 22:00 → 06:00).
  return clock.minutesSinceMidnight >= start || clock.minutesSinceMidnight < end;
}
