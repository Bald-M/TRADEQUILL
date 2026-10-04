import { SelectInput } from "./Shared";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currencies } from "@/lib/business";
import {
  leadTime,
  productText,
  saveOffer,
  saveProduct,
  saveSupplier,
  type CommerceSnapshot,
  type CommerceRoute,
  type Product,
  type ProductFields,
  type Supplier,
  type SupplierFields,
  type Offer,
  type OfferFields,
} from "@/lib/commerce";
import { ActionButton, Empty, Field, SaveForm, TextField } from "./Shared";

type Props = {
  snapshot: CommerceSnapshot;
  refresh: () => Promise<void>;
  navigate: (route: CommerceRoute) => void;
  selectedId?: number;
};
const blankProduct: ProductFields = {
  code: "",
  name: "",
  unit: "",
  parameters: [],
  moq: null,
  leadDaysMin: null,
  leadDaysMax: null,
  notes: "",
  archived: false,
};
const blankSupplier: SupplierFields = {
  name: "",
  contact: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
  archived: false,
};

export function ProductFieldsEditor({
  value,
  onChange,
}: {
  value: ProductFields;
  onChange: (value: ProductFields) => void;
}) {
  const set = <K extends keyof ProductFields>(key: K, next: ProductFields[K]) =>
    onChange({ ...value, [key]: next });
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <TextField
          label="产品编号 *"
          value={value.code}
          onChange={(v) => set("code", v)}
          required
        />
        <TextField
          label="产品名称 *"
          value={value.name}
          onChange={(v) => set("name", v)}
          required
        />
        <TextField
          label="计量单位 *"
          value={value.unit}
          onChange={(v) => set("unit", v)}
          required
        />
        <TextField
          label="MOQ"
          hint="最多 3 位小数；单位同上，未知留空"
          value={value.moq ?? ""}
          onChange={(v) => set("moq", v || null)}
        />
        <TextField
          label="最短交期（天）"
          hint="确认订单后；未知留空"
          type="number"
          value={value.leadDaysMin?.toString() ?? ""}
          onChange={(v) => set("leadDaysMin", v === "" ? null : Number(v))}
        />
        <TextField
          label="最长交期（天）"
          type="number"
          value={value.leadDaysMax?.toString() ?? ""}
          onChange={(v) => set("leadDaysMax", v === "" ? null : Number(v))}
        />
        <TextField
          label="交期含义"
          value={value.leadTimeNote ?? "确认订单后"}
          onChange={(v) => set("leadTimeNote", v)}
          hint="沿用产品的起算条件；本次报价可单独调整。"
        />
      </div>
      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium">规格参数</legend>
        {value.parameters.map((item, index) => (
          <div
            key={index}
            className="grid items-end gap-2 lg:grid-cols-[1fr_2fr_auto]"
          >
            <TextField
              label={`参数 ${index + 1} 名称`}
              value={item.name}
              onChange={(v) =>
                set(
                  "parameters",
                  value.parameters.map((p, i) =>
                    i === index ? { ...p, name: v } : p,
                  ),
                )
              }
              required
            />
            <TextField
              label={`参数 ${index + 1} 值`}
              value={item.value}
              onChange={(v) =>
                set(
                  "parameters",
                  value.parameters.map((p, i) =>
                    i === index ? { ...p, value: v } : p,
                  ),
                )
              }
              required
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                set(
                  "parameters",
                  value.parameters.filter((_, i) => i !== index),
                )
              }
            >
              移除参数 {index + 1}
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            set("parameters", [...value.parameters, { name: "", value: "" }])
          }
          disabled={value.parameters.length >= 30}
        >
          添加参数
        </Button>
      </fieldset>
    </>
  );
}
function ProductForm({
  product,
  refresh,
  done,
}: {
  product?: Product;
  refresh: () => Promise<void>;
  done: () => void;
}) {
  const [form, setForm] = useState<ProductFields>(product ?? blankProduct);
  return (
    <SaveForm
      save={() => saveProduct({ ...form, id: product?.id ?? null })}
      refresh={refresh}
      onDone={done}
      onCancel={done}
    >
      <ProductFieldsEditor value={form} onChange={setForm} />
      <TextField
        label="内部备注（不复制到客户资料）"
        value={form.notes}
        onChange={(notes) => setForm({ ...form, notes })}
        multiline
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.archived}
          onChange={(e) => setForm({ ...form, archived: e.target.checked })}
        />
        归档产品（新报价不再默认选用，可在此取消归档）
      </label>
    </SaveForm>
  );
}
export function Products({ snapshot, refresh, navigate, selectedId }: Props) {
  const [query, setQuery] = useState("");
  const [archived, setArchived] = useState(false);
  const [selected, setSelected] = useState<number | undefined>(selectedId);
  const [editing, setEditing] = useState<number | null | undefined>();
  const [offerEditing, setOfferEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const items = snapshot.products.filter(
    (p) =>
      (archived || !p.archived) &&
      `${p.code} ${p.name}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const product = snapshot.products.find((p) => p.id === selected);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-52 flex-1">
          <TextField
            label="搜索产品编号或名称"
            value={query}
            onChange={setQuery}
          />
        </div>
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          包含归档
        </label>
        <Button disabled={offerEditing} onClick={() => setEditing(null)}>
          新建产品
        </Button>
      </div>
      {editing !== undefined ? (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>{editing === null ? "新建产品" : "编辑产品"}</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductForm
              key={editing ?? "new"}
              product={snapshot.products.find((p) => p.id === editing)}
              refresh={refresh}
              done={() => setEditing(undefined)}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(200px,1fr)_2fr]">
            <div className="space-y-2">
              {items.length ? (
                items.map((p) => (
                  <button
                    key={p.id}
                    disabled={offerEditing}
                    onClick={() => {
                      setSelected(p.id);
                      setCopied(false);
                    }}
                    className={`w-full rounded-lg border p-4 text-left text-sm break-words focus-visible:ring-2 focus-visible:ring-ring ${p.id === selected ? "bg-accent" : "bg-card hover:bg-muted"}`}
                  >
                    <span className="font-medium">
                      {p.code} · {p.name}
                    </span>
                    <span className="mt-1 block text-muted-foreground">
                      {p.unit} {p.archived ? "· 已归档" : ""}
                    </span>
                  </button>
                ))
              ) : (
                <Empty>
                  {snapshot.products.length
                    ? "筛选无结果，请调整搜索或包含归档。"
                    : "还没有产品，请新建第一份产品档案。"}
                </Empty>
              )}
            </div>
            {product ? (
              <Card className="min-w-0 shadow-none">
                <CardHeader className="flex-row items-center justify-between gap-3">
                  <CardTitle className="break-words">{product.name}</CardTitle>
                  <Button
                    variant="outline"
                    disabled={offerEditing}
                    onClick={() => setEditing(product.id)}
                  >
                    编辑产品
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <pre className="font-sans text-sm leading-7 break-words whitespace-pre-wrap">
                    {productText(product)}
                  </pre>
                  <ActionButton
                    action={async () => {
                      await navigator.clipboard.writeText(productText(product));
                      setCopied(true);
                    }}
                  >
                    {copied ? "已复制资料" : "复制客户资料"}
                  </ActionButton>
                  {product.notes && (
                    <p className="text-sm whitespace-pre-wrap">
                      内部备注：{product.notes}
                    </p>
                  )}
                  <h3 className="font-medium">供货来源</h3>
                  <Offers
                    key={product.id}
                    onEditingChange={setOfferEditing}
                    snapshot={snapshot}
                    productId={product.id}
                    refresh={refresh}
                    navigate={navigate}
                  />
                </CardContent>
              </Card>
            ) : (
              <Empty>选择产品查看参数、MOQ、交期及供应商。</Empty>
            )}
          </div>
        </>
      )}
    </div>
  );
}
function SupplierForm({
  supplier,
  refresh,
  done,
}: {
  supplier?: Supplier;
  refresh: () => Promise<void>;
  done: () => void;
}) {
  const [form, setForm] = useState<SupplierFields>(supplier ?? blankSupplier);
  return (
    <SaveForm
      save={() => saveSupplier({ ...form, id: supplier?.id ?? null })}
      refresh={refresh}
      onDone={done}
      onCancel={done}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {(
          [
            ["name", "供应商名称 *"],
            ["contact", "主联系人"],
            ["email", "邮箱"],
            ["phone", "电话"],
            ["address", "地址"],
          ] as const
        ).map(([key, label]) => (
          <TextField
            key={key}
            label={label}
            value={form[key]}
            onChange={(v) => setForm({ ...form, [key]: v })}
            required={key === "name"}
          />
        ))}
      </div>
      <TextField
        label="供应商备注"
        value={form.notes}
        onChange={(notes) => setForm({ ...form, notes })}
        multiline
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.archived}
          onChange={(e) => setForm({ ...form, archived: e.target.checked })}
        />
        归档供应商（保留供货和交易历史）
      </label>
    </SaveForm>
  );
}
export function Suppliers({ snapshot, refresh, navigate, selectedId }: Props) {
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState(selectedId);
  const [editing, setEditing] = useState<number | null | undefined>();
  const [offerEditing, setOfferEditing] = useState(false);
  const supplier = snapshot.suppliers.find((s) => s.id === selected);
  const items = snapshot.suppliers.filter(
    (s) =>
      (showArchived || !s.archived) &&
      `${s.name} ${s.contact} ${s.email} ${s.phone}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-52 flex-1">
          <TextField
            label="搜索供应商及联系人"
            value={query}
            onChange={setQuery}
          />
        </div>
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          包含归档
        </label>
        <Button disabled={offerEditing} onClick={() => setEditing(null)}>
          新建供应商
        </Button>
      </div>
      {editing !== undefined ? (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>
              {editing === null ? "新建供应商" : "编辑供应商"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SupplierForm
              key={editing ?? "new"}
              supplier={snapshot.suppliers.find((s) => s.id === editing)}
              refresh={refresh}
              done={() => setEditing(undefined)}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(200px,1fr)_2fr]">
          <div className="space-y-2">
            {items.length ? (
              items.map((s) => (
                <button
                  key={s.id}
                  disabled={offerEditing}
                  onClick={() => setSelected(s.id)}
                  className={`w-full rounded-lg border p-4 text-left text-sm break-words focus-visible:ring-2 focus-visible:ring-ring ${selected === s.id ? "bg-accent" : "bg-card hover:bg-muted"}`}
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="mt-1 block text-muted-foreground">
                    {s.contact || "未填写联系人"} {s.archived ? "· 已归档" : ""}
                  </span>
                </button>
              ))
            ) : (
              <Empty>
                {snapshot.suppliers.length
                  ? "筛选无结果，请调整搜索或包含归档。"
                  : "尚无供应商，请新建供应商档案。"}
              </Empty>
            )}
          </div>
          {supplier ? (
            <Card className="min-w-0 shadow-none">
              <CardHeader className="flex-row items-center justify-between gap-3">
                <CardTitle>{supplier.name}</CardTitle>
                <Button
                  variant="outline"
                  disabled={offerEditing}
                  onClick={() => setEditing(supplier.id)}
                >
                  编辑供应商
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-7 break-words whitespace-pre-wrap">
                  {[
                    supplier.contact,
                    supplier.email,
                    supplier.phone,
                    supplier.address,
                    supplier.notes,
                  ]
                    .filter(Boolean)
                    .join("\n") || "尚未补充联系方式。"}
                </p>
                <h3 className="font-medium">供货产品</h3>
                <Offers
                  key={supplier.id}
                  onEditingChange={setOfferEditing}
                  snapshot={snapshot}
                  supplierId={supplier.id}
                  refresh={refresh}
                  navigate={navigate}
                />
              </CardContent>
            </Card>
          ) : (
            <Empty>选择供应商查看联系人和供货产品。</Empty>
          )}
        </div>
      )}
    </div>
  );
}
function Offers({
  onEditingChange,
  snapshot,
  productId,
  supplierId,
  refresh,
  navigate,
}: {
  onEditingChange: (editing: boolean) => void;
  snapshot: CommerceSnapshot;
  productId?: number;
  supplierId?: number;
  refresh: () => Promise<void>;
  navigate: Props["navigate"];
}) {
  const [editing, setEditing] = useState<number | null | undefined>();
  const edit = (id: number | null | undefined) => {
    setEditing(id);
    onEditingChange(id !== undefined);
  };
  const items = snapshot.offers.filter(
    (o) =>
      (!productId || o.productId === productId) &&
      (!supplierId || o.supplierId === supplierId),
  );
  return (
    <div className="space-y-3">
      {editing !== undefined && (
        <p role="status" className="text-sm text-muted-foreground">
          正在编辑供货资料；保存或取消后可切换档案。
        </p>
      )}
      {editing !== undefined ? (
        <OfferForm
          key={editing ?? "new"}
          offer={items.find((o) => o.id === editing)}
          snapshot={snapshot}
          productId={productId}
          supplierId={supplierId}
          refresh={refresh}
          done={() => edit(undefined)}
        />
      ) : (
        <>
          <Button variant="outline" onClick={() => edit(null)}>
            关联供货资料
          </Button>
          {items.length ? (
            items.map((offer) => (
              <article
                key={offer.id}
                className="space-y-3 rounded-lg border p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="link"
                    className="h-auto p-0 text-left break-words whitespace-normal"
                    onClick={() =>
                      navigate({
                        kind: productId ? "suppliers" : "products",
                        id: productId ? offer.supplierId : offer.productId,
                      })
                    }
                  >
                    {productId
                      ? snapshot.suppliers.find(
                          (s) => s.id === offer.supplierId,
                        )?.name
                      : snapshot.products.find((p) => p.id === offer.productId)
                          ?.name}
                  </Button>
                  <Badge variant="outline">
                    {offer.active ? "有效关联" : "已解除"}
                  </Badge>
                </div>
                <p>
                  参考单价：
                  {offer.price === null
                    ? "未知"
                    : `${offer.currency} ${offer.price}`}{" "}
                  · 报价日期：{offer.quotedOn ?? "未知"}
                </p>
                <p>
                  货号：{offer.supplierCode || "未填写"} · MOQ：
                  {offer.moq ?? "未知"}{" "}
                  {
                    snapshot.products.find((p) => p.id === offer.productId)
                      ?.unit
                  }
                </p>
                <p>交期：{leadTime(offer)}</p>
                {offer.notes && (
                  <p className="whitespace-pre-wrap">{offer.notes}</p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => edit(offer.id)}
                >
                  编辑供货条件
                </Button>
              </article>
            ))
          ) : (
            <Empty>没有供货关联。可为同一产品关联多家供应商。</Empty>
          )}
        </>
      )}
    </div>
  );
}
function OfferForm({
  offer,
  snapshot,
  productId,
  supplierId,
  refresh,
  done,
}: {
  offer?: Offer;
  snapshot: CommerceSnapshot;
  productId?: number;
  supplierId?: number;
  refresh: () => Promise<void>;
  done: () => void;
}) {
  const [form, setForm] = useState<OfferFields>(
    offer ?? {
      productId: productId ?? 0,
      supplierId: supplierId ?? 0,
      supplierCode: "",
      price: null,
      currency: "USD",
      quotedOn: null,
      moq: null,
      leadDaysMin: null,
      leadDaysMax: null,
      notes: "",
      active: true,
    },
  );
  return (
    <SaveForm
      save={() => saveOffer({ ...form, id: offer?.id ?? null })}
      refresh={refresh}
      onDone={done}
      onCancel={done}
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <Field label="产品 *">
          {(id) => (
            <SelectInput
              id={id}
              value={String(form.productId)}
              disabled={!!productId || !!offer}
              onValueChange={(value) =>
                setForm({ ...form, productId: Number(value) })
              }
              options={[
                { value: String(0), label: String("选择产品") },
                ...snapshot.products
                  .filter((p) => !p.archived || p.id === form.productId)
                  .map((p) => ({
                    value: String(p.id),
                    label: [p.code, "·", p.name].join(""),
                  })),
              ]}
            />
          )}
        </Field>
        <Field label="供应商 *">
          {(id) => (
            <SelectInput
              id={id}
              value={String(form.supplierId)}
              disabled={!!supplierId || !!offer}
              onValueChange={(value) =>
                setForm({ ...form, supplierId: Number(value) })
              }
              options={[
                { value: String(0), label: String("选择供应商") },
                ...snapshot.suppliers
                  .filter((s) => !s.archived || s.id === form.supplierId)
                  .map((s) => ({ value: String(s.id), label: String(s.name) })),
              ]}
            />
          )}
        </Field>
        <TextField
          label="供应商货号"
          value={form.supplierCode}
          onChange={(supplierCode) => setForm({ ...form, supplierCode })}
        />
        <TextField
          label="采购参考单价"
          hint="最多 4 位小数；未知留空"
          value={form.price ?? ""}
          onChange={(price) => setForm({ ...form, price: price || null })}
        />
        <Field label="参考价币种">
          {(id) => (
            <SelectInput
              id={id}
              value={String(form.currency)}
              onValueChange={(value) => setForm({ ...form, currency: value })}
              options={[
                ...currencies.map((c) => ({
                  value: String(String(c)),
                  label: String(c),
                })),
              ]}
            />
          )}
        </Field>
        <TextField
          label="参考报价日期"
          type="date"
          value={form.quotedOn ?? ""}
          onChange={(quotedOn) =>
            setForm({ ...form, quotedOn: quotedOn || null })
          }
          required={form.price !== null}
        />
        <TextField
          label="供货 MOQ"
          hint="最多 3 位小数，单位同产品"
          value={form.moq ?? ""}
          onChange={(moq) => setForm({ ...form, moq: moq || null })}
        />
        <TextField
          label="最短交期（天）"
          type="number"
          value={form.leadDaysMin?.toString() ?? ""}
          onChange={(v) =>
            setForm({ ...form, leadDaysMin: v === "" ? null : Number(v) })
          }
        />
        <TextField
          label="最长交期（天）"
          type="number"
          value={form.leadDaysMax?.toString() ?? ""}
          onChange={(v) =>
            setForm({ ...form, leadDaysMax: v === "" ? null : Number(v) })
          }
        />
      </div>
      <TextField
        label="供货备注"
        value={form.notes}
        onChange={(notes) => setForm({ ...form, notes })}
        multiline
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm({ ...form, active: e.target.checked })}
        />
        保留有效关联（取消勾选解除关联，保留历史）
      </label>
    </SaveForm>
  );
}
