import { describe, expect, it } from "vitest";
import {
  dateInputError,
  isDateValue,
  shiftCalendarDay,
  shiftCalendarMonth,
  calendarWeekday,
} from "./date-input";
import { localDateTimeValue } from "./business";

describe("civil date input", () => {
  it("validates Gregorian dates, four-digit years and minute precision", () => {
    for (const value of [
      "2024-02-29",
      "2000-02-29",
      "0001-01-01",
      "9999-12-31",
    ])
      expect(isDateValue(value)).toBe(true);
    for (const value of [
      "2025-02-29",
      "1900-02-29",
      "2026-04-31",
      "2026-13-01",
      "2026-00-01",
      "0000-01-01",
      "2026-1-01",
      "2026-01-00",
      "",
    ])
      expect(isDateValue(value)).toBe(false);
    for (const value of [
      "2026-01-01T24:00",
      "2026-01-01T23:60",
      "2026-01-01T01:00Z",
      "2026-01-01T01:00:00",
      "2026-01-01",
      "",
    ])
      expect(dateInputError(value, true)).not.toBe("");
  });

  it("preserves local wall times at midnight and DST gaps/overlaps in every timezone", () => {
    for (const value of [
      "2026-01-01T00:00",
      "2026-12-31T23:59",
      "2026-03-08T02:30",
      "2026-11-01T01:30",
    ])
      expect(dateInputError(value, true)).toBe("");
    expect(localDateTimeValue(new Date(2026, 0, 1, 0, 5))).toBe(
      "2026-01-01T00:05",
    );
    expect(localDateTimeValue(new Date(2026, 11, 31, 23, 59))).toBe(
      "2026-12-31T23:59",
    );
  });

  it("moves across months, leap years and the supported year limits", () => {
    expect(shiftCalendarDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftCalendarDay("2024-03-01", -1)).toBe("2024-02-29");
    expect(shiftCalendarMonth("2024-02-29", 12)).toBe("2025-02-28");
    expect(shiftCalendarMonth("2026-01-31", 1)).toBe("2026-02-28");
    expect(shiftCalendarDay("0001-01-01", -7)).toBe("0001-01-01");
    expect(shiftCalendarDay("9999-12-31", 7)).toBe("9999-12-31");
    expect(calendarWeekday("0001-01-01")).toBe(1);
    expect(calendarWeekday("2026-12-31")).toBe(4);
    expect(calendarWeekday("2011-12-30")).toBe(5);
  });
});
