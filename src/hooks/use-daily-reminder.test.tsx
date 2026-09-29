// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDueReminder, markReminderSent } from "@/lib/business";
import { useDailyReminder } from "./use-daily-reminder";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  sendNotification: vi.fn(),
}));
vi.mock("@/lib/business", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/business")>();
  return {
    ...actual,
    getDueReminder: vi.fn(),
    markReminderSent: vi.fn(),
  };
});

const mockedInvoke = vi.mocked(invoke);
const mockedPermission = vi.mocked(isPermissionGranted);
const mockedRequestPermission = vi.mocked(requestPermission);
const mockedSendNotification = vi.mocked(sendNotification);
const mockedGetDueReminder = vi.mocked(getDueReminder);
const mockedMarkReminderSent = vi.mocked(markReminderSent);

afterEach(cleanup);

describe("useDailyReminder", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
    mockedPermission.mockReset();
    mockedRequestPermission.mockReset();
    mockedSendNotification.mockReset();
    mockedGetDueReminder.mockReset();
    mockedMarkReminderSent.mockReset();
    mockedPermission.mockResolvedValue(true);
    mockedRequestPermission.mockResolvedValue("granted");
    mockedGetDueReminder.mockResolvedValue({
      localDate: "2026-09-29",
      dueToday: 1,
      overdue: 0,
    });
    mockedMarkReminderSent.mockResolvedValue();
  });

  it("does not mark a reminder sent while native delivery is pending", async () => {
    const pendingDelivery = new Promise<void>(() => undefined);
    mockedSendNotification.mockReturnValue(pendingDelivery as never);
    mockedInvoke.mockReturnValue(pendingDelivery);

    const { unmount } = renderHook(() => useDailyReminder(true));
    await waitFor(() => expect(mockedPermission).toHaveBeenCalledOnce());
    await act(async () => Promise.resolve());

    expect(mockedMarkReminderSent).not.toHaveBeenCalled();
    unmount();
  });

  it("coalesces overlapping checks for the same local date", async () => {
    const pendingLookup = new Promise<null>(() => undefined);
    mockedGetDueReminder.mockReturnValue(pendingLookup);

    const { unmount } = renderHook(() => useDailyReminder(true));
    await waitFor(() => expect(mockedGetDueReminder).toHaveBeenCalledOnce());

    await act(async () => window.dispatchEvent(new Event("focus")));

    expect(mockedGetDueReminder).toHaveBeenCalledOnce();
    unmount();
  });

  it("records delivery only after the native command succeeds", async () => {
    mockedInvoke.mockResolvedValue(undefined);

    const { result, unmount } = renderHook(() => useDailyReminder(true));

    await waitFor(() => expect(mockedMarkReminderSent).toHaveBeenCalledOnce());
    expect(result.current).toContain("已发送今日提醒");
    unmount();
  });

  it("keeps the reminder unsent when native delivery fails", async () => {
    mockedInvoke.mockRejectedValue(new Error("native delivery failed"));

    const { result, unmount } = renderHook(() => useDailyReminder(true));

    await waitFor(() =>
      expect(result.current).toContain("native delivery failed"),
    );
    expect(mockedMarkReminderSent).not.toHaveBeenCalled();
    unmount();
  });
});
