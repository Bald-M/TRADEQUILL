import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateTimeField } from "@/components/ui/date-time-field";
import { dateInputError } from "@/lib/date-input";
import {
  appendSampleProgress,
  currencies,
  followUpStages,
  localDateTimeValue,
  localDateValue,
  sampleStages,
  saveCustomer,
  saveFollowUpTask,
  saveInquiry,
  saveQuote,
  saveSample,
  splitProducts,
  updateSampleShipment,
  type CustomerRecord,
  type FollowUpTaskRecord,
  type InquiryRecord,
  type QuoteRecord,
  type SampleRecord,
} from "@/lib/business";

export const fieldClass =
  "min-h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50";

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: (id: string, errorId: string | undefined) => ReactNode;
}) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children(id, errorId)}
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-5 text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function FormError({ message }: { message: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (message) ref.current?.focus();
  }, [message]);
  if (!message) return null;
  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {message}
    </div>
  );
}

function Actions({
  saving,
  committed,
  submitLabel,
  onCancel,
}: {
  saving: boolean;
  committed: boolean;
  submitLabel: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={saving}
      >
        取消
      </Button>
      <Button type="submit" disabled={saving || committed}>
        {saving && (
          <LoaderCircle
            className="animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        )}
        {committed ? "已保存" : saving ? "保存中…" : submitLabel}
      </Button>
    </div>
  );
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function commitAndRefresh(
  mutation: () => Promise<void>,
  refresh: () => Promise<void> | void,
  onCommitted: () => void,
  showError: (message: string) => void,
) {
  try {
    await mutation();
  } catch (error) {
    showError(messageOf(error));
    return;
  }
  onCommitted();
  try {
    await refresh();
  } catch (error) {
    showError(
      `数据已保存，但界面刷新失败：${messageOf(error)}。请关闭当前表单后重试刷新。`,
    );
  }
}

export function CustomerForm({
  customer,
  onSaved,
  onCancel,
}: {
  customer?: CustomerRecord;
  onSaved: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: customer?.name ?? "",
    company: customer?.company ?? "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
    country: customer?.country ?? "",
    source: customer?.source ?? "",
    notes: customer?.notes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const [committed, setCommitted] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "请输入客户姓名。";
    if (form.email && !/^\S+@\S+$/.test(form.email))
      next.email = "请输入有效的电子邮箱。";
    setErrors(next);
    if (Object.keys(next).length) {
      setServerError("请检查表单中标记的字段。已填写内容会保留。");
      return;
    }
    setSaving(true);
    setServerError("");
    await commitAndRefresh(
      () => saveCustomer({ id: customer?.id ?? null, ...form }),
      onSaved,
      () => setCommitted(true),
      setServerError,
    );
    setSaving(false);
  }

  const set = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setServerError("");
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={serverError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="客户姓名 *" error={errors.name}>
          {(id, errorId) => (
            <input
              id={id}
              autoFocus
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errorId}
              className={fieldClass}
            />
          )}
        </Field>
        <Field label="公司名称">
          {(id) => (
            <input
              id={id}
              value={form.company}
              onChange={(event) => set("company", event.target.value)}
              className={fieldClass}
            />
          )}
        </Field>
        <Field label="电子邮箱" error={errors.email}>
          {(id, errorId) => (
            <input
              id={id}
              type="email"
              value={form.email}
              onChange={(event) => set("email", event.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errorId}
              className={fieldClass}
            />
          )}
        </Field>
        <Field label="联系电话">
          {(id) => (
            <input
              id={id}
              value={form.phone}
              onChange={(event) => set("phone", event.target.value)}
              className={fieldClass}
            />
          )}
        </Field>
        <Field label="国家或地区">
          {(id) => (
            <input
              id={id}
              value={form.country}
              onChange={(event) => set("country", event.target.value)}
              className={fieldClass}
            />
          )}
        </Field>
        <Field label="客户来源">
          {(id) => (
            <input
              id={id}
              value={form.source}
              onChange={(event) => set("source", event.target.value)}
              className={fieldClass}
            />
          )}
        </Field>
      </div>
      <Field label="备注">
        {(id) => (
          <textarea
            id={id}
            rows={3}
            value={form.notes}
            onChange={(event) => set("notes", event.target.value)}
            className={fieldClass}
          />
        )}
      </Field>
      <Actions
        saving={saving}
        committed={committed}
        submitLabel={customer ? "保存客户" : "创建客户"}
        onCancel={onCancel}
      />
    </form>
  );
}

export function InquiryForm({
  customer,
  inquiry,
  onSaved,
  onCancel,
}: {
  customer: CustomerRecord;
  inquiry?: InquiryRecord;
  onSaved: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    receivedOn: inquiry?.receivedOn ?? localDateValue(),
    content: inquiry?.content ?? "",
    source: inquiry?.source ?? customer.source,
    country: inquiry?.country ?? customer.country,
    products: inquiry?.products.join("、") ?? "",
    stage: inquiry?.stage ?? "new",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const [committed, setCommitted] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (dateInputError(form.receivedOn))
      next.receivedOn = dateInputError(form.receivedOn);
    if (!form.source.trim()) next.source = "请输入询盘来源。";
    if (!form.country.trim()) next.country = "请输入国家或地区。";
    if (splitProducts(form.products).length === 0)
      next.products = "请至少填写一个意向产品。";
    if (!form.content.trim()) next.content = "请输入询盘内容。";
    setErrors(next);
    if (Object.keys(next).length) {
      setServerError("请检查表单中标记的字段。已填写内容会保留。");
      return;
    }
    setSaving(true);
    setServerError("");
    await commitAndRefresh(
      () =>
        saveInquiry({
          id: inquiry?.id ?? null,
          customerId: customer.id,
          receivedOn: form.receivedOn,
          content: form.content,
          source: form.source,
          country: form.country,
          products: splitProducts(form.products),
          stage: form.stage,
        }),
      onSaved,
      () => setCommitted(true),
      setServerError,
    );
    setSaving(false);
  }

  const set = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setServerError("");
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={serverError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="收到日期 *" error={errors.receivedOn}>
          {(id, errorId) => (
            <DateTimeField
              id={id}
              label="收到日期"
              required
              disabled={saving || committed}
              value={form.receivedOn}
              onChange={(value) => set("receivedOn", value)}
              aria-invalid={Boolean(errors.receivedOn)}
              aria-describedby={errorId}
            />
          )}
        </Field>
        <Field label="跟进阶段 *">
          {(id) => (
            <select
              id={id}
              value={form.stage}
              onChange={(event) => set("stage", event.target.value)}
              className={fieldClass}
            >
              {followUpStages.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="询盘来源 *" error={errors.source}>
          {(id, errorId) => (
            <input
              id={id}
              value={form.source}
              onChange={(event) => set("source", event.target.value)}
              aria-invalid={Boolean(errors.source)}
              aria-describedby={errorId}
              className={fieldClass}
            />
          )}
        </Field>
        <Field label="国家或地区 *" error={errors.country}>
          {(id, errorId) => (
            <input
              id={id}
              value={form.country}
              onChange={(event) => set("country", event.target.value)}
              aria-invalid={Boolean(errors.country)}
              aria-describedby={errorId}
              className={fieldClass}
            />
          )}
        </Field>
      </div>
      <Field
        label="意向产品 *"
        error={errors.products}
        hint="多个产品使用逗号、顿号或换行分隔；重复项会自动合并。"
      >
        {(id, errorId) => (
          <input
            id={id}
            value={form.products}
            onChange={(event) => set("products", event.target.value)}
            aria-invalid={Boolean(errors.products)}
            aria-describedby={errorId}
            className={fieldClass}
          />
        )}
      </Field>
      <Field label="询盘内容 *" error={errors.content}>
        {(id, errorId) => (
          <textarea
            id={id}
            rows={4}
            value={form.content}
            onChange={(event) => set("content", event.target.value)}
            aria-invalid={Boolean(errors.content)}
            aria-describedby={errorId}
            className={fieldClass}
          />
        )}
      </Field>
      <Actions
        saving={saving}
        committed={committed}
        submitLabel={inquiry ? "保存询盘" : "归档询盘"}
        onCancel={onCancel}
      />
    </form>
  );
}

function InquirySelect({
  id,
  value,
  inquiries,
  onChange,
}: {
  id: string;
  value: number | null;
  inquiries: InquiryRecord[];
  onChange: (value: number | null) => void;
}) {
  return (
    <select
      id={id}
      value={value ?? ""}
      onChange={(event) =>
        onChange(event.target.value ? Number(event.target.value) : null)
      }
      className={fieldClass}
    >
      <option value="">不关联询盘</option>
      {inquiries.map((inquiry) => (
        <option key={inquiry.id} value={inquiry.id}>
          {inquiry.receivedOn} · {inquiry.products.join("、")}
        </option>
      ))}
    </select>
  );
}

export function QuoteForm({
  customer,
  inquiries,
  quote,
  onSaved,
  onCancel,
}: {
  customer: CustomerRecord;
  inquiries: InquiryRecord[];
  quote?: QuoteRecord;
  onSaved: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    inquiryId: quote?.inquiryId ?? null,
    quotedOn: quote?.quotedOn ?? localDateValue(),
    content: quote?.content ?? "",
    amount: quote?.amount ?? "",
    currency: quote?.currency ?? "USD",
    notes: quote?.notes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const [committed, setCommitted] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (dateInputError(form.quotedOn))
      next.quotedOn = dateInputError(form.quotedOn);
    if (!form.content.trim()) next.content = "请输入产品或报价内容。";
    if (!/^\d+(\.\d{1,2})?$/.test(form.amount))
      next.amount = "请输入非负且最多两位小数的金额。";
    setErrors(next);
    if (Object.keys(next).length) {
      setServerError("请检查表单中标记的字段。已填写内容会保留。");
      return;
    }
    setSaving(true);
    setServerError("");
    await commitAndRefresh(
      () =>
        saveQuote({
          id: quote?.id ?? null,
          customerId: customer.id,
          ...form,
        }),
      onSaved,
      () => setCommitted(true),
      setServerError,
    );
    setSaving(false);
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setServerError("");
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={serverError} />
      <p className="text-xs leading-5 text-muted-foreground">
        商业报价发生修订时请新建记录；编辑只用于更正录入错误。
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="报价日期 *" error={errors.quotedOn}>
          {(id, errorId) => (
            <DateTimeField
              id={id}
              label="报价日期"
              required
              disabled={saving || committed}
              value={form.quotedOn}
              onChange={(value) => set("quotedOn", value)}
              aria-invalid={Boolean(errors.quotedOn)}
              aria-describedby={errorId}
            />
          )}
        </Field>
        <Field label="关联询盘">
          {(id) => (
            <InquirySelect
              id={id}
              value={form.inquiryId}
              inquiries={inquiries}
              onChange={(inquiryId) => set("inquiryId", inquiryId)}
            />
          )}
        </Field>
        <Field label="金额 *" error={errors.amount}>
          {(id, errorId) => (
            <input
              id={id}
              inputMode="decimal"
              value={form.amount}
              onChange={(event) => set("amount", event.target.value)}
              aria-invalid={Boolean(errors.amount)}
              aria-describedby={errorId}
              className={fieldClass}
            />
          )}
        </Field>
        <Field label="币种 *">
          {(id) => (
            <select
              id={id}
              value={form.currency}
              onChange={(event) => set("currency", event.target.value)}
              className={fieldClass}
            >
              {currencies.map((currency) => (
                <option key={currency}>{currency}</option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <Field label="产品或报价内容 *" error={errors.content}>
        {(id, errorId) => (
          <textarea
            id={id}
            rows={3}
            value={form.content}
            onChange={(event) => set("content", event.target.value)}
            aria-invalid={Boolean(errors.content)}
            aria-describedby={errorId}
            className={fieldClass}
          />
        )}
      </Field>
      <Field label="备注">
        {(id) => (
          <textarea
            id={id}
            rows={2}
            value={form.notes}
            onChange={(event) => set("notes", event.target.value)}
            className={fieldClass}
          />
        )}
      </Field>
      <Actions
        saving={saving}
        committed={committed}
        submitLabel={quote ? "保存报价" : "记录报价"}
        onCancel={onCancel}
      />
    </form>
  );
}

export function SampleForm({
  customer,
  inquiries,
  sample,
  onSaved,
  onCancel,
}: {
  customer: CustomerRecord;
  inquiries: InquiryRecord[];
  sample?: SampleRecord;
  onSaved: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    inquiryId: sample?.inquiryId ?? null,
    product: sample?.product ?? "",
    quantity: String(sample?.quantity ?? 1),
    requestedOn: sample?.requestedOn ?? localDateValue(),
    notes: sample?.notes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const [committed, setCommitted] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const quantity = Number(form.quantity);
    const next: Record<string, string> = {};
    if (!form.product.trim()) next.product = "请输入样品产品。";
    if (!Number.isInteger(quantity) || quantity <= 0)
      next.quantity = "请输入大于 0 的整数数量。";
    if (dateInputError(form.requestedOn))
      next.requestedOn = dateInputError(form.requestedOn);
    setErrors(next);
    if (Object.keys(next).length) {
      setServerError("请检查表单中标记的字段。已填写内容会保留。");
      return;
    }
    setSaving(true);
    setServerError("");
    await commitAndRefresh(
      () =>
        saveSample({
          id: sample?.id ?? null,
          customerId: customer.id,
          inquiryId: form.inquiryId,
          product: form.product,
          quantity,
          requestedOn: form.requestedOn,
          notes: form.notes,
        }),
      onSaved,
      () => setCommitted(true),
      setServerError,
    );
    setSaving(false);
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setServerError("");
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={serverError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="样品产品 *" error={errors.product}>
          {(id, errorId) => (
            <input
              id={id}
              value={form.product}
              onChange={(event) => set("product", event.target.value)}
              aria-invalid={Boolean(errors.product)}
              aria-describedby={errorId}
              className={fieldClass}
            />
          )}
        </Field>
        <Field label="数量 *" error={errors.quantity}>
          {(id, errorId) => (
            <input
              id={id}
              type="number"
              min="1"
              step="1"
              value={form.quantity}
              onChange={(event) => set("quantity", event.target.value)}
              aria-invalid={Boolean(errors.quantity)}
              aria-describedby={errorId}
              className={fieldClass}
            />
          )}
        </Field>
        <Field label="申请日期 *" error={errors.requestedOn}>
          {(id, errorId) => (
            <DateTimeField
              id={id}
              label="申请日期"
              required
              disabled={saving || committed}
              value={form.requestedOn}
              onChange={(value) => set("requestedOn", value)}
              aria-invalid={Boolean(errors.requestedOn)}
              aria-describedby={errorId}
            />
          )}
        </Field>
        <Field label="关联询盘">
          {(id) => (
            <InquirySelect
              id={id}
              value={form.inquiryId}
              inquiries={inquiries}
              onChange={(inquiryId) => set("inquiryId", inquiryId)}
            />
          )}
        </Field>
      </div>
      <Field label="备注">
        {(id) => (
          <textarea
            id={id}
            rows={3}
            value={form.notes}
            onChange={(event) => set("notes", event.target.value)}
            className={fieldClass}
          />
        )}
      </Field>
      <Actions
        saving={saving}
        committed={committed}
        submitLabel={sample ? "保存样品" : "创建样品"}
        onCancel={onCancel}
      />
    </form>
  );
}

export function TaskForm({
  customer,
  inquiries,
  task,
  onSaved,
  onCancel,
}: {
  customer: CustomerRecord;
  inquiries: InquiryRecord[];
  task?: FollowUpTaskRecord;
  onSaved: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const future = new Date(Date.now() + 60 * 60 * 1000);
  const [form, setForm] = useState({
    inquiryId: task?.inquiryId ?? null,
    dueAt: task?.dueAt ?? localDateTimeValue(future),
    content: task?.content ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const [committed, setCommitted] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (dateInputError(form.dueAt, true))
      next.dueAt = dateInputError(form.dueAt, true);
    if (!form.content.trim()) next.content = "请输入跟进内容。";
    setErrors(next);
    if (Object.keys(next).length) {
      setServerError("请检查表单中标记的字段。已填写内容会保留。");
      return;
    }
    setSaving(true);
    setServerError("");
    await commitAndRefresh(
      () =>
        saveFollowUpTask({
          id: task?.id ?? null,
          customerId: customer.id,
          ...form,
        }),
      onSaved,
      () => setCommitted(true),
      setServerError,
    );
    setSaving(false);
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setServerError("");
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={serverError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="跟进时间 *" error={errors.dueAt}>
          {(id, errorId) => (
            <DateTimeField
              id={id}
              label="跟进时间"
              required
              disabled={saving || committed}
              withTime
              value={form.dueAt}
              onChange={(value) => set("dueAt", value)}
              aria-invalid={Boolean(errors.dueAt)}
              aria-describedby={errorId}
            />
          )}
        </Field>
        <Field label="关联询盘">
          {(id) => (
            <InquirySelect
              id={id}
              value={form.inquiryId}
              inquiries={inquiries}
              onChange={(inquiryId) => set("inquiryId", inquiryId)}
            />
          )}
        </Field>
      </div>
      <Field label="跟进内容 *" error={errors.content}>
        {(id, errorId) => (
          <textarea
            id={id}
            rows={3}
            value={form.content}
            onChange={(event) => set("content", event.target.value)}
            aria-invalid={Boolean(errors.content)}
            aria-describedby={errorId}
            className={fieldClass}
          />
        )}
      </Field>
      <Actions
        saving={saving}
        committed={committed}
        submitLabel={task ? "保存改期" : "安排跟进"}
        onCancel={onCancel}
      />
    </form>
  );
}

export function SampleProgressForm({
  sample,
  onSaved,
}: {
  sample: SampleRecord;
  onSaved: () => Promise<void> | void;
}) {
  const [stage, setStage] = useState("");
  const [occurredOn, setOccurredOn] = useState(localDateValue());
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const [committed, setCommitted] = useState(false);
  const nextStages = sampleStages.filter(([value]) => {
    const transitions: Record<string, string[]> = {
      requested: ["preparing", "cancelled"],
      preparing: ["sent", "cancelled"],
      sent: ["received", "cancelled"],
      received: ["completed", "cancelled"],
    };
    return transitions[sample.currentStage]?.includes(value);
  });
  if (nextStages.length === 0) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!stage) next.stage = "请选择下一阶段。";
    if (dateInputError(occurredOn))
      next.occurredOn = dateInputError(occurredOn);
    setErrors(next);
    if (Object.keys(next).length) {
      setServerError("请检查表单中标记的字段。已填写内容会保留。");
      return;
    }
    setSaving(true);
    setServerError("");
    await commitAndRefresh(
      () =>
        appendSampleProgress({
          sampleId: sample.id,
          stage,
          occurredOn,
          notes,
        }),
      onSaved,
      () => setCommitted(true),
      setServerError,
    );
    setSaving(false);
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 space-y-3 rounded-md bg-muted/50 p-3"
    >
      <FormError message={serverError} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="下一阶段" error={errors.stage}>
          {(id, errorId) => (
            <select
              id={id}
              value={stage}
              onChange={(event) => {
                setStage(event.target.value);
                setErrors((current) => ({ ...current, stage: "" }));
                setServerError("");
              }}
              aria-invalid={Boolean(errors.stage)}
              aria-describedby={errorId}
              className={fieldClass}
            >
              <option value="">请选择</option>
              {nextStages.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="发生日期" error={errors.occurredOn}>
          {(id, errorId) => (
            <DateTimeField
              id={id}
              label="发生日期"
              required
              disabled={saving || committed}
              value={occurredOn}
              onChange={(value) => {
                setOccurredOn(value);
                setErrors((current) => ({ ...current, occurredOn: "" }));
                setServerError("");
              }}
              aria-invalid={Boolean(errors.occurredOn)}
              aria-describedby={errorId}
            />
          )}
        </Field>
      </div>
      <Field label="进度备注">
        {(id) => (
          <input
            id={id}
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              setServerError("");
            }}
            className={fieldClass}
          />
        )}
      </Field>
      <Button type="submit" size="sm" disabled={saving || committed}>
        {committed ? "已更新" : saving ? "更新中…" : "追加进度"}
      </Button>
    </form>
  );
}

export function ShipmentForm({
  sample,
  onSaved,
}: {
  sample: SampleRecord;
  onSaved: () => Promise<void> | void;
}) {
  const [carrier, setCarrier] = useState(sample.carrier);
  const [trackingNumber, setTrackingNumber] = useState(sample.trackingNumber);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const [committed, setCommitted] = useState(false);
  if (!["sent", "received", "completed"].includes(sample.currentStage))
    return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!carrier.trim()) next.carrier = "请输入物流承运方。";
    if (!trackingNumber.trim()) next.trackingNumber = "请输入物流单号。";
    setErrors(next);
    if (Object.keys(next).length) {
      setServerError("请检查表单中标记的字段。已填写内容会保留。");
      return;
    }
    setSaving(true);
    setServerError("");
    await commitAndRefresh(
      () =>
        updateSampleShipment({
          sampleId: sample.id,
          carrier,
          trackingNumber,
        }),
      onSaved,
      () => setCommitted(true),
      setServerError,
    );
    setSaving(false);
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-md border p-3">
      <p className="text-xs leading-5 text-muted-foreground">
        物流信息由你手动维护，不代表实时物流状态。
      </p>
      <FormError message={serverError} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="承运方" error={errors.carrier}>
          {(id, errorId) => (
            <input
              id={id}
              value={carrier}
              onChange={(event) => {
                setCarrier(event.target.value);
                setErrors((current) => ({ ...current, carrier: "" }));
                setServerError("");
              }}
              aria-invalid={Boolean(errors.carrier)}
              aria-describedby={errorId}
              className={fieldClass}
            />
          )}
        </Field>
        <Field label="物流单号" error={errors.trackingNumber}>
          {(id, errorId) => (
            <input
              id={id}
              value={trackingNumber}
              onChange={(event) => {
                setTrackingNumber(event.target.value);
                setErrors((current) => ({
                  ...current,
                  trackingNumber: "",
                }));
                setServerError("");
              }}
              aria-invalid={Boolean(errors.trackingNumber)}
              aria-describedby={errorId}
              className={fieldClass}
            />
          )}
        </Field>
      </div>
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={saving || committed}
      >
        {committed ? "已保存" : saving ? "保存中…" : "保存物流信息"}
      </Button>
    </form>
  );
}
