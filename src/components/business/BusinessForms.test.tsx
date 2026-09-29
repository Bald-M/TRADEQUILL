// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveCustomer } from "@/lib/business";
import { CustomerForm } from "./BusinessForms";

vi.mock("@/lib/business", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/business")>();
  return { ...actual, saveCustomer: vi.fn() };
});

const mockedSaveCustomer = vi.mocked(saveCustomer);

afterEach(cleanup);

describe("CustomerForm", () => {
  beforeEach(() => mockedSaveCustomer.mockReset());

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
