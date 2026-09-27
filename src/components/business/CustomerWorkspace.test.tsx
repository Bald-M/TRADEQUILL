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
import type { BusinessSnapshot, InquiryRecord } from "@/lib/business";
import { CustomerWorkspace } from "./CustomerWorkspace";

afterEach(cleanup);

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
  it("applies inquiry filters to both the customer list and detail history", () => {
    render(<CustomerWorkspace snapshot={snapshot} refresh={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("按跟进阶段筛选"), {
      target: { value: "quoted" },
    });

    expect(screen.getByText("Quoted inquiry")).toBeInTheDocument();
    expect(screen.queryByText("New inquiry")).not.toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText("按跟进阶段筛选"), {
      target: { value: "sampling" },
    });

    await waitFor(() =>
      expect(screen.queryByLabelText("询盘内容 *")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Sampling inquiry")).toBeInTheDocument();
  });
});
