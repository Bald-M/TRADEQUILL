// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOrderHistory,
  getCommerceSnapshot,
  updateOrder,
  saveOrderCosts,
  saveOffer,
  type Order,
  getOrderReport,
  productText,
  saveProduct,
  saveStructuredQuote,
  type CommerceSnapshot,
  type OrderReport,
} from "@/lib/commerce";
import type { BusinessSnapshot } from "@/lib/business";
import { CommerceWorkspace } from "./CommerceWorkspace";
import { SaveForm, SelectInput, TextField } from "./Shared";
import { chooseSelectOption } from "@/test/select";

vi.mock("@/lib/commerce", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/commerce")>();
  return {
    ...actual,
    saveProduct: vi.fn(),
    saveStructuredQuote: vi.fn(),
    getOrderReport: vi.fn(),
    getOrderHistory: vi.fn(),
    getCommerceSnapshot: vi.fn(),
    updateOrder: vi.fn(),
    saveOrderCosts: vi.fn(),
    saveOffer: vi.fn(),
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
    await chooseSelectOption("添加产品", "P-01·Widget");
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

const supplier = {
  id: 21,
  name: "Supplier A",
  contact: "Alice",
  email: "",
  phone: "",
  address: "",
  notes: "",
  archived: false,
};
const related: CommerceSnapshot = {
  ...snapshot,
  products: [
    ...snapshot.products,
    { ...snapshot.products[0], id: 2, code: "P-02", name: "Second" },
  ],
  suppliers: [supplier, { ...supplier, id: 22, name: "Supplier B" }],
  offers: [
    {
      id: 31,
      productId: 1,
      supplierId: 21,
      supplierCode: "original",
      price: null,
      currency: "USD",
      quotedOn: null,
      moq: null,
      leadDaysMin: null,
      leadDaysMax: null,
      notes: "",
      active: true,
    },
  ],
};
const order: Order = {
  id: 41,
  number: "SO-000041",
  sourceQuoteId: 51,
  orderedOn: "2026-10-01",
  deliveryOn: null,
  status: "draft",
  notes: "original",
  version: 1,
  costs: [],
  costsComplete: false,
  completenessNote: "",
  quote: {
    quoteId: 51,
    seriesId: 1,
    revision: 1,
    number: "QT-000001-R1",
    previousQuoteId: null,
    customer: business.customers[0],
    customerId: 11,
    inquiryId: null,
    quotedOn: "2026-10-01",
    validUntil: "2026-12-31",
    seller: "Demo Seller",
    terms: "FOB",
    currency: "USD",
    discount: "0.00",
    tax: "0.00",
    freight: "0.00",
    lines: [
      {
        productId: 1,
        product: snapshot.products[0],
        quantity: "10.000",
        unitPrice: "10.0000",
      },
    ],
    lineAmounts: ["100.00"],
    belowMoq: [],
    subtotal: "100.00",
    total: "100.00",
  },
  profit: {
    missingRates: 0,
    complete: false,
    purchase: null,
    freight: null,
    tax: null,
    other: null,
    totalCost: null,
    profit: null,
    margin: null,
  },
};
describe("review regressions", () => {
  it("offers legacy completion once and preserves its source in customer history", () => {
    const legacy = {
      id: 31,
      customerId: 11,
      inquiryId: null,
      quotedOn: "2026-10-01",
      content: "Legacy original",
      amount: "100.00",
      currency: "USD",
      notes: "",
      createdAt: "",
      updatedAt: "",
    };
    const props = {
      business: { ...business, quotes: [legacy] },
      refresh: vi.fn(),
      route: { kind: "quotes" as const },
      navigate: vi.fn(),
    };
    const { rerender } = render(
      <CommerceWorkspace {...props} snapshot={snapshot} />,
    );
    expect(
      screen.getByRole("button", { name: "补齐明细生成报价" }),
    ).toBeVisible();
    rerender(
      <CommerceWorkspace
        {...props}
        snapshot={{
          ...snapshot,
          quotes: [{ ...order.quote, previousQuoteId: 31 }],
        }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "补齐明细生成报价" }),
    ).not.toBeInTheDocument();
    expect(props.business.quotes[0]).toEqual(legacy);
  });

  it("shows report loading until IPC completes without displaying stale totals", async () => {
    let resolve!: (value: OrderReport) => void;
    vi.mocked(getOrderReport).mockReturnValue(
      new Promise<OrderReport>((r) => {
        resolve = r;
      }),
    );
    render(
      <CommerceWorkspace
        snapshot={snapshot}
        business={business}
        refresh={vi.fn()}
        route={{ kind: "reports" }}
        navigate={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("正在计算经营统计");
    expect(screen.queryByText(/销售收入/)).not.toBeInTheDocument();
    resolve({
      from: "2026-10-01",
      through: "2026-10-04",
      includedCount: 0,
      incompleteCount: 0,
      missingRateCount: 0,
      currencies: [],
      orders: [],
    });
    expect(
      await screen.findByText("所选期间与客户没有已确认订单。"),
    ).toBeVisible();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each([
    ["products", false],
    ["products", true],
    ["suppliers", false],
    ["suppliers", true],
  ] as const)(
    "keeps %s association context while editing (existing=%s)",
    async (kind, existing) => {
      const user = userEvent.setup();
      vi.mocked(saveOffer).mockResolvedValue(31);
      render(
        <CommerceWorkspace
          snapshot={related}
          business={business}
          refresh={vi.fn().mockResolvedValue(undefined)}
          route={{ kind, id: kind === "products" ? 1 : 21 }}
          navigate={vi.fn()}
        />,
      );
      await user.click(
        screen.getByRole("button", {
          name: existing ? "编辑供货条件" : "关联供货资料",
        }),
      );
      const second = screen.getByRole("button", {
        name: kind === "products" ? /P-02 · Second/ : /Supplier B/,
      });
      expect(second).toBeDisabled();
      await user.click(second);
      expect(
        screen.getByLabelText(kind === "products" ? "产品 *" : "供应商 *"),
      ).toHaveTextContent(kind === "products" ? "P-01·Widget" : "Supplier A");
      await user.click(screen.getByRole("button", { name: "取消并放弃输入" }));
      await user.click(second);
      await user.click(screen.getByRole("button", { name: "关联供货资料" }));
      expect(
        screen.getByLabelText(kind === "products" ? "产品 *" : "供应商 *"),
      ).toHaveTextContent(kind === "products" ? "P-02·Second" : "Supplier B");
      expect(screen.getByLabelText("供应商货号")).toHaveValue("");
      await chooseSelectOption(
        kind === "products" ? "供应商 *" : "产品 *",
        kind === "products" ? "Supplier A" : "P-01·Widget",
      );
      await user.click(screen.getByRole("button", { name: "保存" }));
      await waitFor(() => expect(saveOffer).toHaveBeenCalledOnce());
      expect(vi.mocked(saveOffer).mock.calls[0][0]).toMatchObject({
        id: null,
        productId: kind === "products" ? 2 : 1,
        supplierId: kind === "products" ? 21 : 22,
      });
    },
  );
  it.each(["draft", "costs"] as const)(
    "recovers %s version conflicts without losing input or silently adopting a version",
    async (mode) => {
      const user = userEvent.setup();
      const mutation =
        mode === "draft" ? vi.mocked(updateOrder) : vi.mocked(saveOrderCosts);
      mutation
        .mockRejectedValueOnce(new Error("订单已更新，请刷新后重试"))
        .mockResolvedValue(undefined);
      const current = { ...order, version: 2, notes: "changed elsewhere" };
      vi.mocked(getCommerceSnapshot).mockResolvedValue({
        ...snapshot,
        orders: [current],
      });
      const view = (currentOrder: Order) => (
        <CommerceWorkspace
          snapshot={{
            ...snapshot,
            quotes: [order.quote],
            orders: [currentOrder],
          }}
          business={business}
          refresh={vi.fn().mockResolvedValue(undefined)}
          route={{ kind: "orders", id: 41 }}
          navigate={vi.fn()}
        />
      );
      const { rerender } = render(view(order));
      await user.click(
        screen.getByRole("button", {
          name: mode === "draft" ? "更正草稿" : "录入 / 更正成本",
        }),
      );
      const reasonLabel =
        mode === "draft" ? "更正原因 *" : "本次成本录入/更正原因 *";
      await user.type(screen.getByLabelText(reasonLabel), "preserve my input");
      const submit = () =>
        screen.getByRole("button", {
          name: mode === "draft" ? "保存" : "保存成本并重算",
        });
      await user.click(submit());
      expect(await screen.findByRole("alert")).toHaveTextContent("订单已更新");
      rerender(view(current));
      expect(mutation.mock.calls[0][0].expectedVersion).toBe(1);
      await user.click(
        screen.getByRole("button", { name: "读取最新订单并保留输入" }),
      );
      const acknowledge = await screen.findByRole("button", {
        name: "已核对最新内容，保留输入并采用版本 2",
      });
      expect(screen.getByLabelText(reasonLabel)).toHaveValue(
        "preserve my input",
      );
      expect(mutation).toHaveBeenCalledTimes(1);
      await user.click(acknowledge);
      await user.click(submit());
      await waitFor(() => expect(mutation).toHaveBeenCalledTimes(2));
      expect(mutation.mock.calls[1][0]).toMatchObject({
        expectedVersion: 2,
        reason: "preserve my input",
      });
    },
  );
});

it("keeps shared select and calendar controls disabled after a committed save until refresh succeeds", async () => {
  const refresh = vi
    .fn()
    .mockRejectedValueOnce(new Error("refresh failed"))
    .mockResolvedValue(undefined);
  const save = vi.fn().mockResolvedValue(undefined);
  const change = vi.fn();
  const user = userEvent.setup();
  render(
    <SaveForm save={save} refresh={refresh} onDone={vi.fn()} onCancel={vi.fn()}>
      <label htmlFor="currency">币种</label>
      <SelectInput
        id="currency"
        value="USD"
        onValueChange={change}
        options={[
          { value: "USD", label: "USD" },
          { value: "EUR", label: "EUR" },
        ]}
      />
      <TextField
        label="费用日期"
        type="date"
        value="2026-10-04"
        onChange={change}
      />
    </SaveForm>,
  );
  const select = screen.getByRole("combobox", { name: "币种" });
  select.focus();
  await user.keyboard("{ArrowDown}{End}{Enter}");
  expect(change).toHaveBeenCalledWith("EUR");
  const calendar = screen.getByRole("button", { name: "选择费用日期" });
  await user.click(calendar);
  await user.keyboard("{Escape}");
  expect(calendar).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "保存" }));
  await screen.findByRole("alert");
  expect(select).toBeDisabled();
  expect(calendar).toBeDisabled();
  expect(screen.getByLabelText("费用日期")).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "重试刷新" }));
  expect(save).toHaveBeenCalledOnce();
});
