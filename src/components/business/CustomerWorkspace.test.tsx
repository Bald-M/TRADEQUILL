// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  saveInquiry,
  setFollowUpTaskCompleted,
  type BusinessSnapshot,
  type InquiryRecord,
} from "@/lib/business";
import { CustomerWorkspace } from "./CustomerWorkspace";
import { chooseSelectOption } from "@/test/select";

vi.mock("@/lib/business", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/business")>();
  return {
    ...actual,
    saveInquiry: vi.fn(),
    setFollowUpTaskCompleted: vi.fn(),
  };
});

const mockedSaveInquiry = vi.mocked(saveInquiry);
const mockedSetFollowUpTaskCompleted = vi.mocked(setFollowUpTaskCompleted);

afterEach(() => {
  cleanup();
  mockedSaveInquiry.mockReset();
  mockedSetFollowUpTaskCompleted.mockReset();
});

const inquiries: InquiryRecord[] = [
  {
    id: 1,
    customerId: 10,
    receivedOn: "2026-09-28",
    content: "New inquiry",
    source: "展会",
    country: "德国",
    products: ["Widget A"],
    stage: "new",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: 2,
    customerId: 10,
    receivedOn: "2026-09-27",
    content: "Quoted inquiry",
    source: "网站",
    country: "法国",
    products: ["Widget B"],
    stage: "quoted",
    createdAt: "",
    updatedAt: "",
  },
];

const snapshot: BusinessSnapshot = {
  customers: [
    {
      id: 10,
      name: "Alice",
      company: "Example Ltd",
      email: "alice@example.com",
      phone: "",
      country: "德国",
      source: "展会",
      notes: "",
      createdAt: "",
      updatedAt: "",
    },
  ],
  inquiries,
  quotes: [],
  samples: [],
  tasks: [],
};

describe("CustomerWorkspace", () => {
  it("applies inquiry filters to both the customer list and detail history", async () => {
    render(<CustomerWorkspace snapshot={snapshot} refresh={vi.fn()} />);

    await chooseSelectOption("按跟进阶段筛选", "已报价");

    expect(screen.getByText("Quoted inquiry")).toBeInTheDocument();
    expect(screen.queryByText("New inquiry")).not.toBeInTheDocument();
  });

  it("combines all four filters and restores empty values when cleared", async () => {
    render(<CustomerWorkspace snapshot={snapshot} refresh={vi.fn()} />);

    await chooseSelectOption("按询盘来源筛选", "网站");
    await chooseSelectOption("按国家或地区筛选", "法国");
    await chooseSelectOption("按意向产品筛选", "Widget B");
    await chooseSelectOption("按跟进阶段筛选", "已报价");
    expect(screen.getByText("Quoted inquiry")).toBeInTheDocument();
    expect(screen.queryByText("New inquiry")).not.toBeInTheDocument();

    await chooseSelectOption("按意向产品筛选", "Widget A");
    expect(screen.getByText("没有符合组合筛选的客户。")).toBeInTheDocument();
    expect(screen.queryByText("Quoted inquiry")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "清除筛选" })[0]);

    expect(
      screen.getByRole("combobox", { name: "按询盘来源筛选" }),
    ).toHaveTextContent("全部来源");
    expect(
      screen.getByRole("combobox", { name: "按国家或地区筛选" }),
    ).toHaveTextContent("全部国家或地区");
    expect(
      screen.getByRole("combobox", { name: "按意向产品筛选" }),
    ).toHaveTextContent("全部产品");
    expect(
      screen.getByRole("combobox", { name: "按跟进阶段筛选" }),
    ).toHaveTextContent("全部阶段");
    expect(screen.getByText("New inquiry")).toBeInTheDocument();
    expect(screen.getByText("Quoted inquiry")).toBeInTheDocument();
  });

  it("remounts the editor when switching between records", () => {
    render(<CustomerWorkspace snapshot={snapshot} refresh={vi.fn()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "编辑 2026-09-28 询盘" }),
    );
    expect(screen.getByLabelText("询盘内容 *")).toHaveValue("New inquiry");

    fireEvent.click(
      screen.getByRole("button", { name: "编辑 2026-09-27 询盘" }),
    );
    expect(screen.getByLabelText("询盘内容 *")).toHaveValue("Quoted inquiry");
  });

  it("closes an editor when filtering selects a different customer", async () => {
    const switchedSnapshot: BusinessSnapshot = {
      ...snapshot,
      customers: [
        ...snapshot.customers,
        {
          ...snapshot.customers[0],
          id: 20,
          name: "Bob",
          company: "Second Ltd",
        },
      ],
      inquiries: [
        ...snapshot.inquiries,
        {
          ...snapshot.inquiries[0],
          id: 3,
          customerId: 20,
          content: "Sampling inquiry",
          stage: "sampling",
        },
      ],
    };
    render(<CustomerWorkspace snapshot={switchedSnapshot} refresh={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: "编辑 2026-09-28 询盘" }),
    );
    expect(screen.getByLabelText("询盘内容 *")).toHaveValue("New inquiry");

    await chooseSelectOption("按跟进阶段筛选", "样品中");

    await waitFor(() =>
      expect(screen.queryByLabelText("询盘内容 *")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Sampling inquiry")).toBeInTheDocument();
  });

  it("keeps an edited inquiry bound to its record when filters hide it", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    mockedSaveInquiry.mockResolvedValue();
    render(<CustomerWorkspace snapshot={snapshot} refresh={refresh} />);
    fireEvent.click(
      screen.getByRole("button", { name: "编辑 2026-09-28 询盘" }),
    );
    expect(screen.getByLabelText("询盘内容 *")).toHaveValue("New inquiry");

    await chooseSelectOption("按跟进阶段筛选", "已报价");

    expect(screen.getByLabelText("询盘内容 *")).toHaveValue("New inquiry");
    fireEvent.click(screen.getByRole("button", { name: "保存询盘" }));

    await waitFor(() =>
      expect(mockedSaveInquiry).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, content: "New inquiry" }),
      ),
    );
  });

  it("offers refresh recovery after a task status write commits", async () => {
    const taskSnapshot: BusinessSnapshot = {
      ...snapshot,
      tasks: [
        {
          id: 7,
          customerId: 10,
          inquiryId: null,
          dueAt: "2026-09-29T10:00",
          content: "Call customer",
          completed: false,
          completedAt: null,
          createdAt: "",
          updatedAt: "",
        },
      ],
    };
    const refresh = vi
      .fn()
      .mockRejectedValueOnce(new Error("refresh failed"))
      .mockResolvedValueOnce(undefined);
    mockedSetFollowUpTaskCompleted.mockResolvedValue();
    render(<CustomerWorkspace snapshot={taskSnapshot} refresh={refresh} />);
    fireEvent.click(screen.getByRole("tab", { name: /跟进/ }));

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
