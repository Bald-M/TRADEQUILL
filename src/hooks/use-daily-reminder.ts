import { useCallback, useEffect, useRef, useState } from "react";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import {
  getDueReminder,
  localDateTimeValue,
  localDateValue,
  markReminderSent,
} from "@/lib/business";

export function useDailyReminder(enabled: boolean) {
  const [message, setMessage] = useState("");
  const attemptedDate = useRef("");

  const check = useCallback(async () => {
    if (!enabled) return;
    const now = new Date();
    const date = localDateValue(now);
    if (attemptedDate.current === date) return;
    try {
      const reminder = await getDueReminder(date, localDateTimeValue(now));
      if (!reminder) return;
      attemptedDate.current = date;
      let granted = await isPermissionGranted();
      if (!granted) granted = (await requestPermission()) === "granted";
      if (!granted) {
        setMessage(
          `系统通知未获授权：今日 ${reminder.dueToday} 项、逾期 ${reminder.overdue} 项仍可在应用内查看。`,
        );
        return;
      }
      sendNotification({
        title: "TradeQuill 跟进提醒",
        body: `今日 ${reminder.dueToday} 项待办，另有 ${reminder.overdue} 项逾期未完成。`,
      });
      await markReminderSent(reminder.localDate);
      setMessage(
        `已发送今日提醒：${reminder.dueToday} 项今日待办，${reminder.overdue} 项逾期。`,
      );
    } catch (error) {
      attemptedDate.current = date;
      setMessage(
        `系统提醒发送失败：${error instanceof Error ? error.message : String(error)}。应用内待办仍可使用。`,
      );
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void check();
    const interval = window.setInterval(() => void check(), 15 * 60 * 1000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", check);
    };
  }, [check, enabled]);

  return message;
}
