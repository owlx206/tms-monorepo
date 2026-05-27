export const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

const VIETNAM_UTC_OFFSET_MINUTES = 7 * 60;

export function vietnamDateTimeToIso(
  dateOnly: string,
  time = "00:00:00",
  milliseconds = 0,
): string {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const [hours = 0, minutes = 0, seconds = 0] = time.split(":").map(Number);

  return new Date(Date.UTC(
    year,
    month - 1,
    day,
    hours,
    minutes - VIETNAM_UTC_OFFSET_MINUTES,
    seconds,
    milliseconds,
  )).toISOString();
}

export function vietnamDateRangeToIso(dateOnly: string): { from: string; to: string } {
  return {
    from: vietnamDateTimeToIso(dateOnly, "00:00:00", 0),
    to: vietnamDateTimeToIso(dateOnly, "23:59:59", 999),
  };
}

export function formatVietnamDate(value: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("vi-VN", {
    timeZone: VIETNAM_TIME_ZONE,
    ...options,
  });
}

export function formatVietnamTime(value: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return date.toLocaleTimeString("vi-VN", {
    timeZone: VIETNAM_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...options,
  });
}

export function formatVietnamDateTime(value: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("vi-VN", {
    timeZone: VIETNAM_TIME_ZONE,
    ...options,
  });
}

export function todayVietnamDateOnly(): string {
  return vietnamDateOnly(new Date());
}

export function vietnamDateOnly(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return `${year}-${month}-${day}`;
}

export function addDaysToDateOnly(dateOnly: string, amount: number): string {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const utcNoon = new Date(Date.UTC(year, month - 1, day + amount, 12, 0, 0, 0));

  return [
    String(utcNoon.getUTCFullYear()).padStart(4, "0"),
    String(utcNoon.getUTCMonth() + 1).padStart(2, "0"),
    String(utcNoon.getUTCDate()).padStart(2, "0"),
  ].join("-");
}
