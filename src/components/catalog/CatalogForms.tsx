import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/business/BusinessForms";
import {
  catalogError,
  previewKnowledgeImport,
  saveKnowledge,
  saveProduct,
  splitTags,
  type KnowledgeDetail,
  type KnowledgeInput,
  type KnowledgeKind,
  type KnowledgePreview,
  type ProductRecord,
} from "@/lib/catalog";

export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-5 text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function ErrorNotice({
  message,
  errors = {},
  prefix = "",
}: {
  message: string;
  errors?: Record<string, string>;
  prefix?: string;
}) {
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
      <p>{message}</p>
      {Object.keys(errors).length > 0 && (
        <ul className="mt-2 space-y-1">
          {Object.entries(errors)
            .filter(([, value]) => value)
            .map(([key, value]) => (
              <li key={key}>
                <a href={`#${prefix}-${key}`} className="underline">
                  {value}
                </a>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function FormActions({
  saving,
  parsing = false,
  committed,
  onCancel,
  label,
}: {
  saving: boolean;
  parsing?: boolean;
  committed: boolean;
  onCancel: () => void;
  label: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        取消会放弃本次未保存的输入。
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          {committed ? "关闭" : "取消"}
        </Button>
        <Button type="submit" disabled={saving || parsing || committed}>
          {committed
            ? "已保存"
            : saving
              ? "保存中…"
              : parsing
                ? "提取中…"
                : label}
        </Button>
      </div>
    </div>
  );
}

async function commitAndRefresh(
  mutation: () => Promise<void>,
  refresh: () => Promise<void>,
  committed: () => void,
  showError: (message: string) => void,
) {
  try {
    await mutation();
  } catch (error) {
    showError(catalogError(error));
    return;
  }
  committed();
  try {
    await refresh();
  } catch (error) {
    showError(
      `数据已保存，但界面刷新失败：${catalogError(error)}。请关闭表单并重试刷新，不要重复保存。`,
    );
  }
}

export function ProductForm({
  product,
  onSaved,
  onCancel,
}: {
  product?: ProductRecord;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const prefix = useId();
  const [form, setForm] = useState({
    sku: product?.sku ?? "",
    name: product?.name ?? "",
    unit: product?.unit ?? "",
    moq: product?.moq ?? "",
    leadTimeDays:
      product?.leadTimeDays === null || product?.leadTimeDays === undefined
        ? ""
        : String(product.leadTimeDays),
    leadTimeNote: product?.leadTimeNote ?? "",
    parameters:
      product?.parameters.map((parameter) => ({ ...parameter })) ?? [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [committed, setCommitted] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setError("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || committed) return;
    const next: Record<string, string> = {};
    if (!form.sku.trim()) next.sku = "请输入唯一的产品编号。";
    if (!form.name.trim()) next.name = "请输入产品名称。";
    if (!form.unit.trim()) next.unit = "请输入计量单位。";
    if (
      form.moq &&
      (!/^\d+(\.\d{1,3})?$/.test(form.moq) || Number(form.moq) <= 0)
    )
      next.moq = "MOQ 需大于 0，最多三位小数；未知请留空。";
    if (
      form.leadTimeDays &&
      (!/^\d+$/.test(form.leadTimeDays) ||
        !Number.isSafeInteger(Number(form.leadTimeDays)) ||
        Number(form.leadTimeDays) <= 0)
    )
      next.leadTimeDays = "交期需为正整数天数；未知请留空。";
    if (form.leadTimeDays && !form.leadTimeNote.trim())
      next.leadTimeNote = "请说明交期起点和含义，例如收到订金后至发货。";
    if (
      form.parameters.some(({ name, value }) => !name.trim() || !value.trim())
    )
      next.parameters = "每项参数都需填写名称和值，空行可移除。";
    setErrors(next);
    if (Object.keys(next).length) {
      setError("请检查标记的字段。已填写内容会保留。");
      return;
    }
    setSaving(true);
    setError("");
    await commitAndRefresh(
      () =>
        saveProduct({
          id: product?.id ?? null,
          sku: form.sku,
          name: form.name,
          unit: form.unit,
          parameters: form.parameters,
          moq: form.moq || null,
          leadTimeDays: form.leadTimeDays ? Number(form.leadTimeDays) : null,
          leadTimeNote: form.leadTimeNote,
        }),
      onSaved,
      () => setCommitted(true),
      setError,
    );
    setSaving(false);
  }

  const input = (
    key: "sku" | "name" | "unit" | "moq" | "leadTimeDays" | "leadTimeNote",
    label: string,
    hint?: string,
  ) => {
    const id = `${prefix}-${key}`;
    return (
      <Field id={id} label={label} hint={hint} error={errors[key]}>
        <input
          id={id}
          value={form[key]}
          onChange={(event) => set(key, event.target.value)}
          inputMode={
            key === "moq"
              ? "decimal"
              : key === "leadTimeDays"
                ? "numeric"
                : undefined
          }
          aria-invalid={Boolean(errors[key])}
          aria-describedby={errors[key] ? `${id}-error` : undefined}
          className={fieldClass}
        />
      </Field>
    );
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <ErrorNotice message={error} errors={errors} prefix={prefix} />
      <fieldset disabled={saving || committed} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {input("sku", "产品编号 *", "每个型号或变体使用独立编号。")}
          {input("name", "产品名称 *")}
          {input("unit", "计量单位 *", "例如件、套、千克；MOQ 沿用此单位。")}
          {input("moq", "MOQ", "最多三位小数；未知留空，不能用 0 代替。")}
          {input("leadTimeDays", "交期（天）", "正整数；未知留空。")}
          {input(
            "leadTimeNote",
            "交期含义",
            "例如收到订金后至发货；填写天数时必填。",
          )}
        </div>
        <fieldset
          id={`${prefix}-parameters`}
          className="space-y-3"
          tabIndex={-1}
        >
          <legend className="mb-2 text-sm font-medium">规格参数</legend>
          {form.parameters.map((parameter, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <Field
                id={`${prefix}-parameter-${index}-name`}
                label={`参数 ${index + 1} 名称`}
              >
                <input
                  id={`${prefix}-parameter-${index}-name`}
                  value={parameter.name}
                  onChange={(event) =>
                    set(
                      "parameters",
                      form.parameters.map((item, at) =>
                        at === index
                          ? { ...item, name: event.target.value }
                          : item,
                      ),
                    )
                  }
                  className={fieldClass}
                />
              </Field>
              <Field
                id={`${prefix}-parameter-${index}-value`}
                label={`参数 ${index + 1} 值`}
              >
                <input
                  id={`${prefix}-parameter-${index}-value`}
                  value={parameter.value}
                  onChange={(event) =>
                    set(
                      "parameters",
                      form.parameters.map((item, at) =>
                        at === index
                          ? { ...item, value: event.target.value }
                          : item,
                      ),
                    )
                  }
                  className={fieldClass}
                />
              </Field>
              <Button
                type="button"
                variant="outline"
                className="self-end"
                aria-label={`移除参数 ${index + 1}`}
                onClick={() =>
                  set(
                    "parameters",
                    form.parameters.filter((_, at) => at !== index),
                  )
                }
              >
                移除
              </Button>
            </div>
          ))}
          {errors.parameters && (
            <p className="text-sm text-destructive">{errors.parameters}</p>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              set("parameters", [...form.parameters, { name: "", value: "" }])
            }
          >
            添加参数
          </Button>
        </fieldset>
      </fieldset>
      <FormActions
        saving={saving}
        committed={committed}
        onCancel={onCancel}
        label={product ? "保存产品" : "创建产品"}
      />
    </form>
  );
}

export function KnowledgeForm({
  detail,
  products,
  onSaved,
  onCancel,
}: {
  detail?: KnowledgeDetail;
  products: ProductRecord[];
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const prefix = useId();
  const document = detail?.document;
  const [form, setForm] = useState({
    title: document?.title ?? "",
    productId: document?.productId ?? null,
    tags: document?.tags.join("、") ?? "",
    source: document?.source ?? "",
    kind: document?.kind ?? ("text" as KnowledgeKind),
    status: document?.status ?? ("draft" as KnowledgeInput["status"]),
    visibility:
      document?.visibility ?? ("internal" as KnowledgeInput["visibility"]),
    conflictNote: document?.conflictNote ?? "",
    text: detail?.pages.map((page) => page.text).join("\n\n") ?? "",
  });
  const [preview, setPreview] = useState<KnowledgePreview | null>(null);
  const [previewConfirmed, setPreviewConfirmed] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [committed, setCommitted] = useState(false);
  const parsingGeneration = useRef(0);
  useEffect(
    () => () => {
      parsingGeneration.current += 1;
    },
    [],
  );

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setError("");
  }

  async function importFile(file: File | undefined) {
    const generation = ++parsingGeneration.current;
    setPreview(null);
    setPreviewConfirmed(false);
    setErrors((current) => ({ ...current, file: "" }));
    setError("");
    if (!file) {
      setParsing(false);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((current) => ({
        ...current,
        file: "文件超过 5 MiB 上限。请选择较小的文件。",
      }));
      setParsing(false);
      return;
    }
    if (!/\.(txt|md|pdf)$/i.test(file.name)) {
      setErrors((current) => ({
        ...current,
        file: "只支持 TXT、Markdown 和含文本的 PDF。",
      }));
      setParsing(false);
      return;
    }
    setParsing(true);
    try {
      const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
      if (generation !== parsingGeneration.current) return;
      const next = await previewKnowledgeImport(file.name, bytes);
      if (generation !== parsingGeneration.current) return;
      setPreview(next);
      setForm((current) => ({
        ...current,
        title: current.title || file.name,
        source: current.source || file.name,
      }));
    } catch (failure) {
      if (generation === parsingGeneration.current)
        setError(
          `提取失败：${catalogError(failure).replace(/[。.!]+$/, "")}。既有资料不会改变。`,
        );
    } finally {
      if (generation === parsingGeneration.current) setParsing(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || committed || parsing) return;
    const next: Record<string, string> = {};
    if (!form.title.trim()) next.title = "请输入资料标题。";
    if (!form.source.trim())
      next.source = "请输入来源，例如产品手册及发布日期。";
    if (form.kind !== "file" && !form.text.trim())
      next.text = "请输入资料正文。";
    if (form.kind === "file" && !preview && !document)
      next.file = "请选择文件并查看提取预览。";
    if (preview && !previewConfirmed)
      next.file = "请核对提取预览后确认；扫描 PDF 请先提供可提取文本。";
    setErrors(next);
    if (Object.keys(next).length) {
      setError("请检查标记的字段。已填写内容会保留。");
      return;
    }
    setSaving(true);
    setError("");
    await commitAndRefresh(
      () =>
        saveKnowledge({
          id: document?.id ?? null,
          expectedVersion: document?.version ?? null,
          title: form.title,
          productId: form.productId,
          tags: splitTags(form.tags),
          source: form.source,
          kind: form.kind,
          status: form.status,
          visibility: form.visibility,
          conflictNote: form.conflictNote,
          text: form.kind === "file" ? "" : form.text,
          previewToken: preview?.token ?? null,
        }),
      onSaved,
      () => setCommitted(true),
      setError,
    );
    setSaving(false);
  }

  function plainInput(
    key: "title" | "source" | "tags" | "conflictNote",
    label: string,
    hint?: string,
  ) {
    const id = `${prefix}-${key}`;
    return (
      <Field id={id} label={label} error={errors[key]} hint={hint}>
        <input
          id={id}
          value={form[key]}
          onChange={(event) => set(key, event.target.value)}
          aria-invalid={Boolean(errors[key])}
          aria-describedby={errors[key] ? `${id}-error` : undefined}
          className={fieldClass}
        />
      </Field>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <ErrorNotice message={error} errors={errors} prefix={prefix} />
      {document && (
        <p className="text-xs leading-5 text-muted-foreground">
          基于版本 {document.version}{" "}
          更正；保存会建立新版本。版本冲突时保留输入，请先关闭表单查看现行版本再核对。
        </p>
      )}
      <fieldset disabled={saving || committed} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {plainInput("title", "资料标题 *")}
          <Field id={`${prefix}-productId`} label="关联产品">
            <select
              id={`${prefix}-productId`}
              value={form.productId ?? ""}
              onChange={(event) =>
                set(
                  "productId",
                  event.target.value ? Number(event.target.value) : null,
                )
              }
              className={fieldClass}
            >
              <option value="">通用资料</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} · {product.name}
                  {product.archived ? "（已归档）" : ""}
                </option>
              ))}
            </select>
          </Field>
          {plainInput(
            "source",
            "资料来源 *",
            "记录来源名称、版本或日期；网址按文本保存。",
          )}
          {plainInput("tags", "标签", "用逗号或顿号分隔，例如材质、保养。")}
          <Field id={`${prefix}-kind`} label="资料类型">
            <select
              id={`${prefix}-kind`}
              value={form.kind}
              disabled={Boolean(document)}
              onChange={(event) => {
                set("kind", event.target.value as KnowledgeKind);
                parsingGeneration.current += 1;
                setParsing(false);
                setPreview(null);
                setPreviewConfirmed(false);
              }}
              className={fieldClass}
            >
              <option value="text">文本条目</option>
              <option value="faq">FAQ（问答）</option>
              <option value="file">文件导入</option>
            </select>
          </Field>
          <Field
            id={`${prefix}-status`}
            label="确认状态"
            hint="确认表示你已核对资料；草稿不会作为默认 AI 依据。"
          >
            <select
              id={`${prefix}-status`}
              value={form.status}
              onChange={(event) =>
                set("status", event.target.value as KnowledgeInput["status"])
              }
              className={fieldClass}
            >
              <option value="draft">草稿</option>
              <option value="confirmed">已确认</option>
            </select>
          </Field>
          <Field
            id={`${prefix}-visibility`}
            label="使用范围"
            hint="仅内部资料不能作为默认对外回答依据。"
          >
            <select
              id={`${prefix}-visibility`}
              value={form.visibility}
              onChange={(event) =>
                set(
                  "visibility",
                  event.target.value as KnowledgeInput["visibility"],
                )
              }
              className={fieldClass}
            >
              <option value="internal">仅内部</option>
              <option value="public">对外可用</option>
            </select>
          </Field>
          {plainInput(
            "conflictNote",
            "资料冲突或待核实说明",
            "与其他资料或产品字段不一致时记录问题，由你核对，不自动改写产品。",
          )}
        </div>
        {form.kind === "file" ? (
          <div className="space-y-3">
            <Field
              id={`${prefix}-file`}
              label={document ? "替换文件（可选）" : "选择文件 *"}
              error={errors.file}
              hint="支持 TXT、Markdown、含文本的 PDF；单文件最多 5 MiB、100 页，资料库最多 100 条。含历史版本和提取预览的总容量最多 500 MiB，超限需主动删除资料；提取完成不会自动保存。"
            >
              <input
                id={`${prefix}-file`}
                type="file"
                accept=".txt,.md,.pdf"
                onChange={(event) => {
                  void importFile(event.target.files?.[0]);
                }}
                className={fieldClass}
                aria-invalid={Boolean(errors.file)}
                aria-describedby={
                  errors.file ? `${prefix}-file-error` : undefined
                }
              />
            </Field>
            {document && !preview && (
              <p className="text-sm text-muted-foreground">
                保留现有文件：{document.fileName}。提取失败不会替换既有版本。
              </p>
            )}
            {parsing && (
              <p role="status" className="text-sm">
                正在本地提取资料…
              </p>
            )}
            {preview && (
              <div className="space-y-3 rounded-md border p-4">
                <h3 className="font-medium">提取预览 · {preview.fileName}</h3>
                <div className="max-h-72 space-y-4 overflow-auto">
                  {preview.pages.map((page) => (
                    <section key={page.page}>
                      <h4 className="mb-1 text-xs font-medium text-muted-foreground">
                        第 {page.page} 页
                      </h4>
                      <p className="whitespace-pre-wrap break-words text-sm leading-6">
                        {page.text}
                      </p>
                    </section>
                  ))}
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={previewConfirmed}
                    onChange={(event) =>
                      setPreviewConfirmed(event.target.checked)
                    }
                    className="mt-1 accent-primary"
                  />
                  我已核对提取内容，确认将其保存到本地资料库
                </label>
              </div>
            )}
          </div>
        ) : (
          <Field
            id={`${prefix}-text`}
            label={form.kind === "faq" ? "问题与回答 *" : "资料正文 *"}
            error={errors.text}
            hint={
              form.kind === "faq"
                ? "请明确写出问题和回答；未知事实请注明未知。"
                : "正文只按文本保存和显示。"
            }
          >
            <textarea
              id={`${prefix}-text`}
              rows={8}
              value={form.text}
              onChange={(event) => set("text", event.target.value)}
              className={fieldClass}
              aria-invalid={Boolean(errors.text)}
              aria-describedby={
                errors.text ? `${prefix}-text-error` : undefined
              }
            />
          </Field>
        )}
      </fieldset>
      <FormActions
        saving={saving}
        parsing={parsing}
        committed={committed}
        onCancel={onCancel}
        label={document ? "保存新版本" : "保存资料"}
      />
    </form>
  );
}
