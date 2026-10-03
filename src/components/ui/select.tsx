import type { ComponentProps } from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectFieldProps = Omit<
  ComponentProps<typeof SelectPrimitive.Trigger>,
  "value" | "onChange" | "children"
> & {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
};

// Radix reserves an empty value; encode every value so business values stay distinct.
const valuePrefix = "value:";

function SelectField({
  value,
  onValueChange,
  options,
  disabled,
  className,
  ...props
}: SelectFieldProps) {
  const selectedLabel = options.find((option) => option.value === value)?.label;

  return (
    <SelectPrimitive.Root
      value={`${valuePrefix}${value}`}
      onValueChange={(nextValue) =>
        onValueChange(nextValue.slice(valuePrefix.length))
      }
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        data-slot="select-trigger"
        disabled={disabled}
        className={cn(
          "flex min-h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          className,
        )}
        {...props}
      >
        <span className="min-w-0 flex-1 whitespace-normal break-words">
          <SelectPrimitive.Value>
            {selectedLabel ?? value}
          </SelectPrimitive.Value>
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          data-slot="select-content"
          position="popper"
          sideOffset={4}
          collisionPadding={8}
          className="z-50 max-h-[var(--radix-select-content-available-height)] w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-1rem)] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md"
        >
          <SelectPrimitive.ScrollUpButton className="flex shrink-0 items-center justify-center py-1">
            <ChevronUp className="size-4" aria-hidden="true" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="min-h-0 overflow-y-auto p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={`${valuePrefix}${option.value}`}
                textValue={option.label}
                disabled={option.disabled}
                className="grid min-h-9 w-full cursor-default grid-cols-[minmax(0,1fr)_1rem] items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
              >
                <SelectPrimitive.ItemText>
                  <span className="block whitespace-normal break-words">
                    {option.label}
                  </span>
                </SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="col-start-2 row-start-1">
                  <Check className="size-4" aria-hidden="true" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex shrink-0 items-center justify-center py-1">
            <ChevronDown className="size-4" aria-hidden="true" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export { SelectField };
