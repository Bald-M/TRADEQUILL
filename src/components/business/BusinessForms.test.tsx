// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendSampleProgress,
  saveCustomer,
  saveFollowUpTask,
  saveInquiry,
  saveQuote,
  saveSample,
  type CustomerRecord,
  type FollowUpTaskRecord,
  type InquiryRecord,
  type QuoteRecord,
  type SampleRecord,
} from "@/lib/business";
import { chooseSelectOption } from "@/test/select";
import {
  CustomerForm,
  InquiryForm,
  QuoteForm,
  SampleForm,
  SampleProgressForm,
  TaskForm,
} from "./BusinessForms";

vi.mock("@/lib/business", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/business")>();
  return {
    ...actual,
    appendSampleProgress: vi.fn(),
    saveCustomer: vi.fn(),
    saveFollowUpTask: vi.fn(),
    saveInquiry: vi.fn(),
    saveQuote: vi.fn(),
    saveSample: vi.fn(),
  };
});

const mockedSaveCustomer = vi.mocked(saveCustomer);

afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());

describe("CustomerForm", () => {
  it("shows inline validation and does not submit an empty customer", async () => {
    const user = userEvent.setup();
    render(<CustomerForm onSaved={vi.fn()} onCancel={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "创建客户" }));
    expect(screen.getByText("请输入客户姓名。")).toBeInTheDocument();
    expect(mockedSaveCustomer).not.toHaveBeenCalled();
  });

  it("keeps entered values when validation fails", async () => {
    const user = userEvent.setup();
    render(<CustomerForm onSaved={vi.fn()} onCancel={vi.fn()} />);
    const name = screen.getByLabelText("客户姓名 *");
    await user.type(name, "Alice");
    await user.type(screen.getByLabelText("电子邮箱"), "invalid-email");
    await user.click(screen.getByRole("button", { name: "创建客户" }));
    expect(screen.getByText("请输入有效的电子邮箱。")).toBeInTheDocument();
    expect(name).toHaveValue("Alice");
    expect(mockedSaveCustomer).not.toHaveBeenCalled();
  });

  it("saves a valid customer and reports completion", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    mockedSaveCustomer.mockResolvedValue();
    render(<CustomerForm onSaved={onSaved} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText("客户姓名 *"), "Alice");
    await user.type(screen.getByLabelText("电子邮箱"), "alice@example.com");
    await user.click(screen.getByRole("button", { name: "创建客户" }));
    expect(mockedSaveCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Alice", email: "alice@example.com" }),
    );
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("does not repeat a committed create when the following refresh fails", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn().mockRejectedValue(new Error("refresh failed"));
    mockedSaveCustomer.mockResolvedValue();
    render(<CustomerForm onSaved={onSaved} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText("客户姓名 *"), "Alice");

    await user.click(screen.getByRole("button", { name: "创建客户" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "refresh failed",
    );

    expect(mockedSaveCustomer).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "已保存" })).toBeDisabled();
  });
});

const customer: CustomerRecord = {
  id: 7,
  name: "Alice",
  company: "Example Ltd",
  email: "alice@example.com",
  phone: "",
  country: "美国",
  source: "展会",
  notes: "",
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
};

const inquiry: InquiryRecord = {
  id: 12,
  customerId: customer.id,
  receivedOn: "2026-10-02",
  content: "Please quote the valve.",
  source: customer.source,
  country: customer.country,
  products: ["Valve"],
  stage: "quoted",
  createdAt: customer.createdAt,
  updatedAt: customer.updatedAt,
};

const inquiryLabel = "2026-10-02 · Valve";

const quote: QuoteRecord = {
  id: 15,
  customerId: customer.id,
  inquiryId: inquiry.id,
  quotedOn: "2026-10-03",
  content: "Valve, FOB Shanghai",
  amount: "120.00",
  currency: "EUR",
  notes: "",
  createdAt: customer.createdAt,
  updatedAt: customer.updatedAt,
};

const sample: SampleRecord = {
  id: 21,
  customerId: customer.id,
  inquiryId: inquiry.id,
  product: "Valve",
  quantity: 2,
  requestedOn: "2026-10-03",
  notes: "",
  carrier: "",
  trackingNumber: "",
  currentStage: "requested",
  createdAt: customer.createdAt,
  updatedAt: customer.updatedAt,
  progress: [],
};

const task: FollowUpTaskRecord = {
  id: 25,
  customerId: customer.id,
  inquiryId: inquiry.id,
  dueAt: "2026-10-05T10:00",
  content: "Confirm quote receipt",
  completed: false,
  completedAt: null,
  createdAt: customer.createdAt,
  updatedAt: customer.updatedAt,
};

describe("business form selects", () => {
  it("fills an existing inquiry stage and saves the chosen stage", async () => {
    const user = userEvent.setup();
    vi.mocked(saveInquiry).mockResolvedValue();
    render(
      <InquiryForm
        customer={customer}
        inquiry={inquiry}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("combobox", { name: "跟进阶段 *" }),
    ).toHaveTextContent("已报价");
    await chooseSelectOption("跟进阶段 *", "已成交");
    await user.click(screen.getByRole("button", { name: "保存询盘" }));

    expect(saveInquiry).toHaveBeenCalledWith(
      expect.objectContaining({ id: inquiry.id, stage: "won" }),
    );
  });

  it("fills an existing quote and saves an empty association and chosen currency", async () => {
    const user = userEvent.setup();
    vi.mocked(saveQuote).mockResolvedValue();
    render(
      <QuoteForm
        customer={customer}
        inquiries={[inquiry]}
        quote={quote}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("combobox", { name: "关联询盘" }),
    ).toHaveTextContent(inquiryLabel);
    expect(screen.getByRole("combobox", { name: "币种 *" })).toHaveTextContent(
      "EUR",
    );
    await chooseSelectOption("关联询盘", "不关联询盘");
    await chooseSelectOption("币种 *", "GBP");
    await user.click(screen.getByRole("button", { name: "保存报价" }));

    expect(saveQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        id: quote.id,
        inquiryId: null,
        currency: "GBP",
      }),
    );
  });

  it("allows saving a quote when no inquiries are available", async () => {
    const user = userEvent.setup();
    vi.mocked(saveQuote).mockResolvedValue();
    render(
      <QuoteForm
        customer={customer}
        inquiries={[]}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "关联询盘" }));
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(
      screen.getByRole("option", { name: "不关联询盘" }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.type(screen.getByLabelText("金额 *"), "42.50");
    await user.type(screen.getByLabelText("产品或报价内容 *"), "Valve");
    await user.click(screen.getByRole("button", { name: "记录报价" }));

    expect(saveQuote).toHaveBeenCalledWith(
      expect.objectContaining({ inquiryId: null, currency: "USD" }),
    );
  });

  it.each(["sample", "task"] as const)(
    "fills an existing %s association and saves its numeric inquiry ID",
    async (kind) => {
      const user = userEvent.setup();
      const onSaved = vi.fn();
      if (kind === "sample") {
        vi.mocked(saveSample).mockResolvedValue();
        render(
          <SampleForm
            customer={customer}
            inquiries={[inquiry]}
            sample={sample}
            onSaved={onSaved}
            onCancel={vi.fn()}
          />,
        );
      } else {
        vi.mocked(saveFollowUpTask).mockResolvedValue();
        render(
          <TaskForm
            customer={customer}
            inquiries={[inquiry]}
            task={task}
            onSaved={onSaved}
            onCancel={vi.fn()}
          />,
        );
      }

      expect(
        screen.getByRole("combobox", { name: "关联询盘" }),
      ).toHaveTextContent(inquiryLabel);
      await chooseSelectOption("关联询盘", "不关联询盘");
      await chooseSelectOption("关联询盘", inquiryLabel);
      await user.click(
        screen.getByRole("button", {
          name: kind === "sample" ? "保存样品" : "保存改期",
        }),
      );

      expect(
        kind === "sample" ? saveSample : saveFollowUpTask,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          id: kind === "sample" ? sample.id : task.id,
          inquiryId: inquiry.id,
        }),
      );
      expect(onSaved).toHaveBeenCalledOnce();
    },
  );

  it("keeps selected association and currency after a save fails", async () => {
    const user = userEvent.setup();
    vi.mocked(saveQuote).mockRejectedValue(new Error("写入失败"));
    render(
      <QuoteForm
        customer={customer}
        inquiries={[inquiry]}
        quote={{ ...quote, inquiryId: null }}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await chooseSelectOption("关联询盘", inquiryLabel);
    await chooseSelectOption("币种 *", "CNY");
    await user.click(screen.getByRole("button", { name: "保存报价" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("写入失败");
    expect(
      screen.getByRole("combobox", { name: "关联询盘" }),
    ).toHaveTextContent(inquiryLabel);
    expect(screen.getByRole("combobox", { name: "币种 *" })).toHaveTextContent(
      "CNY",
    );
    expect(screen.getByRole("button", { name: "保存报价" })).toBeEnabled();
  });
});

describe("SampleProgressForm select", () => {
  it("describes required validation and saves an allowed next stage", async () => {
    const user = userEvent.setup();
    vi.mocked(appendSampleProgress).mockResolvedValue();
    render(<SampleProgressForm sample={sample} onSaved={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "追加进度" }));
    const stage = screen.getByRole("combobox", { name: "下一阶段" });
    expect(stage).toHaveAttribute("aria-invalid", "true");
    expect(stage).toHaveAccessibleDescription("请选择下一阶段。");
    expect(appendSampleProgress).not.toHaveBeenCalled();

    await chooseSelectOption("下一阶段", "准备中");
    expect(stage).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByText("请选择下一阶段。")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "追加进度" }));

    expect(appendSampleProgress).toHaveBeenCalledWith(
      expect.objectContaining({ sampleId: sample.id, stage: "preparing" }),
    );
  });

  it.each([
    ["requested", "准备中"],
    ["preparing", "已寄出"],
    ["sent", "已签收"],
    ["received", "已完成"],
  ])(
    "offers only valid transitions from %s",
    async (currentStage, nextStage) => {
      const user = userEvent.setup();
      render(
        <SampleProgressForm
          sample={{ ...sample, currentStage }}
          onSaved={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("combobox", { name: "下一阶段" }));
      expect(
        screen.getAllByRole("option").map((option) => option.textContent),
      ).toEqual(["请选择", nextStage, "已取消"]);
    },
  );

  it.each(["completed", "cancelled"])(
    "does not offer further transitions for a %s sample",
    (currentStage) => {
      render(
        <SampleProgressForm
          sample={{ ...sample, currentStage }}
          onSaved={vi.fn()}
        />,
      );

      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    },
  );
});
