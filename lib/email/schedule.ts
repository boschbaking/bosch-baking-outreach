// Turns a flat list of "things to send" into spaced-out timestamps that
// respect the sending_settings the app already stores: a daily cap, a
// sending window (e.g. 9am-4pm), weekdays-only, and a random gap between
// each send so a burst of approvals doesn't look like a spam blast.
//
// Business hours are evaluated in a fixed IANA timezone (defaults to
// America/Los_Angeles, since Bosch Baking's prospects are all in Rancho
// Cucamonga, CA) rather than the server's own timezone, which is undefined
// in a serverless environment.

export interface SendingSettings {
  max_daily_sends: number;
  weekdays_only: boolean;
  sending_window_start: string; // "09:00:00"
  sending_window_end: string; // "16:00:00"
  min_spacing_minutes: number;
  max_spacing_minutes: number;
}

const DEFAULT_TZ = process.env.SENDING_TIMEZONE || "America/Los_Angeles";

function partsInTz(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === "24" ? "0" : parts.hour),
    minute: Number(parts.minute),
    weekday: parts.weekday, // "Mon", "Tue", ...
  };
}

// Given a UTC instant, find the offset (in minutes) of `timeZone` at that
// instant, so we can construct new UTC instants that land at a specific
// local wall-clock time.
function tzOffsetMinutes(date: Date, timeZone: string): number {
  const p = partsInTz(date, timeZone);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((asUTC - date.getTime()) / 60000);
}

function localWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  // First guess assuming UTC, then correct using the real offset at that guess.
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offset = tzOffsetMinutes(guess, timeZone);
  return new Date(guess.getTime() - offset * 60000);
}

const WEEKENDS = new Set(["Sat", "Sun"]);

function parseHM(t: string): [number, number] {
  const [h, m] = t.split(":").map(Number);
  return [h, m];
}

// Moves `date` forward (never backward) to the next instant that falls
// inside the configured sending window on a valid day.
function alignToWindow(date: Date, settings: SendingSettings, timeZone: string): Date {
  const [startH, startM] = parseHM(settings.sending_window_start);
  const [endH, endM] = parseHM(settings.sending_window_end);

  for (let guard = 0; guard < 14; guard++) {
    const p = partsInTz(date, timeZone);
    const isWeekend = WEEKENDS.has(p.weekday);

    if (settings.weekdays_only && isWeekend) {
      // jump to the same wall-clock start time the next day
      const next = localWallClockToUtc(p.year, p.month, p.day, startH, startM, timeZone);
      date = new Date(next.getTime() + 24 * 60 * 60000);
      continue;
    }

    const minutesNow = p.hour * 60 + p.minute;
    const windowStart = startH * 60 + startM;
    const windowEnd = endH * 60 + endM;

    if (minutesNow < windowStart) {
      return localWallClockToUtc(p.year, p.month, p.day, startH, startM, timeZone);
    }
    if (minutesNow >= windowEnd) {
      const next = localWallClockToUtc(p.year, p.month, p.day, startH, startM, timeZone);
      date = new Date(next.getTime() + 24 * 60 * 60000);
      continue;
    }
    return date; // already inside a valid window
  }
  return date;
}

function dateKey(date: Date, timeZone: string): string {
  const p = partsInTz(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/**
 * Returns one Date per item, in order, spaced out per `settings` and never
 * exceeding `max_daily_sends` on any one calendar day.
 *
 * `alreadyScheduledToday` lets the caller account for sends already queued
 * or sent earlier today so a second batch doesn't blow past the daily cap.
 */
export function computeScheduleSlots(params: {
  count: number;
  settings: SendingSettings;
  now: Date;
  alreadyScheduledToday?: number;
  timeZone?: string;
}): Date[] {
  const { count, settings, now } = params;
  const timeZone = params.timeZone || DEFAULT_TZ;

  const slots: Date[] = [];
  let cursor = alignToWindow(new Date(now), settings, timeZone);
  let currentDayKey = dateKey(cursor, timeZone);
  let remainingToday = Math.max(0, settings.max_daily_sends - (params.alreadyScheduledToday ?? 0));

  for (let i = 0; i < count; i++) {
    cursor = alignToWindow(cursor, settings, timeZone);
    let dayKey = dateKey(cursor, timeZone);

    if (dayKey !== currentDayKey) {
      currentDayKey = dayKey;
      remainingToday = settings.max_daily_sends;
    }

    if (remainingToday <= 0) {
      // push to tomorrow's window start and retry
      const [startH, startM] = parseHM(settings.sending_window_start);
      const p = partsInTz(cursor, timeZone);
      const tomorrowStart = new Date(
        localWallClockToUtc(p.year, p.month, p.day, startH, startM, timeZone).getTime() +
          24 * 60 * 60000
      );
      cursor = alignToWindow(tomorrowStart, settings, timeZone);
      dayKey = dateKey(cursor, timeZone);
      currentDayKey = dayKey;
      remainingToday = settings.max_daily_sends;
    }

    slots.push(new Date(cursor));
    remainingToday--;

    const spacing =
      settings.min_spacing_minutes +
      Math.random() * Math.max(0, settings.max_spacing_minutes - settings.min_spacing_minutes);
    cursor = new Date(cursor.getTime() + spacing * 60000);
  }

  return slots;
}
