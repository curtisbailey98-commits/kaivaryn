/**
 * Schedules for prompted automations — pure, deterministic, timezone-aware (Intl only, no deps).
 * A ScheduleSpec is wall-clock time in an IANA zone ("every Monday at 8:00 AM America/New_York").
 */

export type ScheduleCadence = "HOURLY" | "DAILY" | "WEEKDAYS" | "WEEKLY" | "MONTHLY";

export type ScheduleSpec = {
  cadence: ScheduleCadence;
  /** HOURLY only: run every N hours (1–12), aligned to local clock hours divisible by N. */
  everyHours?: number;
  /** Minute of the hour, 0–59. */
  minute: number;
  /** Hour of the day, 0–23 (ignored for HOURLY). */
  hour: number;
  /** WEEKLY only: 0 = Sunday … 6 = Saturday. */
  daysOfWeek?: number[];
  /** MONTHLY only: 1–31, or -1 for the last day of the month. Short months clamp to their last day. */
  dayOfMonth?: number;
};

export const DEFAULT_TIMEZONE = "America/New_York";

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const COMMON_TIMEZONES: Array<{ id: string; label: string }> = [
  { id: "America/New_York", label: "Eastern (ET)" },
  { id: "America/Chicago", label: "Central (CT)" },
  { id: "America/Denver", label: "Mountain (MT)" },
  { id: "America/Phoenix", label: "Arizona (MST)" },
  { id: "America/Los_Angeles", label: "Pacific (PT)" },
  { id: "America/Anchorage", label: "Alaska (AKT)" },
  { id: "Pacific/Honolulu", label: "Hawaii (HT)" },
  { id: "UTC", label: "UTC" },
  { id: "Europe/London", label: "London" },
];

export function isValidTimezone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function safeTimezone(tz: string | null | undefined): string {
  return isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
}

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number };

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

/** Wall-clock parts of an instant in a zone. */
export function zonedParts(date: Date, tz: string): Parts {
  const out: Record<string, string> = {};
  for (const p of partsFormatter(tz).formatToParts(date)) out[p.type] = p.value;
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    second: Number(out.second),
    weekday: DAY_SHORT.indexOf(out.weekday ?? "Sun"),
  };
}

function offsetMs(t: number, tz: string): number {
  const p = zonedParts(new Date(t), tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(t / 1000) * 1000;
}

/** Convert a wall-clock time in `tz` to a UTC instant. Fields may overflow (day 32 → next month). */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = naive - offsetMs(naive, tz);
  // second pass settles DST boundaries
  guess = naive - offsetMs(guess, tz);
  return new Date(guess);
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function clampSpec(spec: ScheduleSpec): ScheduleSpec {
  const minute = Math.min(59, Math.max(0, Math.floor(Number(spec.minute) || 0)));
  const hour = Math.min(23, Math.max(0, Math.floor(Number(spec.hour) || 0)));
  const out: ScheduleSpec = { cadence: spec.cadence, minute, hour };
  if (spec.cadence === "HOURLY") out.everyHours = Math.min(12, Math.max(1, Math.floor(Number(spec.everyHours) || 1)));
  if (spec.cadence === "WEEKLY") {
    const days = Array.from(new Set((spec.daysOfWeek ?? []).map((d) => Math.floor(Number(d))).filter((d) => d >= 0 && d <= 6))).sort();
    out.daysOfWeek = days.length ? days : [1];
  }
  if (spec.cadence === "MONTHLY") {
    const d = Math.floor(Number(spec.dayOfMonth) || 1);
    out.dayOfMonth = d === -1 ? -1 : Math.min(31, Math.max(1, d));
  }
  return out;
}

export function normalizeSchedule(raw: unknown): ScheduleSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const cadence = String(o.cadence || "").toUpperCase();
  if (!["HOURLY", "DAILY", "WEEKDAYS", "WEEKLY", "MONTHLY"].includes(cadence)) return null;
  return clampSpec({
    cadence: cadence as ScheduleCadence,
    minute: Number(o.minute ?? 0),
    hour: Number(o.hour ?? 8),
    everyHours: o.everyHours == null ? undefined : Number(o.everyHours),
    daysOfWeek: Array.isArray(o.daysOfWeek) ? (o.daysOfWeek as unknown[]).map(Number) : undefined,
    dayOfMonth: o.dayOfMonth == null ? undefined : Number(o.dayOfMonth),
  });
}

/** Next instant strictly after `from` that matches the schedule in `tz`. */
export function computeNextRun(specIn: ScheduleSpec, tzIn: string, from: Date = new Date()): Date {
  const spec = clampSpec(specIn);
  const tz = safeTimezone(tzIn);
  const fromMs = from.getTime();
  const p = zonedParts(from, tz);

  if (spec.cadence === "HOURLY") {
    const n = spec.everyHours ?? 1;
    for (let k = 0; k <= 48; k++) {
      const naive = new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour + k, spec.minute));
      if (naive.getUTCHours() % n !== 0) continue;
      const at = zonedTimeToUtc(naive.getUTCFullYear(), naive.getUTCMonth() + 1, naive.getUTCDate(), naive.getUTCHours(), spec.minute, tz);
      if (at.getTime() > fromMs) return at;
    }
  } else {
    for (let k = 0; k <= 400; k++) {
      const naive = new Date(Date.UTC(p.year, p.month - 1, p.day + k, 12, 0));
      const y = naive.getUTCFullYear();
      const m = naive.getUTCMonth() + 1;
      const d = naive.getUTCDate();
      const wd = naive.getUTCDay();
      let match = false;
      if (spec.cadence === "DAILY") match = true;
      else if (spec.cadence === "WEEKDAYS") match = wd >= 1 && wd <= 5;
      else if (spec.cadence === "WEEKLY") match = (spec.daysOfWeek ?? [1]).includes(wd);
      else if (spec.cadence === "MONTHLY") {
        const last = daysInMonth(y, m);
        const want = spec.dayOfMonth === -1 ? last : Math.min(spec.dayOfMonth ?? 1, last);
        match = d === want;
      }
      if (!match) continue;
      const at = zonedTimeToUtc(y, m, d, spec.hour, spec.minute, tz);
      if (at.getTime() > fromMs) return at;
    }
  }
  // Unreachable for valid specs; fail safe one day out.
  return new Date(fromMs + 24 * 60 * 60 * 1000);
}

export function nextRuns(spec: ScheduleSpec, tz: string, from: Date = new Date(), count = 3): Date[] {
  const out: Date[] = [];
  let cursor = from;
  for (let i = 0; i < count; i++) {
    const n = computeNextRun(spec, tz, cursor);
    out.push(n);
    cursor = n;
  }
  return out;
}

const US_ZONE_LABEL: Record<string, string> = {
  "America/New_York": "ET",
  "America/Detroit": "ET",
  "America/Toronto": "ET",
  "America/Chicago": "CT",
  "America/Denver": "MT",
  "America/Phoenix": "MST",
  "America/Los_Angeles": "PT",
  "America/Anchorage": "AKT",
  "Pacific/Honolulu": "HT",
  UTC: "UTC",
  "Etc/UTC": "UTC",
};

export function zoneLabel(tz: string, at: Date = new Date()): string {
  if (US_ZONE_LABEL[tz]) return US_ZONE_LABEL[tz]!;
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(at).find((x) => x.type === "timeZoneName");
    return part?.value ?? tz;
  } catch {
    return tz;
  }
}

export function formatClock(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function joinDays(days: number[]) {
  const names = days.map((d) => DAY_NAMES[d]!);
  if (names.length <= 1) return names[0] ?? "Monday";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Plain-English schedule: "Every Monday at 8:00 AM ET". */
export function describeSchedule(specIn: ScheduleSpec, tzIn: string): string {
  const spec = clampSpec(specIn);
  const tz = safeTimezone(tzIn);
  const at = `${formatClock(spec.hour, spec.minute)} ${zoneLabel(tz)}`;
  switch (spec.cadence) {
    case "HOURLY":
      return spec.everyHours && spec.everyHours > 1
        ? `Every ${spec.everyHours} hours at :${String(spec.minute).padStart(2, "0")} (${zoneLabel(tz)} clock)`
        : `Every hour at :${String(spec.minute).padStart(2, "0")}`;
    case "DAILY":
      return `Every day at ${at}`;
    case "WEEKDAYS":
      return `Every weekday (Mon–Fri) at ${at}`;
    case "WEEKLY":
      return `Every ${joinDays(spec.daysOfWeek ?? [1])} at ${at}`;
    case "MONTHLY":
      return spec.dayOfMonth === -1 ? `On the last day of every month at ${at}` : `On the ${ordinal(spec.dayOfMonth ?? 1)} of every month at ${at}`;
  }
}

/** "Mon, Oct 5 · 8:00 AM ET" in the given zone. */
export function formatInZone(date: Date | string | null | undefined, tzIn: string, opts?: { withYear?: boolean }): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const tz = safeTimezone(tzIn);
  const day = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", ...(opts?.withYear ? { year: "numeric" } : {}) }).format(d);
  const p = zonedParts(d, tz);
  return `${day} · ${formatClock(p.hour, p.minute)} ${zoneLabel(tz, d)}`;
}

/** Relative phrase for the near future/past: "in 12 min", "3 h ago". */
export function relativeTime(date: Date, now: Date = new Date()): string {
  const diff = date.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60000);
  const txt = min < 1 ? "under a minute" : min < 60 ? `${min} min` : min < 48 * 60 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} days`;
  return diff >= 0 ? `in ${txt}` : `${txt} ago`;
}

/** Legacy cadence label for orders created before prompted automations. */
export const CADENCE_TO_SPEC: Record<string, ScheduleCadence> = { HOURLY: "HOURLY", DAILY: "DAILY", WEEKLY: "WEEKLY", WEEKDAYS: "WEEKDAYS", MONTHLY: "MONTHLY" };
