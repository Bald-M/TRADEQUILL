// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getCatalogSnapshot } from "@/lib/catalog";
import { CatalogWorkspace } from "./CatalogWorkspace";

vi.mock("@/lib/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalog")>();
  return { ...actual, getCatalogSnapshot: vi.fn() };
});
afterEach(cleanup);
beforeEach(() => vi.mocked(getCatalogSnapshot).mockReset());

it("shows real loading and read failure with a working retry", async () => {
  const user = userEvent.setup();
  let rejectRead!: (failure: Error) => void;
  vi.mocked(getCatalogSnapshot)
    .mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectRead = reject;
        }),
    )
    .mockResolvedValueOnce({ products: [], documents: [] });
  render(<CatalogWorkspace />);
  expect(screen.getByRole("status")).toHaveTextContent(
    "正在读取本地产品与资料",
  );
  rejectRead(new Error("数据库暂不可用"));
  expect(await screen.findByRole("alert")).toHaveTextContent("数据库暂不可用");
  await user.click(screen.getByRole("button", { name: "刷新资料" }));
  expect(await screen.findByText(/尚无产品档案/)).toBeInTheDocument();
  expect(getCatalogSnapshot).toHaveBeenCalledTimes(2);
  await user.click(screen.getByRole("button", { name: "知识资料" }));
  expect(screen.getByText(/资料库为空/)).toBeInTheDocument();
});
