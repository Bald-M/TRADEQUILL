// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DateTimeField } from "./date-time-field";

afterEach(cleanup);
function Field({ initial = "2026-12-31", withTime = false, disabled = false }) {
  const [value, setValue] = useState(initial);
  return (
    <DateTimeField
      label="测试日期"
      value={value}
      onChange={setValue}
      withTime={withTime}
      disabled={disabled}
      required
    />
  );
}

describe("DateTimeField", () => {
  it("allows typing, reports invalid dates and clears without losing the typed draft", async () => {
    const user = userEvent.setup();
    render(<Field />);
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "2026-02-30");
    expect(input).toHaveValue("2026-02-30");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("有效的日期");
    await user.click(screen.getByRole("button", { name: "清空测试日期" }));
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute("aria-required", "true");
  });

  it("crosses a year with arrows, selects with Enter, and applies explicitly", async () => {
    const user = userEvent.setup();
    render(<Field />);
    await user.click(screen.getByRole("button", { name: "选择测试日期" }));
    expect(screen.getByRole("button", { name: "2026-12-31" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    const next = await screen.findByRole("button", { name: "2027-01-01" });
    await waitFor(() => expect(next).toHaveFocus());
    await user.keyboard("{Enter}");
    expect(next).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("textbox", { hidden: true })).toHaveValue(
      "2026-12-31",
    );
    await user.click(screen.getByRole("button", { name: "应用" }));
    expect(screen.getByRole("textbox")).toHaveValue("2027-01-01");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "选择测试日期" }),
      ).toHaveFocus(),
    );
  });

  it("moves focus synchronously before an immediate Enter can select a reused day button", async () => {
    const user = userEvent.setup();
    render(<Field initial="2026-12-31" />);
    await user.click(screen.getByRole("button", { name: "选择测试日期" }));
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: "2027-01-01" })).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "应用" }));
    expect(screen.getByRole("textbox")).toHaveValue("2027-01-01");
  });

  it("cancels a draft with Escape, Cancel, or an outside click and restores focus", async () => {
    const user = userEvent.setup();
    render(<Field />);
    for (const action of ["escape", "cancel", "outside"]) {
      await user.click(screen.getByRole("button", { name: "选择测试日期" }));
      await user.click(screen.getByRole("button", { name: "下一年" }));
      await user.click(screen.getByRole("button", { name: "2027-12-01" }));
      if (action === "escape") await user.keyboard("{Escape}");
      else if (action === "cancel")
        await user.click(screen.getByRole("button", { name: "取消选择" }));
      else
        await user.click(
          document.querySelector('[data-state="open"][class*="inset-0"]')!,
        );
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(screen.getByRole("textbox")).toHaveValue("2026-12-31");
    }
  });

  it("edits hour/minute, rejects invalid time and retains a DST-gap wall time", async () => {
    const user = userEvent.setup();
    render(<Field initial="2026-03-08T02:30" withTime />);
    await user.click(screen.getByRole("button", { name: "选择测试日期" }));
    const hour = screen.getByLabelText("小时");
    const minute = screen.getByLabelText("分钟");
    expect(hour).toHaveValue(2);
    expect(minute).toHaveValue(30);
    fireEvent.change(hour, { target: { value: "24" } });
    expect(screen.getByRole("button", { name: "应用" })).toBeDisabled();
    fireEvent.change(hour, { target: { value: "2" } });
    fireEvent.change(minute, { target: { value: "5" } });
    await user.click(screen.getByRole("button", { name: "应用" }));
    expect(screen.getByRole("textbox")).toHaveValue("2026-03-08T02:05");
  });

  it("supports page/home/end navigation and clamps leap-day year changes", async () => {
    const user = userEvent.setup();
    render(<Field initial="2024-02-29" />);
    await user.click(screen.getByRole("button", { name: "选择测试日期" }));
    await user.keyboard("{Shift>}{PageDown}{/Shift}");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "2025-02-28" })).toHaveFocus(),
    );
    await user.keyboard("{Home}");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "2025-02-23" })).toHaveFocus(),
    );
    await user.keyboard("{End}");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "2025-03-01" })).toHaveFocus(),
    );
  });

  it("disables every entry point and reflects externally updated values", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <DateTimeField
        label="日期"
        value="2026-01-01"
        onChange={onChange}
        disabled
      />,
    );
    expect(screen.getByRole("textbox")).toBeDisabled();
    for (const button of screen.getAllByRole("button"))
      expect(button).toBeDisabled();
    rerender(
      <DateTimeField label="日期" value="2027-02-01" onChange={onChange} />,
    );
    expect(screen.getByRole("textbox")).toHaveValue("2027-02-01");
    expect(onChange).not.toHaveBeenCalled();
  });
});
