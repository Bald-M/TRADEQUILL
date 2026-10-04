// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBusinessSnapshot } from "@/lib/business";
import { getCatalogSnapshot, saveKnowledge, saveProduct } from "@/lib/catalog";
import { getWorkspaceStatus } from "@/lib/workspace";
import App from "./App";
import {
  getCommerceSnapshot,
  saveProduct as saveCommerceProduct,
} from "@/lib/commerce";

const { toggleTheme } = vi.hoisted(() => ({ toggleTheme: vi.fn() }));
vi.mock("@/hooks/use-daily-reminder", () => ({ useDailyReminder: () => "" }));
vi.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({ dark: false, toggleTheme }),
}));
vi.mock("@/lib/workspace", () => ({ getWorkspaceStatus: vi.fn() }));
vi.mock("@/lib/business", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/business")>();
  return { ...actual, getBusinessSnapshot: vi.fn() };
});
vi.mock("@/lib/catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalog")>();
  return {
    ...actual,
    getCatalogSnapshot: vi.fn(),
    saveKnowledge: vi.fn(),
    saveProduct: vi.fn(),
  };
});

vi.mock("@/lib/commerce", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/commerce")>();
  return { ...actual, getCommerceSnapshot: vi.fn(), saveProduct: vi.fn() };
});
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCommerceSnapshot).mockResolvedValue({
    products: [],
    suppliers: [],
    offers: [],
    quotes: [],
    orders: [],
    seller: "",
  });
  vi.mocked(getWorkspaceStatus).mockResolvedValue({
    databasePath: "/tmp/tradequill.sqlite3",
    attachmentsPath: "/tmp/attachments",
    schemaVersion: 3,
  });
  vi.mocked(getBusinessSnapshot).mockResolvedValue({
    customers: [],
    inquiries: [],
    quotes: [],
    samples: [],
    tasks: [],
  });
  vi.mocked(getCatalogSnapshot)
    .mockReset()
    .mockResolvedValue({ products: [], documents: [] });
  vi.mocked(saveProduct).mockReset();
  vi.mocked(saveKnowledge).mockReset();
});

async function openCatalog(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await waitFor(() => expect(getBusinessSnapshot).toHaveBeenCalledOnce());
  await user.click(screen.getByRole("button", { name: "产品与知识库" }));
  await screen.findByRole("button", { name: "新建产品" });
}

describe("App catalog navigation protection", () => {
  it("keeps product input mounted until explicit cancellation and leaves theme switching available", async () => {
    const user = userEvent.setup();
    await openCatalog(user);
    await user.click(screen.getByRole("button", { name: "新建产品" }));
    await user.type(screen.getByLabelText("产品名称 *"), "尚未保存的型号");
    const customers = screen.getByRole("button", { name: "客户管理" });
    expect(customers).toBeDisabled();
    expect(
      screen.getByText(
        "请先保存或取消当前产品/资料编辑，再切换页面。保存期间请等待完成。",
      ),
    ).toBeInTheDocument();
    await user.click(customers);
    expect(screen.getByLabelText("产品名称 *")).toHaveValue("尚未保存的型号");
    const theme = screen.getByRole("button", { name: "切换到深色主题" });
    expect(theme).toBeEnabled();
    await user.click(theme);
    expect(toggleTheme).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(customers).toBeEnabled();
    await user.click(customers);
    expect(
      screen.getByRole("heading", { level: 1, name: "客户管理" }),
    ).toBeInTheDocument();
    expect(saveProduct).not.toHaveBeenCalled();
  });

  it("protects the actual knowledge form and restores navigation after cancellation", async () => {
    const user = userEvent.setup();
    await openCatalog(user);
    await user.click(screen.getByRole("button", { name: "知识资料" }));
    await user.click(screen.getByRole("button", { name: "新建资料" }));
    await user.type(screen.getByLabelText("资料标题 *"), "待核对手册");
    await user.type(screen.getByLabelText("资料正文 *"), "尚未确认的参数");
    const customers = screen.getByRole("button", { name: "客户管理" });
    expect(customers).toBeDisabled();
    await user.click(customers);
    expect(screen.getByLabelText("资料标题 *")).toHaveValue("待核对手册");
    expect(screen.getByLabelText("资料正文 *")).toHaveValue("尚未确认的参数");
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(customers).toBeEnabled();
    await user.click(customers);
    expect(
      screen.getByRole("heading", { level: 1, name: "客户管理" }),
    ).toBeInTheDocument();
    expect(saveKnowledge).not.toHaveBeenCalled();
  });

  it("blocks navigation while saving and preserves the form after a failed write", async () => {
    const user = userEvent.setup();
    let rejectSave!: (failure: Error) => void;
    vi.mocked(saveProduct).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectSave = reject;
        }),
    );
    await openCatalog(user);
    await user.click(screen.getByRole("button", { name: "新建产品" }));
    await user.type(screen.getByLabelText("产品编号 *"), "SKU-UNSAVED");
    await user.type(screen.getByLabelText("产品名称 *"), "保存中型号");
    await user.type(screen.getByLabelText("计量单位 *"), "件");
    await user.click(screen.getByRole("button", { name: "创建产品" }));
    expect(screen.getByRole("button", { name: "保存中…" })).toBeDisabled();
    const customers = screen.getByRole("button", { name: "客户管理" });
    expect(customers).toBeDisabled();
    await user.click(customers);
    expect(screen.getByLabelText("产品编号 *")).toHaveValue("SKU-UNSAVED");
    rejectSave(new Error("保存失败，请重试"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "保存失败，请重试",
    );
    expect(customers).toBeDisabled();
    expect(screen.getByLabelText("产品名称 *")).toHaveValue("保存中型号");
    expect(screen.getByRole("button", { name: "创建产品" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(customers).toBeEnabled();
  });
});

it("protects all navigation while a commerce save fails, then unlocks on explicit cancellation", async () => {
  const user = userEvent.setup();
  vi.mocked(saveCommerceProduct).mockRejectedValue(new Error("Duplicate SKU"));
  render(<App />);
  await waitFor(() => expect(getBusinessSnapshot).toHaveBeenCalledOnce());
  await user.click(screen.getByRole("button", { name: "业务管理" }));
  await user.click(screen.getByRole("button", { name: "产品、报价与订单" }));
  await user.click(await screen.findByRole("button", { name: "新建产品" }));
  await user.type(screen.getByLabelText("产品编号 *"), "KEPT");
  await user.type(screen.getByLabelText("产品名称 *"), "Unsaved");
  await user.type(screen.getByLabelText("计量单位 *"), "pcs");
  for (const name of [
    "工作台",
    "客户管理",
    "产品与知识库",
    "跟进日历",
    "报价单",
    "产品档案",
    "新建产品",
  ])
    expect(screen.getByRole("button", { name })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "保存" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Duplicate SKU");
  expect(screen.getByLabelText("产品名称 *")).toHaveValue("Unsaved");
  expect(screen.getByRole("button", { name: "产品与知识库" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "取消并放弃输入" }));
  expect(screen.getByRole("button", { name: "产品与知识库" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "报价单" })).toBeEnabled();
});
