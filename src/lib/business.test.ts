import { describe, expect, it } from "vitest";
import {
  filterInquiries,
  splitProducts,
  taskBucket,
  type FollowUpTaskRecord,
  type InquiryRecord,
} from "./business";

const inquiry: InquiryRecord = {
  id: 1,
  customerId: 10,
  receivedOn: "2026-09-27",
  content: "Need a quote",
  source: "展会",
  country: "德国",
  products: ["Widget A", "Widget B"],
  stage: "quoted",
  createdAt: "",
  updatedAt: "",
};

describe("business view helpers", () => {
  it("normalizes product entry and removes case-insensitive duplicates", () => {
    expect(splitProducts("Widget A，Widget B\nwidget a、Widget C")).toEqual([
      "Widget A",
      "Widget B",
      "Widget C",
    ]);
  });

  it("combines all inquiry filter dimensions", () => {
    expect(
      filterInquiries([inquiry], {
        source: "展会",
        country: "德国",
        product: "Widget B",
        stage: "quoted",
      }),
    ).toHaveLength(1);
    expect(
      filterInquiries([inquiry], {
        source: "展会",
        country: "德国",
        product: "Widget B",
        stage: "sampling",
      }),
    ).toHaveLength(0);
  });

  it("groups tasks using local calendar dates and completion first", () => {
    const task: FollowUpTaskRecord = {
      id: 1,
      customerId: 10,
      inquiryId: null,
      dueAt: "2026-09-27T09:00",
      content: "Follow up",
      completed: false,
      completedAt: null,
      createdAt: "",
      updatedAt: "",
    };
    expect(taskBucket(task, "2026-09-27")).toBe("today");
    expect(
      taskBucket({ ...task, dueAt: "2026-09-26T23:59" }, "2026-09-27"),
    ).toBe("overdue");
    expect(taskBucket({ ...task, completed: true }, "2026-09-27")).toBe(
      "completed",
    );
  });
});
