import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { localDateValue } from "@/lib/business";
import {
  calendarDate,
  calendarWeekday,
  dateInputError,
  daysInMonth,
  isDateValue,
  shiftCalendarDay,
  shiftCalendarMonth,
} from "@/lib/date-input";

const inputClass =
  "min-h-10 min-w-0 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive";

export function DateTimeField({
  id,
  label,
  value,
  onChange,
  withTime = false,
  required = false,
  disabled = false,
  "aria-invalid": invalid,
  "aria-describedby": describedBy,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  withTime?: boolean;
  required?: boolean;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState("");
  const [focusDate, setFocusDate] = useState("");
  const [hour, setHour] = useState("00");
  const [minute, setMinute] = useState("00");
  const calendarRef = useRef<HTMLTableElement>(null);
  const pendingCalendarFocus = useRef(false);
  useLayoutEffect(() => {
    if (!pendingCalendarFocus.current) return;
    pendingCalendarFocus.current = false;
    calendarRef.current
      ?.querySelector<HTMLButtonElement>(`button[data-date="${focusDate}"]`)
      ?.focus();
  }, [focusDate]);
  const error = value ? dateInputError(value, withTime) : "";
  const showError = error && !(invalid && describedBy);
  const hintId = `${inputId}-format`;
  const errorId = `${inputId}-invalid`;
  const draft = withTime
    ? `${draftDate}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`
    : draftDate;
  const timeValid =
    /^\d{1,2}$/.test(hour) &&
    Number(hour) <= 23 &&
    /^\d{1,2}$/.test(minute) &&
    Number(minute) <= 59;

  function changeOpen(next: boolean) {
    if (next) {
      const date = isDateValue(value.slice(0, 10))
        ? value.slice(0, 10)
        : localDateValue();
      setDraftDate(date);
      setFocusDate(date);
      const time = !dateInputError(value, true) ? value.slice(11) : "00:00";
      setHour(time.slice(0, 2));
      setMinute(time.slice(3, 5));
    }
    setOpen(next);
  }

  function moveFocus(next: string) {
    pendingCalendarFocus.current = true;
    setFocusDate(next);
  }

  function calendarKey(event: KeyboardEvent, date: string) {
    let next: string;
    switch (event.key) {
      case "ArrowLeft":
        next = shiftCalendarDay(date, -1);
        break;
      case "ArrowRight":
        next = shiftCalendarDay(date, 1);
        break;
      case "ArrowUp":
        next = shiftCalendarDay(date, -7);
        break;
      case "ArrowDown":
        next = shiftCalendarDay(date, 7);
        break;
      case "Home":
        next = shiftCalendarDay(date, -calendarWeekday(date));
        break;
      case "End":
        next = shiftCalendarDay(date, 6 - calendarWeekday(date));
        break;
      case "PageUp":
        next = shiftCalendarMonth(date, event.shiftKey ? -12 : -1);
        break;
      case "PageDown":
        next = shiftCalendarMonth(date, event.shiftKey ? 12 : 1);
        break;
      default:
        return;
    }
    event.preventDefault();
    moveFocus(next);
  }

  const [year, month] = focusDate.split("-").map(Number);
  const firstWeekday = open ? calendarWeekday(calendarDate(year, month, 1)) : 0;
  const count = open ? daysInMonth(year, month) : 0;

  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <input
          id={inputId}
          type="text"
          aria-label={label}
          aria-required={required}
          aria-invalid={Boolean(invalid || error)}
          aria-describedby={[
            describedBy,
            hintId,
            showError ? errorId : undefined,
          ]
            .filter(Boolean)
            .join(" ")}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          className={inputClass}
        />
        <Dialog.Root open={open} onOpenChange={changeOpen}>
          <Dialog.Trigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-10"
              disabled={disabled}
              aria-label={`选择${label}`}
            >
              <CalendarDays aria-hidden="true" />
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
            <Dialog.Content
              className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-80 max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-4 text-foreground shadow-lg"
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                calendarRef.current
                  ?.querySelector<HTMLButtonElement>('button[tabindex="0"]')
                  ?.focus();
              }}
            >
              <Dialog.Title className="text-base font-semibold">
                选择{label}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs leading-5 text-muted-foreground">
                方向键移动，回车选取，应用后回填。
              </Dialog.Description>
              <div className="my-3 flex items-center justify-between gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="上一年"
                  disabled={year === 1}
                  onClick={() =>
                    setFocusDate(shiftCalendarMonth(focusDate, -12))
                  }
                >
                  <ChevronsLeft aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="上一月"
                  disabled={year === 1 && month === 1}
                  onClick={() =>
                    setFocusDate(shiftCalendarMonth(focusDate, -1))
                  }
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <p
                  className="flex-1 text-center text-sm font-medium"
                  aria-live="polite"
                >
                  {year} 年 {month} 月
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="下一月"
                  disabled={year === 9999 && month === 12}
                  onClick={() => setFocusDate(shiftCalendarMonth(focusDate, 1))}
                >
                  <ChevronRight aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="下一年"
                  disabled={year === 9999}
                  onClick={() =>
                    setFocusDate(shiftCalendarMonth(focusDate, 12))
                  }
                >
                  <ChevronsRight aria-hidden="true" />
                </Button>
              </div>
              <table
                ref={calendarRef}
                className="w-full table-fixed"
                aria-label={`${year} 年 ${month} 月`}
              >
                <thead>
                  <tr>
                    {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
                      <th
                        key={day}
                        scope="col"
                        className="pb-1 text-xs font-normal text-muted-foreground"
                      >
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from(
                    { length: Math.ceil((firstWeekday + count) / 7) },
                    (_, week) => (
                      <tr key={week}>
                        {Array.from({ length: 7 }, (_, weekday) => {
                          const day = week * 7 + weekday - firstWeekday + 1;
                          if (day < 1 || day > count)
                            return <td key={weekday} />;
                          const date = calendarDate(year, month, day);
                          return (
                            <td key={weekday} className="p-0.5">
                              <Button
                                type="button"
                                variant={
                                  draftDate === date ? "default" : "ghost"
                                }
                                className="h-8 w-full px-0"
                                data-date={date}
                                aria-label={date}
                                aria-pressed={draftDate === date}
                                tabIndex={focusDate === date ? 0 : -1}
                                onFocus={() => setFocusDate(date)}
                                onKeyDown={(event) => calendarKey(event, date)}
                                onClick={() => {
                                  setDraftDate(date);
                                  setFocusDate(date);
                                }}
                              >
                                {day}
                              </Button>
                            </td>
                          );
                        })}
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
              {withTime && (
                <div className="mt-3 flex items-end gap-2">
                  <label className="flex-1 space-y-1 text-sm">
                    小时
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={hour}
                      onChange={(event) => setHour(event.target.value)}
                      className={inputClass}
                      aria-invalid={!timeValid}
                    />
                  </label>
                  <span className="pb-2">:</span>
                  <label className="flex-1 space-y-1 text-sm">
                    分钟
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={minute}
                      onChange={(event) => setMinute(event.target.value)}
                      className={inputClass}
                      aria-invalid={!timeValid}
                    />
                  </label>
                </div>
              )}
              {withTime && !timeValid && (
                <p role="alert" className="mt-1 text-sm text-destructive">
                  小时为 0–23，分钟为 0–59。
                </p>
              )}
              <p
                className="mt-3 text-xs text-muted-foreground"
                aria-live="polite"
              >
                已选：{draftDate}
                {withTime && timeValid
                  ? ` ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`
                  : ""}
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <Dialog.Close asChild>
                  <Button type="button" variant="outline">
                    取消选择
                  </Button>
                </Dialog.Close>
                <Button
                  type="button"
                  disabled={
                    disabled ||
                    Boolean(dateInputError(draft, withTime)) ||
                    (withTime && !timeValid)
                  }
                  onClick={() => {
                    onChange(draft);
                    setOpen(false);
                  }}
                >
                  应用
                </Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled || !value}
          aria-label={`清空${label}`}
          onClick={() => onChange("")}
        >
          清空
        </Button>
      </div>
      <p id={hintId} className="text-xs text-muted-foreground">
        {withTime ? "YYYY-MM-DDTHH:mm · 本地时间" : "YYYY-MM-DD"}
      </p>
      {showError && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
