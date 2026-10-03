// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOrderHistory,
  getOrderReport,
  productText,
  saveProduct,
  saveStructuredQuote,
  type CommerceSnapshot,
  type OrderReport,
} from "@/lib/commerce";
import type { BusinessSnapshot } from "@/lib/business";
import { CommerceWorkspace } from "./CommerceWorkspace";
import { SaveForm } from "./Shared";

vi.mock("@/lib/commerce", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/commerce")>();
  return {
    ...actual,
    saveProduct: vi.fn(),
    saveStructuredQuote: vi.fn(),
    getOrderReport: vi.fn(),
    getOrderHistory: vi.fn(),
  };
});
const snapshot: CommerceSnapshot = {
  products: [
    {
      id: 1,
      code: "P-01",
      name: "Widget",
      parameters: [{ name: "Material", value: "Steel" }],
      unit: "pcs",
      moq: null,
      leadDaysMin: null,
      leadDaysMax: null,
      notes: "INTERNAL NOTE",
      archived: false,
    },
  ],
  suppliers: [],
  offers: [],
  quotes: [],
  orders: [],
  seller: "Example Trade",
};
const business: BusinessSnapshot = {
  customers: [
    {
      id: 11,
      name: "Buyer",
      company: "Example Ltd",
      email: "buyer@example.com",
      phone: "",
      country: "CN",
      source: "",
      notes: "",
      createdAt: "",
      updatedAt: "",
    },
  ],
  inquiries: [],
  quotes: [],
  samples: [],
  tasks: [],
};

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getOrderHistory).mockResolvedValue([]);
});

describe("commerce persistence and recovery", () => {
  it("retains product input and reports duplicate feedback from Rust", async () => {
    vi.mocked(saveProduct).mockRejectedValue(new Error("产品编号已存在"));
    const user = userEvent.setup();
    render(
      <CommerceWorkspace
        snapshot={snapshot}
        business={business}
        refresh={vi.fn()}
        route={{ kind: "products" }}
        navigate={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "新建产品" }));
    await user.type(screen.getByLabelText("产品编号 *"), "P-01");
    await user.type(screen.getByLabelText("产品名称 *"), "Duplicate");
    await user.type(screen.getByLabelText("计量单位 *"), "pcs");
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "产品编号已存在",
    );
    expect(screen.getByLabelText("产品名称 *")).toHaveValue("Duplicate");
    expect(vi.mocked(saveProduct).mock.calls[0][0].moq).toBeNull();
  });
  it("retries only the refresh after a committed mutation", async () => {
    const save = vi.fn().mockResolvedValue(1),
      refresh = vi
        .fn()
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValue(undefined),
      done = vi.fn();
    const user = userEvent.setup();
    render(
      <SaveForm save={save} refresh={refresh} onDone={done} onCancel={vi.fn()}>
        <label>
          Record
          <input defaultValue="kept" />
        </label>
      </SaveForm>,
    );
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("数据已保存");
    expect(screen.getByRole("textbox", { name: "Record" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "重试刷新" }));
    expect(save).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(done).toHaveBeenCalledOnce();
  });
  it("selects product snapshots and sends exact decimal strings for a quote", async () => {
    vi.mocked(saveStructuredQuote).mockResolvedValue(99);
    const navigate = vi.fn(),
      refresh = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <CommerceWorkspace
        snapshot={snapshot}
        business={business}
        refresh={refresh}
        route={{ kind: "quotes", newQuote: true, customerId: 11 }}
        navigate={navigate}
      />,
    );
    await user.type(screen.getByLabelText("有效期 *"), "2026-12-31");
    await user.selectOptions(screen.getByLabelText("添加产品"), "1");
    await user.click(screen.getByRole("button", { name: "加入明细" }));
    await user.clear(screen.getByLabelText("明细 1 数量 *"));
    await user.type(screen.getByLabelText("明细 1 数量 *"), "0.125");
    await user.type(screen.getByLabelText("明细 1 单价 *"), "0.2001");
    await user.type(screen.getByLabelText("贸易及商业条款 *"), "FOB Shanghai");
    await user.click(screen.getByRole("button", { name: "保存并预览报价" }));
    await waitFor(() => expect(saveStructuredQuote).toHaveBeenCalledOnce());
    const input = vi.mocked(saveStructuredQuote).mock.calls[0][0];
    expect(input.lines[0]).toMatchObject({
      productId: 1,
      quantity: "0.125",
      unitPrice: "0.2001",
      product: {
        code: "P-01",
        parameters: [{ name: "Material", value: "Steel" }],
      },
    });
    expect(input.customerId).toBe(11);
    expect(input.previousQuoteId).toBeNull();
    expect(navigate).toHaveBeenCalledWith({ kind: "quotes", id: 99 });
  });
  it("copies only customer-facing data and distinguishes unknown MOQ and lead time", () => {
    const text = productText(snapshot.products[0]);
    expect(text).toContain("Material：Steel");
    expect(text).toContain("MOQ：未知");
    expect(text).toContain("交期：未知");
    expect(text).not.toContain("INTERNAL");
  });
  it("reports an IPC error and retries the same applied period", async () => {
    const empty: OrderReport = {
      from: "2026-10-01",
      through: "2026-10-03",
      includedCount: 0,
      incompleteCount: 0,
      missingRateCount: 0,
      currencies: [],
      orders: [],
    };
    vi.mocked(getOrderReport)
      .mockRejectedValueOnce(new Error("report unavailable"))
      .mockResolvedValue(empty);
    const user = userEvent.setup();
    render(
      <CommerceWorkspace
        snapshot={snapshot}
        business={business}
        refresh={vi.fn()}
        route={{ kind: "reports" }}
        navigate={vi.fn()}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "report unavailable",
    );
    await user.click(screen.getByRole("button", { name: "重试统计" }));
    expect(
      await screen.findByText("所选期间与客户没有已确认订单。"),
    ).toBeVisible();
    expect(vi.mocked(getOrderReport).mock.calls[0][0]).toEqual(
      vi.mocked(getOrderReport).mock.calls[1][0],
    );
  });
});
