// Kalenderrekenwerk. Alle datums zijn kalenderdagen (geen tijd), intern als UTC-middernacht
// zodat zomer-/wintertijd geen dagen kan verschuiven. "Vandaag" wordt bepaald in Europe/Amsterdam.
import type { ISODate } from "./types";

export const TIMEZONE = "Europe/Amsterdam";

export function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function fromISO(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function ymd(year: number, month: number, day: number): ISODate {
  return toISO(new Date(Date.UTC(year, month - 1, day)));
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = fromISO(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round((fromISO(to).getTime() - fromISO(from).getTime()) / 86_400_000);
}

/** 0 = zondag … 6 = zaterdag */
export function weekday(iso: ISODate): number {
  return fromISO(iso).getUTCDay();
}

/** Vandaag als kalenderdatum in Nederland, ongeacht de tijdzone van server of browser. */
export function todayInNL(now: Date = new Date()): ISODate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA levert YYYY-MM-DD
}

/** Eerste zondag van Pasen (Gregoriaans, anonieme algoritme van Meeus/Jones/Butcher). */
export function easterSunday(year: number): ISODate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(year, month, day);
}

/** n-de weekdag van een maand (n = 1..5). weekday: 0 = zondag. */
export function nthWeekday(year: number, month: number, wd: number, n: number): ISODate {
  const first = ymd(year, month, 1);
  const shift = (wd - weekday(first) + 7) % 7;
  const result = addDays(first, shift + (n - 1) * 7);
  if (Number(result.slice(5, 7)) !== month) {
    throw new Error(`Er is geen ${n}e weekdag ${wd} in ${year}-${month}`);
  }
  return result;
}

export function lastWeekday(year: number, month: number, wd: number): ISODate {
  const nextMonthFirst = month === 12 ? ymd(year + 1, 1, 1) : ymd(year, month + 1, 1);
  const last = addDays(nextMonthFirst, -1);
  const shift = (weekday(last) - wd + 7) % 7;
  return addDays(last, -shift);
}

/** Koningsdag: 27 april, of 26 april als 27 april op zondag valt. */
export function koningsdag(year: number): ISODate {
  const d = ymd(year, 4, 27);
  return weekday(d) === 0 ? ymd(year, 4, 26) : d;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function overlaps(aStart: ISODate, aEnd: ISODate, bStart: ISODate, bEnd: ISODate): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

const NL_MONTHS = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];
const NL_WEEKDAYS_SHORT = ["zo", "ma", "di", "wo", "do", "vr", "za"];

export function monthName(month: number): string {
  return NL_MONTHS[month - 1];
}

export function formatNL(iso: ISODate, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const d = fromISO(iso);
  const base = `${d.getUTCDate()} ${NL_MONTHS[d.getUTCMonth()]}`;
  const withYear = opts.year ? `${base} ${d.getUTCFullYear()}` : base;
  return opts.weekday ? `${NL_WEEKDAYS_SHORT[d.getUTCDay()]} ${withYear}` : withYear;
}

export function formatRange(start: ISODate, end: ISODate): string {
  if (start === end) return formatNL(start);
  return `${formatNL(start)} – ${formatNL(end)}`;
}

/** "over 6 weken", "over 3 dagen", "vandaag", "2 dagen geleden" */
export function relativeNL(today: ISODate, target: ISODate): string {
  const d = diffDays(today, target);
  if (d === 0) return "vandaag";
  if (d === 1) return "morgen";
  if (d === -1) return "gisteren";
  if (d < 0) return `${-d} dagen geleden`;
  if (d < 14) return `over ${d} dagen`;
  const weeks = Math.round(d / 7);
  return `over ${weeks} weken`;
}
