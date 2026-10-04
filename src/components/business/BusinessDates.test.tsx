// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { chooseSelectOption } from "@/test/select";
import {
  appendSampleProgress,
  saveFollowUpTask,
  saveInquiry,
  saveQuote,
  saveSample,
  type CustomerRecord,
  type InquiryRecord,
  type QuoteRecord,
  type SampleRecord,
  type FollowUpTaskRecord,
} from "@/lib/business";
import {
  InquiryForm,
  QuoteForm,
  SampleForm,
  SampleProgressForm,
  TaskForm,
} from "./BusinessForms";
vi.mock("@/lib/business", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/business")>()),
  appendSampleProgress: vi.fn(),
  saveFollowUpTask: vi.fn(),
  saveInquiry: vi.fn(),
  saveQuote: vi.fn(),
  saveSample: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const customer: CustomerRecord = {
  id: 1,
  name: "Date QA",
  company: "",
  email: "",
  phone: "",
  country: "US",
  source: "test",
  notes: "",
  createdAt: "",
  updatedAt: "",
};
const common = { id: 1, customerId: 1, createdAt: "", updatedAt: "" };
const inquiry: InquiryRecord = {
  ...common,
  receivedOn: "2026-12-31",
  content: "date test",
  source: "test",
  country: "US",
  products: ["test"],
  stage: "new",
};
const quote: QuoteRecord = {
  ...common,
  inquiryId: null,
  quotedOn: "2026-12-31",
  content: "test",
  amount: "10.00",
  currency: "USD",
  notes: "",
};
const sample: SampleRecord = {
  ...common,
  inquiryId: null,
  requestedOn: "2026-12-31",
  product: "test",
  quantity: 1,
  notes: "",
  carrier: "",
  trackingNumber: "",
  currentStage: "requested",
  progress: [],
};
const task: FollowUpTaskRecord = {
  ...common,
  inquiryId: null,
  dueAt: "2026-12-31T23:59",
  content: "test",
  completed: false,
  completedAt: null,
};
const props = { customer, inquiries: [], onSaved: vi.fn(), onCancel: vi.fn() };
const cases = [
  {
    label: "收到日期",
    field: "receivedOn",
    button: "保存询盘",
    save: saveInquiry,
    element: <InquiryForm {...props} inquiry={inquiry} />,
    initial: inquiry.receivedOn,
    next: "2027-01-01",
  },
  {
    label: "报价日期",
    field: "quotedOn",
    button: "保存报价",
    save: saveQuote,
    element: <QuoteForm {...props} quote={quote} />,
    initial: quote.quotedOn,
    next: "2027-01-01",
  },
  {
    label: "申请日期",
    field: "requestedOn",
    button: "保存样品",
    save: saveSample,
    element: <SampleForm {...props} sample={sample} />,
    initial: sample.requestedOn,
    next: "2027-01-01",
  },
  {
    label: "跟进时间",
    field: "dueAt",
    button: "保存改期",
    save: saveFollowUpTask,
    element: <TaskForm {...props} task={task} />,
    initial: task.dueAt,
    next: "2027-01-01T00:05",
  },
  {
    label: "发生日期",
    field: "occurredOn",
    button: "追加进度",
    save: appendSampleProgress,
    element: <SampleProgressForm sample={sample} onSaved={vi.fn()} />,
    next: "2027-01-01",
  },
];
describe("business date contracts", () => {
  it.each(cases)(
    "$label: restores, validates and preserves input after a failed save",
    async ({ label, field, button, save, element, initial, next }) => {
      const user = userEvent.setup();
      vi.mocked(save).mockRejectedValueOnce(new Error("保存失败，请重试"));
      render(element);
      const input = screen.getByRole("textbox", { name: label });
      if (initial) expect(input).toHaveValue(initial);
      else await chooseSelectOption("下一阶段", "准备中");
      await user.click(screen.getByRole("button", { name: `清空${label}` }));
      await user.click(screen.getByRole("button", { name: button }));
      expect(save).not.toHaveBeenCalled();
      expect(input).toHaveAttribute("aria-invalid", "true");
      fireEvent.change(input, { target: { value: "2026-02-30" } });
      await user.click(screen.getByRole("button", { name: button }));
      expect(save).not.toHaveBeenCalled();
      expect(input).toHaveValue("2026-02-30");
      expect(screen.getAllByText(/请输入有效的日期/)).toHaveLength(1);
      fireEvent.change(input, { target: { value: next } });
      await user.click(screen.getByRole("button", { name: button }));
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ [field]: next }),
      );
      expect(await screen.findByText("保存失败，请重试")).toBeInTheDocument();
      expect(input).toHaveValue(next);
      await user.click(screen.getByRole("button", { name: button }));
      expect(save).toHaveBeenCalledTimes(2);
    },
  );
});
