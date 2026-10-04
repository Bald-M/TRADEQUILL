// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  setFollowUpTaskCompleted,
  type BusinessSnapshot,
} from "@/lib/business";
import { FollowUpWorkspace } from "./FollowUpWorkspace";

vi.mock("@/lib/business", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/business")>();
  return { ...actual, setFollowUpTaskCompleted: vi.fn() };
});

const mockedSetFollowUpTaskCompleted = vi.mocked(setFollowUpTaskCompleted);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  mockedSetFollowUpTaskCompleted.mockReset();
});

const snapshot: BusinessSnapshot = {
  customers: [
    {
      id: 10,
      name: "Alice",
      company: "",
      email: "",
      phone: "",
      country: "",
      source: "",
      notes: "",
      createdAt: "",
      updatedAt: "",
    },
  ],
  inquiries: [],
  quotes: [],
  samples: [],
  tasks: [
    {
      id: 1,
      customerId: 10,
      inquiryId: null,
      dueAt: "2026-09-28T09:00",
      content: "Cross-day follow-up",
      completed: false,
      completedAt: null,
      createdAt: "",
      updatedAt: "",
    },
  ],
};

describe("FollowUpWorkspace", () => {
  it("reclassifies tasks when an open app crosses the local date boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 27, 23, 59));
    render(
      <FollowUpWorkspace
        snapshot={snapshot}
        refresh={vi.fn()}
        reminderMessage=""
        openCustomers={vi.fn()}
      />,
    );

    const todayCard = screen
      .getAllByText("今日待办")[1]
      .closest<HTMLElement>('[data-slot="card"]');
    expect(todayCard).not.toBeNull();
    expect(within(todayCard!).getByText("今天没有待办。")).toBeInTheDocument();

    act(() => {
      vi.setSystemTime(new Date(2026, 8, 28, 0, 1));
      vi.advanceTimersByTime(60 * 1000);
    });

    expect(
      within(todayCard!).getByText("Cross-day follow-up"),
    ).toBeInTheDocument();
  });

  it("offers refresh recovery after a task status write commits", async () => {
    const refresh = vi
      .fn()
      .mockRejectedValueOnce(new Error("refresh failed"))
      .mockResolvedValueOnce(undefined);
    mockedSetFollowUpTaskCompleted.mockResolvedValue();
    render(
      <FollowUpWorkspace
        snapshot={snapshot}
        refresh={refresh}
        reminderMessage=""
        openCustomers={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "标记为已完成" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "任务状态已更新，但界面刷新失败：refresh failed",
    );
    expect(mockedSetFollowUpTaskCompleted).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "标记为已完成" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "重试刷新" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
    expect(mockedSetFollowUpTaskCompleted).toHaveBeenCalledOnce();
  });
});

it("filters an exact local date and shows no tasks for empty or partial dates", () => {
  render(
    <FollowUpWorkspace
      snapshot={snapshot}
      refresh={vi.fn()}
      reminderMessage=""
      openCustomers={vi.fn()}
    />,
  );
  const calendar = screen
    .getByText("按日期查看")
    .closest<HTMLElement>('[data-slot="card"]')!;
  const input = within(calendar).getByRole("textbox", { name: "日历日期" });
  for (const value of ["", "2026-09", "2026-09-27", "2026-02-30"]) {
    fireEvent.change(input, { target: { value } });
    expect(
      within(calendar).queryByText("Cross-day follow-up"),
    ).not.toBeInTheDocument();
  }
  fireEvent.change(input, { target: { value: "2026-09-28" } });
  expect(within(calendar).getByText("Cross-day follow-up")).toBeInTheDocument();
});
