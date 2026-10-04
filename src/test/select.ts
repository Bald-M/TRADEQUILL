import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// jsdom lacks these browser APIs; selection and focus still run through Radix.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

export async function chooseSelectOption(label: string, optionName: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.click(screen.getByRole("option", { name: optionName }));
}
