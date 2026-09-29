// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBusinessSnapshot, saveCustomer } from "@/lib/business";
import { getWorkspaceStatus } from "@/lib/workspace";
import App from "./App";

vi.mock("@/hooks/use-daily-reminder", () => ({
  useDailyReminder: () => "",
}));
vi.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({ dark: false, toggleTheme: vi.fn() }),
}));
vi.mock("@/lib/workspace", () => ({ getWorkspaceStatus: vi.fn() }));
vi.mock("@/lib/business", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/business")>();
  return {
    ...actual,
    getBusinessSnapshot: vi.fn(),
    saveCustomer: vi.fn(),
  };
});

const mockedGetWorkspaceStatus = vi.mocked(getWorkspaceStatus);
const mockedGetBusinessSnapshot = vi.mocked(getBusinessSnapshot);
const mockedSaveCustomer = vi.mocked(saveCustomer);

afterEach(cleanup);

describe("App business refresh", () => {
  beforeEach(() => {
    mockedGetWorkspaceStatus.mockReset();
    mockedGetBusinessSnapshot.mockReset();
    mockedSaveCustomer.mockReset();
    mockedGetWorkspaceStatus.mockResolvedValue({
      databasePath: "/tmp/tradequill.sqlite3",
      attachmentsPath: "/tmp/attachments",
      schemaVersion: 2,
    });
    mockedGetBusinessSnapshot
      .mockResolvedValueOnce({
        customers: [],
        inquiries: [],
        quotes: [],
        samples: [],
        tasks: [],
      })
      .mockRejectedValueOnce(new Error("refresh failed"));
    mockedSaveCustomer.mockResolvedValue();
  });

  it("keeps a committed form visible when its refresh fails", async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() =>
      expect(mockedGetBusinessSnapshot).toHaveBeenCalledOnce(),
    );
    await user.click(screen.getByRole("button", { name: "客户管理" }));
    await user.click(screen.getByRole("button", { name: "新建" }));
    await user.type(screen.getByLabelText("客户姓名 *"), "Alice");
    await user.click(screen.getByRole("button", { name: "创建客户" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "数据已保存，但界面刷新失败：refresh failed",
    );
    expect(screen.getByRole("button", { name: "已保存" })).toBeDisabled();
    expect(screen.queryByText(/无法读取业务数据/)).not.toBeInTheDocument();
  });
});
