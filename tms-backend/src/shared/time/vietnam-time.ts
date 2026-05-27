const VIETNAM_UTC_OFFSET_MINUTES = 7 * 60;
const MINUTE_IN_MS = 60 * 1000;

export type VietnamDateParts = {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
  dayOfWeek: number;
};

export function vietnamDateTimeToUtcDate(
  year: number,
  month: number,
  day: number,
  hours = 0,
  minutes = 0,
  seconds = 0,
  milliseconds = 0,
): Date {
  return new Date(Date.UTC(
    year,
    month - 1,
    day,
    hours,
    minutes - VIETNAM_UTC_OFFSET_MINUTES,
    seconds,
    milliseconds,
  ));
}

export function toVietnamDateParts(date: Date): VietnamDateParts {
  const vietnamDate = new Date(date.getTime() + VIETNAM_UTC_OFFSET_MINUTES * MINUTE_IN_MS);

  return {
    year: vietnamDate.getUTCFullYear(),
    month: vietnamDate.getUTCMonth() + 1,
    day: vietnamDate.getUTCDate(),
    hours: vietnamDate.getUTCHours(),
    minutes: vietnamDate.getUTCMinutes(),
    seconds: vietnamDate.getUTCSeconds(),
    milliseconds: vietnamDate.getUTCMilliseconds(),
    dayOfWeek: vietnamDate.getUTCDay(),
  };
}

export function vietnamStartOfDay(date: Date): Date {
  const parts = toVietnamDateParts(date);
  return vietnamDateTimeToUtcDate(parts.year, parts.month, parts.day);
}

export function vietnamEndOfDay(date: Date): Date {
  const parts = toVietnamDateParts(date);
  return vietnamDateTimeToUtcDate(parts.year, parts.month, parts.day, 23, 59, 59, 999);
}

export function addVietnamDays(date: Date, amount: number): Date {
  const parts = toVietnamDateParts(date);
  return vietnamDateTimeToUtcDate(parts.year, parts.month, parts.day + amount, parts.hours, parts.minutes, parts.seconds, parts.milliseconds);
}

export function vietnamDateOnlyString(date: Date): string {
  const parts = toVietnamDateParts(date);
  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
}

export function vietnamTimeString(date: Date): string {
  const parts = toVietnamDateParts(date);
  return [
    String(parts.hours).padStart(2, '0'),
    String(parts.minutes).padStart(2, '0'),
    String(parts.seconds).padStart(2, '0'),
  ].join(':');
}
