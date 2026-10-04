// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import "@/test/select";
import { useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { chooseSelectOption } from "@/test/select";
import { SelectField, type SelectOption } from "./select";

afterEach(cleanup);

function ControlledSelect({
  options,
  onChange,
}: {
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <SelectField
      aria-label="筛选条件"
      value={value}
      onValueChange={(nextValue) => {
        setValue(nextValue);
        onChange(nextValue);
      }}
      options={options}
    />
  );
}

describe("SelectField", () => {
  it("round-trips empty, numeric and prefix-like business values distinctly", async () => {
    const onChange = vi.fn();
    render(
      <ControlledSelect
        onChange={onChange}
        options={[
          { value: "", label: "全部" },
          { value: "23", label: "客户 23" },
          { value: "value:", label: "带前缀的产品" },
          { value: "value:23", label: "前缀与数字组合" },
        ]}
      />,
    );
    const trigger = screen.getByRole("combobox", { name: "筛选条件" });
    expect(trigger).toHaveTextContent("全部");

    await chooseSelectOption("筛选条件", "客户 23");
    expect(onChange).toHaveBeenLastCalledWith("23");
    expect(trigger).toHaveTextContent("客户 23");

    await chooseSelectOption("筛选条件", "带前缀的产品");
    expect(onChange).toHaveBeenLastCalledWith("value:");

    await chooseSelectOption("筛选条件", "前缀与数字组合");
    expect(onChange).toHaveBeenLastCalledWith("value:23");

    await chooseSelectOption("筛选条件", "全部");
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(trigger).toHaveTextContent("全部");
    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it("selects with arrows and Enter, skips disabled options and restores focus on Escape", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <button>上一个控件</button>
        <ControlledSelect
          onChange={onChange}
          options={[
            { value: "", label: "全部" },
            { value: "disabled", label: "不可选择", disabled: true },
            { value: "next", label: "后续跟进" },
          ]}
        />
        <button>下一个控件</button>
      </>,
    );
    const trigger = screen.getByRole("combobox", { name: "筛选条件" });
    await user.tab();
    expect(screen.getByRole("button", { name: "上一个控件" })).toHaveFocus();
    await user.tab();
    expect(trigger).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "全部" })).toHaveFocus(),
    );
    expect(screen.getByRole("option", { name: "不可选择" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.keyboard("{ArrowDown}");
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "后续跟进" })).toHaveFocus(),
    );
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("next");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());

    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "后续跟进" })).toHaveFocus(),
    );
    await user.keyboard("{ArrowUp}");
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "全部" })).toHaveFocus(),
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveTextContent("后续跟进");
    expect(onChange).toHaveBeenCalledOnce();
    await user.tab();
    expect(screen.getByRole("button", { name: "下一个控件" })).toHaveFocus();
  });

  it("associates visible labels and errors while preventing disabled interaction", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <>
        <label htmlFor="customer">关联客户</label>
        <SelectField
          id="customer"
          value=""
          onValueChange={onValueChange}
          options={[{ value: "", label: "请选择客户" }]}
          aria-invalid="true"
          aria-describedby="customer-error"
          disabled
        />
        <p id="customer-error">需要先创建客户。</p>
      </>,
    );
    const trigger = screen.getByRole("combobox", { name: "关联客户" });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger).toHaveAccessibleDescription("需要先创建客户。");
    await user.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("reflects async options and controlled edits without emitting a value change", async () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <SelectField
        aria-label="关联客户"
        value="42"
        onValueChange={onValueChange}
        options={[]}
      />,
    );
    const trigger = screen.getByRole("combobox", { name: "关联客户" });
    expect(trigger).toHaveTextContent("42");
    rerender(
      <SelectField
        aria-label="关联客户"
        value="42"
        onValueChange={onValueChange}
        options={[
          { value: "", label: "未关联客户" },
          { value: "42", label: "Alice 公司" },
        ]}
      />,
    );
    expect(trigger).toHaveTextContent("Alice 公司");
    rerender(
      <SelectField
        aria-label="关联客户"
        value="42"
        onValueChange={onValueChange}
        options={[
          { value: "", label: "未关联客户" },
          { value: "42", label: "Alice 公司（更新）" },
        ]}
      />,
    );
    expect(trigger).toHaveTextContent("Alice 公司（更新）");
    rerender(
      <SelectField
        aria-label="关联客户"
        value="42"
        onValueChange={onValueChange}
        options={[{ value: "", label: "未关联客户" }]}
      />,
    );
    expect(trigger).toHaveTextContent("42");
    expect(onValueChange).not.toHaveBeenCalled();
    await chooseSelectOption("关联客户", "未关联客户");
    expect(onValueChange).toHaveBeenLastCalledWith("");
  });
});
