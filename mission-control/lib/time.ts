// Tijd in Europe/Amsterdam zonder externe libs. Werkt goed rond zomer-/wintertijd.

export const TZ = "Europe/Amsterdam";

export interface AmsParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  /** 0 = zondag … 6 = zaterdag */
  weekday: number;
}

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function amsParts(d: Date): AmsParts {
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(d)) p[part.type] = part.value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    weekday: WD[p.weekday],
  };
}

/** Bouw een Date uit een Amsterdamse wandkloktijd. */
export function fromAms(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  // Twee iteraties dekken de DST-sprong.
  let ts = guess;
  for (let i = 0; i < 2; i++) {
    const p = amsParts(new Date(ts));
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    ts += guess - asUtc;
  }
  return new Date(ts);
}

/** Middernacht (Amsterdam) van de dag waarin d valt. */
export function startOfAmsDay(d: Date): Date {
  const p = amsParts(d);
  return fromAms(p.year, p.month, p.day);
}

/** Tel n kalenderdagen op in Amsterdamse tijd en zet de klok op hour:minute. */
export function amsDayAt(d: Date, addDays: number, hour: number, minute: number): Date {
  const p = amsParts(d);
  const base = new Date(Date.UTC(p.year, p.month - 1, p.day + addDays));
  return fromAms(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), hour, minute);
}

/** Maandag 00:00 (Amsterdam) van de week waarin d valt. */
export function startOfAmsWeek(d: Date): Date {
  const p = amsParts(d);
  const back = (p.weekday + 6) % 7;
  return amsDayAt(d, -back, 0, 0);
}

export function amsMonthKey(d: Date): string {
  const p = amsParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

export function startOfAmsMonth(d: Date): Date {
  const p = amsParts(d);
  return fromAms(p.year, p.month, 1);
}

export function dayKey(d: Date): string {
  const p = amsParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

const dayFmt = new Intl.DateTimeFormat("nl-NL", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("nl-NL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
export const formatDay = (d: Date | string) => dayFmt.format(new Date(d));
export const formatTime = (d: Date | string) => timeFmt.format(new Date(d));
export const formatDayTime = (d: Date | string) => `${formatDay(d)} ${formatTime(d)}`;
