import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/business/BusinessForms";
export { fieldClass };
import { SelectField } from "@/components/ui/select";
import { DateTimeField } from "@/components/ui/date-time-field";

const FormDisabled = createContext(false);
export const CommerceEditing = createContext<
  ((editing: boolean) => void) | null
>(null);
export function SelectInput(props: ComponentProps<typeof SelectField>) {
  const formDisabled = useContext(FormDisabled);
  return <SelectField {...props} disabled={formDisabled || props.disabled} />;
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: (id: string) => ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children(id)}
      {hint && (
        <p className="text-xs leading-5 text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
export function TextField({
  label,
  value,
  onChange,
  multiline = false,
  type = "text",
  required = false,
  hint,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  type?: string;
  required?: boolean;
  hint?: string;
  disabled?: boolean;
}) {
  const formDisabled = useContext(FormDisabled);
  disabled ||= formDisabled;
  if (type === "date")
    return (
      <Field label={label} hint={hint}>
        {(id) => (
          <DateTimeField
            id={id}
            label={label}
            value={value}
            onChange={onChange}
            required={required}
            disabled={disabled}
          />
        )}
      </Field>
    );
  return (
    <Field label={label} hint={hint}>
      {(id) =>
        multiline ? (
          <textarea
            id={id}
            className={fieldClass}
            rows={3}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={required}
            disabled={disabled}
          />
        ) : (
          <input
            id={id}
            className={fieldClass}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={required}
            disabled={disabled}
          />
        )
      }
    </Field>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
      {children}
    </p>
  );
}
export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <p
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm break-words"
    >
      {message}
    </p>
  ) : null;
}
export function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

// Remember a successful write separately from its refresh. A failed refresh must
// never resubmit a successful mutation and accidentally create another record.
export function SaveForm({
  children,
  save,
  refresh,
  onDone,
  onCancel,
  label = "保存",
}: {
  children: ReactNode;
  save: () => Promise<unknown>;
  refresh: () => Promise<void>;
  onDone: () => void;
  onCancel: () => void;
  label?: string;
}) {
  const onEditing = useContext(CommerceEditing);
  useEffect(() => {
    onEditing?.(true);
    return () => onEditing?.(false);
  }, [onEditing]);
  const [busy, setBusy] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [error, setError] = useState("");
  const guard = useRef(false);
  const alertRef = useRef<HTMLDivElement>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    let saved = committed;
    try {
      if (!saved) {
        await save();
        saved = true;
        setCommitted(true);
      }
      await refresh();
      onDone();
    } catch (error) {
      setError(
        `${saved ? "数据已保存，刷新失败；请重试刷新。" : "保存失败，输入已保留。"}${messageOf(error)}`,
      );
      requestAnimationFrame(() => alertRef.current?.focus());
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div
        ref={alertRef}
        tabIndex={-1}
        className="outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ErrorMessage message={error} />
      </div>
      <fieldset
        disabled={busy || committed}
        className="space-y-4 disabled:opacity-70"
      >
        <FormDisabled.Provider value={busy || committed}>
          {children}
        </FormDisabled.Provider>
      </fieldset>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={busy}
        >
          {committed ? "关闭" : "取消并放弃输入"}
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "处理中…" : committed ? "重试刷新" : label}
        </Button>
      </div>
    </form>
  );
}

export function ActionButton({
  action,
  children,
  disabled = false,
  variant = "outline",
}: {
  action: () => Promise<void>;
  children: ReactNode;
  disabled?: boolean;
  variant?: "outline" | "default" | "destructive";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const guard = useRef(false);
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={variant}
        disabled={disabled || busy}
        onClick={async () => {
          if (guard.current) return;
          guard.current = true;
          setBusy(true);
          setError("");
          try {
            await action();
          } catch (error) {
            setError(messageOf(error));
          } finally {
            guard.current = false;
            setBusy(false);
          }
        }}
      >
        {busy ? "处理中…" : children}
      </Button>
      <ErrorMessage message={error} />
    </div>
  );
}
