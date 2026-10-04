export function daysInMonth(year: number, month: number): number {
  if (month === 2)
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isDateValue(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return (
    year >= 1 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
}

export function dateInputError(value: string, withTime = false): string {
  if (!value) return withTime ? "请选择日期和时间。" : "请选择日期。";
  if (
    !isDateValue(value.slice(0, 10)) ||
    (withTime
      ? !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(value)
      : value.length !== 10)
  )
    return withTime
      ? "请输入有效的日期和时间（YYYY-MM-DDTHH:mm）。"
      : "请输入有效的日期（YYYY-MM-DD）。";
  return "";
}

export function calendarDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Calendar arithmetic stays in civil dates; local DST gaps never normalize an entered time.
export function shiftCalendarMonth(value: string, amount: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const index = Math.max(
    12,
    Math.min(9999 * 12 + 11, year * 12 + month - 1 + amount),
  );
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return calendarDate(
    nextYear,
    nextMonth,
    Math.min(day, daysInMonth(nextYear, nextMonth)),
  );
}

export function shiftCalendarDay(value: string, amount: number): string {
  let [year, month, day] = value.split("-").map(Number);
  day += amount;
  while (day < 1) {
    if (--month < 1) {
      month = 12;
      year--;
    }
    if (year < 1) return "0001-01-01";
    day += daysInMonth(year, month);
  }
  while (day > daysInMonth(year, month)) {
    day -= daysInMonth(year, month);
    if (++month > 12) {
      month = 1;
      year++;
    }
    if (year > 9999) return "9999-12-31";
  }
  return calendarDate(year, month, day);
}

export function calendarWeekday(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  const priorYear = year - 1;
  const daysBeforeYear =
    365 * priorYear +
    Math.floor(priorYear / 4) -
    Math.floor(priorYear / 100) +
    Math.floor(priorYear / 400);
  const daysBeforeMonth = [
    0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334,
  ][month - 1];
  const leapDay = month > 2 && daysInMonth(year, 2) === 29 ? 1 : 0;
  // 0001-01-01 is Monday. Count civil days so historical timezone date skips cannot shift weekdays.
  return (daysBeforeYear + daysBeforeMonth + leapDay + day) % 7;
}
